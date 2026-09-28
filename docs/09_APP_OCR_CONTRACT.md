# App OCR contract — Native ML Kit → MediCare backend

Tài liệu này là biên giới tích hợp giữa research pipeline và app MediCare hiện tại. App production và research pipeline **không dùng chung toàn bộ schema nội bộ**; research giữ các entity, relation, confidence và drug-linking riêng. Chỉ lớp adapter được phép chuyển kết quả research sang contract app.

Không sửa source app trong tài liệu này. Các nhận định dưới đây được đối chiếu từ các file app đã cung cấp.

## 1. Luồng production hiện tại

```text
Native ML Kit rawText
  → POST /api/v1/ocr/parse
  → ParsedMedicationDto[]
  → User review
  → User chọn/nhập timeSlots
  → POST /api/v1/health-profiles/{profileId}/medications
  → Medication entity → MedicationLog / reminder schedule
```

### Request OCR — app contract hiện tại

```http
POST /api/v1/ocr/parse
X-Idempotency-Key: <unique-key>
Content-Type: application/json
```

```json
{
  "rawText": "...nội dung OCR...",
  "consentGiven": true
}
```

Backend app đã xử lý consent, xác thực, quota và idempotency. Research pipeline chỉ nhận dữ liệu ở lớp adapter; không tự giả định rằng `rawText` đã có consent hoặc được phép lưu trữ.

### AI provider contract hiện tại

AI endpoint nội bộ dùng schema `ocr.medication.v1` với các trường chính:

```text
name, strength, form, dose_instruction, frequency,
duration_days, total_quantity, route, confidence, warnings
```

Provider được yêu cầu không suy diễn strength/dose/route/duration còn thiếu và luôn yêu cầu user xác nhận. Backend `ProviderOcrServiceImpl` chuyển payload này thành `ParsedMedicationDto`.

## 2. Hai contract cần phân biệt

### A. `ParsedMedicationDto` — kết quả OCR hiện tại

Các trường hiện có trong app:

```text
medicineName
totalQuantity
unit
dosage
frequency
frequencySource
frequencyRequiresReview
timesPerDay
durationDays
notes
```

`ParsedMedicationDto` hiện **chưa có** `timeSlots`, `doseQuantity` hoặc `doseUnit`.

### B. `CreateMedicationRequest` — request tạo lịch

Các trường app backend nhận:

```text
medicineName
dosage
doseQuantity
doseUnit
frequency
timesPerDay
timeSlots
startDate
endDate
notes
```

Vì vậy `ParsedMedicationDto` không thể được dùng trực tiếp như request tạo lịch. Sau khi user xác nhận, app phải tạo một request schedule riêng và bổ sung `timeSlots`.

## 3. Mapping research → app

| Research output | App field | Quy tắc |
|---|---|---|
| linked drug name + strength | `medicineName` | Chỉ dùng normalized name khi linking đủ tin cậy; nếu chưa, giữ raw/candidate và review |
| extracted dose | `dosage` | Giữ nguyên biểu diễn trên đơn, ví dụ `1 viên/lần` |
| normalized frequency | `frequency` | Chỉ gửi enum app hỗ trợ và đã validate |
| raw frequency text | `frequencySource` hoặc `notes` | Không được làm mất bằng chứng OCR |
| frequency confidence/ambiguity | `frequencyRequiresReview` | `true` nếu không map an toàn |
| extracted count | `timesPerDay` | Không tự suy ra nếu câu chữ không đủ rõ |
| explicit prescribed time | `timeSlots` ở schedule request | Chỉ truyền khi có bằng chứng rõ ràng |
| user-selected reminder time | `timeSlots` ở schedule request | Là lịch nhắc của user, không phải chỉ định nguyên văn |
| dose quantity/unit | `doseQuantity`, `doseUnit` | Chỉ map khi model trích xuất đủ chắc chắn |
| `totalQuantity` | OCR/display only | Entity `Medication` hiện chưa có số lượng cấp phát tương ứng |
| duration | `durationDays`, rồi tính `endDate` | Phải hiểu là số ngày bao gồm ngày bắt đầu |

Research `Verified Medication Plan` vẫn giữ schema riêng tại `schemas/medication_plan.schema.json`. Adapter app nằm tại `src/integration/app-ocr-contract.mjs` và không thay thế schema nghiên cứu.

## 4. Frequency contract

Enum được khai báo trong app gồm:

```text
ONCE_DAILY
TWICE_DAILY
THREE_TIMES_DAILY
WEEKLY
DAILY
EVERY_OTHER_DAY
SPECIFIC_DAYS
AS_NEEDED
CUSTOM
```

Nhưng service tạo lịch hiện chỉ xử lý đầy đủ nhóm:

```text
ONCE_DAILY
TWICE_DAILY
THREE_TIMES_DAILY
DAILY
WEEKLY
EVERY_OTHER_DAY
AS_NEEDED
```

`SPECIFIC_DAYS` và `CUSTOM` hiện bị từ chối khi tạo lịch vì chưa có scheduling contract đầy đủ.

### Quy tắc an toàn cho research adapter

- Không chuyển frequency không rõ sang `DAILY`.
- Không biến frequency không rõ thành lịch có giờ mặc định.
- Nếu không map được, giữ `frequencyRequiresReview=true` và không cho đi thẳng vào create schedule.
- Adapter hiện trả frequency chưa nhận diện là `null` để tránh tạo lịch sai. App hiện có fallback UI `null → CUSTOM`; fallback này phải được coi là trạng thái cần review, vì backend service không cho lưu `CUSTOM`.
- Giữ `frequencySource` nguyên văn để user kiểm tra.

## 5. Time slots và verification gate

Backend tạo medication yêu cầu:

- `medicineName`, `frequency`, `startDate`.
- Với frequency khác `AS_NEEDED`, `timeSlots` phải có ít nhất một giờ.
- `timesPerDay` phải bằng số lượng `timeSlots`.
- `ONCE_DAILY`, `TWICE_DAILY`, `THREE_TIMES_DAILY` phải khớp lần lượt 1, 2, 3 giờ.
- Giờ phải có định dạng `HH:mm` và không trùng.
- `endDate` không được trước `startDate`.

Do đó trạng thái an toàn phải là:

```text
OCR extraction
  → frequency/time evidence review
  → user chọn timeSlots nếu đơn không ghi giờ
  → validate CreateMedicationRequest
  → tạo lịch
```

Nếu đơn chỉ ghi “sáng/tối”, research model trả:

```json
{
  "frequency": "TWICE_DAILY",
  "frequencySource": "sáng/tối",
  "frequencyRequiresReview": true,
  "timesPerDay": 2,
  "timeSlots": null
}
```

Model không được tự đặt `08:00` và `20:00`. Các giờ đó chỉ xuất hiện sau khi user chọn hoặc khi đơn ghi giờ cụ thể.

## 6. Duration và lỗi lệch một ngày

App RN hiện tính `endDate` bằng cách cộng trực tiếp `durationDays` vào `startDate`. Nếu `durationDays = 15` và `startDate = 2026-09-28`, cách này cho `2026-10-13`, trong khi cách hiểu bao gồm ngày bắt đầu là `2026-10-12`.

Contract nghiên cứu thống nhất:

```text
endDate = startDate + durationDays - 1 ngày
```

Ví dụ:

```text
1 ngày  → startDate
15 ngày → 2026-09-28 đến 2026-10-12
```

Research adapter có hàm kiểm tra tại `src/integration/app-ocr-contract.mjs`; việc sửa RN/backend thật sự để áp dụng quy tắc này thuộc repo app, không thực hiện trong repo nghiên cứu theo phạm vi hiện tại.

## 7. Các điểm lệch đã xác nhận

| Mức | Điểm lệch | Ý nghĩa |
|---|---|---|
| Blocking | `ParsedMedicationDto` và RN OCR type chưa có `timeSlots`, nhưng create service bắt buộc với thuốc theo giờ | Luồng OCR save có thể fail validation hoặc không thể tạo lịch đúng |
| High | Unknown frequency được backend/UI đưa về `CUSTOM`, nhưng service từ chối `CUSTOM` | Không được coi `CUSTOM` là fallback có thể lưu |
| High | RN cộng trực tiếp `durationDays` vào start date | Có thể tạo lịch dư một ngày |
| Medium | `doseQuantity/doseUnit` có ở create/entity nhưng chưa có trong OCR DTO và RN save | Không truyền được liều định lượng vào lịch/kho thuốc |
| Medium | `totalQuantity/unit` có ở OCR nhưng không có trong `Medication` | Chỉ dùng cho hiển thị/extraction, chưa phải số lượng cấp phát được lưu |
| Low | AI provider cho `duration_days >= 0`, trong khi duration thực tế nên là số ngày dương | Adapter research chỉ chấp nhận duration dương khi dùng để lập lịch |

Đây là các điểm cần theo dõi để app team xử lý sau; research team không tự sửa chúng trong repo app.

## 8. Nguyên tắc phát triển song song

1. Research giữ pipeline OCR noise-aware, entity extraction, relation extraction, drug linking, confidence và verified plan riêng.
2. App integration chỉ dùng adapter projection, không lấy trực tiếp entity/relation nội bộ của research.
3. Model trả bằng chứng và trường extraction; backend normalize enum và validate; user xác nhận các trường critical và `timeSlots`.
4. Không dùng reminder time để ghi đè `prescribed_frequency` hoặc `frequencySource`.
5. Khi contract app thay đổi, cập nhật mapping table và test adapter trước khi đổi model output.
6. Không upload raw prescription lên môi trường cloud benchmark nếu chưa có quyền và consent phù hợp.

## 9. Files tham chiếu app

Các file đã dùng để đối chiếu contract:

- Backend OCR: `OcrController.java`, `ParseOcrRequest.java`, `ParsedMedicationDto.java`, `ProviderOcrServiceImpl.java`.
- AI/OCR: `ocr.py`, `ocr_schemas.py`.
- Tạo lịch: `CreateMedicationRequest.java`, `MedicationServiceImpl.java`, `Medication.java`, `MedicationFrequency.java`.
- RN: `ocr.ts`, `medication.ts`, `OcrScreen.tsx`.

Các file trên thuộc repo app `D:\DoAn1\MediCare`; repo research chỉ lưu bản mapping và adapter, không sao chép hay chỉnh sửa source app.

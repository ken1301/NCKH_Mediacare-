# App OCR contract — Native ML Kit → MediCare backend

Tài liệu này nối research pipeline của MediCare với luồng app hiện tại. Native ML Kit có thể tạo `rawText`, nhưng backend/model phải trả extraction có cấu trúc để app hiển thị cho người dùng xác nhận trước khi tạo lịch.

## Luồng hiện tại

```text
Native ML Kit rawText
  → POST /api/v1/ocr/parse
  → ParsedMedicationDto
  → User review / chọn giờ
  → POST /api/v1/health-profiles/{profileId}/medications
  → MedicationLog / reminder schedule
```

Request OCR hiện tại:

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

Idempotency và `consentGiven` là trách nhiệm của application backend. Research pipeline không tự giả định rằng rawText đã được consent hoặc đã được phép lưu trữ.

## ParsedMedicationDto chuẩn hóa

Model nên trả extraction đầy đủ khi có bằng chứng; backend chịu trách nhiệm normalize enum, kiểm tra kiểu dữ liệu và gắn cờ review.

```json
{
  "medicineName": "Paracetamol 500mg",
  "totalQuantity": 30,
  "unit": "Viên",
  "dosage": "1 viên/lần",
  "frequency": "TWICE_DAILY",
  "frequencySource": "Uống ngày 2 lần",
  "frequencyRequiresReview": false,
  "timesPerDay": 2,
  "timeSlots": ["08:00", "20:00"],
  "doseQuantity": 1,
  "doseUnit": "TABLET",
  "durationDays": 15,
  "notes": "Uống sau khi ăn"
}
```

Nếu đơn chỉ ghi “sáng/tối”, model không được tự gán `08:00` và `20:00`:

```json
{
  "frequency": "TWICE_DAILY",
  "frequencySource": "sáng/tối",
  "frequencyRequiresReview": true,
  "timesPerDay": 2,
  "timeSlots": null
}
```

`timeSlots` chỉ chứa giờ có bằng chứng rõ ràng hoặc giờ do người dùng chọn. Không biến giờ nhắc do người dùng chọn thành chỉ định của bác sĩ.

## Enum frequency

Backend chỉ chấp nhận sau normalize:

```text
ONCE_DAILY
TWICE_DAILY
THREE_TIMES_DAILY
DAILY
WEEKLY
EVERY_OTHER_DAY
AS_NEEDED
```

`CUSTOM` và `SPECIFIC_DAYS` chưa thuộc contract triển khai hiện tại; phải trả lỗi rõ ràng hoặc đưa vào review, không silently fallback sang `DAILY`.

## Contract tạo lịch

```json
{
  "medicineName": "Paracetamol 500mg",
  "dosage": "1 viên/lần",
  "frequency": "TWICE_DAILY",
  "timesPerDay": 2,
  "timeSlots": ["08:00", "20:00"],
  "startDate": "2026-09-28",
  "endDate": "2026-10-12",
  "notes": "Uống sau khi ăn"
}
```

Validation bắt buộc:

- `medicineName`, `frequency`, `startDate` bắt buộc.
- Với frequency khác `AS_NEEDED`, `timeSlots` bắt buộc.
- `timesPerDay` phải bằng số phần tử `timeSlots`.
- `TWICE_DAILY` phải có đúng hai giờ.
- Mọi giờ phải có dạng `HH:mm`.
- `endDate` không được trước `startDate`.
- `durationDays` được hiểu là số ngày **bao gồm ngày bắt đầu**. Vì vậy `startDate + 1 ngày` có `endDate = startDate`; không dùng phép cộng trực tiếp `durationDays` nếu muốn tránh dư một ngày.

Adapter kiểm tra contract nằm tại `src/integration/app-ocr-contract.mjs`, với test tại `test/app-ocr-contract.test.mjs`.

## Lưu ý dữ liệu

`totalQuantity` hiện là thông tin hiển thị/extraction. Nếu entity lịch thuốc chưa có field số lượng cấp phát, không được giả định rằng backend đã lưu hoặc dùng nó để tính lịch.

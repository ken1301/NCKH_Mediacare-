# Bước 1 — Phạm vi và thiết kế nền tảng

> Trạng thái: Đã chốt cho phiên bản nghiên cứu đầu tiên  
> Ngày: 2026-09-27  
> Dự án: NCKH MediCare

## 1. Quyết định trung tâm

MediCare tập trung vào bài toán **Vietnamese Prescription Understanding**:

```text
Ảnh đơn thuốc Việt Nam
→ OCR có tọa độ
→ Trích xuất thực thể thuốc
→ Trích xuất quan hệ thuốc–hướng dẫn
→ Chuẩn hóa/liên kết thuốc
→ Độ tin cậy và xác nhận người dùng
→ Kế hoạch dùng thuốc có cấu trúc
```

Sản phẩm nghiên cứu không được định nghĩa là “ứng dụng OCR đơn thuốc”. Kết quả cần chứng minh là thông tin của từng thuốc được nhận diện, gán đúng, chuẩn hóa và kiểm chứng.

## 2. Phạm vi phiên bản 1

### Bao gồm

- Đơn thuốc Việt Nam dạng in hoặc bán cấu trúc.
- Ảnh chụp bằng điện thoại hoặc ảnh tải lên.
- Một hoặc nhiều thuốc trên cùng đơn.
- Các trường: tên thuốc, hoạt chất, hàm lượng, liều, dạng thuốc, đường dùng, tần suất, thời gian, thời điểm và hướng dẫn.
- Lỗi OCR phổ biến về ký tự, dấu tiếng Việt, chữ số và đơn vị.
- Liên kết thông tin hướng dẫn với đúng thuốc.
- Chuẩn hóa tên thuốc bằng nhiều thuộc tính và drug database.
- Xác nhận thủ công đối với trường có độ tin cậy thấp.

### Không bao gồm trong phiên bản 1

- Đơn viết tay hoàn toàn.
- Tự kê đơn hoặc đề xuất thay đổi liều.
- Chẩn đoán bệnh.
- Tự kết luận tương tác/chống chỉ định nếu chưa có nguồn dữ liệu được kiểm chứng.
- Tự động biến kết quả không chắc chắn thành lịch nhắc.
- Dùng LLM làm nguồn dữ liệu thuốc.

## 3. Bộ thông tin chuẩn

### 3.1. Thực thể

| Nhãn | Ý nghĩa | Ví dụ |
|---|---|---|
| `DRUG` | Tên thương mại/tên thuốc trên đơn | `Augmentin` |
| `ACTIVE_INGREDIENT` | Hoạt chất | `amoxicillin/clavulanate` |
| `STRENGTH` | Hàm lượng/nồng độ | `625 mg` |
| `DOSE` | Lượng dùng mỗi lần | `1 viên` |
| `FORM` | Dạng bào chế | `viên nén` |
| `ROUTE` | Đường dùng | `uống` |
| `FREQUENCY` | Số lần hoặc khoảng cách dùng | `2 lần/ngày` |
| `DURATION` | Thời gian sử dụng | `7 ngày` |
| `TIMING` | Thời điểm dùng | `sau ăn` |
| `INSTRUCTION` | Hướng dẫn bổ sung | `uống nhiều nước` |

### 3.2. Quan hệ bắt buộc

```text
DRUG → HAS_ACTIVE_INGREDIENT
DRUG → HAS_STRENGTH
DRUG → HAS_DOSE
DRUG → HAS_FORM
DRUG → HAS_ROUTE
DRUG → HAS_FREQUENCY
DRUG → HAS_DURATION
DRUG → HAS_TIMING
DRUG → HAS_INSTRUCTION
```

Một trường không xuất hiện phải có giá trị `null` hoặc danh sách rỗng, không được tự suy đoán.

## 4. Quy tắc chuẩn hóa

1. Giữ lại `raw_text` đúng như OCR hoặc vùng văn bản gốc.
2. Làm sạch lỗi hiển nhiên về khoảng trắng, dấu câu, ký tự và đơn vị.
3. Tìm ứng viên thuốc theo tên sau làm sạch.
4. Xếp hạng ứng viên bằng tên, hoạt chất, hàm lượng, dạng thuốc và ngữ cảnh.
5. Chỉ gán `normalized_name` khi có ứng viên đạt ngưỡng tin cậy.
6. Nếu có nhiều ứng viên gần nhau, trả về yêu cầu xác nhận.

Ví dụ:

```text
raw_text:        Augrnentin 625rng
normalized_name: Augmentin
strength:        625 mg
```

Không được sửa `0.5 mg` thành `5 mg` chỉ vì kết quả đó “trông hợp lý”. Hàm lượng và liều là trường có mức độ nghiêm trọng cao.

## 5. Mô hình dữ liệu đầu ra

Schema chính thức nằm tại:

```text
schemas/prescription.schema.json
```

Các nguyên tắc bắt buộc:

- Mỗi thuốc có `medication_id` riêng.
- Mỗi trường quan trọng có confidence riêng.
- Có `raw_text` để truy vết.
- Có `verification.status` và `fields_to_verify`.
- Tách `prescribed_frequency` khỏi `reminder_schedule`.
- Lịch nhắc là cài đặt của người dùng, không phải chỉ định mới của bác sĩ.

## 6. Kiến trúc mô-đun

### Mô-đun A — Image Pre-processing

Đầu vào ảnh; đầu ra ảnh đã xoay/cắt/cân bằng sáng ở mức cần thiết. Không làm biến dạng nội dung thuốc.

### Mô-đun B — OCR

Đầu ra bắt buộc gồm văn bản, bounding box, confidence và thứ tự dòng. P0 dùng PaddleOCR hoặc OCR tương đương.

### Mô-đun C — Information Extraction

Trích xuất thực thể từ text và tọa độ. P0 dùng regex/dictionary; P1 dùng NER; P2/P3 có thể dùng layout-aware model.

### Mô-đun D — Relation Extraction

Gán các trường hướng dẫn về đúng `medication_id`, đặc biệt trong đơn nhiều thuốc.

### Mô-đun E — Drug Entity Linking

Liên kết ứng viên OCR với drug database; trả về ứng viên, điểm số và lý do/thuộc tính khớp.

### Mô-đun F — Confidence and Verification

Tổng hợp độ tin cậy; đánh dấu trường phải xác nhận; không tự chấp nhận trường nhạy cảm dưới ngưỡng.

### Mô-đun G — Schedule

Chỉ tạo lịch nhắc từ kết quả đã được người dùng xác nhận hoặc được đánh dấu đủ tin cậy.

## 7. Thiết kế thực nghiệm

| Pipeline | Đầu vào | Mục đích |
|---|---|---|
| P0 | OCR → Regex/Dictionary | Baseline |
| P1 | OCR → Vietnamese NER | Đánh giá mô hình NLP |
| P2 | OCR + tọa độ → Layout-aware model | Đánh giá tác động của layout |
| P3 | OCR + layout + domain vocabulary + relations + linking + calibration | Phương pháp đề xuất |

Tất cả pipeline phải được đánh giá trên cùng tập test và cùng định nghĩa nhãn.

## 8. Chỉ số đánh giá đã chốt

- OCR: CER, WER.
- Entity extraction: Precision, Recall, F1 theo từng nhãn.
- Relation extraction: Relation Precision, Recall, F1.
- Drug linking: Top-1 Accuracy, Top-k Accuracy.
- Kết quả hoàn chỉnh: Complete Medication Entry Accuracy.
- An toàn: Clinically Critical Error Rate.
- Human verification: tỷ lệ cảnh báo đúng, tỷ lệ lỗi sau xác nhận.

## 9. Điều kiện hoàn thành bước 1

- Phạm vi bản đầu tiên đã được chốt.
- Bộ nhãn và quan hệ đã được định nghĩa.
- Schema đầu ra đã được tạo.
- Kiến trúc mô-đun đã được xác định.
- Pipeline P0–P3 và chỉ số đánh giá đã thống nhất.
- Các trường hợp ngoài phạm vi đã được ghi rõ.

## 10. Việc tiếp theo — Bước 2

1. Tạo cấu trúc thư mục dataset.
2. Viết quy chuẩn ẩn danh dữ liệu.
3. Chuẩn bị template annotation.
4. Thu thập một batch dữ liệu nhỏ để thử quy trình.
5. Gắn nhãn thử và kiểm tra độ thống nhất giữa hai thành viên.


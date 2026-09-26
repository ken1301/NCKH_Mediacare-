# Bước 2 — Mô hình dữ liệu và contract giữa các module

> Mục tiêu: các module có thể phát triển độc lập và ghép lại khi dataset VAIPE-P được cấp quyền.

## 1. Thứ tự xử lý chuẩn

```text
Prescription Image
    ↓
OCR Result
    ↓
Extracted Entities
    ↓
Medication Relations
    ↓
Drug Entity Linking
    ↓
Confidence + Verification
    ↓
Verified Medication Plan
    ↓
Reminder Schedule
```

Mỗi bước chỉ nhận và trả dữ liệu theo contract đã định nghĩa, không phụ thuộc trực tiếp vào giao diện hoặc database nội bộ của bước khác.

## 2. Các schema chính

### OCR Result

Mỗi vùng OCR cần có:

```text
page_id
text
bbox
ocr_confidence
line_index
```

### Extracted Entity

Mỗi entity cần có:

```text
entity_id
label
text
normalized_text
bbox
confidence
```

### Drug Catalog Entry

Schema chính thức:

```text
schemas/drug_catalog.schema.json
```

Drug catalog phục vụ tìm ứng viên và chuẩn hóa, không được dùng để tự bổ sung thông tin không có trên đơn.

### Verified Medication Plan

Schema chính thức:

```text
schemas/medication_plan.schema.json
```

Medication plan phải tách:

- Thông tin được kê trên đơn.
- Trạng thái xác nhận.
- Lịch nhắc do người dùng cài đặt.

## 3. Quy tắc giao tiếp giữa module

### OCR → Information Extraction

- OCR phải giữ nguyên `raw_text`.
- Không được xóa các token nghi ngờ trước khi extraction.
- Bounding box dùng hệ tọa độ ảnh gốc.

### Information Extraction → Relation Extraction

- Mỗi entity phải có ID ổn định trong một prescription.
- Relation chỉ được trỏ tới entity tồn tại trong cùng prescription.

### Relation Extraction → Drug Linking

- Drug linking nhận `DRUG` entity và các thuộc tính đã liên kết.
- Không chỉ truyền chuỗi tên thuốc đơn lẻ.

### Drug Linking → Verification

- Phải trả về ứng viên, điểm số và thuộc tính khớp.
- Nếu có nhiều ứng viên gần nhau, trạng thái là `needs_review`.

### Verification → Schedule

- Chỉ tạo reminder từ plan đã `verified` hoặc trường liên quan đã được xác nhận.
- Không biến reminder thành `prescribed_frequency`.

## 4. Ngưỡng confidence ban đầu

Đây là ngưỡng khởi đầu để triển khai, sẽ hiệu chỉnh bằng validation set:

| Trường | Tự động chấp nhận | Yêu cầu review |
|---|---:|---:|
| Drug | ≥ 0.95 | < 0.95 |
| Strength | ≥ 0.90 | < 0.90 |
| Dose | ≥ 0.90 | < 0.90 |
| Frequency | ≥ 0.90 | < 0.90 |
| Duration | ≥ 0.85 | < 0.85 |
| Timing | ≥ 0.85 | < 0.85 |

Hàm lượng và liều không được tự động bỏ qua review chỉ vì tên thuốc có confidence cao.

## 5. Trạng thái medication plan

```text
draft
  ↓
needs_verification
  ↓
verified
  ↓
scheduled
```

Không được chuyển từ `needs_verification` sang `scheduled` nếu còn trường critical chưa xác nhận.

## 6. Tiêu chí hoàn thành bước này

- Drug catalog có schema.
- Medication plan có schema.
- Quy tắc confidence đã được ghi rõ.
- Quy tắc tách chỉ định và lịch nhắc đã được ghi rõ.
- Các module có thể phát triển độc lập dựa trên contract.

## 7. Bước tiếp theo

Sau khi chốt contract, nhóm triển khai:

1. Drug catalog repository và mock records.
2. API lưu prescription/medication plan.
3. Verification workflow.
4. Schedule engine.
5. OCR adapter khi dataset được cấp quyền.


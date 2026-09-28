# Bước 4 — Drug Catalog Repository và Drug Entity Linking

## Mục tiêu

Chuẩn hóa tên thuốc OCR sai và liên kết với bản ghi thuốc phù hợp dựa trên tên, alias, hàm lượng và ngữ cảnh. Module không được tự tạo thuốc mới hoặc tự suy đoán khi không đủ bằng chứng.

## Module

```text
OCR raw text
    ↓
normalizeDrugText
    ↓
candidate search
    ↓
name similarity + strength matching
    ↓
linkDrug
    ├── linked
    ├── needs_review
    └── not_found
```

Code nằm tại:

```text
src/catalog/drug-catalog.mjs
```

## Trạng thái liên kết

### `linked`

Ứng viên đứng đầu vượt threshold và cách biệt đủ với ứng viên thứ hai.

### `needs_review`

Có nhiều ứng viên gần nhau hoặc thiếu thuộc tính quan trọng như hàm lượng.

### `not_found`

Không có ứng viên đủ điểm hoặc tên quá ngắn/không xác định.

## Quy tắc an toàn

- Không fuzzy match tên thuốc mà bỏ qua hàm lượng khi raw text có hàm lượng.
- Không xem confidence tên thuốc là confidence hàm lượng.
- Không tự chọn giữa `Paracetamol 500 mg` và `Paracetamol 650 mg` nếu đơn không đủ rõ.
- Luôn trả về danh sách candidates để UI hiển thị khi cần review.
- Bản ghi chính thức phải có `source_url` và `accessed_at` theo `schemas/drug_catalog.schema.json`.

## Dữ liệu hiện tại

Repository hiện chỉ dùng fixture trong test để kiểm thử thuật toán. Chưa đưa dữ liệu thuốc thật vào repo cho đến khi có nguồn và quyền sử dụng rõ ràng.

VAIPE-P hiện được dùng để tạo `candidate-only catalog` từ train split nhằm benchmark exploratory. Đây không phải trusted drug database: không có hoạt chất/đăng ký thuốc đầy đủ, không được dùng cho production hoặc công bố chính thức.

## Chạy kiểm thử

```bash
npm test
```

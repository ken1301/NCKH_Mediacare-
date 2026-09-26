# Hướng dẫn gắn nhãn dataset

## 1. Nguyên tắc chung

Gắn nhãn những gì xuất hiện trên đơn, không suy đoán những gì không nhìn thấy. Nếu không chắc chắn, đánh dấu để review thay vì tự điền theo kiến thức bên ngoài.

Mỗi entity phải có `id`, `label`, `text`, `bbox` theo thứ tự `[x_min, y_min, x_max, y_max]` và `normalized_text` nếu có cơ sở rõ ràng.

## 2. Định nghĩa nhãn

| Nhãn | Ý nghĩa | Ví dụ |
|---|---|---|
| `DRUG` | Tên thương mại hoặc tên thuốc | `Augmentin` |
| `ACTIVE_INGREDIENT` | Hoạt chất được ghi trên đơn | `amoxicillin` |
| `STRENGTH` | Hàm lượng hoặc nồng độ | `625 mg` |
| `DOSE` | Lượng dùng mỗi lần | `1 viên` |
| `FORM` | Dạng bào chế | `viên nén` |
| `ROUTE` | Đường dùng | `uống` |
| `FREQUENCY` | Số lần hoặc khoảng cách dùng | `2 lần/ngày` |
| `DURATION` | Thời lượng sử dụng | `7 ngày` |
| `TIMING` | Thời điểm hoặc điều kiện dùng | `sau ăn` |
| `INSTRUCTION` | Hướng dẫn bổ sung | `uống nhiều nước` |

## 3. Quy tắc tách vùng

- Tách `DRUG` và `STRENGTH` nếu có thể xác định độc lập.
- Tách `DOSE` khỏi `FREQUENCY`.
- Tách `FREQUENCY` khỏi `DURATION`.
- Nếu một cụm không thể tách đáng tin cậy, giữ nguyên span và ghi chú.
- Giữ các dấu `×`, `/`, `-`, `:` trong span có ý nghĩa.

## 4. Gắn quan hệ

Mỗi quan hệ có dạng `source_entity_id`, `type`, `target_entity_id`. Source của quan hệ thuốc–hướng dẫn phải là `DRUG`.

Các quan hệ được phép:

```text
DRUG → HAS_ACTIVE_INGREDIENT → ACTIVE_INGREDIENT
DRUG → HAS_STRENGTH → STRENGTH
DRUG → HAS_DOSE → DOSE
DRUG → HAS_FORM → FORM
DRUG → HAS_ROUTE → ROUTE
DRUG → HAS_FREQUENCY → FREQUENCY
DRUG → HAS_DURATION → DURATION
DRUG → HAS_TIMING → TIMING
DRUG → HAS_INSTRUCTION → INSTRUCTION
```

Không nối thông tin của thuốc này sang thuốc kế bên chỉ dựa vào vị trí gần nhau.

## 5. Chuẩn hóa annotation

`text` giữ nguyên nội dung nhìn thấy. `normalized_text` dùng để biểu diễn dạng chuẩn khi có thể xác định:

| Text nhìn thấy | Normalized text |
|---|---|
| `1v` | `1 viên` |
| `2 lan/ngay` | `2 lần/ngày` |
| `625rng` | `625 mg` nếu có đủ bằng chứng |
| `sau an` | `sau ăn` |

Không tự sửa các trường có thể làm thay đổi ý nghĩa y khoa nếu chưa có bằng chứng trực tiếp.

## 6. Trường hợp khó

- Không đọc được: tạo entity nếu biết loại trường và đặt `needs_review: true`.
- Hai cách đọc hợp lý: giữ cách đọc nhìn thấy và ghi cả hai trong `notes`.
- Không biết entity thuộc thuốc nào: không gắn quan hệ, ghi chú để review.
- Hướng dẫn áp dụng toàn đơn: gắn `global_instruction`, không gán tùy tiện cho từng thuốc.
- Chữ viết tay trong phiên bản 1: đánh dấu `out_of_scope` nếu không thuộc phạm vi.

## 7. Review hai người

1. Annotator A gắn nhãn độc lập.
2. Annotator B gắn nhãn độc lập, không xem kết quả của A.
3. So sánh entity span, label và relation.
4. Ghi nhận bất đồng.
5. Reviewer cuối quyết định nhãn chuẩn.

Theo dõi entity agreement, label agreement, relation agreement và tỷ lệ mẫu cần review.


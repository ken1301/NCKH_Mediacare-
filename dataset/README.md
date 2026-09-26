# Dataset — Vietnamese Prescription Understanding

## Mục đích

Dataset phục vụ huấn luyện và đánh giá pipeline nhận diện, trích xuất, liên kết và kiểm chứng thông tin từ ảnh đơn thuốc Việt Nam.

## Cấu trúc thư mục

```text
dataset/
├── README.md
├── ANNOTATION_GUIDELINE.md
├── raw/                 # Ảnh đã được phép sử dụng
├── processed/           # Ảnh đã tiền xử lý
├── annotations/         # Nhãn chính thức
├── splits/              # train/validation/test manifest
├── metadata/            # Metadata không định danh
├── templates/           # Template annotation
└── samples/             # Mẫu tổng hợp, không phải dữ liệu thật
```

## Nguồn dữ liệu

Chi tiết nguồn và quy trình thu thập nằm tại:

```text
dataset/SOURCE_AND_COLLECTION_PLAN.md
```

VAIPE-P là nguồn ưu tiên cần kiểm tra trước. Checklist tiếp nhận nằm tại:

```text
dataset/VAIPE_ACCESS_CHECKLIST.md
```

Dataset dùng mô hình kết hợp: drug catalog chính thống, ảnh tổng hợp và ảnh đơn thuốc thật đã ẩn danh.

## Quy tắc dữ liệu

1. Chỉ sử dụng dữ liệu có quyền sử dụng rõ ràng.
2. Không đưa họ tên, mã bệnh nhân, số điện thoại, địa chỉ, mã bảo hiểm, chữ ký hoặc mã QR vào Git.
3. Ẩn danh trước khi annotation và trước khi chia sẻ nội bộ.
4. Không dùng dữ liệu thật trong `samples/`; mẫu phải được tổng hợp hoặc làm giả.
5. Không để tên file chứa thông tin cá nhân.
6. Không commit ảnh đơn thuốc thật nếu chưa có quyết định bảo mật dữ liệu rõ ràng.
7. Mỗi mẫu phải có `sample_id` ổn định, không chứa thông tin nhận diện.

## Mức độ khó

| Mức | Mô tả |
|---|---|
| `easy` | Đơn in rõ, tương phản tốt, bố cục đơn giản |
| `medium` | Ảnh chụp điện thoại, nhiễu nhẹ, lệch góc hoặc dấu khó đọc |
| `hard` | Bố cục phức tạp, nhiều thuốc, chữ nhỏ hoặc nhiễu mạnh |

Phiên bản 1 tập trung vào `easy` và `medium`. `hard` dùng để kiểm tra khả năng chịu lỗi khi có đủ dữ liệu.

## Quy tắc chia tập

- `train`: 70%.
- `validation`: 15%.
- `test`: 15%.
- Chia theo mẫu đơn, không chia các dòng của cùng một đơn sang nhiều tập.
- Nếu nhiều ảnh là cùng một đơn, tất cả phải thuộc cùng một split.
- Giữ tỷ lệ mức độ khó và số lượng thuốc tương đối cân bằng giữa các split.

## Định dạng annotation

Annotation chính thức dùng template:

```text
dataset/templates/annotation.template.json
```

Annotation cần lưu cả văn bản gốc, tọa độ bounding box, nhãn thực thể, quan hệ, văn bản chuẩn hóa và ghi chú không chắc chắn.

## Quy trình thêm một mẫu

1. Cấp `sample_id` ngẫu nhiên.
2. Xóa hoặc che thông tin định danh.
3. Đưa ảnh vào kho lưu trữ được phép.
4. Tạo metadata theo template.
5. Gắn nhãn vùng văn bản, thực thể và quan hệ.
6. Review độc lập bởi annotator thứ hai.
7. Giải quyết bất đồng và ghi quyết định.
8. Chỉ chuyển vào split sau khi mẫu đạt kiểm tra chất lượng.

## Tiêu chí chất lượng tối thiểu

- Không còn thông tin định danh rõ ràng.
- Mọi thuốc có `DRUG` entity.
- Các trường xuất hiện trên ảnh đều được gắn nhãn.
- Quan hệ không trỏ tới entity khác mẫu.
- Tọa độ nằm trong kích thước ảnh.
- Mẫu có bất đồng phải có `review_status` và ghi chú giải quyết.

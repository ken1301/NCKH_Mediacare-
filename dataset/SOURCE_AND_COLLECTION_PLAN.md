# Nguồn dữ liệu và kế hoạch thu thập

## 1. Kết luận hiện tại

Chưa có một bộ ảnh đơn thuốc Việt Nam công khai, đầy đủ và chắc chắn phù hợp trực tiếp với mục tiêu của MediCare. Vì vậy, dataset phải được xây dựng theo mô hình kết hợp thay vì phụ thuộc vào một nguồn duy nhất.

```text
Drug database chính thống
        +
Ảnh đơn thuốc tổng hợp
        +
Ảnh đơn thuốc thật đã ẩn danh
        ↓
Vietnamese Prescription Dataset
```

## 2. Nguồn A — Drug database chính thống

### Nguồn ưu tiên

- [Cục Quản lý Dược — Tra cứu thông tin thuốc](https://dav.gov.vn/tra-cuu-thuoc-page181.html)
- [Công bố giấy đăng ký thuốc tại Việt Nam](https://06dichvucong.dav.gov.vn/congbothuoc/index)
- [Ngân hàng dữ liệu ngành Dược](https://dav.gov.vn/bo-y-te-cuc-quan-ly-duoc-ra-mat-ngan-hang-du-lieu-tra-cuu-thong-tin-thuoc-truc-tuyen-dau-tien-cua-viet-nam-n2562.html)

Các nguồn này có thể cung cấp dữ liệu tham chiếu như tên thuốc, hoạt chất, hàm lượng, dạng bào chế, số đăng ký và tài liệu liên quan. Đây là nguồn cho **drug entity linking**, không phải nguồn ảnh đơn thuốc để huấn luyện OCR.

### Cách sử dụng

- Tạo bảng `drug_catalog` nội bộ.
- Lưu URL nguồn và ngày truy cập cho mỗi bản ghi.
- Không tự xem dữ liệu tra cứu là giấy phép để phân phối lại toàn bộ dữ liệu.
- Chỉ lưu các trường cần thiết cho nghiên cứu và tuân thủ điều khoản nguồn.

### Trường tối thiểu

```text
drug_database_id
brand_name
active_ingredient
strength
dosage_form
route
registration_number
source_url
source_accessed_at
```

## 3. Nguồn B — Ảnh đơn thuốc tổng hợp

Đây là nguồn có thể triển khai ngay, không chứa dữ liệu bệnh nhân.

### Mục đích

- Kiểm tra pipeline từ đầu đến cuối.
- Tạo các lỗi OCR có kiểm soát.
- Kiểm tra quan hệ thuốc–hàm lượng–liều–tần suất.
- Xây baseline P0 trước khi có dữ liệu thật.

### Cách tạo

- Chọn tên thuốc, hoạt chất, hàm lượng và dạng thuốc từ drug catalog.
- Dùng một số layout đơn thuốc bán cấu trúc do nhóm tự thiết kế.
- Tạo dữ liệu giả lập với thông tin bệnh nhân không có thật hoặc để trống.
- Render thành ảnh ở nhiều kích thước, độ nghiêng, độ sáng và mức nhiễu.
- Sinh một số biến thể lỗi OCR như mất dấu, nhầm ký tự và sai khoảng trắng.

### Giới hạn

Ảnh tổng hợp không thay thế ảnh đơn thuốc thực tế. Kết quả trên nguồn này chỉ chứng minh pipeline hoạt động có kiểm soát, không được dùng để tuyên bố hệ thống đã tổng quát tốt ngoài đời.

### Mục tiêu ban đầu

- 20–30 layout.
- 200–500 ảnh tổng hợp.
- Có single-medication và multi-medication.
- Có ground truth hoàn chỉnh từ lúc sinh dữ liệu.

## 4. Nguồn C — Ảnh đơn thuốc thật đã ẩn danh

Đây là nguồn quan trọng nhất cho đánh giá thực tế.

### Kênh thu thập ưu tiên

1. Phòng khám hoặc bệnh viện nơi giảng viên có thể giới thiệu đầu mối.
2. Nhà thuốc hoặc phòng khám tư nhân đồng ý hỗ trợ nghiên cứu.
3. Thành viên nhóm tự nguyện cung cấp đơn của gia đình sau khi được đồng ý và ẩn danh.
4. Đơn mẫu do bác sĩ/dược sĩ tạo cho mục đích nghiên cứu.

### Điều kiện bắt buộc

- Có sự cho phép của đơn vị hoặc người cung cấp dữ liệu.
- Xác định rõ mục đích nghiên cứu, phạm vi sử dụng và thời hạn lưu trữ.
- Che/xóa họ tên, ngày sinh, địa chỉ, số điện thoại, mã bệnh nhân, mã bảo hiểm, chữ ký và mã QR.
- Không đưa ảnh thật lên GitHub công khai.
- Lưu ảnh gốc ở kho riêng có phân quyền; repository chỉ lưu annotation không định danh hoặc ảnh đã được phép công khai.
- Kiểm tra lại 100% ảnh trước khi annotation.

### Mục tiêu ban đầu

- Pilot: 30–50 ảnh từ ít nhất hai kiểu biểu mẫu.
- Nghiên cứu chính: 300–500 ảnh nếu có thể.
- Có đơn một thuốc và nhiều thuốc.
- Có ảnh rõ, ảnh chụp lệch và ảnh nhiễu tự nhiên.

## 5. Nguồn D — Dataset hỗ trợ OCR tiếng Việt

[ViOCRVQA](https://arxiv.org/abs/2404.18397) là dataset/benchmark OCR-VQA tiếng Việt có thể tham khảo cho tiền huấn luyện hoặc kiểm tra năng lực OCR tiếng Việt nói chung. Dataset này không phải dataset đơn thuốc, vì vậy không được dùng thay thế cho prescription dataset của MediCare.

## 6. Kế hoạch thực hiện 14 ngày

### Ngày 1–2

- Chốt người/đơn vị có thể cung cấp ảnh.
- Gửi mẫu giới thiệu đề tài và yêu cầu dữ liệu.
- Chốt biểu mẫu đồng ý/cho phép sử dụng dữ liệu với giảng viên hướng dẫn.

### Ngày 3–5

- Chuẩn hóa drug catalog từ nguồn chính thống.
- Tạo 5 layout đơn thuốc giả lập.
- Sinh batch đầu tiên 50–100 ảnh tổng hợp.

### Ngày 6–7

- Chạy thử annotation template.
- Hai thành viên cùng gắn nhãn 10 mẫu.
- Ghi lại các trường hợp bất đồng và cập nhật guideline.

### Tuần thứ 2

- Mở rộng ảnh tổng hợp lên 200–500 mẫu.
- Tiếp nhận pilot ảnh thật nếu đã có phép.
- Ẩn danh và review ảnh thật.
- Gắn nhãn 30–50 mẫu đầu tiên.
- Khóa phiên bản dataset `v0.1`.

## 7. Quyết định sử dụng dữ liệu

| Loại dữ liệu | Dùng cho | Được commit công khai? |
|---|---|---|
| Drug catalog từ nguồn chính thống | Entity linking, normalization | Chỉ các trường cần thiết và theo điều khoản nguồn |
| Ảnh tổng hợp | P0, pipeline, controlled test | Có thể, nếu chỉ chứa dữ liệu giả |
| Ảnh đơn thuốc thật | Test thực tế, nghiên cứu | Không, trừ khi có quyền công khai rõ ràng |
| Annotation đã ẩn danh | Huấn luyện/đánh giá | Có thể xem xét sau khi rà soát |

## 8. Không được làm

- Không tải ảnh đơn thuốc ngẫu nhiên trên mạng xã hội về làm dataset.
- Không dùng ảnh thật khi chưa biết nguồn và quyền sử dụng.
- Không đưa ảnh có thông tin cá nhân lên repository công khai.
- Không gọi dataset tổng hợp là dữ liệu thực tế.
- Không đánh giá mô hình chỉ trên dữ liệu tổng hợp.

## 9. Tiêu chí sẵn sàng chuyển sang bước annotation chính thức

- Có ít nhất 50 mẫu tổng hợp hợp lệ.
- Có ít nhất 10 mẫu được hai annotator gắn nhãn thử.
- Có drug catalog phiên bản đầu tiên.
- Guideline đã được cập nhật sau vòng review thử.
- Có quyết định rõ ràng về quyền sử dụng của ảnh thật.


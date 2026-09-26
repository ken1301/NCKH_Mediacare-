# Lộ trình phát triển NCKH MediCare

## 1. Mục tiêu của lộ trình

Phát triển MediCare theo thứ tự:

```text
Chốt bài toán → Xây dựng dữ liệu → Baseline → AI lõi
→ Kiểm chứng an toàn → Prototype ứng dụng → Đánh giá → Báo cáo
```

Trọng tâm xuyên suốt là biến ảnh đơn thuốc Việt Nam thành **kế hoạch sử dụng thuốc có cấu trúc, được chuẩn hóa và có kiểm chứng**.

---

## 2. Các giai đoạn thực hiện

### Giai đoạn 1 — Chốt phạm vi và thiết kế

**Thời gian dự kiến:** Tuần 1

**Công việc:**

- Chốt tên đề tài và câu hỏi nghiên cứu.
- Giới hạn phiên bản đầu tiên ở đơn thuốc in/bán cấu trúc.
- Chốt các trường: Drug, Strength, Dose, Frequency, Duration, Timing, Route, Form.
- Chốt bộ nhãn thực thể và quan hệ.
- Chốt kiến trúc, định dạng JSON và chỉ số đánh giá.

**Đầu ra:** Tài liệu định hướng, sơ đồ hệ thống, quy chuẩn dữ liệu và nguyên tắc an toàn.

### Giai đoạn 2 — Dataset và cơ sở dữ liệu thuốc

**Thời gian dự kiến:** Tuần 2–5

**Công việc:**

- Thu thập dữ liệu hợp pháp và ẩn danh.
- Phân loại Easy, Medium, Hard.
- Gắn nhãn thực thể và quan hệ.
- Chia train/validation/test, tránh trùng mẫu.
- Xây dựng drug database phiên bản đầu tiên.

**Mục tiêu ban đầu:** 300–500 ảnh đơn thuốc cho prototype nghiên cứu, sau đó mở rộng khi quy trình ổn định.

**Đầu ra:** Dataset phiên bản 1, quy chuẩn annotation và drug database phiên bản 1.

### Giai đoạn 3 — Baseline P0

**Thời gian dự kiến:** Tuần 6–7

```text
Ảnh → PaddleOCR → Regex/Dictionary → Kết quả cấu trúc
```

P0 là mốc so sánh, không phải phương pháp cuối cùng.

**Đầu ra:** CER/WER, Drug Accuracy, Strength/Dose/Frequency Accuracy và danh sách lỗi phổ biến.

### Giai đoạn 4 — Trích xuất thông tin thuốc

**Thời gian dự kiến:** Tuần 8–11

- P1: OCR + Vietnamese Transformer NER.
- P2: OCR + tọa độ + Layout-aware model.
- So sánh text-only với layout-aware.
- Chuẩn hóa các biểu diễn như `1v`, `625rng`, `2 lần/ngày`.

**Đầu ra:** Mô hình trích xuất thực thể và bảng so sánh P0/P1/P2.

### Giai đoạn 5 — Relation Extraction và Drug Entity Linking

**Thời gian dự kiến:** Tuần 12–15

Hệ thống phải gán đúng thông tin cho từng thuốc trong đơn nhiều thuốc:

```text
Drug → Strength
Drug → Dose
Drug → Frequency
Drug → Duration
Drug → Timing
```

Drug Entity Linking sử dụng tên sau OCR correction, hoạt chất, hàm lượng, dạng thuốc, ngữ cảnh và cơ sở dữ liệu thuốc.

**Đầu ra:** Relation F1, Top-1/Top-k linking accuracy và kết quả hoàn chỉnh theo từng thuốc.

### Giai đoạn 6 — Confidence và User Verification

**Thời gian dự kiến:** Tuần 16–17

- Tính độ tin cậy cho từng trường.
- Tự động chấp nhận trường có độ tin cậy cao.
- Yêu cầu xác nhận với trường có độ tin cậy thấp.
- Ưu tiên kiểm tra Drug, Strength, Dose, Frequency và Duration.

**Đầu ra:** Confidence theo trường, giao diện xác nhận và so sánh lỗi trước/sau xác nhận.

### Giai đoạn 7 — Prototype MediCare

**Thời gian dự kiến:** Tuần 18–21

```text
Tải/chụp ảnh → Xem kết quả → Xác nhận/sửa → Lưu thuốc
→ Tạo lịch nhắc → Đã uống/Chưa uống/Bỏ qua
```

Phải tách biệt:

- `prescribed_frequency`: chỉ định trên đơn.
- `reminder_schedule`: giờ nhắc do người dùng cài đặt.

Thông tin thuốc hiển thị phải lấy từ nguồn có kiểm soát.

### Giai đoạn 8 — Đánh giá và viết báo cáo

**Thời gian dự kiến:** Tuần 22–26

- Đánh giá P0–P3 trên cùng tập test.
- Phân tích lỗi OCR, lỗi gán quan hệ và lỗi liên kết thuốc.
- Đo Clinically Critical Error Rate.
- Hoàn thiện khóa luận, bài báo, demo và tài liệu hướng dẫn.

---

## 3. Phân chia công việc

### Thành viên 1 — AI và nghiên cứu

- Dataset và annotation.
- OCR và tiền xử lý ảnh.
- NER, Relation Extraction.
- Drug Entity Linking.
- Thiết kế đánh giá và phân tích lỗi.

### Thành viên 2 — Hệ thống và ứng dụng

- Backend pipeline và API.
- Drug database.
- Confidence và giao diện xác nhận.
- Scheduling engine.
- Giao diện MediCare và theo dõi lịch uống.

### Công việc chung

- Chốt phạm vi.
- Chuẩn bị dữ liệu.
- Thiết kế thực nghiệm.
- Đánh giá thống kê.
- Viết khóa luận và bài báo.

---

## 4. Các mốc kiểm soát bắt buộc

### Gate 1 — Có dữ liệu đúng

Không huấn luyện mô hình khi bộ nhãn chưa thống nhất và dữ liệu chưa được ẩn danh.

### Gate 2 — Có baseline

Không tuyên bố phương pháp mới hiệu quả nếu chưa có P0 để so sánh.

### Gate 3 — Hiểu quan hệ thuốc

Không chỉ đo OCR hoặc NER; phải kiểm tra thông tin có thuộc đúng thuốc hay không.

### Gate 4 — Có cơ chế an toàn

Không tự động chấp nhận trường nhạy cảm khi độ tin cậy thấp.

### Gate 5 — Có đánh giá cuối

Không đánh giá bằng một vài ảnh mẫu; phải có tập test độc lập và phân tích lỗi nghiêm trọng.

---

## 5. Ưu tiên khi thiếu thời gian

Ưu tiên theo thứ tự:

1. Dataset và annotation.
2. OCR baseline.
3. Trích xuất Drug/Strength/Dose/Frequency.
4. Gán đúng thông tin cho từng thuốc.
5. Confidence và user verification.
6. Prototype scan → verify → schedule.
7. Các tính năng mở rộng.

Các tính năng như chữ viết tay, tương tác thuốc, LLM/VLM và tư vấn nâng cao chỉ thực hiện sau khi hoàn thành pipeline lõi.

---

## 6. Tiêu chí hoàn thành

Lộ trình được xem là hoàn thành khi nhóm có:

- Dataset đã ẩn danh.
- Bộ nhãn thực thể và quan hệ.
- Ít nhất P0, P1 và P3 để so sánh.
- Pipeline từ ảnh đến dữ liệu có cấu trúc.
- Drug Entity Linking.
- Confidence và User Verification.
- Prototype MediCare.
- Kết quả đánh giá kỹ thuật và an toàn.
- Báo cáo giới hạn, failure cases và hướng phát triển.

---

## 7. Nguyên tắc không thay đổi

- Bài toán trung tâm là **Prescription Understanding**, không phải OCR đơn thuần.
- Quan hệ thuốc–hướng dẫn là thành phần bắt buộc.
- Lịch nhắc người dùng phải tách khỏi chỉ định của bác sĩ.
- Không tự kê đơn, thay đổi liều hoặc chẩn đoán.
- Dữ liệu thuốc phải có nguồn và có thể truy vết.
- Khi không chắc chắn, hệ thống phải yêu cầu người dùng xác nhận.


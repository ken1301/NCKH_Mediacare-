# NCKH MediCare

## Tài liệu định hướng xuyên suốt dự án

> Phiên bản: 1.0  
> Trạng thái: Tài liệu nền tảng  
> Phạm vi: Khóa luận tốt nghiệp, bài báo nghiên cứu khoa học và prototype ứng dụng

---

## 1. Tên đề tài

### Tên tiếng Việt

**Nghiên cứu phương pháp trích xuất, liên kết và kiểm chứng thông tin sử dụng thuốc từ hình ảnh đơn thuốc Việt Nam.**

### Tên tiếng Anh

**Vietnamese Prescription Understanding with Layout-Aware Medication Information Extraction, Drug Entity Linking, and Confidence-Guided Verification.**

### Tên sản phẩm prototype

**MediCare – Vietnamese Prescription Understanding and Medication Management.**

---

## 2. Tầm nhìn của dự án

Xây dựng một hệ thống có khả năng chuyển ảnh đơn thuốc Việt Nam thành kế hoạch sử dụng thuốc có cấu trúc, được chuẩn hóa, có thể kiểm chứng và hỗ trợ người dùng quản lý lịch uống thuốc an toàn.

Hệ thống không chỉ “đọc chữ trong ảnh”, mà phải hiểu mối liên hệ giữa từng thuốc với hàm lượng, liều dùng, số lần dùng, thời gian dùng, đường dùng và hướng dẫn liên quan.

### Chuỗi xử lý chính

```text
Ảnh đơn thuốc
    ↓
Tiền xử lý ảnh
    ↓
OCR và tọa độ văn bản
    ↓
Trích xuất thông tin thuốc
    ↓
Trích xuất quan hệ thuốc–hướng dẫn
    ↓
Chuẩn hóa và liên kết thuốc
    ↓
Tính độ tin cậy
    ↓
Người dùng xác nhận trường không chắc chắn
    ↓
Kế hoạch sử dụng thuốc có cấu trúc
    ↓
Thông tin thuốc có nguồn + lịch nhắc
```

---

## 3. Mục tiêu tổng quát

Nghiên cứu và xây dựng prototype có khả năng nhận diện, trích xuất, chuẩn hóa, liên kết và kiểm chứng thông tin sử dụng thuốc từ ảnh đơn thuốc Việt Nam, trong đó ưu tiên tính chính xác và an toàn đối với các trường thông tin quan trọng như tên thuốc, hàm lượng, liều dùng, tần suất và thời gian sử dụng.

---

## 4. Mục tiêu cụ thể

1. Xây dựng bộ dữ liệu đơn thuốc Việt Nam đã ẩn danh, có chú thích thực thể và quan hệ giữa thuốc với hướng dẫn sử dụng.
2. Đánh giá các pipeline OCR trên ảnh đơn thuốc Việt Nam trong các điều kiện rõ, nhiễu, chụp bằng điện thoại và bố cục khác nhau.
3. Xây dựng mô-đun trích xuất thông tin thuốc gồm:
   - Tên thuốc.
   - Hoạt chất nếu có thể xác định.
   - Hàm lượng.
   - Liều dùng.
   - Dạng thuốc.
   - Đường dùng.
   - Tần suất sử dụng.
   - Thời gian sử dụng.
   - Thời điểm sử dụng.
   - Hướng dẫn bổ sung.
4. Xây dựng mô-đun trích xuất quan hệ để gán đúng hàm lượng, liều, tần suất và thời gian cho từng thuốc trong đơn nhiều thuốc.
5. Xây dựng mô-đun chuẩn hóa và liên kết tên thuốc bị lỗi OCR với cơ sở dữ liệu thuốc đáng tin cậy.
6. Xây dựng cơ chế độ tin cậy và xác nhận thủ công đối với trường có khả năng gây lỗi nghiêm trọng.
7. Xây dựng prototype quản lý kế hoạch dùng thuốc, lịch nhắc và trạng thái đã uống/chưa uống/bỏ qua.
8. Đánh giá hệ thống bằng các chỉ số kỹ thuật, chỉ số liên kết và chỉ số an toàn.

---

## 5. Câu hỏi nghiên cứu

### RQ1

Các phương pháp OCR hiện có hoạt động chính xác đến mức nào trên ảnh đơn thuốc Việt Nam thực tế?

### RQ2

Thông tin bố cục và tọa độ văn bản có cải thiện kết quả trích xuất thông tin thuốc so với mô hình chỉ dùng văn bản hay không?

### RQ3

Chuẩn hóa theo tên thuốc, hoạt chất, hàm lượng, dạng thuốc và ngữ cảnh có giúp sửa lỗi OCR tốt hơn fuzzy matching tên đơn thuần hay không?

### RQ4

Hệ thống có thể liên kết chính xác thuốc với hàm lượng, liều dùng, tần suất và thời gian trong đơn có nhiều thuốc hay không?

### RQ5

Cơ chế xác nhận dựa trên độ tin cậy có làm giảm lỗi nghiêm trọng liên quan đến thuốc hay không?

---

## 6. Hướng đi nghiên cứu cốt lõi

### Không đi theo hướng

> “OCR đơn thuốc rồi tạo lời nhắc uống thuốc.”

Hướng này có novelty thấp và chưa giải quyết bài toán hiểu, chuẩn hóa, liên kết và an toàn.

### Bắt buộc đi theo hướng

> **Vietnamese Prescription Understanding → Structured and Verified Medication Plan**

Nói cách khác, hệ thống phải trả lời được:

> Thông tin này thuộc về thuốc nào, có ý nghĩa gì, có chắc chắn không và người dùng có cần xác nhận hay không?

---

## 7. Phạm vi thực hiện

### Phạm vi bắt buộc

- Đơn thuốc Việt Nam dạng in hoặc bán cấu trúc.
- Ảnh đơn thuốc chụp bằng điện thoại hoặc tải lên.
- Nhận diện các trường thông tin sử dụng thuốc phổ biến.
- Đơn có một hoặc nhiều thuốc.
- Xử lý một số lỗi OCR thường gặp.
- Chuẩn hóa thuốc dựa trên cơ sở dữ liệu được kiểm soát.
- Hiển thị kết quả để người dùng xác nhận.
- Tạo lịch nhắc dựa trên thông tin đã được xác nhận.

### Phạm vi mở rộng nếu còn thời gian

- Chữ viết tay.
- Nhiều kiểu biểu diễn tần suất và thời điểm dùng.
- Phát hiện trường bị thiếu hoặc mâu thuẫn.
- So sánh thêm mô hình LLM/VLM làm benchmark.
- Phát hiện tương tác thuốc ở mức tham khảo có nguồn.

### Không thuộc phạm vi

- Tự kê đơn.
- Tự thay đổi chỉ định của bác sĩ.
- Tự đề xuất liều dùng mới.
- Chẩn đoán bệnh.
- Thay thế bác sĩ hoặc dược sĩ.
- Kết luận y khoa chỉ dựa trên đầu ra của mô hình.

---

## 8. Phương pháp nghiên cứu

### 8.1. Xây dựng dữ liệu

Thu thập dữ liệu hợp pháp, ẩn danh thông tin cá nhân và loại bỏ các trường không cần thiết.

Mỗi mẫu dữ liệu cần có:

- Ảnh gốc hoặc ảnh đã xử lý.
- Kết quả OCR.
- Tọa độ vùng văn bản.
- Nhãn thực thể.
- Nhãn quan hệ.
- Kết quả chuẩn hóa nếu có.
- Mức độ khó: Easy, Medium hoặc Hard.

### 8.2. Bộ nhãn thực thể

```text
DRUG
ACTIVE_INGREDIENT
STRENGTH
DOSE
FORM
ROUTE
FREQUENCY
DURATION
TIMING
INSTRUCTION
```

### 8.3. Bộ nhãn quan hệ

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

### 8.4. Các pipeline thực nghiệm

| Pipeline | Mô tả | Vai trò |
|---|---|---|
| P0 – Baseline | OCR → Regex/Dictionary | Mốc so sánh cơ bản |
| P1 – NLP | OCR → Vietnamese Transformer NER | Đánh giá trích xuất thực thể |
| P2 – Layout | OCR + tọa độ → Layout-aware Transformer | Đánh giá vai trò của bố cục |
| P3 – Proposed | OCR + layout + từ vựng chuyên ngành + quan hệ + entity linking + calibration | Phương pháp đề xuất |

LLM/VLM chỉ được dùng làm benchmark hoặc mô-đun hỗ trợ có kiểm soát, không mặc định là kiến trúc production.

---

## 9. Kiến trúc hệ thống mục tiêu

```text
[Prescription Image]
          ↓
[Image Pre-processing]
          ↓
[OCR Engine + Text Coordinates]
          ↓
[Layout-aware Information Extraction]
          ↓
[Medication Relation Extraction]
          ↓
[Vietnamese Drug Entity Linking]
          ↓
[Confidence Calibration]
          ↓
   ┌──────┴──────┐
   │             │
 Độ tin cậy cao  Độ tin cậy thấp
   │             │
   │      [User Verification]
   └──────┬──────┘
          ↓
[Structured Prescription]
          ↓
   ┌──────┴──────────────┐
   ↓                     ↓
[Medication Schedule] [Trusted Drug Information]
```

---

## 10. Nguyên tắc chuẩn hóa thuốc

Không chuẩn hóa chỉ dựa trên chuỗi tên thuốc. Thứ tự ưu tiên là:

1. Tên thuốc sau khi làm sạch lỗi OCR.
2. Hoạt chất.
3. Hàm lượng.
4. Dạng thuốc.
5. Ngữ cảnh trong dòng thuốc.
6. Cơ sở dữ liệu thuốc được kiểm soát.

Ví dụ:

```text
OCR: Augrnentin 625rng
Chuẩn hóa dự kiến: Augmentin 625 mg
```

Nếu có nhiều ứng viên hoặc thông tin không đủ chắc chắn, hệ thống phải yêu cầu xác nhận thay vì tự chọn im lặng.

---

## 11. Nguyên tắc an toàn

1. Không tự kê đơn hoặc thay đổi chỉ định bác sĩ.
2. Phân biệt rõ `prescribed_frequency` và `reminder_schedule`.
3. Không biến giờ nhắc do người dùng chọn thành chỉ định y khoa.
4. Các lỗi ở hàm lượng, liều dùng, tần suất và thời gian phải được ưu tiên kiểm tra.
5. Khi độ tin cậy thấp, phải hiển thị cảnh báo và yêu cầu người dùng xác nhận.
6. Thông tin thuốc phải lấy từ nguồn được kiểm soát, không lấy trực tiếp từ trí nhớ của LLM.
7. Nếu dùng LLM, chỉ dùng để diễn giải thông tin đã được grounding từ cơ sở dữ liệu tin cậy.
8. Mọi kết quả tự động phải có khả năng truy vết về ảnh, vùng văn bản, kết quả OCR và nguồn dữ liệu.

---

## 12. Chỉ số đánh giá

### OCR

- Character Error Rate – CER.
- Word Error Rate – WER.

### Trích xuất

- Precision, Recall, F1 cho từng loại thực thể.
- Macro F1 và Micro F1.

### Quan hệ

- Relation Precision.
- Relation Recall.
- Relation F1.

### Chuẩn hóa và liên kết

- Drug Entity Linking Accuracy.
- Top-1 và Top-k linking accuracy.
- Complete Medication Entry Accuracy.

### An toàn

- Drug Accuracy.
- Strength Accuracy.
- Dose Accuracy.
- Frequency Accuracy.
- Duration Accuracy.
- Clinically Critical Error Rate.
- Tỷ lệ trường độ tin cậy thấp được yêu cầu xác nhận.
- Tỷ lệ lỗi nghiêm trọng sau khi người dùng xác nhận.

Không đánh giá hệ thống chỉ bằng CER/WER. Một OCR có điểm chữ tốt nhưng gán sai hàm lượng hoặc liều dùng vẫn là hệ thống không an toàn.

---

## 13. Tiêu chí hoàn thành tối thiểu

Đề tài được xem là đạt khi:

- Có dataset đã ẩn danh và có tài liệu mô tả rõ.
- Có bộ nhãn thực thể và quan hệ thống nhất.
- Có ít nhất P0, P1 và P3 để so sánh.
- Có pipeline từ ảnh đến kết quả cấu trúc.
- Có xử lý lỗi OCR tên thuốc và đơn vị/hàm lượng.
- Có cơ chế gán thông tin cho đúng thuốc.
- Có confidence và quy trình người dùng xác nhận.
- Có đánh giá bằng các chỉ số thực thể, quan hệ, liên kết và an toàn.
- Có prototype scan → verify → schedule.
- Có báo cáo giới hạn, failure cases và nguyên tắc an toàn.

---

## 14. Phân chia công việc nhóm 2 người

### Thành viên 1 – AI và nghiên cứu

- Tổng quan tài liệu.
- Thiết kế và gắn nhãn dataset.
- Tiền xử lý ảnh.
- Thử nghiệm OCR.
- Information Extraction.
- Relation Extraction.
- Drug Entity Linking.
- Thiết kế đánh giá và phân tích lỗi.

### Thành viên 2 – Hệ thống và ứng dụng

- Backend pipeline.
- Thiết kế cơ sở dữ liệu thuốc.
- Confidence và giao diện xác nhận.
- Scheduling engine.
- Giao diện web/mobile.
- Tra cứu thông tin thuốc có nguồn.
- Theo dõi trạng thái sử dụng thuốc.

### Thực hiện chung

- Chốt phạm vi.
- Chuẩn bị dataset.
- Thiết kế thực nghiệm.
- Đánh giá thống kê.
- Viết khóa luận và bài báo.
- Chuẩn bị demo và thuyết trình.

---

## 15. Lộ trình thực hiện

### Giai đoạn 1 – Chốt bài toán

- Chốt tên đề tài.
- Chốt phạm vi printed/semi-structured prescription.
- Chốt bộ nhãn và bộ quan hệ.
- Chốt tiêu chí đánh giá.

### Giai đoạn 2 – Dataset và baseline

- Thu thập/chuẩn hóa dữ liệu hợp pháp.
- Ẩn danh dữ liệu.
- Gắn nhãn thử nghiệm.
- Xây dựng P0.
- Ghi nhận lỗi phổ biến.

### Giai đoạn 3 – Trích xuất thông tin

- Xây dựng P1.
- Thử nghiệm layout-aware P2.
- So sánh kết quả theo mức độ khó.

### Giai đoạn 4 – Phương pháp đề xuất

- Xây dựng relation extraction.
- Xây dựng drug entity linking.
- Xây dựng confidence calibration.
- Xây dựng quy trình user verification.

### Giai đoạn 5 – Prototype

- Tích hợp backend và frontend.
- Tạo kế hoạch dùng thuốc.
- Tạo lịch nhắc.
- Hiển thị nguồn thông tin thuốc.

### Giai đoạn 6 – Đánh giá và viết báo cáo

- Đánh giá định lượng.
- Phân tích lỗi nghiêm trọng.
- So sánh các pipeline.
- Viết khóa luận.
- Viết bài báo.
- Chuẩn bị demo.

---

## 16. Các quyết định phải giữ nhất quán

Các quyết định sau không được thay đổi tùy tiện trong quá trình làm:

- Bài toán trung tâm là **Prescription Understanding**, không phải OCR đơn thuần.
- Kết quả cuối là **Structured and Verified Medication Plan**.
- Printed/semi-structured prescription là phạm vi chính.
- Quan hệ thuốc–hướng dẫn là thành phần bắt buộc.
- Entity linking phải dựa trên nhiều thuộc tính, không chỉ tên thuốc.
- Confidence-guided verification là thành phần an toàn bắt buộc.
- Lịch nhắc của người dùng phải tách khỏi chỉ định trên đơn.
- Dữ liệu thuốc phải có nguồn và có thể truy vết.
- Mọi kết quả phải được đánh giá bằng cả độ chính xác và mức độ an toàn.

---

## 17. Những việc không được làm

- Không tuyên bố hệ thống “hiểu đơn thuốc” nếu chỉ mới nhận diện chữ.
- Không dùng một vài ảnh mẫu để kết luận hệ thống chính xác.
- Không tự động sửa các trường nhạy cảm khi độ tin cậy thấp.
- Không trộn dữ liệu huấn luyện và dữ liệu kiểm thử.
- Không dùng dữ liệu đơn thuốc có thông tin cá nhân chưa được ẩn danh.
- Không lấy thông tin thuốc không có nguồn.
- Không để giao diện biến lịch nhắc thành chỉ định của bác sĩ.
- Không mở rộng sang chữ viết tay, tương tác thuốc hoặc LLM trước khi hoàn thành phạm vi lõi.

---

## 18. Mẫu dữ liệu đầu ra chuẩn

```json
{
  "prescription_id": "example-001",
  "source": "user_uploaded_image",
  "medications": [
    {
      "raw_text": "Augrnentin 625rng",
      "normalized_name": "Augmentin",
      "strength": "625 mg",
      "dose": "1 viên/lần",
      "frequency": "2 lần/ngày",
      "route": "uống",
      "timing": "sau ăn",
      "duration": "7 ngày",
      "confidence": {
        "drug": 0.98,
        "strength": 0.72,
        "dose": 0.95,
        "frequency": 0.94,
        "duration": 0.91
      },
      "requires_user_verification": ["strength"],
      "prescribed_frequency": "2/day",
      "reminder_schedule": ["08:00", "20:00"]
    }
  ]
}
```

---

## 19. Định nghĩa thành công của dự án

Dự án thành công khi chứng minh được rằng một ảnh đơn thuốc Việt Nam có thể được chuyển thành thông tin thuốc có cấu trúc và kế hoạch sử dụng thuốc có kiểm chứng, trong đó:

- Thông tin được gán đúng cho từng thuốc.
- Lỗi OCR phổ biến được xử lý có kiểm soát.
- Các trường quan trọng được cảnh báo khi không chắc chắn.
- Người dùng có thể xác nhận trước khi tạo lịch nhắc.
- Kết quả có nguồn, có thể truy vết và không thay thế quyết định của bác sĩ.

### Câu tuyên bố định hướng

> **Mục tiêu nghiên cứu không đơn thuần là đọc đơn thuốc chính xác, mà là xác định hệ thống có thể chuyển ảnh đơn thuốc Việt Nam thành một kế hoạch sử dụng thuốc có cấu trúc, được kiểm chứng và an toàn đến mức nào.**

---

## 20. Cách sử dụng tài liệu này

Trước mỗi quyết định về tính năng, mô hình hoặc phạm vi, nhóm phải kiểm tra:

1. Việc này có phục vụ bài toán Prescription Understanding không?
2. Có cải thiện trích xuất, liên kết hoặc kiểm chứng không?
3. Có đo lường được bằng thực nghiệm không?
4. Có bảo đảm an toàn và khả năng truy vết không?
5. Có vượt quá phạm vi khóa luận hiện tại không?

Nếu câu trả lời không rõ, ưu tiên hoàn thiện pipeline lõi và ghi ý tưởng đó vào phần hướng phát triển thay vì đưa ngay vào sản phẩm chính.


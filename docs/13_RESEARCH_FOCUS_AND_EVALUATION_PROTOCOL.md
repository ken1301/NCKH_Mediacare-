# Research Focus & Evaluation Protocol — MediCare v1

> Trạng thái: chốt định hướng cho giai đoạn annotation và thực nghiệm đầu tiên  
> Ngày: 2026-09-28  
> Mục tiêu: biến khoảng trống nghiên cứu thành giả thuyết, module, metric và safety gate có thể kiểm chứng.

## 1. Luận điểm nghiên cứu trung tâm

MediCare không cố chứng minh rằng mình có OCR tốt nhất. Luận điểm cần kiểm chứng là:

> **Một hệ thống hiểu đơn thuốc Việt Nam nên biết khi nào kết quả của nó không đủ chắc chắn, đặc biệt ở các trường có thể làm thay đổi cách dùng thuốc, và phải chuyển trường hợp đó sang xác minh bởi con người.**

Tên định hướng hiện tại:

> **Risk-Aware Vietnamese Prescription Understanding under OCR Uncertainty: Context-Aware Drug Linking and Confidence-Guided Human Verification**

Các thành phần `layout-aware extraction`, `relation extraction`, `drug linking` và `OCR preprocessing` vẫn là nền tảng bắt buộc. Chúng không được trình bày riêng lẻ là novelty chính.

## 2. Ranh giới contribution

### Contribution nghiên cứu

1. **Vietnamese prescription benchmark:** benchmark có entity, relation, normalized drug candidate và mức độ khó trong phạm vi quyền dữ liệu cho phép.
2. **Context-aware drug linking:** liên kết thuốc bằng tên, hàm lượng, dạng thuốc, hoạt chất nếu có, layout và ngữ cảnh; không chỉ dùng edit distance.
3. **Risk-aware confidence:** calibration theo field/record và selective prediction có quyền `accept`, `review` hoặc `abstain`.
4. **Safety-oriented evaluation:** đánh giá critical-field proxy error, risk–coverage và human verification burden bên cạnh F1.

### Không phải novelty chính

- Chọn PaddleOCR, VietOCR hoặc ML Kit.
- Chỉ thêm tọa độ vào NER.
- Reminder/scheduling.
- Chatbot/RAG.
- Dùng model nhỏ hoặc inference nhanh nếu không gắn với trade-off safety.

Các phần trên vẫn được phát triển cho sản phẩm, nhưng paper chỉ dùng chúng làm nền tảng, baseline hoặc deployment constraint.

## 3. Ranh giới giữa annotation, research output và app contract

Annotation vòng A/B tiếp tục dùng `medication.annotation.v1` tại `schemas/medication_annotation.schema.json`. Không thêm `ACTIVE_INGREDIENT`, nhãn risk hoặc nhãn lỗi vào schema này trong lúc Annotator B đang review.

Các trường nghiên cứu như `risk_level`, `risk_action`, `uncertainty_reason`, `error_type` và `criticality` là **derived evaluation fields**, lưu ở output đánh giá hoặc research adapter sau khi so sánh prediction với gold. Chúng không được làm thay đổi OCR output app-facing.

Projection sang app phải giữ nguyên nguyên tắc:

- Prescription fact khác user reminder.
- Không tự đoán giờ khi đơn chỉ ghi sáng/tối.
- Confidence thấp hoặc có xung đột phải trả review, không fallback im lặng.
- Chỉ tạo lịch sau khi người dùng xác nhận các trường bắt buộc.

## 4. Taxonomy lỗi và mức độ rủi ro

Đây là taxonomy dùng cho đánh giá prediction, không phải nhãn bắt buộc mà annotator phải tự suy đoán trên ảnh.

### 4.1. Nhóm lỗi

| Mã | Loại lỗi | Ví dụ |
|---|---|---|
| `WRONG_DRUG` | Nhận nhầm thuốc hoặc candidate | `Augmentin` thành một thuốc khác |
| `WRONG_STRENGTH` | Sai giá trị, dấu thập phân hoặc đơn vị | `0.5 mg` thành `5 mg` |
| `WRONG_DOSE` | Sai lượng dùng mỗi lần | `1 viên` thành `2 viên` |
| `WRONG_FREQUENCY` | Sai số lần hoặc khoảng cách dùng | `2 lần/ngày` thành `3 lần/ngày` |
| `WRONG_ROUTE` | Sai đường dùng | `uống` thành `tiêm` |
| `WRONG_RELATION` | Gắn hướng dẫn của thuốc này sang thuốc khác | Drug A nhận dose của Drug B |
| `OMISSION` | Bỏ sót thông tin có trên ảnh | Không trích xuất Strength nhìn thấy rõ |
| `HALLUCINATED_FIELD` | Tự thêm thông tin không có bằng chứng | Tự thêm giờ uống |
| `WRONG_DURATION` | Sai số ngày hoặc khoảng thời gian | `7 ngày` thành `14 ngày` |
| `WRONG_TIMING` | Sai thời điểm dùng | `sau ăn` thành `trước ăn` |
| `NORMALIZATION_ONLY` | Khác cách viết nhưng không đổi nghĩa | `1v` và `1 viên` |

### 4.2. Nhóm critical-field proxy

Mặc định, `DRUG`, `STRENGTH`, `DOSE`, `FREQUENCY`, `ROUTE` và quan hệ của chúng là nhóm **critical-field proxy**. `DURATION` và `TIMING` được báo cáo riêng vì có thể quan trọng tùy thuốc và ngữ cảnh.

`critical-field proxy` không đồng nghĩa với clinical harm. Chỉ được dùng cụm “clinical error” khi có rubric và đánh giá của người có chuyên môn phù hợp. Nếu chưa có, paper dùng `critical medication error proxy` hoặc `safety-critical field error`.

## 5. Định nghĩa metric đã chốt

### 5.1. Metric nền tảng

- OCR: `CER`, `WER` khi có transcription/reference phù hợp.
- Entity: strict span F1 và box/IoU F1 theo label.
- Relation: exact triple F1 theo `type + source + target`.
- Drug linking: `Top-1`, `Top-k`, `not_found/ambiguous` rate.

### 5.2. Complete Medication Accuracy

```text
CMA = số medication record đúng toàn bộ / số medication record đủ điều kiện đánh giá
```

Một record chỉ được tính đúng khi:

1. mọi trường bắt buộc trong gold được trích xuất đúng;
2. mọi relation cần thiết đúng endpoint và type;
3. normalized drug candidate đúng;
4. không có critical-field proxy error;
5. không thêm field không có bằng chứng.

Record bị `needs_review` vẫn có thể được đánh giá extraction, nhưng không được gọi là verified record.

### 5.3. Critical Field Error Rate

```text
CFER = số critical-field prediction sai / tổng critical-field prediction được hệ thống trả ra
```

Luôn báo cáo thêm:

- critical omission rate;
- hallucinated critical-field rate;
- wrong-relation rate;
- escaped critical error rate sau selective gate.

Không gộp tất cả lỗi vào một con số nếu chưa ghi rõ denominator.

### 5.4. Calibration

Confidence được đánh giá bằng correctness nhị phân của entity/field hoặc record:

- Expected Calibration Error (`ECE`);
- Brier Score;
- Negative Log-Likelihood khi mô hình cung cấp xác suất hợp lệ;
- reliability diagram.

Calibration phải fit trên validation set và khóa trước khi chạy test. Báo cáo tối thiểu trước/sau calibration, theo field quan trọng nếu đủ mẫu.

### 5.5. Selective prediction

Model có thể `predict` hoặc `abstain`. Với mỗi threshold, báo cáo:

```text
coverage = số field/record được auto-accept / tổng số field/record
risk = số prediction sai trong phần auto-accept / số prediction auto-accept
```

Đường cong chính là `risk–coverage curve`; đường cong phụ là `critical-risk–coverage curve`. Threshold không được chọn trên test set.

### 5.6. Human verification burden

Giai đoạn đầu báo cáo:

- verification rate;
- correction rate;
- số field cần xem lại mỗi sample;
- critical error còn sót sau gate.

Nếu UI được instrument sau này, bổ sung thời gian review, số click và số lần mở rộng candidate. Không tuyên bố giảm gánh nặng con người nếu chưa đo.

## 6. Risk decision policy

| Quyết định | Điều kiện tối thiểu | App projection |
|---|---|---|
| `ACCEPT` | confidence đã calibration vượt threshold, không có conflict/rule violation | Có thể prefill |
| `REVIEW` | confidence trung bình, thiếu bằng chứng hoặc field không đủ rõ | `needs_review=true` |
| `ABSTAIN` | critical field mơ hồ, candidate conflict, numeric ambiguity hoặc catalog conflict | Không tự normalize; yêu cầu xác nhận |

Các rule bắt buộc:

- Strength/Dose có xung đột không được auto-accept chỉ vì tên thuốc có confidence cao.
- Không tự chuyển `unknown frequency` thành `CUSTOM` nếu backend chưa hỗ trợ.
- Không tự tạo `timeSlots` từ “sáng/tối”.
- Không dùng catalog để bịa thêm thông tin không có trong prescription; catalog chỉ dùng để kiểm chứng/candidate ranking.

## 7. Baseline và ablation

### 7.1. Pipeline so sánh

| Mã | Pipeline |
|---|---|
| `B0` | OCR → Regex/Dictionary |
| `B1` | OCR → NER |
| `B2` | OCR → NER → fuzzy drug linking |
| `B3` | OCR + layout → entity/relation extraction |
| `P1` | `B3` + context-aware drug linking |
| `P2` | `P1` + confidence calibration |
| `P3` | `P2` + risk-aware selective prediction + human verification |

`B3` là baseline layout/IE gần với hướng hiện có trên literature. `P3` là pipeline nghiên cứu đầy đủ.

### 7.2. Ablation bắt buộc

- bỏ layout;
- bỏ context trong drug linking;
- bỏ catalog constraints;
- bỏ calibration;
- bỏ selective gate;
- thay risk threshold bằng một threshold chung;
- thay context-aware linking bằng fuzzy matching.

Mỗi ablation phải báo cáo ít nhất `CMA`, `CFER`, linking Top-1 và coverage/risk nếu thành phần đó có liên quan.

## 8. Dataset và protocol đánh giá

### 8.1. Quy tắc gold

- A và B làm độc lập trên cùng sample ID.
- Reviewer adjudicate disagreement.
- Chỉ record đã qua privacy gate, relation gate và reviewer gate mới là gold.
- `complete` của A/B chỉ là trạng thái vòng annotator, không phải gold.

### 8.2. Lộ trình kích thước

1. Pilot `20–50` sample: kiểm tra guideline, agreement và lỗi UI.
2. Benchmark tạm thời `100–300` sample: chạy baseline và ablation đầu tiên.
3. Mở rộng sau khi quy trình ổn định và quyền dữ liệu cho phép.

Không cam kết trước dataset `1.000–3.000` gold nếu chưa biết chi phí annotation, quyền công bố và khả năng adjudication.

### 8.3. Chống leakage

Split theo prescription/document source hoặc template; các ảnh thuộc cùng đơn, cùng nhóm template hoặc cùng patient phải ở cùng split nếu có thông tin đó. Không tune threshold trên test.

### 8.4. OCR noise

Phải tách hai setting:

- `real_ocr`: output OCR thật có reference/transcription tương ứng;
- `controlled_noise`: corruption có kiểm soát như nhầm ký tự, dấu thập phân, đơn vị và viết tắt.

Nếu VAIPE-P chỉ có word box/label mà không có raw OCR tương ứng, chỉ được kết luận chắc chắn về extraction/linking trên input đó; không gọi kết quả là robustness với OCR thực tế.

## 9. Mapping sang MediCare application

| Research output | App-facing behavior |
|---|---|
| calibrated confidence thấp ở Drug/Strength/Dose | highlight và bắt user xác nhận |
| frequency hiểu được nhưng thiếu giờ | giữ frequency, `timeSlots=null`, `frequencyRequiresReview=true` |
| candidate drug không duy nhất | không tự normalize, hiển thị candidate/verification |
| critical relation conflict | không cho tạo lịch cho đến khi xác nhận |
| verified medication plan | cho phép chuyển sang CreateMedicationRequest |

Application không được biến `accept` thành chỉ định bác sĩ và không được biến reminder thành prescription fact.

## 10. Tiêu chí đủ điều kiện viết kết luận

Chỉ viết kết luận mạnh khi:

- có gold adjudicated đủ cho metric tương ứng;
- có test split tách biệt;
- có so sánh với baseline và ablation;
- critical error proxy được định nghĩa trước khi xem kết quả test;
- confidence được đánh giá bằng calibration, không chỉ lấy softmax;
- mọi claim safety được giới hạn trong phạm vi proxy hoặc có đánh giá chuyên môn phù hợp.

Nếu chưa đủ dữ liệu, dùng câu “we investigate” hoặc “the system is designed to”, không dùng “proves safety” hoặc “reduces clinical harm”.

## 11. Việc cần làm ngay sau khi Annotator B hoàn tất

1. Export riêng A/B và tính entity/relation agreement.
2. Adjudicate pilot và tạo reviewer gold.
3. Gắn metadata difficulty và tình trạng có/không có OCR reference.
4. Chạy B0–B3 trên pilot.
5. Xây evaluation report cho `CMA`, `CFER`, omission, hallucination và relation error.
6. Sau khi có prediction score đủ ổn định, mới fit calibration và risk–coverage.
7. Cuối cùng mới benchmark latency/deployment trên cùng input và cùng phần cứng.

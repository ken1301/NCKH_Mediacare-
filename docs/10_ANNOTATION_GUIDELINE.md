# MediCare Medication Annotation Guideline v1

## 1. Mục đích và phạm vi

Guideline này dùng để tạo gold annotation cho P2 Medication NER và P3 Relation Extraction trên đơn thuốc Việt Nam in hoặc bán cấu trúc. Annotation phải giữ bằng chứng nhìn thấy trên ảnh/OCR; annotator không được suy đoán chỉ định, liều hoặc lịch uống còn thiếu.

Schema machine-readable:

```text
schemas/medication_annotation.schema.json
```

Nhãn nguồn phải có quyền sử dụng và được ẩn danh trước khi đưa ra ngoài môi trường được phê duyệt. VAIPE-P hiện đã được xác nhận quyền sử dụng cho nghiên cứu nội bộ; vẫn phải hoàn tất privacy review và lưu điều khoản/citation trước khi công bố.

## 2. Entity labels

| Label | Gán cho | Không gán cho |
|---|---|---|
| `DRUG` | Tên thương mại, tên generic hoặc tên thuốc nhìn thấy trên đơn | Tên bệnh viện, bác sĩ, bệnh nhân, chẩn đoán |
| `STRENGTH` | Hàm lượng/nồng độ của thuốc, ví dụ `500 mg`, `0,5 g` | Số lượng cấp phát hoặc số lần uống |
| `DOSE` | Lượng dùng mỗi lần, ví dụ `1 viên`, `5 ml` | Tần suất hoặc tổng số viên |
| `FORM` | Dạng thuốc, ví dụ viên, viên nang, siro, giọt | Tên thuốc hoặc đơn vị tổng số lượng |
| `ROUTE` | Đường dùng, ví dụ uống, bôi, nhỏ mắt | Hướng dẫn chung không chỉ rõ đường dùng |
| `FREQUENCY` | Số lần/chu kỳ dùng, ví dụ `2 lần/ngày`, `mỗi tuần` | Giờ cụ thể trong ngày |
| `DURATION` | Khoảng thời gian dùng, ví dụ `7 ngày`, `2 tuần` | Ngày kê đơn hoặc ngày tái khám |
| `TIMING` | Thời điểm liên quan bữa ăn hoặc buổi, ví dụ `sau ăn`, `sáng/tối` | Giờ reminder do user tự chọn |
| `INSTRUCTION` | Cụm hướng dẫn nguyên văn khi chưa tách chắc chắn thành các field trên | Không tự tạo từ kiến thức ngoài ảnh |

### Quy tắc span

1. Giữ span nhỏ nhất nhưng đủ nghĩa; không bao gồm dấu câu thừa nếu không cần.
2. Giữ nguyên text nhìn thấy, kể cả lỗi chính tả/OCR; `normalized_text` là field phụ, không thay raw text.
3. Nếu một cụm vừa có tên thuốc vừa có hàm lượng, tách thành entity riêng khi bbox/text cho phép.
4. Nếu không thể tách an toàn, giữ `INSTRUCTION` hoặc entity lớn hơn và đánh dấu `needs_review=true`.
5. Một entity phải có bbox ảnh gốc. Không tạo entity chỉ từ kiến thức thuốc ngoài đơn.

## 3. Relation labels

Mọi relation có hướng từ một `DRUG` đến đúng thuộc tính của thuốc đó:

```text
DRUG → HAS_STRENGTH → STRENGTH
DRUG → HAS_DOSE → DOSE
DRUG → HAS_FORM → FORM
DRUG → HAS_ROUTE → ROUTE
DRUG → HAS_FREQUENCY → FREQUENCY
DRUG → HAS_DURATION → DURATION
DRUG → HAS_TIMING → TIMING
DRUG → HAS_INSTRUCTION → INSTRUCTION
```

Quy tắc:

- Không tạo relation nếu không chắc entity thuộc thuốc nào.
- Không nối thuộc tính của thuốc trước với thuốc sau chỉ vì gần nhau trên ảnh.
- Với một thuốc có nhiều instruction/timing, tạo nhiều relation nếu mỗi span có bằng chứng riêng.
- Không suy ra `DRUG → HAS_FREQUENCY` từ câu `usage` nếu chưa xác định được quan hệ bằng layout/ngữ cảnh.
- Relation có source/target không tồn tại hoặc sai label là annotation lỗi.

## 4. Layout và thứ tự đọc

Annotator đọc theo layout đơn thuốc, không chỉ theo thứ tự file OCR:

1. Xác định vùng danh sách thuốc.
2. Xác định từng dòng/khối thuốc.
3. Gán các thuộc tính nằm cùng dòng, cùng cột hướng dẫn hoặc cùng block cho thuốc gần nhất khi có bằng chứng layout.
4. Khi nhiều thuốc nằm trong bảng, ưu tiên cột và hàng tương ứng hơn khoảng cách Euclidean.
5. Nếu layout mơ hồ, đánh dấu `needs_review` và không tạo relation đoán.

## 5. Trường hợp mơ hồ và an toàn

- `0,5 g` và `5 g` là hai giá trị khác nhau; không tự sửa theo kiến thức thuốc.
- `1v`, `1 viên`, `1 tab` có thể giữ raw text; normalization thực hiện ở pipeline sau annotation.
- `sáng/tối` là `TIMING` hoặc `FREQUENCY` tùy span có chứa số lần hay không; không biến thành `08:00/20:00`.
- `khi cần` là `FREQUENCY`/`INSTRUCTION` với review phù hợp; không tự tạo time slot.
- Thiếu duration không được gán `0 ngày`.
- Không dùng nhãn `diagnose`, `date`, `other` làm medication entity.

## 6. Quy trình hai annotator

### Pass A — độc lập

- Hai annotator làm riêng, không xem nhãn của nhau.
- Mỗi người ghi `annotator_id`, version guideline và các span/relation cần review.

### Pass B — agreement

Đo riêng:

- Span exact/IoU agreement theo label.
- Entity label agreement.
- Relation agreement theo triple `type + source + target`.
- Agreement cho các field an toàn: `DRUG`, `STRENGTH`, `DOSE`, `FREQUENCY`, `DURATION`.

Không gộp agreement entity với OCR accuracy hoặc linking accuracy.

### Pass C — adjudication

Reviewer quyết định các disagreement và ghi lý do. Chỉ bản adjudicated mới có `annotation_status=complete`. Bản còn tranh chấp dùng `needs_review`; bản chỉ có `DRUG/INSTRUCTION` như VAIPE-P hiện tại dùng `partial`.

## 7. Checklist trước khi đưa vào gold set

- [ ] Dataset có quyền sử dụng và đã review privacy.
- [ ] Không còn tên bệnh nhân, địa chỉ, số điện thoại hoặc chẩn đoán ngoài phạm vi chia sẻ.
- [ ] Mỗi entity có label hợp lệ, text và bbox hợp lệ.
- [ ] Mỗi relation source là `DRUG`, target đúng label.
- [ ] Không có relation suy đoán từ khoảng cách đơn thuần.
- [ ] `DRUG–STRENGTH–DOSE–FREQUENCY–DURATION` đã được review ở các mẫu dùng cho safety evaluation.
- [ ] Split train/validation/test theo prescription, không tách các crop cùng một đơn sang nhiều split.
- [ ] Gold set có version và hash manifest.

Queue review có thể tạo bằng `npm run build:medication-annotation-queue`. Queue chỉ lập danh sách công việc và giữ số relation hiện có; script không tự sinh relation, gold label hoặc metric.

## 8. Output tối thiểu

```json
{
  "schema_version": "medication.annotation.v1",
  "sample_id": "rx-001",
  "annotation_status": "complete",
  "entities": [
    {"id": "e1", "label": "DRUG", "text": "Augmentin", "bbox": [10, 20, 120, 50]},
    {"id": "e2", "label": "STRENGTH", "text": "625 mg", "bbox": [125, 20, 190, 50]},
    {"id": "e3", "label": "DOSE", "text": "1 viên", "bbox": [10, 55, 70, 80]},
    {"id": "e4", "label": "FREQUENCY", "text": "2 lần/ngày", "bbox": [75, 55, 170, 80]}
  ],
  "relations": [
    {"id": "r1", "type": "HAS_STRENGTH", "source_entity_id": "e1", "target_entity_id": "e2"},
    {"id": "r2", "type": "HAS_DOSE", "source_entity_id": "e1", "target_entity_id": "e3"},
    {"id": "r3", "type": "HAS_FREQUENCY", "source_entity_id": "e1", "target_entity_id": "e4"}
  ]
}
```

Đây là annotation gold, không phải app-facing output. Adapter sang app phải giữ nguyên bằng chứng và trạng thái review.

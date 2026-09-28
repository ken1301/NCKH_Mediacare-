# Annotation Handoff — Annotator A → Annotator B

Tài liệu này là checklist bàn giao trước khi Annotator B bắt đầu vòng annotation độc lập. Nó không thay thế schema hoặc
guideline; các quyết định nhãn nằm ở `docs/10_ANNOTATION_GUIDELINE.md`.

## 1. Trạng thái hiện tại

Snapshot kiểm tra ngày `2026-09-28` trên máy làm việc:

| Role | Saved | Complete | Needs review | Relations | Thư mục |
|---|---:|---:|---:|---:|---|
| Annotator A | 2 | 1 | 1 | 24 | `dataset/working/medication-annotations/annotator-a/` |
| Annotator B | 0 | 0 | 0 | 0 | Chưa tạo record |

Hai record của A đều tồn tại local, validator trả `valid: true`:

| Sample | Status | Entities | Relations | Ghi chú |
|---|---|---:|---:|---|
| `VAIPE_P_TRAIN_0` | `needs_review` | 13 | 10 | `HOẠT HUYẾT DƯỠNG NÃO` có hai `STRENGTH` cần kiểm chứng |
| `VAIPE_P_TRAIN_1` | `complete` | 17 | 14 | Complete trong vòng A, chưa phải gold |

Record của A đang được lưu local và bị `.gitignore`; hiện chưa có dữ liệu của B trong repository. Có thể xác nhận bằng:

```powershell
Invoke-RestMethod "http://127.0.0.1:4173/api/annotation/stats?annotator=annotator-a"
Invoke-RestMethod "http://127.0.0.1:4173/api/annotation/stats?annotator=annotator-b"
```

## 2. Quy tắc độc lập cho Annotator B

1. Chọn role `Annotator B` trong Studio.
2. Annotate lại `VAIPE_P_TRAIN_0` và `VAIPE_P_TRAIN_1` từ ảnh/OCR, không mở file của A và không xem ghi chú của A.
3. Kiểm tra `DRUG`, `STRENGTH`, `DOSE`, `TIMING` và từng relation theo guideline.
4. Nếu gặp nhiều hàm lượng trên cùng thuốc, chỉ tạo nhiều `HAS_STRENGTH` khi ảnh thực sự thể hiện nhiều giá trị.
5. Không nhầm `SL: 20 Viên` với `20mg`; khi chưa chắc thì để `needs_review` và ghi chú.
6. Chỉ đánh dấu `complete` khi đã kiểm tra toàn bộ bằng chứng; `complete` của B vẫn chưa phải gold.
7. Lưu trực tiếp trong role B. Không sao chép record từ role A.

## 3. Tiêu chí kết thúc vòng B

- B đã lưu cả hai sample.
- Cả hai record đều qua validator.
- Không còn entity/relation bị đánh dấu `needs_review` nếu B chọn `complete`.
- Mọi bất đồng được ghi trong `review.notes`.
- A và B đã export bundle riêng trước khi so sánh.

## 4. Đồng bộ và so sánh

Trên máy của B:

```powershell
npm run annotation:export -- --annotator annotator-b
git add dataset/annotations/incoming/annotator-b
git commit -m "data: sync annotator-b annotations"
git push
```

Trên máy tổng hợp:

```powershell
git pull
npm run annotation:import
npm run annotation:merge
```

Nếu A và B khác nhau, merge report ghi `conflict`; hệ thống không tự chọn một bản. Reviewer phải adjudicate, lưu role
`Reviewer`, export lại và chỉ khi đủ privacy/review gate mới được ghi vào `dataset/annotations/gold/`.

## 5. Không được làm trong vòng B

- Không sửa file trong `dataset/working/medication-annotations/annotator-a/`.
- Không commit raw image, raw OCR hoặc thư mục `dataset/working`.
- Không coi candidate hoặc record `complete` của A/B là gold.
- Không tự suy đoán hàm lượng, liều, tần suất hoặc giờ uống từ kiến thức ngoài ảnh.

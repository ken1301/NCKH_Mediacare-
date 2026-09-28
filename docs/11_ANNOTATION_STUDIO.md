# MediCare Annotation Studio

Annotation Studio là công cụ web local/offline để biến candidate annotation của VAIPE-P thành annotation đã được con người kiểm tra. Công cụ chỉ phục vụ nghiên cứu; candidate không được xem là gold và không được dùng trực tiếp để tính metric.

## Chạy công cụ

Từ thư mục repository:

```powershell
npm run annotation:studio
```

Mở `http://127.0.0.1:4173` trên cùng máy. Server chỉ bind vào `127.0.0.1`, không mở endpoint ra mạng LAN.

## Quy trình annotation

1. Chọn vai trò `Annotator A`, `Annotator B` hoặc `Reviewer`.
2. Chọn sample trong danh sách hoặc tìm theo `sample_id`.
3. Kiểm tra ảnh đơn thuốc, OCR word boxes và các entity candidate.
4. Sửa label, text và bounding box; bỏ chọn hoặc xóa candidate nếu không có bằng chứng trên ảnh.
5. Kiểm tra lại từng relation: source phải là `DRUG`, target phải đúng loại field.
6. Đánh dấu privacy/de-identification và quyền dùng cho research theo quy trình nhóm.
7. Chỉ đánh dấu `annotation complete` khi entity và relation đã được kiểm tra đầy đủ.
8. Bấm `Lưu annotation`; có thể lưu bản nháp nhiều lần.

Phím tắt: `←`/`→` chuyển sample, `Ctrl+S` hoặc `Cmd+S` lưu annotation.

## Nơi lưu dữ liệu

Review records được ghi local vào:

```text
dataset/working/medication-annotations/<annotator-id>/<sample-id>.json
```

Thư mục này đã được thêm vào `.gitignore` để không commit ảnh/annotation y tế vào repository. Raw dataset và candidate JSONL cũng không bị ghi đè.

## Điều kiện để chạy P2/P3

Annotation Studio chỉ tạo dữ liệu review. Pipeline thí nghiệm vẫn phải kiểm tra gate:

```powershell
npm run prepare:medication-experiment
```

Một sample chỉ được đưa vào training/evaluation khi có annotation hoàn tất, privacy đã review/approved, relation cần thiết và reviewer approval theo `docs/10_ANNOTATION_GUIDELINE.md`. Nếu chưa đạt, pipeline phải giữ trạng thái `blocked` và không được tự coi candidate là gold.

## Phân công khuyến nghị

- Annotator A và B làm độc lập trên cùng protocol.
- Reviewer xử lý các sample bất đồng hoặc có lỗi an toàn như strength/dose bị thiếu, nhầm hoặc liên kết sai thuốc.
- Chỉ export gold sau khi đã kiểm tra agreement và duyệt privacy.

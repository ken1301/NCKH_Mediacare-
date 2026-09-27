# Làm việc tạm thời với dataset Kaggle

## Quyết định

Trong thời gian chờ tác giả VAIPE-P phản hồi, nhóm được phép dùng bản Kaggle để:

- Kiểm tra cấu trúc file.
- Viết data loader.
- Chạy smoke test OCR/extraction.
- Phát hiện thiếu trường và lỗi định dạng.
- Chuẩn bị chuyển đổi annotation.

## Chưa được phép

- Đưa ảnh thô vào GitHub.
- Công bố dataset hoặc chia sẻ lại archive.
- Gọi kết quả là benchmark chính thức của MediCare.
- Viết kết luận nghiên cứu cuối dựa trên dataset này.
- Dùng dữ liệu trong production.

## Tiêu chí chuyển sang nguồn chính thức

Khi tác giả phản hồi, cập nhật `dataset/external/source_manifest.json` và quyết định một trong các trạng thái:

```text
approved_research
restricted_research
not_approved
```

Nếu được chấp thuận, ghi rõ điều kiện trích dẫn, công bố metric và lưu trữ dữ liệu. Nếu không được chấp thuận, chỉ giữ các code adapter không chứa dữ liệu và loại kết quả thử nghiệm khỏi báo cáo chính.


# External datasets (local only)

Thư mục này dành cho dataset tải về để thử nghiệm nội bộ. Raw images và archive không được commit lên GitHub.

## VAIPE-P Kaggle — temporary development source

Nguồn:

```text
https://www.kaggle.com/datasets/litrdng/vaipe-p
```

Trạng thái:

```text
UNVERIFIED — chỉ dùng cho prototype/kỹ thuật nội bộ
```

Đặt file tải về hoặc thư mục đã giải nén tại đây, ví dụ:

```text
dataset/external/vaipe-p.zip
dataset/external/vaipe-p/
```

## Quy tắc bắt buộc

- Không commit archive hoặc ảnh.
- Không đưa raw images vào issue, pull request hoặc demo công khai.
- Không công bố metric/bài báo dựa trên nguồn này như kết quả chính thức trước khi có quyền sử dụng.
- Không dùng cho sản phẩm production.
- Ghi lại version, ngày tải, URL và license trong `source_manifest.json`.

## Sau khi tải

1. Xác nhận số lượng file.
2. Kiểm tra cấu trúc annotation.
3. Kiểm tra ngôn ngữ và loại ảnh.
4. Kiểm tra thông tin cá nhân còn sót.
5. Chạy báo cáo coverage trước khi chuyển đổi nhãn.
6. Chỉ dùng dữ liệu sau khi hai thành viên review kết quả kiểm tra.


# Kiểm tra và chuyển annotation VAIPE-P

Các script này dành cho bản VAIPE-P Kaggle đang chờ xác nhận quyền sử dụng. Chúng chỉ phục vụ phát triển nội bộ.

## 1. Kiểm tra dataset

Sau khi giải nén dataset vào `dataset/external/vaipe-p/`, chạy:

```powershell
npm run inspect:dataset -- --input dataset/external/vaipe-p --output dataset/metadata/vaipe-p-inspection
```

Kết quả:

- `report.json`: số file, số ảnh, các định dạng annotation, nhãn/relation phát hiện được và cảnh báo heuristic về privacy.
- `report.md`: bản tóm tắt để review nhanh.

Script không đọc nội dung ảnh để tự OCR và không sửa raw dataset.

## 2. Chuyển annotation

Nếu annotation nằm trong cùng thư mục, chạy:

```powershell
npm run convert:dataset -- `
  --input dataset/external/vaipe-p `
  --output dataset/external/vaipe-p-medicare-annotations
```

Adapter hiện hỗ trợ các dạng thường gặp:

- MediCare-like JSON: `entities` và `relations`.
- Label Studio JSON: `annotations[].result` và relation `from_id/to_id`.
- COCO JSON: `images`, `categories`, `annotations`, bbox dạng `[x, y, width, height]`.
- JSON records có field `drug`, `strength`, `dose`, `frequency`, ...

Nhãn được chuyển sang:

`DRUG`, `ACTIVE_INGREDIENT`, `STRENGTH`, `DOSE`, `FORM`, `ROUTE`, `FREQUENCY`, `DURATION`, `TIMING`, `INSTRUCTION`.

Nhãn lạ, entity thiếu text, bbox thiếu hoặc relation không ghép được sẽ được đưa vào `review.notes`/`needs_review`; script không tự đoán nội dung y khoa.

## 3. Đầu ra và bảo mật

Mặc định đầu ra chuyển đổi nằm trong `dataset/external/`, vì vậy bị `.gitignore` chặn và không được push lên GitHub. `conversion-manifest.json` ghi số lượng bản ghi, entity, relation và cảnh báo.

Sau khi chạy, hai thành viên cần review:

1. `report.md` để biết dataset thực tế có annotation gì.
2. Một số file JSON đầu ra để kiểm tra mapping.
3. Các cảnh báo privacy và quyền sử dụng.
4. Tỷ lệ entity có `bbox`, có text và có relation trước khi dùng huấn luyện.

Không coi output này là annotation chính thức cho bài báo khi VAIPE-P chưa được cấp quyền sử dụng.

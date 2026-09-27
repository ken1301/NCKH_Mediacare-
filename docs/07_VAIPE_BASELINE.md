# VAIPE-P baseline

Mục tiêu của baseline là cố định một mốc thực nghiệm reproducible trước khi thử OCR/model mới.

## Dataset contract

VAIPE-P Kaggle hiện có 1.173 prescription JSON có word box và 1.345 ảnh PNG. `public_train` có nhãn; `public_test` trong bản tải về không có annotation. Nhãn nguồn gồm `drugname`, `usage`, `quantity`, `diagnose`, `date`, `other`.

Trong baseline medication, chỉ dùng:

- `drugname` → `DRUG`.
- `usage` → `INSTRUCTION`.

Không tự chuyển `usage` thành `DOSE`, `FREQUENCY` hoặc `TIMING`, vì VAIPE-P không cung cấp relation/annotation đủ để bảo đảm phép chuyển đó.

## Build manifest và split

```powershell
npm run build:baseline -- --input dataset/external/vaipe-p --output dataset/metadata/vaipe-p-baseline
```

Split được tạo ổn định bằng SHA-1 của `sample_id`, theo tỷ lệ 70/15/15. Toàn bộ word box của một prescription giữ trong cùng một split.

Output local:

- `summary.json` và `summary.md`.
- `train.json`, `validation.json`, `test.json`.
- `all.json` để chạy coverage trên toàn bộ mẫu có annotation.
- Các file `.jsonl` tương ứng để dùng cho pipeline.

## Evaluator

Evaluator nhận prediction JSON dạng:

```json
[
  {
    "sample_id": "VAIPE_P_TRAIN_0",
    "entities": [
      {"label": "DRUG", "text": "RENAPRIL", "bbox": [46, 386, 294, 413]}
    ]
  }
]
```

Chạy khi đã có prediction từ OCR:

```powershell
npm run evaluate:baseline -- `
  --manifest dataset/metadata/vaipe-p-baseline/test.json `
  --predictions path/to/predictions.json
```

Metrics gồm box precision/recall/F1 theo IoU 0.5, text exact accuracy, CER và WER. Nếu chưa truyền prediction, evaluator chỉ chạy coverage report với trạng thái `awaiting_predictions`, không tạo metric giả.

## Trạng thái dữ liệu

Dataset Kaggle vẫn `license=Unknown`, `access_status=unverified`, `approved_for_publication=false`. Tất cả manifest/report/raw data sinh từ dataset này chỉ lưu local.

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

PaddleOCR runner local:

```powershell
$py = "C:\Users\Hi\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
$env:USERPROFILE = "$(Resolve-Path runtime/home)"
$env:HOMEDRIVE = "D:"
$env:HOMEPATH = "\DoAn_MB1\NCKH_MediCare_repo\runtime\home"
$env:PADDLE_HOME = "$(Resolve-Path runtime/paddle-home)"
$env:PYTHONPATH = "$(Resolve-Path runtime/python)"
& $py scripts/run-paddleocr.py `
  --manifest dataset/metadata/vaipe-p-baseline/test.json `
  --input dataset/external/vaipe-p `
  --output dataset/metadata/vaipe-p-baseline/predictions-test.json `
  --model mobile
```

Smoke test trước khi chạy đủ 176 mẫu:

```powershell
& $py scripts/run-paddleocr.py `
  --manifest dataset/metadata/vaipe-p-baseline/test.json `
  --input dataset/external/vaipe-p `
  --output dataset/metadata/vaipe-p-baseline/predictions-smoke.json `
  --limit 1 `
  --model mobile
```

Sau đó đánh giá OCR:

```powershell
npm run evaluate:baseline -- `
  --manifest dataset/metadata/vaipe-p-baseline/test.json `
  --input dataset/external/vaipe-p `
  --predictions dataset/metadata/vaipe-p-baseline/predictions-test.json
```

### Kết quả P0 hiện tại

Chạy trên 176 mẫu test có nhãn bằng `PP-OCRv5_mobile_det` + `latin_PP-OCRv5_mobile_rec`, CPU, IoU threshold 0.5:

| Metric | Kết quả |
|---|---:|
| Gold word boxes | 6.159 |
| Predicted word boxes | 6.859 |
| Matched boxes | 4.932 |
| Box precision | 0.7191 |
| Box recall | 0.8008 |
| Box F1 | 0.7577 |
| Text exact accuracy | 0.4410 |
| Mean CER | 0.0682 |
| Mean WER | 0.2771 |

Đây là baseline OCR thuần, chưa phải kết quả medication understanding.

Chạy khi đã có prediction từ OCR:

```powershell
npm run evaluate:baseline -- `
  --manifest dataset/metadata/vaipe-p-baseline/test.json `
  --predictions path/to/predictions.json
```

Metrics OCR gồm box precision/recall/F1 theo IoU 0.5, text exact accuracy, CER và WER. Entity F1 chỉ được tính khi prediction có field `entities` với semantic labels. Nếu chưa truyền prediction, evaluator chỉ chạy coverage report với trạng thái `awaiting_predictions`, không tạo metric giả.

## P1 — exploratory drug linking

Tạo catalog ứng viên từ train split và đánh giá trên test split:

```powershell
npm run build:drug-candidates -- `
  --input dataset/external/vaipe-p `
  --manifest dataset/metadata/vaipe-p-baseline/train.json

npm run evaluate:drug-linking -- `
  --input dataset/external/vaipe-p `
  --manifest dataset/metadata/vaipe-p-baseline/test.json `
  --candidates dataset/metadata/vaipe-p-baseline/drug-candidates.json `
  --predictions dataset/metadata/vaipe-p-baseline/predictions-test.json
```

Kết quả P1 chỉ là exploratory vì catalog chưa được grounding bằng nguồn thuốc chính thức.

Kết quả chạy hiện tại: 129 candidate names từ train split; 57 liên kết đúng trên test, precision 1.0000, recall 0.1360, F1 0.2395. Recall thấp là tín hiệu cần cải thiện candidate retrieval/line grouping và cần trusted drug catalog; không được diễn giải là chất lượng thuốc production.

Tạo medication draft để kiểm tra luồng confidence/verification:

```powershell
npm run build:medication-drafts -- `
  --input dataset/external/vaipe-p `
  --manifest dataset/metadata/vaipe-p-baseline/test.json `
  --candidates dataset/metadata/vaipe-p-baseline/drug-candidates.json `
  --predictions dataset/metadata/vaipe-p-baseline/predictions-test.json
```

Draft chỉ có các trường có bằng chứng từ OCR. `DOSE`, `FREQUENCY`, `DURATION`, `TIMING` chưa được tự điền; mọi thuốc đều ở `needs_review`.

## Annotation readiness gate cho P2/P3

Schema annotation đầy đủ cho medication NER và relation extraction nằm tại:

```text
schemas/medication_annotation.schema.json
```

Validator chỉ kiểm tra tính hợp lệ của entity/relation, không tự tạo nhãn medication và không biến VAIPE-P thành annotation đầy đủ:

```powershell
npm run validate:medication-annotations -- `
  --input dataset/external/vaipe-p-medicare-annotations `
  --output dataset/metadata/vaipe-p-baseline/annotation-readiness.json
```

Các quan hệ được chấp nhận gồm `DRUG → HAS_STRENGTH/DOSE/FORM/ROUTE/FREQUENCY/DURATION/TIMING/INSTRUCTION`. Annotation partial không bị coi là lỗi, nhưng report phải ghi rõ thiếu relation hoặc thiếu field. Chỉ annotation `complete` đã được review mới đủ điều kiện làm gold label cho P2/P3.

Kết quả chạy trên VAIPE-P conversion hiện tại: `1.173/1.173` record hợp lệ về cấu trúc sau legacy compatibility; có `6.838` entity gồm `2.844 DRUG` và `3.994 INSTRUCTION`, nhưng có `0` relation và `0` record complete. Vì vậy dataset này hiện chỉ đủ cho P0/P1 exploratory và kiểm thử pipeline; chưa đủ làm gold label cho Medication NER/Relation Extraction.

## Pending cho các phase tiếp theo

- `P2 — Medication NER đầy đủ`: chờ annotation riêng cho `STRENGTH`, `DOSE`, `FREQUENCY`, `DURATION`, `TIMING`.
- `P3 — Relation Extraction`: chờ quan hệ `DRUG → HAS_*`; không suy ra relation chỉ từ khoảng cách giữa các word box.
- `P4 — Trusted Drug Entity Linking`: chờ nguồn CSDL thuốc chính thức có hoạt chất, hàm lượng, dạng thuốc và quyền truy cập rõ ràng.
- `P5 — Publication/production`: chờ xác nhận license/quyền sử dụng VAIPE-P; Kaggle mirror hiện chỉ là nguồn phát triển nội bộ.

## RQ6 — Deployment architecture benchmark

RQ6 được chạy sau khi model chính và medication pipeline ổn định. Mục tiêu là đo bằng số liệu thực nghiệm sự đánh đổi giữa accuracy, latency, computational cost và privacy; không kết luận kiến trúc chỉ từ cảm nhận “server chậm” hoặc “on-device nhẹ hơn”.

### Ba profile cần so sánh

| Profile | Đường đi dữ liệu | Phạm vi inference |
|---|---|---|
| Cloud/server | Thiết bị gửi ảnh → server → kết quả | OCR + prescription understanding trên server |
| Hybrid edge-cloud | Thiết bị tiền xử lý/OCR → server → kết quả | OCR một phần ở edge, understanding trên server |
| On-device | Ảnh được xử lý và giữ trên thiết bị | Toàn bộ pipeline khả thi trên thiết bị |

### Metrics và target

- **Accuracy:** dùng cùng tập test và metric P0–P3; khi chưa có annotation medication đầy đủ chỉ báo cáo OCR/box/text metric, không tạo medication metric giả.
- **Latency:** P50, P95, P99 cho từng stage và end-to-end.
- **Model/resource:** kích thước model trên disk, peak memory/RSS, CPU/GPU utilization.
- **Network:** request payload, response payload, tổng bytes và số round-trip.
- **Privacy:** ảnh gốc có rời thiết bị không, text OCR có rời thiết bị không, dữ liệu có lưu/log không, có bên thứ ba xử lý không.
- **Reliability:** timeout/error rate và số lần retry.

Target ban đầu của MediCare là **P95 end-to-end < 3 giây cho server inference**. Đồng hồ end-to-end bắt đầu khi client khởi tạo request/upload và kết thúc khi nhận response; server-only latency phải đo riêng để không che khuất chi phí mạng.

### Protocol bắt buộc

1. Dùng cùng một tập test cố định, cùng preprocessing, cùng model checkpoint và cùng output schema cho cả ba profile.
2. Ghi rõ hardware, OS, runtime, phiên bản model, network condition và warm-up policy.
3. Chạy warm-up trước; đo toàn bộ test set nếu có thể. Nếu lặp mẫu, phải báo số lần lặp và seed.
4. Lưu raw timing/resource logs ở local report; chỉ commit script, schema và summary không nhạy cảm.
5. Không upload raw VAIPE-P hoặc dữ liệu đơn thuốc chưa được phê duyệt lên cloud bên ngoài. Giai đoạn hiện tại chỉ benchmark local/loopback hoặc dữ liệu đã có quyền rõ ràng.

Protocol chi tiết và schema log nằm tại [`docs/08_DEPLOYMENT_BENCHMARK.md`](08_DEPLOYMENT_BENCHMARK.md).

Các phase pending này không được thay thế bằng metric giả hoặc bằng cách dùng nhãn gold của test làm prediction.

## Trạng thái dữ liệu

Dataset Kaggle vẫn `license=Unknown`, `access_status=unverified`, `approved_for_publication=false`. Tất cả manifest/report/raw data sinh từ dataset này chỉ lưu local.

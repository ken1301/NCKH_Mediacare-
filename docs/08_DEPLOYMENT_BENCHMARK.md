# RQ6 — Deployment Architecture Benchmark

## Câu hỏi nghiên cứu

**What is the trade-off between inference accuracy, latency, computational cost, and privacy across cloud, hybrid edge-cloud, and on-device deployment strategies?**

RQ6 là phase đánh giá sau khi model prescription understanding chính đã ổn định. Mục tiêu là lựa chọn kiến trúc triển khai bằng số liệu có thể lặp lại, không đánh đổi an toàn dữ liệu để lấy một con số latency đẹp.

## Phạm vi so sánh

| Profile | Pipeline | Giả thuyết cần kiểm chứng |
|---|---|---|
| Cloud/server | Upload ảnh → server OCR → server understanding → response | Có thể đạt accuracy cao và dễ quản lý model, nhưng phụ thuộc mạng và gửi ảnh ra ngoài thiết bị |
| Hybrid edge-cloud | Edge preprocessing/OCR → server understanding → response | Giảm payload/quyền riêng tư so với cloud toàn phần nhưng vẫn giữ server cho phần model nặng |
| On-device | OCR + extraction/linking trên thiết bị | Giữ dữ liệu cục bộ và giảm phụ thuộc mạng, nhưng chịu giới hạn tài nguyên/model |

Các nhận định trong cột “giả thuyết” chỉ là giả thuyết trước thực nghiệm.

## Metrics

### Accuracy

Dùng đúng test set và evaluator của pipeline:

- P0: box precision/recall/F1, text exact accuracy, CER, WER.
- P1–P3 khi đã có annotation tương ứng: entity F1, relation F1, linking accuracy, complete medication entry accuracy và clinically critical error rate.

Không so sánh một profile bằng OCR metric với profile khác bằng medication metric. Nếu annotation chưa đủ, kết quả phải ghi rõ `metric_status=partial`.

### Latency

Đo:

- `end_to_end_ms`: từ lúc client bắt đầu upload/request đến lúc nhận response hoàn chỉnh.
- `server_inference_ms`: thời gian server xử lý, không gồm network.
- Stage latency: preprocess, OCR, extraction, linking, serialization.
- P50, P95 và P99; kèm timeout/error rate.

Target ban đầu: **P95 end-to-end < 3.000 ms cho server inference**. Target này là ngưỡng kỹ thuật để tối ưu, không phải bằng chứng rằng hệ thống đã đạt trước khi benchmark.

### Computational cost

- Kích thước model trên disk và tổng artifact cần tải.
- Peak memory/RSS.
- CPU utilization; GPU utilization và VRAM nếu có.
- Runtime/model version và hardware để kết quả có thể diễn giải.

### Network và privacy

- Request payload bytes.
- Response payload bytes.
- Tổng bytes và số round-trip.
- Ảnh gốc có rời thiết bị không.
- Text OCR, embedding hoặc metadata nào rời thiết bị.
- Dữ liệu có được lưu/log hay gửi qua bên thứ ba không.

Privacy phải được báo cáo theo đường đi dữ liệu thực tế, không suy ra chỉ từ tên “hybrid” hoặc “on-device”.

## Protocol reproducible

1. Khóa một test manifest, model checkpoint, preprocessing, output schema và seed.
2. Ghi hardware, OS, runtime, commit SHA, model SHA, network condition và cấu hình quantization.
3. Warm-up trước khi đo; loại warm-up khỏi latency report.
4. Chạy toàn bộ test set 176 mẫu VAIPE-P hiện có nếu phase vẫn dùng tập này. Khi có dataset được cấp quyền, chạy lại cùng protocol trên dataset đó.
5. Ghi stage timestamps theo monotonic clock và resource samples trong lúc inference.
6. Báo cáo cả phân phối latency và các request lỗi/timeout; không chỉ báo cáo trung bình.
7. Không đưa raw image, OCR text hoặc thông tin thuốc nhạy cảm vào Git. Report raw chỉ lưu local/được kiểm soát quyền truy cập.

### Giới hạn dữ liệu hiện tại

VAIPE-P hiện có `license=Unknown`, nhưng quyền sử dụng cho nghiên cứu đã được xác nhận và ghi trong `dataset/external/source_manifest.json`. `approved_for_publication=false` vẫn được giữ nguyên: không upload raw dataset lên cloud bên ngoài, không công bố raw data và chỉ dùng kết quả theo đúng điều khoản đã được cấp. Các điều khoản/citation chính thức vẫn phải được lưu kèm hồ sơ trước khi công bố.

## Output schema đề xuất

```json
{
  "run_id": "2026-09-28T000000Z",
  "profile": "cloud|hybrid|on_device",
  "commit_sha": "...",
  "dataset_manifest_sha256": "...",
  "model": {"name": "...", "sha256": "...", "size_bytes": 0},
  "environment": {"hardware": "...", "runtime": "...", "network": "..."},
  "metrics": {
    "accuracy": {"status": "full|partial", "box_f1": 0.0},
    "latency_ms": {"p50": 0.0, "p95": 0.0, "p99": 0.0},
    "peak_memory_mb": 0.0,
    "cpu_percent": 0.0,
    "gpu": {"used": false, "utilization_percent": null, "vram_mb": null},
    "network_bytes": {"request": 0, "response": 0, "total": 0},
    "error_rate": 0.0
  },
  "privacy": {
    "raw_image_leaves_device": false,
    "ocr_text_leaves_device": false,
    "retention_policy": "...",
    "third_party_processor": "none|declared"
  }
}
```

## Quyết định kiến trúc

Sau benchmark, nhóm lập bảng trade-off và chọn architecture theo thứ tự ưu tiên:

1. Không tạo clinically critical error mới.
2. Đạt P95 end-to-end dưới 3 giây hoặc ghi rõ lý do chưa đạt.
3. Giảm dữ liệu nhạy cảm rời thiết bị tối đa trong phạm vi accuracy chấp nhận được.
4. Phù hợp tài nguyên và độ phức tạp vận hành của nhóm 2 người.

Định hướng thử nghiệm ban đầu là **on-device OCR + server-side prescription understanding**, nhưng chỉ trở thành quyết định chính thức sau khi có số liệu accuracy, latency, resource, payload và privacy.

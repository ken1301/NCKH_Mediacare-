# Checklist tiếp nhận VAIPE-P

## 1. Bản ghi nguồn hiện tại

| Trường | Giá trị |
|---|---|
| Dataset | `VAIPE-P` |
| Kaggle ref | `litrdng/vaipe-p` |
| Kaggle URL | https://www.kaggle.com/datasets/litrdng/vaipe-p |
| Kaggle license | `Unknown` |
| Kaggle status | Public, version 1, Ready |
| Dữ liệu chính thức | VAIPE / VinUni–Illinois Smart Health Center |
| Mục tiêu sử dụng | Nghiên cứu OCR và Prescription Understanding |
| Trạng thái MediCare | Đã tải; quyền sử dụng cho nghiên cứu đã được xác nhận; chưa được phép công bố raw data/metric |

## 2. Cách tiếp nhận dữ liệu

### Ưu tiên A — Xin từ nguồn chính thức

Liên hệ nhóm VAIPE/VinUni–HUST qua trang chính thức:

- https://vaipe.health/
- https://smarthealth.vinuni.edu.vn/resources/

Nội dung cần hỏi:

1. Link tải VAIPE-P phiên bản hiện hành.
2. License hoặc điều khoản sử dụng cho nghiên cứu sinh viên.
3. Có được dùng làm train/test cho khóa luận và bài báo không.
4. Có được công bố metric hoặc sample annotation không.
5. Có yêu cầu trích dẫn bài báo/dataset nào không.

### Ưu tiên B — Kiểm tra bản Kaggle

Chỉ dùng bản Kaggle để kiểm tra kỹ thuật trong kho riêng khi chưa có xác nhận license.

Không commit vào Git:

```text
dataset/external/
*.zip
*.jpg
*.jpeg
*.png
```

## 3. Mẫu email xin quyền sử dụng

```text
Subject: Request for research access to VAIPE-P prescription dataset

Dear VAIPE research team,

We are a two-student research group developing MediCare, a graduation thesis
and scientific research project on Vietnamese prescription understanding.
Our research focuses on OCR, medication information extraction, drug entity
linking, relation extraction, and confidence-guided verification.

We would like to request access to the VAIPE-P prescription dataset for
non-commercial academic research. We will not redistribute the raw images,
will keep the data outside our public GitHub repository, and will cite the
dataset and related publications as requested.

Could you please advise us on:

1. The official download/access procedure;
2. The applicable license or research-use terms;
3. Required citation and attribution;
4. Whether model evaluation results may be published in a thesis or paper.

Project repository:
https://github.com/ken1301/NCKH_Mediacare-

Best regards,
[Student names]
[University / Faculty]
```

## 4. Kiểm tra sau khi có file

Không chạy huấn luyện ngay. Thực hiện theo thứ tự:

1. Tính checksum và ghi ngày tải.
2. Kiểm tra cấu trúc thư mục và số lượng file.
3. Xem mẫu ảnh bằng tay.
4. Kiểm tra ngôn ngữ và loại đơn.
5. Tìm thông tin cá nhân còn sót.
6. Xác định annotation có sẵn: OCR, bbox, pill name, prescription text hay không.
7. So sánh nhãn với `dataset/templates/annotation.template.json`.
8. Tạo báo cáo coverage và danh sách trường còn thiếu.
9. Chỉ sau khi review privacy và license mới đưa vào pipeline nghiên cứu.

## 5. Tiêu chí quyết định dùng dataset

### Được dùng cho nghiên cứu chính khi

- Có nguồn/điều khoản sử dụng rõ ràng hoặc có xác nhận quyền nghiên cứu được lưu trong hồ sơ dự án.
- Có thể truy xuất nguồn và phiên bản.
- Dữ liệu đã được ẩn danh hoặc có xác nhận phù hợp.
- Có đủ ảnh và annotation cho mục tiêu đã chốt.
- Có thể trích dẫn đúng nguồn.

### Chỉ dùng tham khảo kỹ thuật khi

- License vẫn là `Unknown`.
- Không xác định được provenance.
- Chỉ có ảnh nhưng không có ground truth cần thiết.
- Không rõ quyền công bố metric.

# Các nguồn dataset đã tìm thấy

## Kết luận ưu tiên

### 1. VAIPE-P — nguồn phù hợp nhất

- Trang dự án: [VAIPE](https://vaipe.health/)
- Trang giới thiệu dataset: [VinUni–Illinois Smart Health Center — Resources](https://smarthealth.vinuni.edu.vn/resources/)
- Bản Kaggle được re-upload: [VAIPE-P trên Kaggle](https://www.kaggle.com/datasets/litrdng/vaipe-p)
- Bài nghiên cứu liên quan: [PIMA — Pill-Prescription Matching](https://arxiv.org/abs/2209.01152)

### Vì sao phù hợp

- Là ảnh đơn thuốc Việt Nam, không chỉ là ảnh thuốc.
- Được thu thập từ nhiều bệnh viện ở Việt Nam.
- Phản ánh nhiều mẫu biểu và bố cục đơn thuốc.
- Có thể dùng làm nền cho OCR, layout understanding và prescription understanding.
- Bài nghiên cứu PIMA mô tả một phần dataset gồm 1.527 đơn thuốc từ bệnh nhân ẩn danh; trang Smart Health Center hiện giới thiệu VAIPE-P ở quy mô hơn 50.000 ảnh.

### Cảnh báo sử dụng

- Bản Kaggle hiện hiển thị giấy phép là `Unknown`.
- Không đưa dữ liệu tải về lên repository của MediCare.
- Không công bố lại dữ liệu hoặc dùng cho sản phẩm thương mại trước khi xác nhận quyền sử dụng.
- Cần ưu tiên tải từ nguồn chính thức hoặc gửi email xin xác nhận quyền nghiên cứu.
- Giữ lại thông tin phiên bản, URL, ngày tải và điều khoản khi nhận dataset.

## 2. VAIPE 2022 challenge subset

- [GitHub mirror và hướng dẫn](https://github.com/anminhhung/Medicine_Pill_Image_Recognition_Challenge)
- [Kaggle profile của người re-upload](https://www.kaggle.com/tommyngx/datasets)

README của mirror ghi nhận subset cuộc thi có khoảng 1.173 ảnh đơn thuốc train và 172 ảnh đơn thuốc test, cùng dữ liệu ảnh viên thuốc. Đây là lựa chọn tốt để thử pipeline sớm nếu quyền tải và quyền nghiên cứu được xác nhận.

Không coi các link mirror là nguồn pháp lý gốc. Cần đối chiếu với VAIPE/VinUni trước khi dùng làm dataset công bố.

## 3. Dataset prescription tổng hợp trên Hugging Face

- [Medical Prescription Dataset](https://huggingface.co/datasets/chinmays18/medical-prescription-dataset)
- [Repository tạo dataset](https://github.com/JonSnow1807/Medical-Prescription-OCR)

Dataset có 1.000 ảnh tổng hợp và annotation JSON; nội dung mẫu là tiếng Anh và metadata cho thấy có tên bệnh nhân/địa chỉ giả lập. Nguồn này chỉ phù hợp để kiểm tra pipeline document OCR, không phù hợp làm dữ liệu chính cho đề tài tiếng Việt.

## 4. Vietnamese-OCR repository

- [vitmetmoi/Vietnamese-OCR](https://github.com/vitmetmoi/Vietnamese-OCR)

Repository có pipeline OCR tiếng Việt và mẫu structured extraction cho prescription, nhưng không phải một prescription dataset chuẩn có annotation đầy đủ. Có thể tham khảo mô hình và format output, không xem là nguồn dataset chính.

## 5. Nguồn phụ cho OCR tiếng Việt

- [ViOCRVQA](https://arxiv.org/abs/2404.18397)

Đây là benchmark OCR-VQA tiếng Việt nói chung, không phải dữ liệu đơn thuốc. Chỉ dùng làm nguồn hỗ trợ cho OCR tiếng Việt hoặc benchmark ngoài miền.

## 6. Quyết định cho MediCare

```text
Ưu tiên 1: Xin/tải VAIPE-P từ nguồn chính thức
Ưu tiên 2: Kiểm tra VAIPE 2022 challenge subset
Ưu tiên 3: Dùng Kaggle mirror để kiểm tra kỹ thuật, chưa công bố kết quả như dữ liệu có giấy phép
Ưu tiên 4: Dùng dataset tổng hợp khác chỉ cho smoke test
```

Nhóm **không bắt đầu bằng việc tự tạo dataset**. Chỉ tạo dữ liệu bổ sung khi:

- VAIPE-P không thể truy cập; hoặc
- VAIPE-P thiếu trường annotation cần cho relation extraction; hoặc
- Cần controlled test để đo lỗi OCR cụ thể.

## 7. Việc cần làm ngay

1. Kiểm tra quyền truy cập và điều khoản của VAIPE-P.
2. Tải một bản nhỏ/subset vào kho dữ liệu riêng ngoài GitHub.
3. Kiểm tra cấu trúc file, ngôn ngữ, annotation và thông tin định danh.
4. Đối chiếu với `annotation.template.json` của MediCare.
5. Chỉ sau khi kiểm tra xong mới quyết định dùng VAIPE-P làm train/test hoặc cần chuyển đổi nhãn.


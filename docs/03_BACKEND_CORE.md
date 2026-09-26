# Bước 3 — Backend lõi và verification workflow

## Chạy backend

```bash
npm start
```

Mặc định server chạy tại `http://localhost:3000`.

## Chạy test

```bash
npm test
```

## API hiện có

### Health check

```http
GET /health
```

### Tạo medication plan

```http
POST /prescriptions
Content-Type: application/json
```

Body phải tuân theo `schemas/medication_plan.schema.json` ở mức domain tối thiểu.

### Xem plan

```http
GET /prescriptions/{plan_id}
```

### Xác nhận trường thuốc

```http
POST /prescriptions/{plan_id}/verify
Content-Type: application/json

{
  "medication_id": "med-001",
  "fields": ["strength"]
}
```

### Tạo lịch nhắc

```http
POST /prescriptions/{plan_id}/schedule
Content-Type: application/json

{
  "medication_id": "med-001",
  "times": ["08:00", "20:00"]
}
```

Lịch nhắc chỉ được tạo khi plan và medication đã `verified`.

## Giới hạn hiện tại

- Store đang lưu trong bộ nhớ, restart server sẽ mất dữ liệu.
- Chưa có authentication.
- Chưa kết nối OCR, dataset hoặc drug database thật.
- Đây là backend prototype, chưa dùng cho dữ liệu y tế thật.


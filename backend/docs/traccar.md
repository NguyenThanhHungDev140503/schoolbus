# Traccar GPS Tracking Platform

## Tổng quan

- **Loại dịch vụ:** Nền tảng GPS mã nguồn mở, có thể tự host hoặc dùng gói cloud của Traccar.
- **Khả năng thiết bị:** Hỗ trợ trên 2.000 model phần cứng và ứng dụng di động, cho phép triển khai đồng thời nhiều chuẩn cảm biến (`Traccar – GPS Tracking Software`, https://www.traccar.org/, truy cập 2025-11-26).
- **Tính năng nổi bật:** Theo dõi thời gian thực, cảnh báo tuỳ chỉnh, báo cáo chuyến đi, ứng dụng web/mobile đầy đủ.

## Mô hình dữ liệu & năng lực

- **Thiết bị & vị trí:** Mọi thiết bị được quản lý như `Device` và phát sinh `Position` cùng `Event`. Dữ liệu vị trí lưu cả lịch sử và có thể xuất ra JSON/CSV/GPX (`Traccar API Reference`, https://www.traccar.org/api-reference/, truy cập 2025-11-26).
- **Báo cáo & phân tích:** Các endpoint `/reports/*` cung cấp tổng hợp hành trình, dừng đỗ, sự kiện với định dạng JSON/XLSX.
- **Thông báo:** `/notifications` cho phép tạo rule cảnh báo và test trực tiếp qua email/SMS nếu cần.

## API & giao thức

| Nhóm | Endpoint chính | Ghi chú |
| --- | --- | --- |
| Phiên đăng nhập | `POST /api/session`, `GET /api/session?token=...` | Hỗ trợ cookie, Basic Auth và bearer token. |
| Thiết bị & vị trí | `GET /api/devices`, `GET /api/positions`, `DELETE /api/positions/{id}` | Lọc theo `deviceId`, phạm vi thời gian hoặc danh sách `id`. |
| WebSocket | `GET /api/socket` | Luồng JSON chứa `devices`, `positions`, `events` – yêu cầu cookie phiên. |
| Báo cáo | `GET /api/reports/{summary|route|events|trips|stops}` | Chấp nhận nhiều `deviceId`/`groupId` song song, trả JSON hoặc Excel. |
| Quản trị | `/api/users`, `/api/groups`, `/api/permissions` | Tách quyền admin/manager/user, phù hợp multi-tenant. |

Tất cả endpoint dùng cùng base URL, phản hồi theo chuẩn REST với mã trạng thái HTTP chuẩn.

## Tích hợp cho School Bus Management System

1. **Tuỳ chọn triển khai:**
   - *Self-host* trên hạ tầng hiện tại (Docker/VM) để tận dụng quyền truy cập DB nội bộ.
   - *Hosted account* nếu muốn giảm chi phí vận hành ban đầu, vẫn truy cập API bằng token.
2. **Đồng bộ thiết bị:**
   - Import danh sách bus tracker vào module `Device`, lưu `uniqueId` trùng với IMEI thiết bị hiện có để đồng bộ sự kiện.
   - Sử dụng `/api/groups` để map tuyến/đội xe → cho phép phân quyền driver hoặc trường.
3. **Luồng dữ liệu:**
   - **Realtime:** Mở kết nối WebSocket `/api/socket` từ dịch vụ NestJS để cập nhật `LocationEvent` và đẩy vào bảng `location_event`.
   - **Batch:** Định kỳ query `/api/positions?deviceId=&from=&to=` nhằm đồng bộ vào kho lịch sử, phòng trường hợp websocket gián đoạn.
4. **An ninh:**
   - Lưu token ở secret manager; áp dụng refresh token bằng endpoint `/api/session?token=...` để tránh lưu plain password.
   - Bật HTTPS và reverse proxy (Nginx) khi self-host để tránh gửi cookie phiên qua HTTP.

## Ưu điểm & hạn chế

**Ưu điểm**

- Hoàn toàn mã nguồn mở, có thể tùy biến và triển khai on-premise.
- API phong phú (thiết bị, người dùng, báo cáo, thông báo) kèm tài liệu OpenAPI chính thức.
- WebSocket built-in giúp giảm chi phí xây dựng dịch vụ push riêng.

**Hạn chế**

- Không có gói SaaS “miễn phí” lâu dài; bản cloud tính phí theo thiết bị.
- WebSocket chỉ nhận cookie → cần proxy nếu sử dụng token thuần.
- Chưa có chức năng geocoding/bản đồ, cần tích hợp thêm (ví dụ Google Maps).

## Yêu cầu vận hành

- **Hạ tầng:** Java 17+, PostgreSQL/MySQL; nên triển khai cùng Redis nếu bật cache báo cáo.
- **Giám sát:** Theo dõi queue event và thread pool vì WebSocket dùng cùng JVM thread.
- **Sao lưu:** Lưu lịch sử vị trí trong DB lớn; cân nhắc retention policy hoặc cold storage.

## Tham khảo

1. Traccar – GPS Tracking Software, https://www.traccar.org/, truy cập 2025-11-26.
2. Traccar API – REST & WebSocket reference, https://www.traccar.org/traccar-api/, truy cập 2025-11-26.
3. Traccar API Reference (OpenAPI), https://www.traccar.org/api-reference/, truy cập 2025-11-26.


# Project Brief - School Bus Management System

## Tổng quan dự án

**Tên dự án:** School Bus Management System (Hệ thống quản lý xe buýt trường học)  
**Loại ứng dụng:** Web Application (Full-stack)  
**Mục tiêu:** Xây dựng hệ thống quản lý vận chuyển học sinh bằng xe buýt, theo dõi vị trí xe, quản lý điểm danh và thông báo cho phụ huynh.

## Yêu cầu cốt lõi

### 1. Quản lý người dùng
- **Admin:** Quản trị viên hệ thống, quản lý toàn bộ dữ liệu
- **Driver (Tài xế):** Quản lý thông tin chuyến đi, điểm danh học sinh
- **Parent (Phụ huynh):** Theo dõi vị trí xe, nhận thông báo về con em

### 2. Quản lý xe buýt và tuyến đường
- Quản lý thông tin xe buýt (biển số, sức chứa, vị trí hiện tại)
- Quản lý tuyến đường và các điểm dừng
- Lên lịch trình chạy xe theo ngày trong tuần

### 3. Theo dõi chuyến đi
- Theo dõi trạng thái chuyến đi (pending, in_progress, completed, cancelled)
- Ghi nhận sự kiện vị trí của xe
- Điểm danh học sinh (picked_up, dropped_off, absent)

### 4. Thông báo
- Gửi thông báo cho phụ huynh về tình trạng chuyến xe
- Các loại thông báo: warning, info, delay, arrival

## Phạm vi dự án

### Trong phạm vi (In Scope)
- API Backend với NestJS
- Database PostgreSQL với Prisma ORM
- Frontend React với Google Maps integration
- Authentication và Authorization
- CRUD operations cho tất cả entities
- Real-time location tracking

### Ngoài phạm vi (Out of Scope)
- Mobile application
- Push notifications (Firebase)
- Payment integration
- Advanced analytics/reporting

## Các bên liên quan

| Vai trò | Trách nhiệm |
|---------|-------------|
| Admin | Quản lý toàn bộ hệ thống, user, xe buýt, tuyến đường |
| Driver | Thực hiện chuyến đi, điểm danh học sinh |
| Parent | Theo dõi xe, nhận thông báo về con em |

## Tiêu chí thành công
1. API Backend hoạt động ổn định với đầy đủ CRUD operations
2. Frontend hiển thị bản đồ và vị trí xe theo thời gian thực
3. Authentication/Authorization hoạt động chính xác
4. Hệ thống thông báo hoạt động đúng
5. Database schema đúng chuẩn và có quan hệ rõ ràng


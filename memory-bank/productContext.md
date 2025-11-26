# Product Context - School Bus Management System

## Vì sao dự án này tồn tại?

Hệ thống quản lý xe buýt trường học được phát triển để giải quyết các vấn đề thực tế:

1. **Thiếu thông tin real-time:** Phụ huynh không biết xe buýt đang ở đâu, con em đã lên/xuống xe chưa
2. **Quản lý thủ công:** Việc điểm danh, lên lịch trình thường làm thủ công, dễ sai sót
3. **Khó theo dõi:** Nhà trường khó theo dõi hoạt động của đội xe

## Vấn đề được giải quyết

### Đối với Phụ huynh
- Theo dõi vị trí xe buýt real-time trên bản đồ
- Nhận thông báo khi con lên/xuống xe
- Biết được xe đến điểm đón/trả khi nào

### Đối với Tài xế
- Có danh sách học sinh cần đón/trả mỗi chuyến
- Dễ dàng điểm danh học sinh
- Thông báo cho phụ huynh khi có vấn đề

### Đối với Admin/Nhà trường
- Quản lý tập trung thông tin xe, tuyến, tài xế
- Theo dõi lịch sử chuyến đi
- Thống kê, báo cáo hoạt động

## Cách hệ thống hoạt động

### Luồng chính

```
1. Admin tạo tuyến đường và điểm dừng
2. Admin gán xe buýt + tài xế vào lịch trình
3. Admin đăng ký học sinh vào lịch trình (điểm đón/trả)
4. Tài xế bắt đầu chuyến đi → Hệ thống tạo Trip
5. Tài xế điểm danh học sinh tại mỗi điểm dừng
6. Hệ thống gửi thông báo cho phụ huynh
7. Tài xế kết thúc chuyến → Trip completed
```

### Các vai trò

| Role | Chức năng chính |
|------|----------------|
| **Admin** | CRUD users, buses, routes, schedules, students |
| **Driver** | View schedule, manage trips, attendance |
| **Parent** | Track bus, view notifications, view student info |

## Mục tiêu UX

### Admin Dashboard
- Giao diện quản trị đơn giản, dễ sử dụng
- Quick actions cho các tác vụ thường dùng
- Bảng biểu dữ liệu rõ ràng

### Driver Interface
- Hiển thị lịch trình ngày hiện tại
- Danh sách học sinh dễ thao tác
- Điểm danh nhanh với 1 tap

### Parent Interface
- Bản đồ hiển thị vị trí xe
- Timeline thông báo
- Thông tin con em rõ ràng

## Các ràng buộc

1. **Bảo mật:** Thông tin học sinh và phụ huynh phải được bảo vệ
2. **Performance:** Real-time tracking không được lag quá 10 giây
3. **Offline:** Hệ thống phải xử lý được khi mất kết nối tạm thời
4. **Responsive:** Frontend phải hoạt động tốt trên mobile browser


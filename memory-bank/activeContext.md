# Active Context - School Bus Management System

## Trạng thái hiện tại

**Ngày cập nhật:** 2025-11-26

### Đang làm việc trên
- Khởi tạo Memory Bank cho dự án
- Tài liệu hóa cấu trúc và patterns của dự án

### Ngữ cảnh hiện tại

Dự án đã có cấu trúc cơ bản hoàn chỉnh với:
- Backend NestJS với đầy đủ modules
- Database schema với Prisma
- Frontend React cơ bản

## Thay đổi gần đây

### Backend Structure
- 16 feature modules đã được tạo (users, admin, driver, parent, student, bus, route, stop-point, itinerary, schedule, student-schedule, trip, attendance, location-event, notification, parent-student)
- Core modules: decorators, guards, enums, interfaces, repositories
- Prisma schema với 14 models

### Frontend Structure
- Các pages cho admin, driver, parent
- API integration với axios
- Google Maps component

## Bước tiếp theo

### Ưu tiên cao
1. [ ] Hoàn thiện API endpoints cho tất cả modules
2. [ ] Implement authentication flow hoàn chỉnh
3. [ ] Kết nối frontend với backend APIs
4. [ ] Test các CRUD operations

### Ưu tiên trung bình
1. [ ] Thêm validation cho DTOs
2. [ ] Implement error handling nhất quán
3. [ ] Thêm Swagger documentation
4. [ ] Viết unit tests

### Ưu tiên thấp
1. [ ] Tối ưu hóa database queries
2. [ ] Thêm caching
3. [ ] Implement real-time features với WebSocket

## Quyết định đang xem xét

### 1. Real-time Location Tracking
**Vấn đề:** Cần cập nhật vị trí xe real-time cho phụ huynh  
**Giải pháp xem xét:**
- WebSocket với Socket.io
- Server-Sent Events (SSE)
- Polling interval

### 2. Mobile Support
**Vấn đề:** Frontend cần hoạt động tốt trên mobile  
**Giải pháp xem xét:**
- Responsive web design
- React Native app riêng
- PWA (Progressive Web App)

## Lưu ý quan trọng

### API Conventions
- Base URL: `/api/v1`
- Authentication: Bearer token trong header
- Response format: JSON

### Code Style
- Sử dụng TypeScript strict mode
- Follow NestJS best practices
- Prisma for all database operations

### Testing Strategy
- Unit tests với Jest
- E2E tests cho critical flows
- Manual testing cho UI

## Blockers / Issues

Hiện tại không có blockers.

## Liên kết hữu ích

- [NestJS Documentation](https://docs.nestjs.com)
- [Prisma Documentation](https://www.prisma.io/docs)
- [React Documentation](https://react.dev)


# Tech Context - School Bus Management System

## Technology Stack

### Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| **NestJS** | ^11.1.8 | Framework chính |
| **TypeScript** | ^5.9.3 | Ngôn ngữ lập trình |
| **Prisma** | ^6.18.0 | ORM và database client |
| **PostgreSQL** | 18.x | Database |
| **Passport** | ^0.7.0 | Authentication |
| **JWT** | via @nestjs/jwt ^11.0.1 | Token-based auth |
| **bcrypt** | ^6.0.0 | Password hashing |
| **class-validator** | ^0.14.2 | DTO validation |
| **class-transformer** | ^0.5.1 | Object transformation |
| **AutoMapper** | ^8.8.1 | Object mapping |

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | ^19.2.0 | UI Framework |
| **Axios** | ^1.13.2 | HTTP Client |
| **Google Maps API** | via @react-google-maps/api ^2.20.7 | Maps integration |

### Development Tools

| Tool | Version | Purpose |
|------|---------|---------|
| **Jest** | ^30.2.0 | Unit testing |
| **ESLint** | ^9.38.0 | Linting |
| **Prettier** | ^3.6.2 | Code formatting |
| **Swagger** | via @nestjs/swagger ^11.2.1 | API documentation |
| **ts-node** | ^10.9.2 | TypeScript execution |

## Cấu trúc dự án

```
schoolbus/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma      # Database schema
│   │   ├── migrations/        # Database migrations
│   │   └── seed.ts            # Seed data
│   ├── src/
│   │   ├── core/              # Core modules (shared)
│   │   │   ├── decorators/    # Custom decorators
│   │   │   ├── dto/           # Base DTOs
│   │   │   ├── entities/      # Base entities
│   │   │   ├── enums/         # Enums
│   │   │   ├── guards/        # Auth guards
│   │   │   ├── interfaces/    # Interfaces
│   │   │   ├── prisma/        # Prisma service
│   │   │   └── repositories/  # Base repository
│   │   ├── modules/           # Feature modules
│   │   │   ├── admin/
│   │   │   ├── attendance/
│   │   │   ├── auth/
│   │   │   ├── bus/
│   │   │   ├── driver/
│   │   │   ├── itinerary/
│   │   │   ├── location-event/
│   │   │   ├── notification/
│   │   │   ├── parent/
│   │   │   ├── parent-student/
│   │   │   ├── route/
│   │   │   ├── schedule/
│   │   │   ├── stop-point/
│   │   │   ├── student/
│   │   │   ├── student-schedule/
│   │   │   ├── trip/
│   │   │   └── users/
│   │   ├── configs/           # Configuration
│   │   ├── types/             # Type definitions
│   │   ├── app.module.ts      # Root module
│   │   └── main.ts            # Entry point
│   └── test/                  # E2E tests
├── frontend/
│   ├── src/
│   │   ├── admin/             # Admin pages
│   │   ├── api/               # API functions
│   │   ├── components/        # Shared components
│   │   ├── drivers/           # Driver pages
│   │   ├── parents/           # Parent pages
│   │   ├── pages/             # General pages
│   │   └── stylecss/          # CSS files
│   └── public/                # Static files
└── memory-bank/               # Project documentation
```

## Thiết lập môi trường phát triển

### Prerequisites
- Node.js (LTS version)
- Yarn package manager
- PostgreSQL 18.x (hoặc dùng binaries từ external-tools)

### Khởi động Backend

```bash
cd backend

# 1. Khởi động PostgreSQL (Windows)
start-postgres.bat

# 2. Cấu hình environment
cp .env.example .env
# Edit .env với DATABASE_URL

# 3. Setup database
yarn db:setup

# 4. Generate Prisma types
yarn prisma:generate

# 5. Start development server
yarn start:dev
```

### Khởi động Frontend

```bash
cd frontend

# 1. Install dependencies
npm install

# 2. Start development server
npm start
```

## Environment Variables

### Backend (.env)

```env
DATABASE_URL="postgresql://postgres:PASSWORD@localhost:5432/schoolbus?schema=public"
JWT_SECRET="your-secret-key"
JWT_EXPIRATION="24h"
```

## Ràng buộc kỹ thuật

1. **Database:** PostgreSQL với Prisma ORM
2. **API Format:** RESTful API
3. **Authentication:** JWT tokens
4. **Port mặc định:**
   - Backend: 3000
   - Frontend: 3001 (React default)
   - PostgreSQL: 5432

## Dependencies quan trọng

### Backend Core
- `@nestjs/common`, `@nestjs/core`: NestJS framework
- `@prisma/client`: Database access
- `passport`, `@nestjs/passport`: Authentication
- `@nestjs/jwt`: JWT handling
- `bcrypt`: Password hashing

### Backend Utilities
- `class-validator`: Request validation
- `class-transformer`: Object transformation
- `@automapper/*`: Object mapping
- `morgan`: HTTP request logging

### Frontend Core
- `react`, `react-dom`: React framework
- `axios`: HTTP client
- `@react-google-maps/api`: Google Maps integration


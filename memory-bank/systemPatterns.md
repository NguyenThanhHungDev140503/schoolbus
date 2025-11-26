# System Patterns - School Bus Management System

## Kiến trúc hệ thống

### Tổng quan

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Frontend     │────▶│    Backend      │────▶│   PostgreSQL    │
│    (React)      │◀────│    (NestJS)     │◀────│   Database      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Layered Architecture (Backend)

```
┌─────────────────────────────────────────────────────┐
│                   Controllers                        │
│   (Handle HTTP requests, call services)              │
├─────────────────────────────────────────────────────┤
│                    Services                          │
│   (Business logic, call repositories)                │
├─────────────────────────────────────────────────────┤
│                  Repositories                        │
│   (Data access via Prisma)                          │
├─────────────────────────────────────────────────────┤
│                    Prisma                            │
│   (ORM, database queries)                           │
└─────────────────────────────────────────────────────┘
```

## Design Patterns được sử dụng

### 1. Repository Pattern

Mỗi module có repository riêng để truy cập database:

```typescript
// base.repository.ts
export abstract class BaseRepository<T> {
  constructor(protected prisma: PrismaService) {}
  
  abstract findAll(): Promise<T[]>;
  abstract findById(id: number): Promise<T | null>;
  abstract create(data: any): Promise<T>;
  abstract update(id: number, data: any): Promise<T>;
  abstract delete(id: number): Promise<T>;
}
```

### 2. Module Pattern (NestJS)

Mỗi feature được đóng gói trong một module riêng:

```
module/
├── *.controller.ts    # HTTP endpoints
├── *.service.ts       # Business logic
├── *.repository.ts    # Data access
├── *.module.ts        # Module definition
└── dto/               # Data Transfer Objects
    ├── create-*.dto.ts
    ├── update-*.dto.ts
    └── *-response.dto.ts
```

### 3. Guard Pattern (Authentication/Authorization)

```typescript
// JWT Auth Guard
@UseGuards(JwtAuthGuard)
@Controller('protected')
export class ProtectedController {}

// Role-based Guard
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {}
```

### 4. Decorator Pattern

Custom decorators cho common operations:

```typescript
// Current User Decorator
@CurrentUser() user: UserPayload

// Public Route Decorator
@Public()

// Roles Decorator
@Roles(UserRole.ADMIN, UserRole.DRIVER)
```

### 5. DTO Pattern (Data Transfer Objects)

Validation và transformation với class-validator:

```typescript
export class CreateUserDto {
  @IsEmail()
  email: string;
  
  @IsString()
  @MinLength(6)
  password: string;
  
  @IsEnum(UserRole)
  role: UserRole;
}
```

## Database Schema Patterns

### 1. User Inheritance Pattern

User table là base, các role cụ thể extends qua foreign key:

```
User (base)
  ├── Admin (1:1)
  ├── Driver (1:1)
  └── Parent (1:1)
```

### 2. Many-to-Many với Relationship Table

```
Parent ←── ParentStudent ──→ Student
(1:N)                        (N:1)
```

### 3. Schedule-Trip Pattern

Schedule là template, Trip là instance cụ thể:

```
Schedule (template)
  │
  └── Trip (instance)
      ├── tripDate
      ├── currentStatus
      └── attendances[]
```

## API Patterns

### 1. RESTful Endpoints

```
GET    /users         # List all users
GET    /users/:id     # Get single user
POST   /users         # Create user
PATCH  /users/:id     # Update user
DELETE /users/:id     # Delete user
```

### 2. Response Format

```typescript
// Single item
{
  "id": 1,
  "email": "admin@example.com",
  ...
}

// List with pagination
{
  "data": [...],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 10
  }
}
```

### 3. Error Response

```typescript
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    { "field": "email", "message": "Invalid email format" }
  ]
}
```

## Component Relationships

### Core Modules

```
AppModule
├── PrismaModule (global)
├── AuthModule
└── Feature Modules
    ├── UsersModule
    ├── AdminModule
    ├── DriverModule
    ├── ParentModule
    ├── StudentModule
    ├── BusModule
    ├── RouteModule
    ├── StopPointModule
    ├── ItineraryModule
    ├── ScheduleModule
    ├── StudentScheduleModule
    ├── TripModule
    ├── AttendanceModule
    ├── LocationEventModule
    ├── NotificationModule
    └── ParentStudentModule
```

### Module Dependencies

```
AuthModule
  └── UsersModule

ScheduleModule
  ├── RouteModule
  ├── BusModule
  └── DriverModule

TripModule
  └── ScheduleModule

AttendanceModule
  ├── TripModule
  └── StudentModule
```

## Security Patterns

### 1. Password Hashing

```typescript
// Using bcrypt
const hashedPassword = await bcrypt.hash(password, 10);
```

### 2. JWT Authentication

```typescript
// Token payload
{
  "sub": userId,
  "email": userEmail,
  "role": userRole
}
```

### 3. Role-based Access Control (RBAC)

```typescript
// Guard checks role
@Roles(UserRole.ADMIN)
@UseGuards(JwtAuthGuard, RolesGuard)
```

## Enums và Constants

### User Roles
```typescript
enum UserRole {
  admin = 'admin',
  driver = 'driver',
  parent = 'parent'
}
```

### Trip Status
```typescript
enum TripStatus {
  pending = 'pending',
  in_progress = 'in_progress',
  completed = 'completed',
  cancelled = 'cancelled'
}
```

### Attendance Action
```typescript
enum AttendanceAction {
  picked_up = 'picked_up',
  dropped_off = 'dropped_off',
  absent = 'absent'
}
```

### Notification Type
```typescript
enum NotificationType {
  warning = 'warning',
  info = 'info',
  delay = 'delay',
  arrival = 'arrival'
}
```


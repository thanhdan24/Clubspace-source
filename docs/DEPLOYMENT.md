# Hướng dẫn Khởi chạy & Triển khai Ứng dụng Clubspace

Dự án sử dụng kiến trúc **React 18 + Vite (Frontend)** và **Node.js + Express (Backend)**, kết nối cơ sở dữ liệu **Supabase (PostgreSQL 15+)** qua **Prisma ORM**.

---

## 1. Cấu hình Môi trường (.env)

Đảm bảo file `.env` tại thư mục gốc có đầy đủ các biến kết nối:

```env
DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"

PORT=3001
HOST=127.0.0.1
APP_ORIGIN=http://localhost:3001
INITIAL_ADMIN_USERNAME=admin
INITIAL_ADMIN_PASSWORD=Admin@123456
```

---

## 2. Khởi tạo Cơ sở Dữ liệu

Trước khi chạy lần đầu, đồng bộ schema và nạp dữ liệu mẫu lên Supabase:

```powershell
# 1. Đẩy schema Prisma lên Supabase
pnpm db:push

# 2. Sinh Prisma Client types
pnpm db:generate

# 3. Nạp dữ liệu mẫu ban đầu từ prisma/seed-data.json
pnpm db:seed:supabase
```

---

## 3. Khởi chạy Ứng dụng

### Môi trường Production (Chạy cả Frontend & Backend trên một cổng):
```powershell
pnpm build
pnpm start
```
Mở trình duyệt tại: `http://localhost:3001` (hoặc cổng cấu hình trong `PORT`).

### Môi trường Phát triển (Development với Hot Reload):
```powershell
# Chạy Frontend dev server (Vite port 5173):
pnpm dev

# Chạy Backend server (Node.js port 3001):
pnpm start:backend
```

---

## 4. Quản trị Dữ liệu với Prisma Studio
```powershell
pnpm db:studio
```
Mở giao diện trực quan tại: `http://localhost:5555`.

# Hướng dẫn kết nối Supabase và sử dụng Prisma trong Clubspace

Dự án đã được cấu hình chuyển đổi sang sử dụng **Supabase (PostgreSQL)** và quản lý cơ sở dữ liệu bằng **Prisma ORM**.

---

## 1. Lấy chuỗi kết nối từ Supabase

1. Đăng nhập vào [Supabase Dashboard](https://supabase.com/dashboard) và tạo một dự án mới (hoặc chọn dự án có sẵn).
2. Vào mục **Project Settings** (biểu tượng bánh răng ở thanh bên trái) → chọn **Database**.
3. Cuộn xuống phần **Connection string**:
   - Chọn tab **URI**.
   - Mục **Mode**: Chọn **Transaction** (Port `6543`) → Đây là `DATABASE_URL`.
   - Mục **Mode**: Chọn **Session** (Port `5432`) → Đây là `DIRECT_URL`.
4. Thay thế `[YOUR-PASSWORD]` bằng mật khẩu cơ sở dữ liệu của bạn.

---

## 2. Cấu hình tệp `.env`

Mở file `.env` trong thư mục gốc của dự án và điền thông tin:

```env
# Connection pooler URL (Port 6543, pgbouncer):
DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"

# Direct connection URL (Port 5432):
DIRECT_URL="postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"

# Supabase API (tùy chọn):
SUPABASE_URL="https://[PROJECT-REF].supabase.co"
SUPABASE_ANON_KEY="your-anon-key"

# Cổng máy chủ và tài khoản quản trị mặc định:
PORT=3001
HOST=127.0.0.1
APP_ORIGIN=http://localhost:3001
INITIAL_ADMIN_USERNAME=admin
INITIAL_ADMIN_PASSWORD=Admin@123456
```

---

## 3. Khởi tạo Schema và Dữ liệu lên Supabase

Chạy các lệnh sau theo thứ tự:

### Bước 1: Tạo Schema trên Supabase bằng Prisma
```powershell
pnpm db:push
```
*Lệnh này sẽ tự động đọc `prisma/schema.prisma` và tạo toàn bộ 15 bảng, chỉ mục (indexes), khóa ngoại (foreign keys) lên Supabase.*

### Bước 2: Nạp dữ liệu mẫu ban đầu và tạo Views
```powershell
pnpm db:seed:supabase
```
*Lệnh này sẽ:*
- Tạo 2 Views thống kê: `vw_club_fund_summary` và `vw_event_statistics`.
- Nạp toàn bộ dữ liệu mẫu ban đầu từ `database/imported-data.json`.
- Tự động đồng bộ các Auto-increment sequences trong PostgreSQL.
- Khởi tạo tài khoản quản trị hệ thống (`ADMIN`) theo cấu hình trong `.env`.

---

## 4. Quản trị cơ sở dữ liệu với Prisma Studio

Bạn có thể mở giao diện quản lý dữ liệu trực quan bằng Prisma Studio:

```powershell
pnpm db:studio
```
Trình duyệt sẽ mở `http://localhost:5555`, cho phép bạn xem, lọc, thêm, sửa, xóa dữ liệu trên các bảng một cách trực quan.

---

## 5. Chạy ứng dụng

Sau khi khởi tạo database:
```powershell
# Build frontend
pnpm build

# Chạy server
pnpm start
```
Mở trình duyệt tại: `http://localhost:3001`.

---

## 6. (Tùy chọn) Chạy SQL trực tiếp trên Supabase Dashboard

Nếu bạn không muốn dùng CLI để push schema, dự án đã chuẩn bị sẵn file DDL hoàn chỉnh tại:
- [`database/supabase/schema.sql`](file:///C:/Users/A.Long/OneDrive/Desktop/PTTKHTPM/Clubspace-source/database/supabase/schema.sql)

Bạn chỉ cần copy toàn bộ nội dung file này và paste vào mục **SQL Editor** trong Supabase Dashboard rồi nhấn **Run**.

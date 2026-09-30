# Clubspace

Website quản lý câu lạc bộ sinh viên, giao diện tiếng Việt, bám theo tài liệu phân tích hệ thống `PhanTich3(2).docx`, cơ sở dữ liệu **Supabase (PostgreSQL)** và quản lý bằng **Prisma ORM**.

Ứng dụng có 5 vai trò: **ADMIN**, **LEADER**, **OFFICER**, **TREASURER**, **MEMBER**. Mỗi thao tác được kiểm tra tại backend theo vai trò và CLB. Thành viên, sự kiện, đăng ký, điểm danh, giao dịch và lịch sử đều được lưu trữ và bảo vệ toàn vẹn dữ liệu.

---

## 🚀 Hướng dẫn cài đặt và vận hành

### Yêu cầu môi trường:
- **Node.js**: >= 22.13.0 (Khuyên dùng Node 24)
- **pnpm**: >= 11.25.0
- Tài khoản và Database trên [Supabase](https://supabase.com/)

---

### 1. Cài đặt thư viện

```bash
pnpm install
```

---

### 2. Cấu hình biến môi trường

Sao chép `.env.example` thành `.env`:

```powershell
Copy-Item .env.example .env
```

Mở file `.env` và điền chuỗi kết nối Supabase của bạn:

```env
# Supabase Transaction Pooler URL (Port 6543):
DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"

# Supabase Session / Direct URL (Port 5432):
DIRECT_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"

PORT=3001
HOST=127.0.0.1
APP_ORIGIN=http://localhost:3001
UPLOAD_DIR=private-uploads

INITIAL_ADMIN_USERNAME=admin
INITIAL_ADMIN_PASSWORD=1234567890
```

---

### 3. Khởi tạo Schema và Dữ liệu lên Supabase

Chạy 2 lệnh sau:

```powershell
# 1. Đẩy schema Prisma lên Supabase:
pnpm db:push

# 2. Tạo views và nạp dữ liệu mẫu ban đầu:
pnpm db:seed
```

---

### 4. Quản lý cơ sở dữ liệu qua Prisma Studio

Mở giao diện quản trị cơ sở dữ liệu trực quan:

```powershell
pnpm db:studio
```
Truy cập tại: `http://localhost:5555`.

---

### 5. Build và khởi động ứng dụng

```powershell
# Build giao diện frontend
pnpm build

# Khởi động máy chủ
pnpm start
```

Mở trình duyệt truy cập: **`http://localhost:3001`**.

- **Tài khoản ADMIN:** `admin` / `1234567890` (hoặc thông tin bạn đặt trong `.env`).

---

## 🛠️ Các lệnh CLI hỗ trợ

| Lệnh | Ý nghĩa |
| :--- | :--- |
| `pnpm dev:frontend` | Chạy Vite dev server cho frontend (`http://localhost:5173`) |
| `pnpm build` | Build ứng dụng frontend ra thư mục `web-dist/` |
| `pnpm start` | Chạy backend server Node.js phục vụ API và frontend build |
| `pnpm db:push` | Đồng bộ schema Prisma lên database Supabase |
| `pnpm db:seed` | Nạp dữ liệu mẫu và tạo views trên Supabase |
| `pnpm db:studio` | Mở Prisma Studio để xem/sửa dữ liệu trực quan |
| `pnpm test` | Chạy bộ kiểm thử tự động API |
| `pnpm typecheck` | Kiểm tra lỗi TypeScript toàn dự án |
| `pnpm lint` | Kiểm tra định dạng và chuẩn mã nguồn |

---

## 📁 Cấu trúc mã nguồn

```text
components/club/       Các trang và thành phần nghiệp vụ (Events, Finance, Members, Dashboard)
components/ui/         Thư viện UI Primitives (Shadcn/Radix UI)
server/                Backend API, nghiệp vụ, xác thực và Prisma Database Adapter
prisma/                Schema Prisma (schema.prisma) và dữ liệu mẫu (seed-data.json)
scripts/               Script nạp dữ liệu Supabase (seed-supabase.ts)
tests/                 Bộ test tự động API nghiệp vụ và test-schema.sql
app/                   CSS dùng chung cho toàn bộ giao diện
standalone/            Entrypoint React / Vite
docs/                  Tài liệu kỹ thuật và hướng dẫn Supabase Prisma
```

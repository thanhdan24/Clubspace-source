# Chạy ứng dụng với SQL Server

Ứng dụng dùng React/Vite và Node.js, kết nối trực tiếp SQL Server qua cấu hình .env.

Chạy pnpm build rồi pnpm start. Mở http://localhost:3001 (hoặc PORT trong .env).

Để phát triển giao diện, chạy thêm pnpm dev và đặt APP_ORIGIN=http://localhost:5173 trong .env trước khi khởi động backend.

Các lệnh build:standalone, start:sqlserver và dev:frontend vẫn được giữ tương thích. Xem README.md để cấu hình database, migration và tài khoản.

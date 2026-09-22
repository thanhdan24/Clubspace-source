# Tự đăng ký tham gia câu lạc bộ

Tài khoản đã đăng nhập có thể vào **Khám phá CLB** để xem các CLB đang hoạt động và gửi yêu cầu tham gia. Tài khoản chưa thuộc CLB nào được đưa tới trang này thay cho tổng quan cần chọn CLB.

## Kiểm tra trên giao diện

1. Đăng nhập bằng tài khoản chưa có vai trò hoặc hồ sơ trong CLB.
2. Chọn **Khám phá CLB → Xin tham gia**, nhập giới thiệu và lưu. Thẻ CLB hiển thị **Chờ duyệt**; tài khoản chưa được xem dữ liệu nội bộ.
3. Đăng nhập bằng Chủ nhiệm hoặc Cán bộ của CLB đã chọn, mở **Yêu cầu tham gia**.
4. Chọn **Duyệt** và lưu. Hệ thống tạo hồ sơ ACTIVE, mã thành viên tự sinh và cấp vai trò MEMBER trong cùng transaction.
5. Quay lại tài khoản đăng ký, chọn **Cập nhật trạng thái → Mở câu lạc bộ**. Phiên đăng nhập tải lại quyền và mở tổng quan CLB.
6. Thử **Từ chối** một đơn khác: người đăng ký xem được phản hồi và có thể gửi lại. Gửi trùng khi đang chờ duyệt bị chặn.

Người đã có hồ sơ PAUSED/LEFT cần liên hệ người quản lý để khôi phục; luồng này không tự kích hoạt lại hồ sơ cũ. Đăng ký tài khoản mới vẫn do Admin thực hiện; đây là chức năng đăng ký tham gia CLB cho tài khoản đã có.

## Cài đặt

- Chạy `pnpm db:migrate:sqlserver` để thêm bảng `CLUB_JOIN_REQUESTS`. Script chạy các file SQL bổ sung theo thứ tự và có thể chạy lại.
- Chạy `pnpm build:standalone` nếu dùng frontend được phục vụ từ backend, sau đó khởi động lại `pnpm start:sqlserver`.
- Bản SQLite dùng migration `0003_club_join_requests.sql`.

## Kiểm chứng

- Bộ kiểm thử API bao phủ người dùng chưa có CLB, quyền truy cập trước/sau duyệt, giả mạo user/role, gửi trùng, duyệt khác CLB, từ chối/gửi lại, CLB ngừng hoạt động và rollback khi tạo thành viên thất bại.
- Đã kiểm tra trên SQL Server cấu hình hiện tại: khám phá CLB, gửi yêu cầu, duyệt, tạo hồ sơ và cấp MEMBER; dữ liệu thử nằm trong transaction đã rollback.
- Typecheck và build thành công. Chưa kiểm thử thao tác giao diện bằng trình duyệt tự động.

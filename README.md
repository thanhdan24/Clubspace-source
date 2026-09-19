# Clubspace

Website quản lý câu lạc bộ sinh viên, giao diện tiếng Việt, bám theo PhanTich3(2).docx và database SQL Server data.sql.

Ứng dụng có 5 vai trò: ADMIN, LEADER, OFFICER, TREASURER, MEMBER. Mỗi thao tác được kiểm tra tại backend theo vai trò và CLB. Thành viên, sự kiện, đăng ký, điểm danh, giao dịch và lịch sử đều lưu vào database.

Ứng dụng chạy trên localhost bằng React/Vite, Node.js và SQL Server. Các tệp SQLite/Drizzle còn lại phục vụ kiểm thử nghiệp vụ cục bộ.

## Chạy thực tế với SQL Server

Yêu cầu: Node.js 24 (môi trường đã chạy thử; ứng dụng hỗ trợ Node 22.13+), pnpm theo packageManager trong package.json, SQL Server 2019+ hoặc Express, SSMS để quản lý database.

1. Giải nén mã nguồn. Mở terminal trong thư mục có package.json, chạy:

```bash
npm install -g pnpm@11.25.0
pnpm install --frozen-lockfile
```

2. Dùng database StudentClubManagement đang có. Nếu chưa có, phục hồi bản backup hoặc nhập database/original/data.sql bằng SSMS. **Không chạy lại bản export trên database đã có dữ liệu.** Bản export gốc có CREATE DATABASE và đường dẫn MDF/LDF cố định trên máy xuất, nên cần chọn đường dẫn dữ liệu phù hợp trên máy triển khai trước khi khởi tạo database mới. Tệp gốc trong mã nguồn được giữ nguyên UTF-16.

3. Sao chép .env.example thành .env. Trên Windows có thể dùng:

```powershell
Copy-Item .env.example .env
```

Trên macOS/Linux:

```bash
cp .env.example .env
```

Điền DB_SERVER, DB_DATABASE, DB_USER, DB_PASSWORD và DB_PORT. Bật TCP/IP và cổng tương ứng của SQL Server trong SQL Server Configuration Manager. Với Express, cấu hình cổng TCP tĩnh rồi dùng tên máy và DB_PORT; ứng dụng không phụ thuộc SQL Browser để dò instance.

Giữ DB_ENCRYPT=true. Nếu máy phát triển dùng chứng chỉ tự ký, DB_TRUST_SERVER_CERTIFICATE=true chỉ nên dùng cho máy phát triển; môi trường thật cần chứng chỉ hợp lệ. Tài khoản runtime chỉ cần SELECT/INSERT/UPDATE/DELETE trên các bảng ứng dụng. Tài khoản chạy migration cần quyền CREATE TABLE/INDEX.

4. Chạy migration bổ sung phiên đăng nhập và bảo vệ đăng nhập:

```bash
pnpm db:migrate:sqlserver
```

Migration này không thay đổi/xóa 12 bảng gốc; chỉ thêm AUTH_SESSIONS, AUTH_ATTEMPTS, APP_SETUP. Có kiểm tra tồn tại trước khi tạo bảng.

5. Đăng nhập bằng tài khoản gốc nếu biết mật khẩu. Nếu chưa có thông tin đăng nhập, điền INITIAL_ADMIN_USERNAME (tên mới chưa tồn tại) và INITIAL_ADMIN_PASSWORD (10–72 ký tự) rồi chạy:

```bash
pnpm account:bootstrap
```

Script tạo **tài khoản quản trị mới**, không đổi hoặc ghi đè mật khẩu của tài khoản cũ. Xóa INITIAL_ADMIN_PASSWORD khỏi .env sau khi tạo. Đăng nhập ADMIN, tạo tài khoản và phân công vai trò tại Phân quyền; ADMIN không tự có quyền nghiệp vụ của chủ nhiệm/cán bộ/thủ quỹ.

6. Build và chạy:

```bash
pnpm build
pnpm start
```

Mở http://localhost:3001. Node phục vụ cả frontend đã build và API. Để phát triển giao diện, chạy thêm `pnpm dev:frontend` ở terminal khác và mở http://localhost:5173. Khi phát triển qua port 5173, đặt APP_ORIGIN=http://localhost:5173 để kiểm tra Origin khớp giao diện qua Vite proxy.

Khi triển khai lên máy chủ, đặt APP_ORIGIN bằng địa chỉ HTTPS thật, dùng reverse proxy hỗ trợ HTTPS, trỏ về HOST/PORT. Đặt UPLOAD_DIR tại thư mục bền vững và sao lưu cùng database. Không đưa .env hoặc private-uploads lên máy chủ tĩnh/public.

## Biến môi trường

| Biến                                           | Ý nghĩa                                                                   |
| ---------------------------------------------- | ------------------------------------------------------------------------- |
| DB_SERVER, DB_PORT                             | Máy chủ và cổng SQL Server                                                |
| DB_DATABASE                                    | Database gốc, mặc định StudentClubManagement                              |
| DB_USER, DB_PASSWORD                           | Tài khoản kết nối, không đưa vào mã nguồn                                 |
| DB_ENCRYPT                                     | Bật mã hóa kết nối, mặc định true                                         |
| DB_TRUST_SERVER_CERTIFICATE                    | Chấp nhận chứng chỉ tự ký khi phát triển, mặc định false                  |
| PORT, HOST                                     | Cổng và địa chỉ bind Node, mặc định 3001 và 127.0.0.1                     |
| APP_ORIGIN                                     | Origin giao diện để kiểm tra nguồn yêu cầu và cookie HTTPS                |
| UPLOAD_DIR                                     | Thư mục chứng từ riêng, mặc định private-uploads                          |
| INITIAL_ADMIN_USERNAME, INITIAL_ADMIN_PASSWORD | Chỉ dùng khi tạo quản trị mới bằng script                                 |


## Các chức năng chính

- Đăng nhập, đăng xuất, đổi mật khẩu, khóa/mở/ngừng tài khoản, tạo quản trị mới qua script.
- Quản trị CLB, chỉ định chủ nhiệm ban đầu, phân nhiều vai trò theo CLB, giữ người quản lý hoạt động cuối cùng.
- Thêm và sửa hồ sơ thành viên, đổi trạng thái kèm lý do, xem lịch sử; tìm kiếm, lọc trạng thái, phân trang, xuất CSV.
- Tạo và chỉnh sửa sự kiện; công bố, chốt danh sách, bắt đầu, hoàn tất, hủy; xử lý mở lại bằng vai trò chủ nhiệm và lý do.
- Thành viên đăng ký/hủy đúng thời hạn; kiểm tra thành viên ACTIVE, sức chứa, đăng ký trùng; cán bộ duyệt/từ chối; bổ sung người tham dự có lý do.
- Điểm danh PRESENT/ABSENT/LATE/EXCUSED, sửa có lý do, khóa và mở khóa kết quả theo quyền. Điểm danh theo từng trang, nhấn Lưu trước khi chuyển trang.
- Khoản thu/chi, danh mục, chứng từ PDF/PNG/JPEG hoặc URL HTTPS; luồng chi DRAFT → PENDING_APPROVAL → APPROVED → POSTED. Người lập không được tự duyệt kể cả kiêm nhiệm LEADER.
- Số dư chỉ tính POSTED; khoản đã ghi sổ không sửa số tiền. Chủ nhiệm có thể hủy khoản ghi sai kèm lý do, giữ lịch sử.
- Dashboard, báo cáo sự kiện/tham dự, tài chính, thành viên và cá nhân; xuất CSV UTF-8, in hoặc lưu PDF bằng chức năng in của trình duyệt. CSV mở được bằng Excel; không có xuất .xlsx riêng.
- Nhật ký hoạt động và thông báo trong ứng dụng về thay đổi sự kiện người dùng đã đăng ký. Không gửi email/SMS.

## Dữ liệu và migration

- `database/original/data.sql`: tệp gốc, giữ nguyên.
- `database/schema-inventory.json`: kiểm kê toàn bộ cột, kiểu, FK, index, CHECK.
- `database/imported-data.json`: dữ liệu xuất từ SQL, chỉ dùng seed bản trải nghiệm.
- `database/sqlserver/001_auth_support.sql`: migration bổ sung cho SQL Server.
- `db/schema.ts`, `drizzle/`: schema/migration riêng cho D1, không chạy lên SQL Server.
- `server/seed.ts`: chỉ khởi tạo bản sao D1 khi database chưa có USERS và đã bật DEMO_MODE với DEMO_PASSWORD. Seed trong một transaction; không chạy trên database đang có dữ liệu.

SQL Server dùng DECIMAL(15,2) gốc. D1 dùng NUMERIC theo SQLite, không có đầy đủ precision/collation như SQL Server; kiểm tra kiểu tiền, thời gian và trạng thái bổ sung ở service. Chọn bản SQL Server cho vận hành yêu cầu giữ đúng engine gốc.

Các sự kiện OPEN trong tệp đã hết hạn: hệ thống giữ nguyên ngày và trạng thái, hiển thị hết hạn và chặn đăng ký. Muốn thử vòng đời mới, dùng cán bộ tạo một sự kiện với thời gian tương lai. Các đường dẫn /evidence/... trong export chưa có tệp tương ứng; cần tải chứng từ thật lên nếu muốn sử dụng.

## Kiểm thử và giới hạn đã biết

```bash
pnpm typecheck
pnpm test
pnpm build
```

Chi tiết kết quả thực chạy và phần chưa kiểm chứng ở `docs/TESTING.md`. Không có SQL Server đang chạy hoặc thông tin kết nối thực trong phiên xây dựng, nên chưa kiểm thử tích hợp trên SQL Server của bạn. Bộ service đã kiểm thử trên database SQLite thật, cùng dữ liệu và ràng buộc của bản D1. Adapter SQL Server đã kiểm tra biên dịch và chuyển đổi tham số/pagination, không thay thế được kiểm thử trực tiếp trên máy chủ SQL Server.

## Sao lưu và vận hành

Ví dụ lệnh DBA chạy trên SQL Server, thay đường dẫn bằng thư mục SQL Server có quyền ghi:

```sql
BACKUP DATABASE [StudentClubManagement]
TO DISK = N'D:\Backups\StudentClubManagement.bak'
WITH COPY_ONLY, CHECKSUM;
RESTORE VERIFYONLY FROM DISK = N'D:\Backups\StudentClubManagement.bak';
```

Lập lịch Windows Task Scheduler với sqlcmd nếu dùng Express, hoặc SQL Server Agent nếu phiên bản hỗ trợ. Sao lưu UPLOAD_DIR cùng kỳ; xác nhận khôi phục thử trên database khác trước khi sử dụng quy trình vận hành. Không có lịch backup tự động được tạo trong phiên xây dựng này.

## Cấu trúc mã nguồn

```text
components/club/       Các trang và thành phần nghiệp vụ
components/ui/         Primitives Shadcn/Radix
server/               API dùng chung, auth, nghiệp vụ, adapter SQL Server
app/                  CSS dùng chung cho giao diện
standalone/           Entrypoint React/Vite độc lập
scripts/              Migration, bootstrap admin, công cụ build/import
database/            SQL gốc, kiểm kê, migration SQL Server
db/ và drizzle/      D1 schema và migration
tests/               Kiểm thử service với database thật
docs/                Đối chiếu yêu cầu, database và kết quả kiểm thử
```

Đối chiếu từng yêu cầu: `docs/REQUIREMENTS.md`. Kiểm kê database: `docs/DATABASE.md`.

Tham khảo kỹ thuật: [Microsoft SQL Server Node.js driver](https://learn.microsoft.com/en-us/sql/connect/node-js/node-js-driver-for-sql-server), [node-mssql](https://tediousjs.github.io/node-mssql/), [D1 batch transactions](https://developers.cloudflare.com/d1/worker-api/d1-database/).

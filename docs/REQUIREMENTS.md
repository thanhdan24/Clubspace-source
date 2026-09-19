# Đối chiếu yêu cầu và triển khai

Nguồn: PhanTich3(2).docx (toàn bộ 15 mục, phụ lục và ERD) và data.sql (SQL Server 2019, UTF-16).

| Yêu cầu                                   | Trang giao diện                       | API                                                                                       | Bảng liên quan                                            |
| ----------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| FR-01 / UC-01 Đăng nhập, phân quyền CLB   | Đăng nhập; bộ chọn CLB                | POST auth/login, auth/logout; GET me                                                      | USERS, ROLES, USER_ROLES, AUTH_SESSIONS, AUTH_ATTEMPTS    |
| FR-02 / UC-02 Tài khoản và vai trò        | Tài khoản; Phân quyền; Câu lạc bộ     | GET/POST accounts; PATCH accounts/:id; GET/POST roles; PATCH role-catalog; GET/POST clubs | USERS, CLUBS, ROLES, USER_ROLES, AUDIT_LOGS               |
| FR-03 / UC-03 Hồ sơ và lịch sử trạng thái | Thành viên; Hồ sơ cá nhân             | GET/POST members; GET/PATCH members/:id; GET/PATCH profile; POST profile/password         | CLUB_MEMBERS, USERS, MEMBER_STATUS_HISTORY, USER_ROLES    |
| FR-04 / UC-04 Vòng đời sự kiện            | Sự kiện; Chi tiết sự kiện             | GET/POST events; GET/PATCH events/:id; POST events/:id/action                             | EVENTS, AUDIT_LOGS                                        |
| FR-05 / UC-05 Đăng ký và hủy              | Chi tiết; Đăng ký của tôi             | POST events/:id/registration; GET my-registrations                                        | EVENT_REGISTRATIONS, EVENTS, CLUB_MEMBERS                 |
| FR-06 / UC-06 Duyệt và chốt               | Chi tiết → Danh sách đăng ký          | GET/PATCH events/:id/registrations; POST events/:id/action                                | EVENT_REGISTRATIONS, EVENTS, AUDIT_LOGS                   |
| FR-07 / UC-07 Điểm danh và ngoại lệ       | Chi tiết → Điểm danh                  | PUT events/:id/attendance; POST events/:id/participants; POST events/:id/action           | ATTENDANCE, EVENT_REGISTRATIONS, EVENTS, AUDIT_LOGS       |
| FR-08 / UC-08 Hạng mục và khoản thu       | Tài chính; Danh mục thu chi           | GET/POST finance; PATCH finance/:id; GET/POST categories; PATCH categories/:id            | FINANCE_CATEGORIES, FINANCIAL_TRANSACTIONS                |
| FR-09 / UC-09 Phê duyệt chi               | Phê duyệt; Chi tiết giao dịch         | POST finance/:id/action; PATCH finance/:id/evidence; POST/GET evidence                    | FINANCIAL_TRANSACTIONS, AUDIT_LOGS; R2 hoặc kho tệp riêng |
| FR-10 Tổng thu, chi, số dư                | Tổng quan; Tài chính; Báo cáo         | GET dashboard; GET reports?type=finance                                                   | vw_club_fund_summary, FINANCIAL_TRANSACTIONS              |
| FR-11 / UC-10 Báo cáo theo quyền          | Báo cáo; Đăng ký của tôi              | GET reports; export=csv trên danh sách; In/Lưu PDF trên báo cáo                           | vw_event_statistics và các bảng nghiệp vụ                 |
| FR-12 Audit                               | Nhật ký hoạt động; Lịch sử thành viên | GET audit; GET members/:id                                                                | AUDIT_LOGS, MEMBER_STATUS_HISTORY                         |
| UC-04 Thông báo đổi sự kiện đã công bố    | Biểu tượng chuông                     | GET notifications                                                                         | AUDIT_LOGS, EVENTS, EVENT_REGISTRATIONS, CLUB_MEMBERS     |

## Mâu thuẫn và quyết định triển khai

1. Word đề xuất MySQL 8.0, SQL thực tế sử dụng SQL Server, dbo, IDENTITY, NVARCHAR, DATETIME2 và compatibility 150. Lấy SQL Server thực tế làm nguồn chuẩn; không đổi sang MySQL. Bản chạy độc lập kết nối SQL Server bằng Node.js và mssql/Tedious.
2. Đặc tả cột Word lược bỏ event_type và một số cột thời gian, rejection_reason. SQL có những cột này; ứng dụng giữ và sử dụng đầy đủ.
3. Mục lục Word liệt kê 12 mục nhưng phần thân có 15 mục và phụ lục; đã phân tích toàn bộ nội dung phần thân.
4. Ma trận quyền ghi LEADER chỉ đọc đăng ký, nhưng UC-06 cho LEADER duyệt/chốt và xử lý ngoại lệ. Áp dụng quyền chi tiết trong UC-06: LEADER có thể duyệt; việc thay đổi danh sách đã chốt cần lý do và audit. ADMIN chỉ đọc nghiệp vụ, không tự có quyền thu/chi hoặc điểm danh.
5. SQL có 2 sự kiện OPEN đã quá hạn theo ngày hiện tại. Giữ nguyên ngày và trạng thái gốc, hiển thị hết hạn và từ chối đăng ký/hủy trễ. Không tự sửa thời gian hoặc giả số người tham gia.
6. evidence_url trong dữ liệu gốc chỉ là đường dẫn; không có tệp chứng từ kèm theo. Hiển thị rõ tệp chưa được cung cấp; cho thủ quỹ bổ sung tệp hoặc liên kết HTTPS.
7. Word vừa nêu chứng từ “nếu có” ở thu, vừa yêu cầu chứng từ ở quy trình chi. Khoản thu cho phép không có chứng từ; chi cần chứng từ trước POSTED. Hỗ trợ bổ sung chứng từ sau APPROVED mà không sửa số tiền đã duyệt.
8. Cùng một bcrypt hash được dùng cho 14 tài khoản gốc. Không đoán mật khẩu, không ghi đè hash. Bản trải nghiệm thêm 5 tài khoản demo riêng; triển khai SQL Server có script tạo quản trị mới, từ chối trùng username.
9. “Xóa” được triển khai theo nghiệp vụ bảo toàn lịch sử: thành viên LEFT, sự kiện CANCELLED, tài chính CANCELLED, danh mục ngừng hoạt động, tài khoản LOCKED/INACTIVE. Không cung cấp xóa cứng dữ liệu nghiệp vụ.

## Công nghệ và cấu trúc

- Giao diện React + TypeScript, Shadcn/Radix, CSS responsive; font hệ thống hỗ trợ tiếng Việt, không tải font ngoài.
- Backend dùng chung các service server/*.ts, kiểm tra Zod và truy vấn tham số hóa. Bản Node phục vụ cả giao diện Vite đã build và API SQL Server.
- Cookie phiên HttpOnly, SameSite=Lax, Secure trên HTTPS; token ngẫu nhiên lưu SHA-256 trong database; thu hồi phiên khi khóa/đặt lại mật khẩu. Kiểm tra Origin cho ghi dữ liệu, rate limit đăng nhập theo tài khoản.
- SQL Server dùng transaction SERIALIZABLE trong từng request API. D1 dùng batch transaction cùng trigger sức chứa, phạm vi CLB, khóa điểm danh và bất biến giao dịch.
- Thông báo sự kiện được đọc từ audit theo đăng ký của người dùng; chưa gửi email/SMS vì nằm ngoài phạm vi triển khai cốt lõi.
- Các thời điểm nghiệp vụ dùng giờ Việt Nam UTC+7, thống nhất với DATETIME2 không có timezone trong SQL gốc.

## Thay đổi database

- SQL Server: migration 001_auth_support.sql chỉ thêm AUTH_SESSIONS, AUTH_ATTEMPTS, APP_SETUP; không sửa 12 bảng gốc. Chạy lại an toàn khi các bảng đã tồn tại.
- D1: giữ nguyên 12 tên bảng, tên cột, 26 khóa ngoại, PK/UNIQUE/CHECK và 2 view; chuyển IDENTITY/BIGINT/bit thành INTEGER, NVARCHAR/date/datetime2 thành TEXT, DECIMAL thành NUMERIC, ISJSON thành json_valid. Không tương đương tuyệt đối với precision DECIMAL/collation SQL Server; bản SQL Server là chuẩn khi triển khai thật.
- D1 thêm 3 bảng hỗ trợ xác thực/seed và các trigger kiểm tra ghi dữ liệu. Seed dữ liệu gốc chạy riêng trong một batch, chỉ khi DEMO_MODE=true và database chưa có người dùng. Seed không chạy trên SQL Server.
- Các tệp migration là schema-only; dữ liệu gốc nằm riêng database/imported-data.json, giữ nguyên ID và thông tin.

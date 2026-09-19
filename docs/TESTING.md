# Kết quả kiểm thử

Ngày thực hiện: 14/09/2026. Môi trường xây dựng: Linux, Node.js 24.19.0, pnpm theo lockfile.

## Đã chạy

| Kiểm tra                         | Kết quả                   | Phạm vi thực tế                                                                          |
| -------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------- |
| Đọc yêu cầu Word                 | Đã đọc toàn bộ            | Phần thân, bảng, phụ lục, ERD                                                            |
| Kiểm kê SQL                      | 12 bảng, 26 FK, 2 view    | Tên/cột/kiểu/PK/FK/UNIQUE/CHECK/index; dữ liệu gốc giữ nguyên                            |
| `pnpm test`                      | **21/21 nhóm đạt, 0 lỗi** | Service API thực, SQLite thật trong bộ nhớ, migration D1 và dữ liệu nhập từ SQL          |
| `pnpm typecheck`                 | Đạt                       | Biên dịch kiểu frontend, backend và adapter SQL Server                                   |
| Migration D1 cục bộ              | Đạt                       | 0000 schema; 0001 view/trigger; 0002 kiểm tra đồng thời; không sửa migration đã áp dụng  |
| Trang đăng nhập trên trình duyệt | Đạt                       | Bố cục desktop 1363 × 936, nội dung tiếng Việt, biểu mẫu và lựa chọn vai trò trải nghiệm |

Bản chạy hiện tại dùng Vite để tạo web-dist/index.html và tài nguyên JS/CSS. Các kết quả kiểm thử bên dưới dùng SQLite cục bộ; không thay thế kiểm thử tích hợp SQL Server.

## 21 nhóm kiểm thử tự động

1. Nhập dữ liệu bảo toàn số bản ghi, mật khẩu bcrypt gốc, khóa ngoại và số dư quỹ.
2. Từ chối thiếu phiên, sai mật khẩu, tài khoản khóa; kiểm tra trạng thái tài khoản ở mỗi request.
3. Cách ly vai trò và CLB; ADMIN không tự có quyền ghi nghiệp vụ.
4. Chặn ghi dữ liệu từ origin khác và từ chối nội dung không hợp lệ.
5. Ngăn trùng thành viên, yêu cầu lý do đổi trạng thái, lưu lịch sử.
6. Kiểm tra thời gian và vòng đời tạo/công bố sự kiện.
7. Đăng ký không trùng, kiểm tra sức chứa, hủy trả chỗ, kiểm tra hết hạn; hai yêu cầu cạnh tranh cho một chỗ.
8. Duyệt đăng ký lưu người/thời điểm duyệt và không vượt sức chứa.
9. Phân quyền điểm danh, cập nhật không trùng, mở/khóa kết quả.
10. Từ chối số tiền sai, hạng mục sai, tham chiếu khác CLB và tự phê duyệt khi kiêm nhiệm.
11. Duyệt/ghi sổ/hủy khoản chi, kiểm tra bất biến số tiền và số dư trước/sau.
12. Giới hạn phân quyền ADMIN, quyền đọc audit, báo cáo và CSV theo vai trò.
13. Phân trang và xử lý chuỗi SQL injection như dữ liệu tham số.
14. Chuyển đổi tham số và phân trang của adapter SQL Server.
15. Tạo tài khoản với trường tùy chọn; không trả password_hash qua API danh sách.
16. Tạo CLB với chủ nhiệm đầu tiên trong transaction; bảo vệ chủ nhiệm hoạt động cuối cùng.
17. Từ chối ngày/thời gian không tồn tại.
18. Bổ sung chứng từ sau APPROVED; không cho sửa tiền đã duyệt hoặc đổi chứng từ sau POSTED.
19. Chặn nghiệp vụ khi CLB ngừng hoạt động; chủ nhiệm có thể khôi phục.
20. Báo cáo thành viên lọc theo ngày tham gia và từ chối khoảng ngày đảo ngược.
21. Tải chứng từ kiểm tra MIME/nội dung; chỉ cán bộ có quyền trong cùng CLB được tải xuống.

Database kiểm thử là SQLite thực; adapter `prepare/batch` dùng node:sqlite để chạy cùng service và SQL với D1. Kiểm thử tải tệp dùng kho object trong bộ nhớ để xác minh API, nội dung và quyền, chưa phải kiểm thử dịch vụ R2 trên mạng. Kiểm thử cạnh tranh xác minh ràng buộc/transaction trong môi trường này, không phải kiểm thử tải phân tán.

## Chưa kiểm chứng trực tiếp

- **SQL Server thực:** chưa được cung cấp máy chủ, tài khoản hoặc database đang chạy. Adapter đã typecheck và kiểm tra chuyển đổi SQL, nhưng kết nối, migration, collation, transaction/deadlock và luồng nghiệp vụ trên SQL Server cần chạy lại trên môi trường đích.
- **Giao diện sau đăng nhập:** trình duyệt kiểm tra vẫn ở trang đăng nhập; bước đăng nhập an toàn không hoàn thành. Không khẳng định đã chạy end-to-end các vai trò qua trình duyệt. Các luồng nghiệp vụ đã chạy qua API trong 21 nhóm nêu trên.
- **Thiết bị di động/tablet:** đã triển khai media query, sidebar dạng drawer, biểu mẫu thích ứng, bảng cuộn trong vùng chứa và reduced-motion. Chưa có kiểm chứng trực quan trên các kích thước thiết bị này.
- **WebMCP:** đã đăng ký công cụ đọc danh sách sự kiện và mở chi tiết qua cùng session/API khi trình duyệt hỗ trợ `document.modelContext`. Chưa xác minh lời gọi công cụ trong phiên đã đăng nhập.
- R2 production, HTTPS proxy kết nối SQL Server, in/PDF từng trình duyệt, kiểm thử tải, lịch sao lưu và phục hồi thực tế chưa chạy.
- Đường dẫn chứng từ trong dữ liệu gốc không kèm tệp, nên không thể xác nhận nội dung các chứng từ gốc.

## Kiểm tra nhanh tại máy triển khai

1. Điền `.env`, chạy migration hỗ trợ và tạo quản trị mới nếu chưa biết tài khoản gốc.
2. Chạy `pnpm build:standalone`, `pnpm start:sqlserver`; mở `/api/health` để xác nhận SQL Server đã kết nối.
3. Đăng nhập ADMIN, phân vai trò vào đúng CLB cho các tài khoản thử riêng.
4. Cán bộ tạo sự kiện tương lai, mở đăng ký; thành viên đăng ký/hủy; cán bộ duyệt và kiểm tra giới hạn sức chứa.
5. Với sự kiện đã đến giờ, chốt/bắt đầu, lưu điểm danh, hoàn tất và xác nhận đã khóa.
6. Thủ quỹ lập chi, chủ nhiệm khác người lập phê duyệt, thủ quỹ tải chứng từ và ghi sổ. Đối chiếu số dư với view SQL.
7. Kiểm tra quyền bị từ chối bằng tài khoản thành viên và CLB khác; xuất CSV; kiểm tra giao diện 390, 768 và 1440 px.

Dùng tài khoản/dữ liệu thử riêng và giữ bản sao lưu trước khi vận hành. Không chạy seed trải nghiệm lên database gốc.

## Kết quả triển khai

Bản trải nghiệm production bị lỗi migration `incomplete input: SQLITE_ERROR`; chưa có URL hoạt động đã xác minh. Chi tiết, các kiểm tra tiếp theo và lý do dừng sửa migration ở `DEPLOYMENT.md`. Kết quả build/typecheck/21 nhóm kiểm thử ở trên không được coi là kiểm thử production thành công.

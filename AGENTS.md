# AGENTS.md - Cẩm nang Chỉ dẫn & Quy chuẩn Nghiệp vụ Toàn diện dành cho AI Agents

> **Tài liệu tham chiếu chuẩn cho AI Coding Agents làm việc trên dự án Clubspace.**  
> Hợp nhất toàn bộ yêu cầu, quy tắc nghiệp vụ từ đồ án phân tích hệ thống (`PhanTich3_2.docx` - Nhóm 11 PTIT, GVHD: ThS. Nguyễn Thị Bích Nguyên) cùng toàn bộ tài liệu kỹ thuật trong thư mục [`docs/`](file:///C:/Users/A.Long/OneDrive/Desktop/PTTKHTPM/Clubspace-source/docs).

---

## 1. Tổng quan Dự án (System Overview)

- **Tên dự án:** Clubspace - Hệ thống Quản lý Câu lạc bộ Sinh viên.
- **Mục tiêu cốt lõi:** Chuẩn hóa quy trình quản lý tập trung và số hóa toàn diện cho các câu lạc bộ sinh viên:
  1. Quản lý hồ sơ, ban/nhóm, chức vụ và vòng đời hoạt động của thành viên.
  2. Quản lý toàn bộ vòng đời sự kiện (tạo, công bố, đăng ký, duyệt/chốt danh sách, điểm danh, thống kê).
  3. Quản lý tài chính minh bạch: danh mục thu/chi, đề xuất chi, phê duyệt 2 lớp (segregation of duties), đính kèm chứng từ và kiểm soát số dư quỹ.
  4. Phân quyền chặt chẽ theo mô hình đa CLB (Multi-tenant RBAC).
  5. Bảo toàn lịch sử hoạt động, kiểm tra truy vết đầy đủ qua Audit Logs, tuyệt đối **không xóa cứng (No Hard Delete)** dữ liệu nghiệp vụ.
  6. Thống kê, báo cáo động và xuất dữ liệu (CSV/PDF) đúng phạm vi quyền hạn.

---

## 2. Kiến trúc Kỹ thuật & Công nghệ (Tech Stack)

| Thành phần | Công nghệ / Thư viện | Ghi chú vận hành |
| :--- | :--- | :--- |
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS | Giao diện Responsive (Desktop/Tablet/Mobile), Shadcn/Radix UI components, Lucide icons. Mặc định font hệ thống hỗ trợ tiếng Việt Unicode hoàn chỉnh. |
| **Backend** | Node.js, Express, TypeScript (`tsx`) | RESTful API pattern, chia module theo từng nghiệp vụ tại `server/*.ts`. Kiểm thực đầu vào toàn diện bằng **Zod**. |
| **Database** | **Supabase (PostgreSQL 15+)** | Chuyển đổi từ mô hình SQL Server gốc sang PostgreSQL trên Supabase. 15 bảng cơ sở dữ liệu + 2 Views báo cáo. |
| **ORM & Driver** | **Prisma ORM** | Schema khai báo tại [`prisma/schema.prisma`](file:///C:/Users/A.Long/OneDrive/Desktop/PTTKHTPM/Clubspace-source/prisma/schema.prisma). Adapter database dùng [`server/prisma.ts`](file:///C:/Users/A.Long/OneDrive/Desktop/PTTKHTPM/Clubspace-source/server/prisma.ts) tuân thủ interface `Database`. |
| **Kiểm thử tự động** | Node.js built-in Test Runner (`node --test`) | Chạy 21 bộ test nghiệp vụ độc lập trong bộ nhớ (`tests/api.test.ts`) bằng SQLite engine (`node:sqlite` & [`tests/test-schema.sql`](file:///C:/Users/A.Long/OneDrive/Desktop/PTTKHTPM/Clubspace-source/tests/test-schema.sql)). |
| **Bảo mật & Session** | Cookie HttpOnly, SHA-256 tokens | Argon2id / bcrypt password hashing; Origin check chống CSRF; Rate limiting; Thu hồi phiên khi đổi mật khẩu/khóa tài khoản. Múi giờ hệ thống: `Asia/Ho_Chi_Minh` (UTC+7). |

---

## 3. Mô hình Phân quyền Đa CLB (Multi-tenant RBAC)

Hệ thống có **5 vai trò (Roles)** định danh rõ ràng:

1. **`ADMIN` (Quản trị viên toàn hệ thống):**
   - Hoạt động toàn cục (`club_id = NULL`).
   - Quản lý tài khoản người dùng, tạo câu lạc bộ mới, gán `LEADER` ban đầu, quản lý danh mục vai trò, xem audit log hệ thống.
   - *Ràng buộc:* ADMIN **không** tự động có quyền ghi vào nghiệp vụ hàng ngày của từng CLB (không tự tạo sự kiện, không tự duyệt chi, không điểm danh) trừ khi được gán thêm vai trò nghiệp vụ trong CLB đó.
2. **`LEADER` (Chủ nhiệm / Phó chủ nhiệm CLB):**
   - Quản lý cao nhất trong phạm vi CLB (`club_id` xác định).
   - Phân công vai trò nội bộ CLB (`OFFICER`, `TREASURER`, `MEMBER`, `LEADER`).
   - Phê duyệt các khoản chi tài chính; xử lý ngoại lệ nghiệp vụ (mở khóa điểm danh, duyệt hủy giao dịch ghi sai).
   - *Ràng buộc:* Phải luôn bảo đảm còn ít nhất 1 `LEADER` đang `ACTIVE` trong CLB.
3. **`OFFICER` (Cán bộ phụ trách thành viên & sự kiện):**
   - Quản lý hồ sơ thành viên, cập nhật trạng thái hoạt động trong CLB.
   - Tạo, công bố, quản lý danh sách đăng ký sự kiện, chốt danh sách và thực hiện điểm danh.
4. **`TREASURER` (Thủ quỹ CLB):**
   - Lập phiếu thu, đề xuất chi (`DRAFT`, `PENDING_APPROVAL`), đính kèm chứng từ thanh toán.
   - Thực hiện ghi sổ (`POSTED`) sau khi được duyệt và chi tiền thực tế. Quản lý danh mục thu/chi, theo dõi số dư quỹ.
5. **`MEMBER` (Thành viên sinh viên):**
   - Xem thông tin sự kiện được công bố, đăng ký/hủy đăng ký sự kiện cá nhân.
   - Xem lịch sử tham dự, kết quả điểm danh và cập nhật thông tin liên hệ cá nhân.

### Điều kiện hiệu lực quyền nghiệp vụ:
Một yêu cầu nghiệp vụ của 4 vai trò cấp CLB chỉ hợp lệ khi cả 3 điều kiện đồng thời thỏa mãn:
1. `users.account_status = 'ACTIVE'`
2. `clubs.club_status = 'ACTIVE'`
3. `club_members.member_status = 'ACTIVE'`

---

## 4. 22 Quy tắc Nghiệp vụ Bất biến (Business Rules: BR-01 -> BR-22)

AI Agent khi đọc hoặc sinh code **BẮT BUỘC** tuân thủ 22 quy tắc nghiệp vụ sau:

- **`BR-01`**: `username` là duy nhất trên toàn hệ thống (`UQ_USERS_username`).
- **`BR-02`**: Mã sinh viên `student_code` (nếu có) là duy nhất trên toàn hệ thống (`UX_USERS_student_code`).
- **`BR-03`**: Mỗi người dùng (`user_id`) chỉ có duy nhất một hồ sơ thành viên (`club_member_id`) trong cùng một CLB (`UQ_CLUB_MEMBERS_club_user`).
- **`BR-04` (Bảo toàn lịch sử):** **Tuyệt đối không xóa cứng** bất kỳ bản ghi nào đã phát sinh dữ liệu (User, Club, Member, Event, Transaction). Mọi hành động "xóa" đều chuyển trạng thái logic (`LOCKED`, `LEFT`, `CANCELLED`).
- **`BR-05`**: Chỉ thành viên có `member_status = 'ACTIVE'` mới được phép đăng ký tham gia sự kiện.
- **`BR-06`**: Mỗi thành viên chỉ có tối đa 1 bản ghi đăng ký trong một sự kiện (`UQ_EVENT_REGISTRATIONS_event_member`).
- **`BR-07`**: Hạn chót đăng ký phải trước hoặc bằng thời điểm bắt đầu sự kiện: `registration_deadline <= start_at`.
- **`BR-08`**: Thời điểm kết thúc sự kiện phải lớn hơn thời điểm bắt đầu: `end_at > start_at`.
- **`BR-09` (Giới hạn sức chứa):** Số lượng đăng ký `CONFIRMED` không được vượt quá `capacity` khi sự kiện có đặt giới hạn (`capacity IS NOT NULL`). Quá trình xét duyệt cạnh tranh phải dùng transaction/lock để chống race condition.
- **`BR-10`**: Mỗi thành viên chỉ có duy nhất 1 kết quả điểm danh cho mỗi sự kiện (`UQ_ATTENDANCE_event_member`).
- **`BR-11`**: `MEMBER` không được phép tự sửa kết quả điểm danh của chính mình hoặc người khác.
- **`BR-12`**: Số tiền trong giao dịch tài chính bắt buộc phải dương: `amount > 0`.
- **`BR-13` (Tách quyền phê duyệt):** Mọi khoản chi (`EXPENSE`) phải được một `LEADER` **khác với người tạo** phê duyệt trước khi được ghi sổ.
- **`BR-14` (Tính toán số dư quỹ):** Chỉ những giao dịch có trạng thái `transaction_status = 'POSTED'` mới được tính vào báo cáo thu chi và số dư quỹ (`vw_club_fund_summary`).
- **`BR-15` (Bất biến tài chính):** Giao dịch đã `POSTED` không được phép sửa số tiền hoặc xóa. Nếu ghi sai, chỉ `LEADER` mới có quyền phê duyệt hủy (`CANCELLED`) kèm lý do rõ ràng. Giao dịch điều chỉnh mới phải tham chiếu `replaces_transaction_id` và cùng `club_id`.
- **`BR-16` (Kiểm tra truy vết):** Mọi thao tác quan trọng (thay đổi vai trò, đổi trạng thái thành viên, duyệt/hủy chi tiêu, sửa điểm danh khi đã khóa) bắt buộc phải ghi log vào `AUDIT_LOGS`.
- **`BR-17` (Kiểm tra đa điều kiện):** Mọi thao tác nghiệp vụ máy chủ phải kiểm tra tính hợp lệ của tài khoản (`ACTIVE`), CLB (`ACTIVE`), vai trò và đúng phạm vi `club_id`.
- **`BR-18` (Cấm tự duyệt chi):** Người tạo khoản chi **không được tự phê duyệt**, kể cả khi tài khoản đó kiêm nhiệm cả hai vai trò `LEADER` và `TREASURER`.
- **`BR-19` (Toàn vẹn phạm vi CLB):** Tất cả thực thể liên đới trong một tác vụ (sự kiện, thành viên, đăng ký, điểm danh, hạng mục, giao dịch) **phải thuộc cùng một `club_id`**.
- **`BR-20` (Xử lý toàn vẹn danh sách):** Trước khi chốt danh sách tham dự sự kiện (`CLOSED`), phải xử lý hết toàn bộ đăng ký `PENDING`. Khi khóa điểm danh (`attendance_locked = 1`), tất cả thành viên `CONFIRMED` phải có kết quả điểm danh cụ thể.
- **`BR-21` (Bảo vệ Leader cuối cùng):** Không được gỡ vai trò hoặc vô hiệu hóa tài khoản của `LEADER` hoạt động cuối cùng trong CLB nếu chưa bổ nhiệm người thay thế.
- **`BR-22` (Ghi sổ Idempotent):** Giao dịch tài chính chỉ được chuyển sang `POSTED` đúng một lần. Kiểm tra trạng thái và số dư quỹ phải diễn ra trong cùng transaction cơ sở dữ liệu.

---

## 5. Máy Trạng thái Dữ liệu (State Machines)

```
1. Tài khoản (USERS):
   [ACTIVE] <---> [LOCKED]
      |
      +---------> [INACTIVE]

2. Hồ sơ Thành viên (CLUB_MEMBERS):
   [ACTIVE] <---> [PAUSED]
      |
      +---------> [LEFT] (Lưu lý do vào MEMBER_STATUS_HISTORY)

3. Sự kiện (EVENTS):
   [DRAFT] ----> [OPEN] ----> [CLOSED] ----> [ONGOING] ----> [COMPLETED]
     |             |            |              |
     +-------------+------------+--------------+---> [CANCELLED] (Cần lý do)

4. Đăng ký Sự kiện (EVENT_REGISTRATIONS):
   [PENDING] --------+---> [CONFIRMED]
     |               +---> [REJECTED] (Lưu review_reason)
     +---------------+---> [CANCELLED] (Thành viên tự hủy trước hạn)

5. Giao dịch Thu (INCOME):
   [DRAFT] --------> [POSTED] (Cập nhật số dư)
     |
     +-------------> [CANCELLED]

6. Giao dịch Chi (EXPENSE):
   [DRAFT] ---> [PENDING_APPROVAL] ---> [APPROVED] ---> [POSTED] (Cập nhật số dư)
     |                 |                   |
     |                 v                   v
     +------------> [REJECTED]         [CANCELLED] (LEADER duyệt hủy có lý do)
                       |
                       +-> [DRAFT] (để sửa & gửi lại)
```

---

## 6. 10 Ca Sử dụng Cốt lõi (Core Use Cases: UC-01 -> UC-10)

### UC-01: Đăng nhập và Phân quyền
- **Actor:** Tất cả người dùng.
- **Mô tả:** Xác thực username/password; kiểm tra `account_status = 'ACTIVE'`; nạp danh sách vai trò theo từng CLB; cấp session token an toàn.
- **Ngoại lệ:** Tài khoản `LOCKED` hoặc `INACTIVE` -> Từ chối đăng nhập; Sai mật khẩu quá số lần -> Khóa tạm thời hoặc ghi `AUTH_ATTEMPTS`.

### UC-02: Quản lý Tài khoản và Vai trò
- **Actor:** `ADMIN` (toàn hệ thống), `LEADER` (trong CLB).
- **Mô tả:** `ADMIN` tạo tài khoản, khóa/mở khóa; `LEADER` phân công các vai trò `OFFICER`, `TREASURER`, `MEMBER`, `LEADER` trong CLB của mình.
- **Ràng buộc:** Không được gỡ `LEADER` cuối cùng (`BR-21`).

### UC-03: Quản lý Hồ sơ và Trạng thái Thành viên
- **Actor:** `OFFICER`, `LEADER`. `MEMBER` chỉ cập nhật thông tin liên hệ của chính mình.
- **Mô tả:** Thêm thành viên mới, phân ban/nhóm, cập nhật chức danh; chuyển trạng thái `ACTIVE` / `PAUSED` / `LEFT`.
- **Ràng buộc:** Mọi thay đổi trạng thái phải ghi vào `MEMBER_STATUS_HISTORY` (`BR-16`).

### UC-04: Tạo, Công bố và Cập nhật Sự kiện
- **Actor:** `OFFICER`, `LEADER`.
- **Mô tả:** Tạo sự kiện (`DRAFT`), công bố (`OPEN`), cập nhật thông tin hoặc hủy sự kiện (`CANCELLED`).
- **Ràng buộc:** `end_at > start_at`, `registration_deadline <= start_at` (`BR-07`, `BR-08`). Sự kiện đã diễn ra chỉ `LEADER` mới được hủy có lý do.

### UC-05: Đăng ký hoặc Hủy Đăng ký Sự kiện
- **Actor:** `MEMBER`.
- **Mô tả:** Thành viên đăng ký tham gia sự kiện đang `OPEN`. Nếu `approval_required = false` -> `CONFIRMED`; nếu `true` -> `PENDING`. Hủy đăng ký trước hạn -> `CANCELLED`.
- **Ràng buộc:** Kiểm tra hạn đăng ký, sức chứa `capacity`, thành viên phải `ACTIVE`. Đăng ký `CANCELLED` trước đó được phép đăng ký lại khi còn hạn.

### UC-06: Duyệt và Chốt Danh sách Tham dự
- **Actor:** `OFFICER`, `LEADER`.
- **Mô tả:** Duyệt các đăng ký `PENDING` sang `CONFIRMED` hoặc `REJECTED` (bắt buộc nhập lý do). Chốt danh sách chuyển sự kiện sang `CLOSED`.
- **Ràng buộc:** Không duyệt vượt sức chứa. Phải giải quyết hết `PENDING` trước khi chốt danh sách (`BR-20`).

### UC-07: Điểm danh Sự kiện
- **Actor:** `OFFICER`, `LEADER`.
- **Mô tả:** Đánh dấu kết quả điểm danh: `PRESENT`, `ABSENT`, `LATE`, `EXCUSED`. Khi xong, khóa kết quả (`attendance_locked = true`).
- **Ràng buộc:** Chỉ điểm danh người đã có đăng ký `CONFIRMED`. Khi đã khóa, chỉ `LEADER` được mở lại kèm lý do và ghi audit log.

### UC-08: Ghi nhận Khoản thu
- **Actor:** `TREASURER`.
- **Mô tả:** Lập khoản thu theo danh mục `INCOME`, nhập số tiền (`> 0`), đối tác/thành viên nộp, đính kèm chứng từ (nếu có). Chuyển sang `POSTED` khi thực thu.
- **Ràng buộc:** Báo cáo quỹ chỉ cộng các giao dịch `POSTED`.

### UC-09: Lập và Phê duyệt Khoản chi
- **Actor:** `TREASURER` (lập đề nghị chi), `LEADER` (phê duyệt).
- **Mô tả:** `TREASURER` tạo đề nghị chi (`PENDING_APPROVAL`) kèm chứng từ. `LEADER` xem xét và `APPROVED` hoặc `REJECTED`. Khi tiền đã chi và quỹ đủ, `TREASURER` chuyển `POSTED`.
- **Ràng buộc:** Người duyệt **bắt buộc phải khác** người tạo (`BR-13`, `BR-18`). Khoản chi đã `POSTED` không được sửa số tiền (`BR-15`).

### UC-10: Xem Báo cáo và Dashboard
- **Actor:** Tất cả người dùng (phân chia theo phạm vi quyền).
- **Mô tả:** 
  - `ADMIN`: Thống kê hệ thống, audit log toàn cục.
  - `LEADER`: Tổng quan CLB, số dư quỹ, hiệu suất sự kiện, danh sách thành viên.
  - `OFFICER`: Báo cáo nhân sự, tỷ lệ tham gia sự kiện và tỷ lệ điểm danh.
  - `TREASURER`: Sổ quỹ chi tiết, tổng thu/chi, công nợ/tồn quỹ theo kỳ.
  - `MEMBER`: Lịch sử cá nhân và kết quả tham gia của chính mình.

---

## 7. Cấu trúc Cơ sở Dữ liệu (Schema & Views Reference)

### 15 Models Prisma trong [`prisma/schema.prisma`](file:///C:/Users/A.Long/OneDrive/Desktop/PTTKHTPM/Clubspace-source/prisma/schema.prisma):
1. `User`: Tài khoản người dùng (`user_id`, `student_code`, `username`, `password_hash`, `full_name`, `email`, `account_status`, v.v.).
2. `Club`: Thông tin câu lạc bộ (`club_id`, `club_code`, `club_name`, `club_status`, v.v.).
3. `Role`: Danh mục 5 vai trò hệ thống (`role_id`, `role_code`, `role_name`).
4. `UserRole`: Bảng gán vai trò (`user_role_id`, `user_id`, `role_id`, `club_id`, `active_flag`).
5. `ClubMember`: Hồ sơ thành viên (`club_member_id`, `club_id`, `user_id`, `member_code`, `member_status`, `department_name`, `position_name`, v.v.).
6. `MemberStatusHistory`: Lịch sử đổi trạng thái (`history_id`, `club_member_id`, `old_status`, `new_status`, `reason`, `changed_by`).
7. `Event`: Sự kiện (`event_id`, `club_id`, `event_name`, `start_at`, `end_at`, `registration_deadline`, `capacity`, `event_status`, `attendance_locked`, v.v.).
8. `EventRegistration`: Đăng ký sự kiện (`registration_id`, `event_id`, `club_member_id`, `registration_status`, `reviewed_by`, `review_reason`, v.v.).
9. `Attendance`: Điểm danh (`attendance_id`, `event_id`, `club_member_id`, `registration_id`, `attendance_status`, `check_in_at`, `recorded_by`).
10. `FinanceCategory`: Danh mục tài chính (`category_id`, `club_id`, `category_type` ['INCOME'/'EXPENSE'], `category_name`, `active_flag`).
11. `FinancialTransaction`: Thu/chi (`transaction_id`, `club_id`, `event_id`, `category_id`, `amount`, `transaction_type`, `transaction_status`, `created_by`, `approved_by`, `posted_by`, `replaces_transaction_id`, v.v.).
12. `AuditLog`: Nhật ký kiểm vết (`audit_id`, `user_id`, `club_id`, `action_code`, `entity_name`, `entity_id`, `old_value`, `new_value`, `created_at`).
13. `AuthSession`: Phiên làm việc xác thực (`session_id`, `user_id`, `token_hash`, `expires_at`, `revoked_at`).
14. `AuthAttempt`: Kiểm soát đăng nhập/rate-limiting (`attempt_id`, `username`, `success_flag`, `ip_address`, `created_at`).
15. `AppSetup`: Cờ khởi tạo hệ thống (`setup_key`, `setup_value`, `created_at`).

### 2 Views Tổng hợp:
- **`vw_club_fund_summary`**: Tính `total_income`, `total_expense`, `balance` theo từng `club_id` (chỉ gom nhóm các giao dịch `transaction_status = 'POSTED'`).
- **`vw_event_statistics`**: Thống kê `total_registrations`, `confirmed_count`, `actual_attended` (PRESENT + LATE) cho từng sự kiện.

---

## 8. Chỉ dẫn Hành vi & Nguyên tắc Bắt buộc cho AI Agent (DOs & DONTs)

### NHỮNG ĐIỀU BẮT BUỘC PHẢI LÀM (DOs):
1. **Kiểm tra quyền hạn chặt chẽ (Enforce RBAC & Tenant Scope):**
   Mọi endpoint nghiệp vụ cần kiểm tra `req.session`, xác minh `user_id`, kiểm tra tài khoản `ACTIVE`, và xác minh người dùng có vai trò hợp lệ trong `club_id` tương ứng.
2. **Validate Input toàn diện bằng Zod:**
   Không tin tưởng bất kỳ tham số nào từ request body, query params hay route params. Định nghĩa và parse qua Zod schemas.
3. **Sử dụng Transaction an toàn:**
   Khi thực hiện các thao tác thay đổi dữ liệu phụ thuộc lẫn nhau (ví dụ: đăng ký sự kiện kèm đếm sức chứa; duyệt ghi sổ kèm trừ quỹ; tạo CLB kèm tạo hồ sơ Leader), **BẮT BUỘC** gói trong transaction cơ sở dữ liệu.
4. **Ghi Audit Log cho các tác vụ nhạy cảm:**
   Mọi thao tác thay đổi vai trò, đổi trạng thái hồ sơ thành viên, phê duyệt/hủy giao dịch tài chính, mở khóa điểm danh phải insert vào `AuditLog`.
5. **Tham số hóa truy vấn SQL (Parameterized Queries):**
   Tuyệt đối không ghép chuỗi (string concatenation) trong câu truy vấn SQL để phòng ngừa rủi ro SQL Injection. Luôn dùng Prisma Client hoặc cơ chế binding tham số `$1`, `$2`...
6. **Bảo toàn và chạy Test sau khi sửa code:**
   Mỗi khi tạo mới hoặc sửa đổi code backend/frontend, **BẮT BUỘC** chạy kiểm tra:
   - `pnpm test` (đảm bảo 21/21 bộ test đều pass).
   - `pnpm typecheck` (`pnpm exec tsc --noEmit` đạt 0 lỗi).

### NHỮNG ĐIỀU TUYỆT ĐỐI KHÔNG ĐƯỢC LÀM (DONTs):
1. **KHÔNG BAO GIỜ Hard Delete:** Không viết lệnh `DELETE FROM ...` đối với bất kỳ bảng dữ liệu nghiệp vụ nào. Luôn dùng soft-delete bằng cách chuyển trạng thái logic.
2. **KHÔNG BAO GIỜ Cho Phép Tự Duyệt Chi:** Nghiêm cấm mọi logic cho phép `created_by === approved_by` đối với giao dịch chi tiêu (`EXPENSE`), kể cả khi user nắm nhiều quyền.
3. **KHÔNG BAO GIỜ Thay Đổi Số Tiền Sau Khi POSTED:** Bút toán đã `POSTED` là bất biến. Nếu cần điều chỉnh, phải qua quy trình hủy do ghi sai có phê duyệt của `LEADER`.
4. **KHÔNG BAO GIỜ Rò Rỉ Dữ Liệu Nhạy Cảm:** Tuyệt đối không trả về `password_hash`, token phiên hay secret keys trong API response hoặc log ra console.
5. **KHÔNG BAO GIỜ Bỏ Qua Kiểm Tra Phạm Vi CLB (Club Scope):** Tuyệt đối không để xảy ra tình trạng User thuộc CLB A có thể xem hoặc chỉnh sửa dữ liệu của CLB B (Cross-tenant data leakage).
6. **KHÔNG Xóa Leader Cuối Cùng:** Tuyệt đối không được cấp phép thao tác làm cho một CLB đang hoạt động không còn bất kỳ `LEADER` nào có trạng thái `ACTIVE`.

---

## 9. Các Lệnh Thao tác Thường dùng trong Dự án

```powershell
# Chạy dự án ở môi trường phát triển
pnpm dev

# Biên dịch frontend cho bản dựng sản phẩm
pnpm build

# Khởi chạy server production
pnpm start

# Chạy toàn bộ 21 bộ kiểm thử unit/integration test
pnpm test

# Kiểm tra toàn bộ lỗi TypeScript trong codebase
pnpm typecheck

# Quản lý Database với Supabase & Prisma
pnpm db:push             # Đồng bộ trực tiếp schema lên Supabase
pnpm db:generate         # Sinh lại Prisma Client TypeScript definitions
pnpm db:studio           # Mở giao diện Prisma Studio (http://localhost:5555)
pnpm db:seed:supabase    # Nạp dữ liệu mẫu ban đầu và khởi tạo admin trên Supabase
```

# Kiểm kê database gốc

SQL Server 2019, compatibility level 150; 12 bảng; 2 view. Tệp gốc UTF-16 được giữ nguyên.

## CLUBS

2 bản ghi trong tệp gốc.

| Cột          | Kiểu SQL Server      | Cho NULL | PK    |
| ------------ | -------------------- | -------- | ----- |
| club_id      | bigint IDENTITY(1,1) | False    | True  |
| club_code    | nvarchar (30)        | False    | False |
| club_name    | nvarchar (200)       | False    | False |
| description  | nvarchar (max)       | True     | False |
| founded_date | date                 | True     | False |
| club_status  | varchar (20)         | False    | False |
| created_at   | datetime2 (0)        | False    | False |

Khóa ngoại: Không có

Index: UQ_CLUBS_club_code (club_code)

## FINANCIAL_TRANSACTIONS

8 bản ghi trong tệp gốc.

| Cột                | Kiểu SQL Server      | Cho NULL | PK    |
| ------------------ | -------------------- | -------- | ----- |
| transaction_id     | bigint IDENTITY(1,1) | False    | True  |
| club_id            | bigint               | False    | False |
| event_id           | bigint               | True     | False |
| category_id        | bigint               | False    | False |
| related_member_id  | bigint               | True     | False |
| transaction_type   | varchar (20)         | False    | False |
| amount             | decimal (15, 2)      | False    | False |
| transaction_date   | date                 | False    | False |
| description        | nvarchar (500)       | False    | False |
| evidence_url       | nvarchar (500)       | True     | False |
| transaction_status | varchar (30)         | False    | False |
| created_by         | bigint               | False    | False |
| approved_by        | bigint               | True     | False |
| created_at         | datetime2 (0)        | False    | False |
| approved_at        | datetime2 (0)        | True     | False |
| rejection_reason   | nvarchar (500)       | True     | False |

Khóa ngoại: approved_by → USERS.user_id; category_id → FINANCE_CATEGORIES.category_id; club_id → CLUBS.club_id; created_by → USERS.user_id; event_id → EVENTS.event_id; related_member_id → CLUB_MEMBERS.club_member_id

Index: IX_FT_club_date (club_id, transaction_date); IX_FT_status (transaction_status)

## EVENTS

4 bản ghi trong tệp gốc.

| Cột                   | Kiểu SQL Server      | Cho NULL | PK    |
| --------------------- | -------------------- | -------- | ----- |
| event_id              | bigint IDENTITY(1,1) | False    | True  |
| club_id               | bigint               | False    | False |
| created_by            | bigint               | False    | False |
| event_name            | nvarchar (200)       | False    | False |
| event_type            | nvarchar (100)       | False    | False |
| location              | nvarchar (255)       | False    | False |
| start_at              | datetime2 (0)        | False    | False |
| end_at                | datetime2 (0)        | False    | False |
| registration_deadline | datetime2 (0)        | False    | False |
| capacity              | int                  | True     | False |
| approval_required     | bit                  | False    | False |
| event_status          | varchar (20)         | False    | False |
| attendance_locked     | bit                  | False    | False |
| created_at            | datetime2 (0)        | False    | False |
| updated_at            | datetime2 (0)        | True     | False |

Khóa ngoại: club_id → CLUBS.club_id; created_by → USERS.user_id

Index: IX_EVENTS_club_time (club_id, start_at)

## EVENT_REGISTRATIONS

14 bản ghi trong tệp gốc.

| Cột                 | Kiểu SQL Server      | Cho NULL | PK    |
| ------------------- | -------------------- | -------- | ----- |
| registration_id     | bigint IDENTITY(1,1) | False    | True  |
| event_id            | bigint               | False    | False |
| club_member_id      | bigint               | False    | False |
| registration_status | varchar (20)         | False    | False |
| registered_at       | datetime2 (0)        | False    | False |
| reviewed_by         | bigint               | True     | False |
| reviewed_at         | datetime2 (0)        | True     | False |
| cancelled_at        | datetime2 (0)        | True     | False |

Khóa ngoại: event_id → EVENTS.event_id; club_member_id → CLUB_MEMBERS.club_member_id; reviewed_by → USERS.user_id

Index: UQ_EVENT_REGISTRATIONS_event_member (event_id, club_member_id); IX_ER_event_status (event_id, registration_status)

## ATTENDANCE

8 bản ghi trong tệp gốc.

| Cột               | Kiểu SQL Server      | Cho NULL | PK    |
| ----------------- | -------------------- | -------- | ----- |
| attendance_id     | bigint IDENTITY(1,1) | False    | True  |
| event_id          | bigint               | False    | False |
| club_member_id    | bigint               | False    | False |
| registration_id   | bigint               | True     | False |
| attendance_status | varchar (20)         | False    | False |
| check_in_at       | datetime2 (0)        | True     | False |
| recorded_by       | bigint               | False    | False |
| recorded_at       | datetime2 (0)        | False    | False |

Khóa ngoại: event_id → EVENTS.event_id; club_member_id → CLUB_MEMBERS.club_member_id; recorded_by → USERS.user_id; registration_id → EVENT_REGISTRATIONS.registration_id

Index: UQ_ATTENDANCE_event_member (event_id, club_member_id); IX_ATT_event_status (event_id, attendance_status)

## AUDIT_LOGS

7 bản ghi trong tệp gốc.

| Cột         | Kiểu SQL Server      | Cho NULL | PK    |
| ----------- | -------------------- | -------- | ----- |
| audit_id    | bigint IDENTITY(1,1) | False    | True  |
| user_id     | bigint               | True     | False |
| club_id     | bigint               | True     | False |
| action_code | nvarchar (80)        | False    | False |
| entity_name | nvarchar (80)        | False    | False |
| entity_id   | nvarchar (80)        | True     | False |
| old_value   | nvarchar (max)       | True     | False |
| new_value   | nvarchar (max)       | True     | False |
| created_at  | datetime2 (0)        | False    | False |

Khóa ngoại: club_id → CLUBS.club_id; user_id → USERS.user_id

Index: IX_AL_entity (entity_name, entity_id)

## CLUB_MEMBERS

13 bản ghi trong tệp gốc.

| Cột             | Kiểu SQL Server      | Cho NULL | PK    |
| --------------- | -------------------- | -------- | ----- |
| club_member_id  | bigint IDENTITY(1,1) | False    | True  |
| club_id         | bigint               | False    | False |
| user_id         | bigint               | False    | False |
| member_code     | nvarchar (30)        | False    | False |
| join_date       | date                 | False    | False |
| leave_date      | date                 | True     | False |
| member_status   | varchar (20)         | False    | False |
| department_name | nvarchar (120)       | True     | False |
| position_name   | nvarchar (120)       | True     | False |
| created_at      | datetime2 (0)        | False    | False |
| updated_at      | datetime2 (0)        | True     | False |

Khóa ngoại: club_id → CLUBS.club_id; user_id → USERS.user_id

Index: UQ_CLUB_MEMBERS_club_member_code (club_id, member_code); UQ_CLUB_MEMBERS_club_user (club_id, user_id); IX_CM_club_status (club_id, member_status)

## FINANCE_CATEGORIES

8 bản ghi trong tệp gốc.

| Cột           | Kiểu SQL Server      | Cho NULL | PK    |
| ------------- | -------------------- | -------- | ----- |
| category_id   | bigint IDENTITY(1,1) | False    | True  |
| club_id       | bigint               | False    | False |
| category_type | varchar (20)         | False    | False |
| category_name | nvarchar (150)       | False    | False |
| active_flag   | bit                  | False    | False |

Khóa ngoại: club_id → CLUBS.club_id

Index: UQ_FINANCE_CATEGORIES (club_id, category_type, category_name)

## MEMBER_STATUS_HISTORY

2 bản ghi trong tệp gốc.

| Cột            | Kiểu SQL Server      | Cho NULL | PK    |
| -------------- | -------------------- | -------- | ----- |
| history_id     | bigint IDENTITY(1,1) | False    | True  |
| club_member_id | bigint               | False    | False |
| old_status     | varchar (20)         | True     | False |
| new_status     | varchar (20)         | False    | False |
| reason         | nvarchar (500)       | True     | False |
| changed_by     | bigint               | False    | False |
| changed_at     | datetime2 (0)        | False    | False |

Khóa ngoại: changed_by → USERS.user_id; club_member_id → CLUB_MEMBERS.club_member_id

Index: PK

## ROLES

5 bản ghi trong tệp gốc.

| Cột       | Kiểu SQL Server        | Cho NULL | PK    |
| --------- | ---------------------- | -------- | ----- |
| role_id   | smallint IDENTITY(1,1) | False    | True  |
| role_code | varchar (30)           | False    | False |
| role_name | nvarchar (100)         | False    | False |

Khóa ngoại: Không có

Index: UQ_ROLES_role_code (role_code)

## USER_ROLES

20 bản ghi trong tệp gốc.

| Cột          | Kiểu SQL Server      | Cho NULL | PK    |
| ------------ | -------------------- | -------- | ----- |
| user_role_id | bigint IDENTITY(1,1) | False    | True  |
| user_id      | bigint               | False    | False |
| role_id      | smallint             | False    | False |
| club_id      | bigint               | True     | False |
| assigned_by  | bigint               | True     | False |
| assigned_at  | datetime2 (0)        | False    | False |
| active_flag  | bit                  | False    | False |

Khóa ngoại: assigned_by → USERS.user_id; club_id → CLUBS.club_id; role_id → ROLES.role_id; user_id → USERS.user_id

Index: UQ_USER_ROLES_scope (user_id, role_id, club_id); IX_USER_ROLES_user_club_active (user_id, club_id, active_flag)

## USERS

14 bản ghi trong tệp gốc.

| Cột            | Kiểu SQL Server      | Cho NULL | PK    |
| -------------- | -------------------- | -------- | ----- |
| user_id        | bigint IDENTITY(1,1) | False    | True  |
| student_code   | nvarchar (30)        | True     | False |
| username       | nvarchar (50)        | False    | False |
| password_hash  | nvarchar (255)       | False    | False |
| full_name      | nvarchar (150)       | False    | False |
| email          | nvarchar (150)       | True     | False |
| phone          | nvarchar (20)        | True     | False |
| faculty        | nvarchar (150)       | True     | False |
| class_name     | nvarchar (100)       | True     | False |
| account_status | varchar (20)         | False    | False |
| created_at     | datetime2 (0)        | False    | False |
| updated_at     | datetime2 (0)        | True     | False |

Khóa ngoại: Không có

Index: UQ_USERS_username (username); UX_USERS_email (email); UX_USERS_student_code (student_code)

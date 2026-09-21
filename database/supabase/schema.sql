-- =======================================================
-- CLUBSPACE - SUPABASE / POSTGRESQL DDL SCHEMA
-- =======================================================

-- 1. BẢNG CLUBS
CREATE TABLE IF NOT EXISTS "CLUBS" (
    "club_id" SERIAL PRIMARY KEY,
    "club_code" VARCHAR(30) NOT NULL UNIQUE,
    "club_name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "founded_date" DATE,
    "club_status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK ("club_status" IN ('ACTIVE', 'INACTIVE')),
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. BẢNG USERS
CREATE TABLE IF NOT EXISTS "USERS" (
    "user_id" SERIAL PRIMARY KEY,
    "student_code" VARCHAR(30) UNIQUE,
    "username" VARCHAR(50) NOT NULL UNIQUE,
    "password_hash" VARCHAR(255) NOT NULL,
    "full_name" VARCHAR(150) NOT NULL,
    "email" VARCHAR(150) UNIQUE,
    "phone" VARCHAR(20),
    "faculty" VARCHAR(150),
    "class_name" VARCHAR(100),
    "account_status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK ("account_status" IN ('ACTIVE', 'INACTIVE', 'LOCKED')),
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(0)
);

-- 3. BẢNG ROLES
CREATE TABLE IF NOT EXISTS "ROLES" (
    "role_id" SERIAL PRIMARY KEY,
    "role_code" VARCHAR(30) NOT NULL UNIQUE CHECK ("role_code" IN ('ADMIN', 'LEADER', 'OFFICER', 'TREASURER', 'MEMBER')),
    "role_name" VARCHAR(100) NOT NULL
);

-- 4. BẢNG USER_ROLES
CREATE TABLE IF NOT EXISTS "USER_ROLES" (
    "user_role_id" SERIAL PRIMARY KEY,
    "user_id" INTEGER NOT NULL REFERENCES "USERS"("user_id") ON DELETE CASCADE,
    "role_id" INTEGER NOT NULL REFERENCES "ROLES"("role_id") ON DELETE CASCADE,
    "club_id" INTEGER REFERENCES "CLUBS"("club_id") ON DELETE CASCADE,
    "assigned_by" INTEGER REFERENCES "USERS"("user_id") ON DELETE SET NULL,
    "assigned_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active_flag" SMALLINT NOT NULL DEFAULT 1 CHECK ("active_flag" IN (0, 1)),
    CONSTRAINT "UQ_USER_ROLES_scope" UNIQUE ("user_id", "role_id", "club_id")
);
CREATE INDEX IF NOT EXISTS "IX_USER_ROLES_user_club_active" ON "USER_ROLES"("user_id", "club_id", "active_flag");

-- 5. BẢNG CLUB_MEMBERS
CREATE TABLE IF NOT EXISTS "CLUB_MEMBERS" (
    "club_member_id" SERIAL PRIMARY KEY,
    "club_id" INTEGER NOT NULL REFERENCES "CLUBS"("club_id") ON DELETE CASCADE,
    "user_id" INTEGER NOT NULL REFERENCES "USERS"("user_id") ON DELETE CASCADE,
    "member_code" VARCHAR(50) NOT NULL,
    "join_date" DATE NOT NULL,
    "leave_date" DATE,
    "member_status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK ("member_status" IN ('ACTIVE', 'PAUSED', 'LEFT')),
    "department_name" VARCHAR(100),
    "position_name" VARCHAR(100),
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(0),
    CONSTRAINT "UQ_CLUB_MEMBERS_club_member_code" UNIQUE ("club_id", "member_code"),
    CONSTRAINT "UQ_CLUB_MEMBERS_club_user" UNIQUE ("club_id", "user_id")
);
CREATE INDEX IF NOT EXISTS "IX_CM_club_status" ON "CLUB_MEMBERS"("club_id", "member_status");

-- 6. BẢNG MEMBER_STATUS_HISTORY
CREATE TABLE IF NOT EXISTS "MEMBER_STATUS_HISTORY" (
    "history_id" SERIAL PRIMARY KEY,
    "club_member_id" INTEGER NOT NULL REFERENCES "CLUB_MEMBERS"("club_member_id") ON DELETE CASCADE,
    "old_status" VARCHAR(20),
    "new_status" VARCHAR(20) NOT NULL CHECK ("new_status" IN ('ACTIVE', 'PAUSED', 'LEFT')),
    "reason" VARCHAR(500),
    "changed_by" INTEGER NOT NULL REFERENCES "USERS"("user_id"),
    "changed_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7. BẢNG EVENTS
CREATE TABLE IF NOT EXISTS "EVENTS" (
    "event_id" SERIAL PRIMARY KEY,
    "club_id" INTEGER NOT NULL REFERENCES "CLUBS"("club_id") ON DELETE CASCADE,
    "created_by" INTEGER NOT NULL REFERENCES "USERS"("user_id"),
    "event_name" VARCHAR(200) NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "location" VARCHAR(255) NOT NULL,
    "start_at" TIMESTAMP(0) NOT NULL,
    "end_at" TIMESTAMP(0) NOT NULL,
    "registration_deadline" TIMESTAMP(0) NOT NULL,
    "capacity" INTEGER CHECK ("capacity" IS NULL OR "capacity" > 0),
    "approval_required" SMALLINT NOT NULL DEFAULT 0 CHECK ("approval_required" IN (0, 1)),
    "event_status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK ("event_status" IN ('DRAFT', 'OPEN', 'CLOSED', 'ONGOING', 'COMPLETED', 'CANCELLED')),
    "attendance_locked" SMALLINT NOT NULL DEFAULT 0 CHECK ("attendance_locked" IN (0, 1)),
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(0)
);
CREATE INDEX IF NOT EXISTS "IX_EVENTS_club_time" ON "EVENTS"("club_id", "start_at");

-- 8. BẢNG EVENT_REGISTRATIONS
CREATE TABLE IF NOT EXISTS "EVENT_REGISTRATIONS" (
    "registration_id" SERIAL PRIMARY KEY,
    "event_id" INTEGER NOT NULL REFERENCES "EVENTS"("event_id") ON DELETE CASCADE,
    "club_member_id" INTEGER NOT NULL REFERENCES "CLUB_MEMBERS"("club_member_id") ON DELETE CASCADE,
    "registration_status" VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK ("registration_status" IN ('PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED')),
    "registered_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_by" INTEGER REFERENCES "USERS"("user_id"),
    "reviewed_at" TIMESTAMP(0),
    "cancelled_at" TIMESTAMP(0),
    CONSTRAINT "UQ_EVENT_REGISTRATIONS_event_member" UNIQUE ("event_id", "club_member_id")
);
CREATE INDEX IF NOT EXISTS "IX_ER_event_status" ON "EVENT_REGISTRATIONS"("event_id", "registration_status");

-- 9. BẢNG ATTENDANCE
CREATE TABLE IF NOT EXISTS "ATTENDANCE" (
    "attendance_id" SERIAL PRIMARY KEY,
    "event_id" INTEGER NOT NULL REFERENCES "EVENTS"("event_id") ON DELETE CASCADE,
    "club_member_id" INTEGER NOT NULL REFERENCES "CLUB_MEMBERS"("club_member_id") ON DELETE CASCADE,
    "registration_id" INTEGER REFERENCES "EVENT_REGISTRATIONS"("registration_id"),
    "attendance_status" VARCHAR(20) NOT NULL CHECK ("attendance_status" IN ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED')),
    "check_in_at" TIMESTAMP(0),
    "recorded_by" INTEGER NOT NULL REFERENCES "USERS"("user_id"),
    "recorded_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UQ_ATTENDANCE_event_member" UNIQUE ("event_id", "club_member_id")
);
CREATE INDEX IF NOT EXISTS "IX_ATT_event_status" ON "ATTENDANCE"("event_id", "attendance_status");

-- 10. BẢNG FINANCE_CATEGORIES
CREATE TABLE IF NOT EXISTS "FINANCE_CATEGORIES" (
    "category_id" SERIAL PRIMARY KEY,
    "club_id" INTEGER NOT NULL REFERENCES "CLUBS"("club_id") ON DELETE CASCADE,
    "category_type" VARCHAR(20) NOT NULL CHECK ("category_type" IN ('INCOME', 'EXPENSE')),
    "category_name" VARCHAR(100) NOT NULL,
    "active_flag" SMALLINT NOT NULL DEFAULT 1 CHECK ("active_flag" IN (0, 1)),
    CONSTRAINT "UQ_FINANCE_CATEGORIES" UNIQUE ("club_id", "category_type", "category_name")
);

-- 11. BẢNG FINANCIAL_TRANSACTIONS
CREATE TABLE IF NOT EXISTS "FINANCIAL_TRANSACTIONS" (
    "transaction_id" SERIAL PRIMARY KEY,
    "club_id" INTEGER NOT NULL REFERENCES "CLUBS"("club_id") ON DELETE CASCADE,
    "event_id" INTEGER REFERENCES "EVENTS"("event_id") ON DELETE SET NULL,
    "category_id" INTEGER NOT NULL REFERENCES "FINANCE_CATEGORIES"("category_id"),
    "related_member_id" INTEGER REFERENCES "CLUB_MEMBERS"("club_member_id") ON DELETE SET NULL,
    "transaction_type" VARCHAR(20) NOT NULL CHECK ("transaction_type" IN ('INCOME', 'EXPENSE')),
    "amount" DECIMAL(15, 2) NOT NULL CHECK ("amount" > 0),
    "transaction_date" DATE NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "evidence_url" VARCHAR(500),
    "transaction_status" VARCHAR(30) NOT NULL DEFAULT 'DRAFT' CHECK ("transaction_status" IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'POSTED', 'CANCELLED', 'REJECTED')),
    "created_by" INTEGER NOT NULL REFERENCES "USERS"("user_id"),
    "approved_by" INTEGER REFERENCES "USERS"("user_id"),
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_at" TIMESTAMP(0),
    "rejection_reason" VARCHAR(500)
);
CREATE INDEX IF NOT EXISTS "IX_FT_club_date" ON "FINANCIAL_TRANSACTIONS"("club_id", "transaction_date");
CREATE INDEX IF NOT EXISTS "IX_FT_status" ON "FINANCIAL_TRANSACTIONS"("transaction_status");

-- 12. BẢNG AUDIT_LOGS
CREATE TABLE IF NOT EXISTS "AUDIT_LOGS" (
    "audit_id" SERIAL PRIMARY KEY,
    "user_id" INTEGER REFERENCES "USERS"("user_id"),
    "club_id" INTEGER REFERENCES "CLUBS"("club_id"),
    "action_code" VARCHAR(50) NOT NULL,
    "entity_name" VARCHAR(100) NOT NULL,
    "entity_id" VARCHAR(100),
    "old_value" TEXT,
    "new_value" TEXT,
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "IX_AL_entity" ON "AUDIT_LOGS"("entity_name", "entity_id");

-- 13. BẢNG AUTH_SESSIONS
CREATE TABLE IF NOT EXISTS "AUTH_SESSIONS" (
    "token_hash" VARCHAR(64) PRIMARY KEY,
    "user_id" INTEGER NOT NULL REFERENCES "USERS"("user_id") ON DELETE CASCADE,
    "expires_at" BIGINT NOT NULL,
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "IX_AUTH_SESSIONS_user" ON "AUTH_SESSIONS"("user_id");

-- 14. BẢNG AUTH_ATTEMPTS
CREATE TABLE IF NOT EXISTS "AUTH_ATTEMPTS" (
    "attempt_id" SERIAL PRIMARY KEY,
    "identifier" VARCHAR(64) NOT NULL,
    "attempted_at" BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS "IX_AUTH_ATTEMPTS_identifier_time" ON "AUTH_ATTEMPTS"("identifier", "attempted_at");

-- 15. BẢNG APP_SETUP
CREATE TABLE IF NOT EXISTS "APP_SETUP" (
    "setup_id" INTEGER PRIMARY KEY,
    "completed_at" VARCHAR(30) NOT NULL
);

-- =======================================================
-- VIEWS THỐNG KÊ
-- =======================================================

CREATE OR REPLACE VIEW "vw_club_fund_summary" AS
SELECT
    c.club_id,
    c.club_code,
    c.club_name,
    COALESCE(CAST(SUM(CASE
        WHEN ft.transaction_status = 'POSTED'
         AND ft.transaction_type = 'INCOME'
        THEN ft.amount ELSE 0 END) AS DECIMAL(18,2)), 0) AS total_income,
    COALESCE(CAST(SUM(CASE
        WHEN ft.transaction_status = 'POSTED'
         AND ft.transaction_type = 'EXPENSE'
        THEN ft.amount ELSE 0 END) AS DECIMAL(18,2)), 0) AS total_expense,
    COALESCE(CAST(
        SUM(CASE
            WHEN ft.transaction_status = 'POSTED'
             AND ft.transaction_type = 'INCOME'
            THEN ft.amount ELSE 0 END)
        -
        SUM(CASE
            WHEN ft.transaction_status = 'POSTED'
             AND ft.transaction_type = 'EXPENSE'
            THEN ft.amount ELSE 0 END)
        AS DECIMAL(18,2)
    ), 0) AS balance
FROM "CLUBS" c
LEFT JOIN "FINANCIAL_TRANSACTIONS" ft
    ON ft.club_id = c.club_id
GROUP BY
    c.club_id,
    c.club_code,
    c.club_name;

CREATE OR REPLACE VIEW "vw_event_statistics" AS
WITH RegAgg AS
(
    SELECT
        event_id,
        COUNT(*) AS total_registrations,
        SUM(CASE WHEN registration_status = 'PENDING'   THEN 1 ELSE 0 END) AS pending_count,
        SUM(CASE WHEN registration_status = 'CONFIRMED' THEN 1 ELSE 0 END) AS confirmed_count,
        SUM(CASE WHEN registration_status = 'REJECTED'  THEN 1 ELSE 0 END) AS rejected_count,
        SUM(CASE WHEN registration_status = 'CANCELLED' THEN 1 ELSE 0 END) AS cancelled_count
    FROM "EVENT_REGISTRATIONS"
    GROUP BY event_id
),
AttAgg AS
(
    SELECT
        event_id,
        COUNT(*) AS attendance_record_count,
        SUM(CASE WHEN attendance_status IN ('PRESENT', 'LATE') THEN 1 ELSE 0 END) AS attended_count,
        SUM(CASE WHEN attendance_status = 'ABSENT' THEN 1 ELSE 0 END) AS absent_count,
        SUM(CASE WHEN attendance_status = 'EXCUSED' THEN 1 ELSE 0 END) AS excused_count
    FROM "ATTENDANCE"
    GROUP BY event_id
)
SELECT
    e.event_id,
    e.club_id,
    e.event_name,
    e.start_at,
    e.end_at,
    e.event_status,
    e.capacity,
    COALESCE(r.total_registrations, 0) AS total_registrations,
    COALESCE(r.pending_count, 0) AS pending_count,
    COALESCE(r.confirmed_count, 0) AS confirmed_count,
    COALESCE(r.rejected_count, 0) AS rejected_count,
    COALESCE(r.cancelled_count, 0) AS cancelled_count,
    COALESCE(a.attendance_record_count, 0) AS attendance_record_count,
    COALESCE(a.attended_count, 0) AS attended_count,
    COALESCE(a.absent_count, 0) AS absent_count,
    COALESCE(a.excused_count, 0) AS excused_count,
    CAST(
        CASE
            WHEN COALESCE(r.confirmed_count, 0) = 0 THEN 0
            ELSE COALESCE(a.attended_count, 0) * 100.0 / r.confirmed_count
        END
        AS DECIMAL(6,2)
    ) AS attendance_rate_percent
FROM "EVENTS" e
LEFT JOIN RegAgg r ON r.event_id = e.event_id
LEFT JOIN AttAgg a ON a.event_id = e.event_id;

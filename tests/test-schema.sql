CREATE TABLE `APP_SETUP` (
	`setup_id` integer PRIMARY KEY NOT NULL,
	`completed_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ATTENDANCE` (
	`attendance_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer NOT NULL,
	`club_member_id` integer NOT NULL,
	`registration_id` integer,
	`attendance_status` text NOT NULL,
	`check_in_at` text,
	`recorded_by` integer NOT NULL,
	`recorded_at` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `EVENTS`(`event_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`club_member_id`) REFERENCES `CLUB_MEMBERS`(`club_member_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recorded_by`) REFERENCES `USERS`(`user_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`registration_id`) REFERENCES `EVENT_REGISTRATIONS`(`registration_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "CK_ATTENDANCE_status" CHECK(("ATTENDANCE"."attendance_status"='EXCUSED' OR "ATTENDANCE"."attendance_status"='LATE' OR "ATTENDANCE"."attendance_status"='ABSENT' OR "ATTENDANCE"."attendance_status"='PRESENT'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `UQ_ATTENDANCE_event_member` ON `ATTENDANCE` (`event_id`,`club_member_id`);--> statement-breakpoint
CREATE INDEX `IX_ATT_event_status` ON `ATTENDANCE` (`event_id`,`attendance_status`);--> statement-breakpoint
CREATE TABLE `AUDIT_LOGS` (
	`audit_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`club_id` integer,
	`action_code` text NOT NULL,
	`entity_name` text NOT NULL,
	`entity_id` text,
	`old_value` text,
	`new_value` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`club_id`) REFERENCES `CLUBS`(`club_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `USERS`(`user_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "CK_AUDIT_LOGS_new_value_json" CHECK(("AUDIT_LOGS"."new_value" IS NULL OR json_valid("AUDIT_LOGS"."new_value")=(1))),
	CONSTRAINT "CK_AUDIT_LOGS_old_value_json" CHECK(("AUDIT_LOGS"."old_value" IS NULL OR json_valid("AUDIT_LOGS"."old_value")=(1)))
);
--> statement-breakpoint
CREATE INDEX `IX_AL_entity` ON `AUDIT_LOGS` (`entity_name`,`entity_id`);--> statement-breakpoint
CREATE TABLE `AUTH_ATTEMPTS` (
	`attempt_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`identifier` text NOT NULL,
	`attempted_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `IX_AUTH_ATTEMPTS_identifier_time` ON `AUTH_ATTEMPTS` (`identifier`,`attempted_at`);--> statement-breakpoint
CREATE TABLE `AUTH_SESSIONS` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `USERS`(`user_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `CLUBS` (
	`club_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`club_code` text NOT NULL,
	`club_name` text NOT NULL,
	`description` text,
	`founded_date` text,
	`club_status` text NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT "CK_CLUBS_club_status" CHECK(("CLUBS"."club_status"='INACTIVE' OR "CLUBS"."club_status"='ACTIVE'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `UQ_CLUBS_club_code` ON `CLUBS` (`club_code`);--> statement-breakpoint
CREATE TABLE `CLUB_MEMBERS` (
	`club_member_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`club_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`member_code` text NOT NULL,
	`join_date` text NOT NULL,
	`leave_date` text,
	`member_status` text NOT NULL,
	`department_name` text,
	`position_name` text,
	`created_at` text NOT NULL,
	`updated_at` text,
	FOREIGN KEY (`club_id`) REFERENCES `CLUBS`(`club_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `USERS`(`user_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "CK_CLUB_MEMBERS_leave_date" CHECK(("CLUB_MEMBERS"."leave_date" IS NULL OR "CLUB_MEMBERS"."leave_date">="CLUB_MEMBERS"."join_date")),
	CONSTRAINT "CK_CLUB_MEMBERS_member_status" CHECK(("CLUB_MEMBERS"."member_status"='LEFT' OR "CLUB_MEMBERS"."member_status"='PAUSED' OR "CLUB_MEMBERS"."member_status"='ACTIVE'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `UQ_CLUB_MEMBERS_club_member_code` ON `CLUB_MEMBERS` (`club_id`,`member_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `UQ_CLUB_MEMBERS_club_user` ON `CLUB_MEMBERS` (`club_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `IX_CM_club_status` ON `CLUB_MEMBERS` (`club_id`,`member_status`);--> statement-breakpoint
CREATE TABLE `EVENTS` (
	`event_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`club_id` integer NOT NULL,
	`created_by` integer NOT NULL,
	`event_name` text NOT NULL,
	`event_type` text NOT NULL,
	`location` text NOT NULL,
	`start_at` text NOT NULL,
	`end_at` text NOT NULL,
	`registration_deadline` text NOT NULL,
	`capacity` integer,
	`approval_required` integer NOT NULL,
	`event_status` text NOT NULL,
	`scope` text DEFAULT 'PUBLIC' NOT NULL,
	`attendance_locked` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text,
	FOREIGN KEY (`club_id`) REFERENCES `CLUBS`(`club_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `USERS`(`user_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "CK_EVENTS_capacity" CHECK(("EVENTS"."capacity" IS NULL OR "EVENTS"."capacity">(0))),
	CONSTRAINT "CK_EVENTS_event_status" CHECK(("EVENTS"."event_status"='CANCELLED' OR "EVENTS"."event_status"='COMPLETED' OR "EVENTS"."event_status"='ONGOING' OR "EVENTS"."event_status"='CLOSED' OR "EVENTS"."event_status"='OPEN' OR "EVENTS"."event_status"='DRAFT')),
	CONSTRAINT "CK_EVENTS_registration_deadline" CHECK(("EVENTS"."registration_deadline"<="EVENTS"."start_at")),
	CONSTRAINT "CK_EVENTS_time" CHECK(("EVENTS"."end_at">"EVENTS"."start_at"))
);
--> statement-breakpoint
CREATE INDEX `IX_EVENTS_club_time` ON `EVENTS` (`club_id`,`start_at`);--> statement-breakpoint
CREATE TABLE `EVENT_REGISTRATIONS` (
	`registration_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer NOT NULL,
	`club_member_id` integer NOT NULL,
	`registration_status` text NOT NULL,
	`registered_at` text NOT NULL,
	`reviewed_by` integer,
	`reviewed_at` text,
	`cancelled_at` text,
	FOREIGN KEY (`event_id`) REFERENCES `EVENTS`(`event_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`club_member_id`) REFERENCES `CLUB_MEMBERS`(`club_member_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewed_by`) REFERENCES `USERS`(`user_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "CK_EVENT_REGISTRATIONS_status" CHECK(("EVENT_REGISTRATIONS"."registration_status"='CANCELLED' OR "EVENT_REGISTRATIONS"."registration_status"='REJECTED' OR "EVENT_REGISTRATIONS"."registration_status"='CONFIRMED' OR "EVENT_REGISTRATIONS"."registration_status"='PENDING'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `UQ_EVENT_REGISTRATIONS_event_member` ON `EVENT_REGISTRATIONS` (`event_id`,`club_member_id`);--> statement-breakpoint
CREATE INDEX `IX_ER_event_status` ON `EVENT_REGISTRATIONS` (`event_id`,`registration_status`);--> statement-breakpoint
CREATE TABLE `FINANCE_CATEGORIES` (
	`category_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`club_id` integer NOT NULL,
	`category_type` text NOT NULL,
	`category_name` text NOT NULL,
	`active_flag` integer NOT NULL,
	FOREIGN KEY (`club_id`) REFERENCES `CLUBS`(`club_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "CK_FINANCE_CATEGORIES_type" CHECK(("FINANCE_CATEGORIES"."category_type"='EXPENSE' OR "FINANCE_CATEGORIES"."category_type"='INCOME'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `UQ_FINANCE_CATEGORIES` ON `FINANCE_CATEGORIES` (`club_id`,`category_type`,`category_name`);--> statement-breakpoint
CREATE TABLE `FINANCIAL_TRANSACTIONS` (
	`transaction_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`club_id` integer NOT NULL,
	`event_id` integer,
	`category_id` integer NOT NULL,
	`related_member_id` integer,
	`transaction_type` text NOT NULL,
	`amount` numeric NOT NULL,
	`transaction_date` text NOT NULL,
	`description` text NOT NULL,
	`evidence_url` text,
	`transaction_status` text NOT NULL,
	`created_by` integer NOT NULL,
	`approved_by` integer,
	`created_at` text NOT NULL,
	`approved_at` text,
	`rejection_reason` text,
	FOREIGN KEY (`approved_by`) REFERENCES `USERS`(`user_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `FINANCE_CATEGORIES`(`category_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`club_id`) REFERENCES `CLUBS`(`club_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `USERS`(`user_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`event_id`) REFERENCES `EVENTS`(`event_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`related_member_id`) REFERENCES `CLUB_MEMBERS`(`club_member_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "CK_FINANCIAL_TRANSACTIONS_amount" CHECK(("FINANCIAL_TRANSACTIONS"."amount">(0))),
	CONSTRAINT "CK_FINANCIAL_TRANSACTIONS_rejection_reason" CHECK(("FINANCIAL_TRANSACTIONS"."transaction_status"<>'REJECTED' OR nullif(ltrim(rtrim("FINANCIAL_TRANSACTIONS"."rejection_reason")),'') IS NOT NULL)),
	CONSTRAINT "CK_FINANCIAL_TRANSACTIONS_status" CHECK(("FINANCIAL_TRANSACTIONS"."transaction_status"='CANCELLED' OR "FINANCIAL_TRANSACTIONS"."transaction_status"='POSTED' OR "FINANCIAL_TRANSACTIONS"."transaction_status"='REJECTED' OR "FINANCIAL_TRANSACTIONS"."transaction_status"='APPROVED' OR "FINANCIAL_TRANSACTIONS"."transaction_status"='PENDING_APPROVAL' OR "FINANCIAL_TRANSACTIONS"."transaction_status"='DRAFT')),
	CONSTRAINT "CK_FINANCIAL_TRANSACTIONS_type" CHECK(("FINANCIAL_TRANSACTIONS"."transaction_type"='EXPENSE' OR "FINANCIAL_TRANSACTIONS"."transaction_type"='INCOME'))
);
--> statement-breakpoint
CREATE INDEX `IX_FT_club_date` ON `FINANCIAL_TRANSACTIONS` (`club_id`,`transaction_date`);--> statement-breakpoint
CREATE INDEX `IX_FT_status` ON `FINANCIAL_TRANSACTIONS` (`transaction_status`);--> statement-breakpoint
CREATE TABLE `MEMBER_STATUS_HISTORY` (
	`history_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`club_member_id` integer NOT NULL,
	`old_status` text,
	`new_status` text NOT NULL,
	`reason` text,
	`changed_by` integer NOT NULL,
	`changed_at` text NOT NULL,
	FOREIGN KEY (`changed_by`) REFERENCES `USERS`(`user_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`club_member_id`) REFERENCES `CLUB_MEMBERS`(`club_member_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "CK_MEMBER_STATUS_HISTORY_new_status" CHECK(("MEMBER_STATUS_HISTORY"."new_status"='LEFT' OR "MEMBER_STATUS_HISTORY"."new_status"='PAUSED' OR "MEMBER_STATUS_HISTORY"."new_status"='ACTIVE')),
	CONSTRAINT "CK_MEMBER_STATUS_HISTORY_old_status" CHECK(("MEMBER_STATUS_HISTORY"."old_status" IS NULL OR ("MEMBER_STATUS_HISTORY"."old_status"='LEFT' OR "MEMBER_STATUS_HISTORY"."old_status"='PAUSED' OR "MEMBER_STATUS_HISTORY"."old_status"='ACTIVE')))
);
--> statement-breakpoint
CREATE TABLE `ROLES` (
	`role_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`role_code` text NOT NULL,
	`role_name` text NOT NULL,
	CONSTRAINT "CK_ROLES_role_code" CHECK(("ROLES"."role_code"='MEMBER' OR "ROLES"."role_code"='TREASURER' OR "ROLES"."role_code"='OFFICER' OR "ROLES"."role_code"='LEADER' OR "ROLES"."role_code"='ADMIN'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `UQ_ROLES_role_code` ON `ROLES` (`role_code`);--> statement-breakpoint
CREATE TABLE `USERS` (
	`user_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`student_code` text,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`full_name` text NOT NULL,
	`email` text,
	`phone` text,
	`faculty` text,
	`class_name` text,
	`account_status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text,
	CONSTRAINT "CK_USERS_account_status" CHECK(("USERS"."account_status"='INACTIVE' OR "USERS"."account_status"='LOCKED' OR "USERS"."account_status"='ACTIVE'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `UQ_USERS_username` ON `USERS` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `UX_USERS_email` ON `USERS` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `UX_USERS_student_code` ON `USERS` (`student_code`);--> statement-breakpoint
CREATE TABLE `USER_ROLES` (
	`user_role_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`role_id` integer NOT NULL,
	`club_id` integer,
	`assigned_by` integer,
	`assigned_at` text NOT NULL,
	`active_flag` integer NOT NULL,
	FOREIGN KEY (`assigned_by`) REFERENCES `USERS`(`user_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`club_id`) REFERENCES `CLUBS`(`club_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`role_id`) REFERENCES `ROLES`(`role_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `USERS`(`user_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `UQ_USER_ROLES_scope` ON `USER_ROLES` (`user_id`,`role_id`,`club_id`);--> statement-breakpoint
CREATE INDEX `IX_USER_ROLES_user_club_active` ON `USER_ROLES` (`user_id`,`club_id`,`active_flag`);--> statement-breakpoint
CREATE TABLE `CLUB_JOIN_REQUESTS` (
	`request_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`club_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`message` text,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`reviewed_by` integer,
	`reviewed_at` text,
	`review_reason` text,
	`created_at` text NOT NULL,
	`updated_at` text,
	FOREIGN KEY (`club_id`) REFERENCES `CLUBS`(`club_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `USERS`(`user_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewed_by`) REFERENCES `USERS`(`user_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "CK_CLUB_JOIN_REQUESTS_status" CHECK(("CLUB_JOIN_REQUESTS"."status"='PENDING' OR "CLUB_JOIN_REQUESTS"."status"='APPROVED' OR "CLUB_JOIN_REQUESTS"."status"='REJECTED'))
);--> statement-breakpoint
CREATE INDEX `IX_CJR_club_status` ON `CLUB_JOIN_REQUESTS` (`club_id`,`status`);--> statement-breakpoint
CREATE INDEX `IX_CJR_user_id` ON `CLUB_JOIN_REQUESTS` (`user_id`);
CREATE VIEW vw_club_fund_summary AS
SELECT
    c.club_id,
    c.club_code,
    c.club_name,
    CAST(SUM(CASE
        WHEN ft.transaction_status = 'POSTED'
         AND ft.transaction_type = 'INCOME'
        THEN ft.amount ELSE 0 END) AS DECIMAL(18,2)) AS total_income,
    CAST(SUM(CASE
        WHEN ft.transaction_status = 'POSTED'
         AND ft.transaction_type = 'EXPENSE'
        THEN ft.amount ELSE 0 END) AS DECIMAL(18,2)) AS total_expense,
    CAST(
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
    ) AS balance
FROM CLUBS c
LEFT JOIN FINANCIAL_TRANSACTIONS ft
    ON ft.club_id = c.club_id
GROUP BY
    c.club_id,
    c.club_code,
    c.club_name;
--> statement-breakpoint
CREATE VIEW vw_event_statistics AS
WITH RegAgg AS
(
    SELECT
        event_id,
        COUNT(*) AS total_registrations,
        SUM(CASE WHEN registration_status = 'PENDING'   THEN 1 ELSE 0 END) AS pending_count,
        SUM(CASE WHEN registration_status = 'CONFIRMED' THEN 1 ELSE 0 END) AS confirmed_count,
        SUM(CASE WHEN registration_status = 'REJECTED'  THEN 1 ELSE 0 END) AS rejected_count,
        SUM(CASE WHEN registration_status = 'CANCELLED' THEN 1 ELSE 0 END) AS cancelled_count
    FROM EVENT_REGISTRATIONS
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
    FROM ATTENDANCE
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
FROM EVENTS e
LEFT JOIN RegAgg r ON r.event_id = e.event_id
LEFT JOIN AttAgg a ON a.event_id = e.event_id;
--> statement-breakpoint
CREATE TRIGGER TR_REG_insert BEFORE INSERT ON EVENT_REGISTRATIONS WHEN COALESCE((SELECT completed_at FROM APP_SETUP WHERE setup_id=1),'') <> 'SEEDING' BEGIN
  SELECT CASE WHEN (SELECT club_id FROM EVENTS WHERE event_id=NEW.event_id) <> (SELECT club_id FROM CLUB_MEMBERS WHERE club_member_id=NEW.club_member_id) THEN RAISE(ABORT, 'CROSS_CLUB') END;
  SELECT CASE WHEN NEW.registration_status='CONFIRMED' AND (SELECT capacity FROM EVENTS WHERE event_id=NEW.event_id) IS NOT NULL AND (SELECT COUNT(*) FROM EVENT_REGISTRATIONS WHERE event_id=NEW.event_id AND registration_status='CONFIRMED') >= (SELECT capacity FROM EVENTS WHERE event_id=NEW.event_id) THEN RAISE(ABORT, 'CAPACITY') END;
  SELECT CASE WHEN NEW.registration_status IN ('CONFIRMED','PENDING') AND (SELECT member_status FROM CLUB_MEMBERS WHERE club_member_id=NEW.club_member_id)<>'ACTIVE' THEN RAISE(ABORT, 'INACTIVE_MEMBER') END;
  SELECT CASE WHEN NEW.registration_status IN ('CONFIRMED','PENDING') AND (SELECT event_status FROM EVENTS WHERE event_id=NEW.event_id) NOT IN ('OPEN','CLOSED','ONGOING') THEN RAISE(ABORT, 'INVALID_STATE') END;
END;
--> statement-breakpoint
CREATE TRIGGER TR_ATT_insert BEFORE INSERT ON ATTENDANCE WHEN COALESCE((SELECT completed_at FROM APP_SETUP WHERE setup_id=1),'') <> 'SEEDING' BEGIN
  SELECT CASE WHEN (SELECT attendance_locked FROM EVENTS WHERE event_id=NEW.event_id)=1 THEN RAISE(ABORT, 'LOCKED_ATTENDANCE') END;
  SELECT CASE WHEN (SELECT club_id FROM EVENTS WHERE event_id=NEW.event_id)<>(SELECT club_id FROM CLUB_MEMBERS WHERE club_member_id=NEW.club_member_id) THEN RAISE(ABORT, 'CROSS_CLUB') END;
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM EVENT_REGISTRATIONS WHERE registration_id=NEW.registration_id AND event_id=NEW.event_id AND club_member_id=NEW.club_member_id AND registration_status='CONFIRMED') THEN RAISE(ABORT, 'INVALID_STATE') END;
END;
--> statement-breakpoint
CREATE TRIGGER TR_FIN_insert BEFORE INSERT ON FINANCIAL_TRANSACTIONS WHEN COALESCE((SELECT completed_at FROM APP_SETUP WHERE setup_id=1),'') <> 'SEEDING' BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM FINANCE_CATEGORIES WHERE category_id=NEW.category_id AND club_id=NEW.club_id AND category_type=NEW.transaction_type) THEN RAISE(ABORT, 'CROSS_CLUB') END;
  SELECT CASE WHEN NEW.event_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM EVENTS WHERE event_id=NEW.event_id AND club_id=NEW.club_id) THEN RAISE(ABORT, 'CROSS_CLUB') END;
  SELECT CASE WHEN NEW.related_member_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM CLUB_MEMBERS WHERE club_member_id=NEW.related_member_id AND club_id=NEW.club_id) THEN RAISE(ABORT, 'CROSS_CLUB') END;
  SELECT CASE WHEN NEW.transaction_type='EXPENSE' AND NEW.transaction_status IN ('APPROVED','POSTED') AND (NEW.approved_by IS NULL OR NEW.approved_by=NEW.created_by) THEN RAISE(ABORT, 'INVALID_STATE') END;
END;
--> statement-breakpoint
CREATE TRIGGER TR_ROLE_insert BEFORE INSERT ON USER_ROLES WHEN COALESCE((SELECT completed_at FROM APP_SETUP WHERE setup_id=1),'') <> 'SEEDING' BEGIN
  SELECT CASE WHEN ((SELECT role_code FROM ROLES WHERE role_id=NEW.role_id)='ADMIN' AND NEW.club_id IS NOT NULL) OR ((SELECT role_code FROM ROLES WHERE role_id=NEW.role_id)<>'ADMIN' AND NEW.club_id IS NULL) THEN RAISE(ABORT, 'INVALID_STATE') END;
END;
--> statement-breakpoint
CREATE TRIGGER TR_REG_update BEFORE UPDATE ON EVENT_REGISTRATIONS WHEN COALESCE((SELECT completed_at FROM APP_SETUP WHERE setup_id=1),'') <> 'SEEDING' BEGIN
  SELECT CASE WHEN (SELECT club_id FROM EVENTS WHERE event_id=NEW.event_id) <> (SELECT club_id FROM CLUB_MEMBERS WHERE club_member_id=NEW.club_member_id) THEN RAISE(ABORT, 'CROSS_CLUB') END;
  SELECT CASE WHEN NEW.registration_status='CONFIRMED' AND (SELECT capacity FROM EVENTS WHERE event_id=NEW.event_id) IS NOT NULL AND (SELECT COUNT(*) FROM EVENT_REGISTRATIONS WHERE event_id=NEW.event_id AND registration_status='CONFIRMED' AND registration_id<>OLD.registration_id) >= (SELECT capacity FROM EVENTS WHERE event_id=NEW.event_id) THEN RAISE(ABORT, 'CAPACITY') END;
  SELECT CASE WHEN NEW.registration_status IN ('CONFIRMED','PENDING') AND (SELECT member_status FROM CLUB_MEMBERS WHERE club_member_id=NEW.club_member_id)<>'ACTIVE' THEN RAISE(ABORT, 'INACTIVE_MEMBER') END;
  SELECT CASE WHEN NEW.registration_status IN ('CONFIRMED','PENDING') AND (SELECT event_status FROM EVENTS WHERE event_id=NEW.event_id) NOT IN ('OPEN','CLOSED','ONGOING') THEN RAISE(ABORT, 'INVALID_STATE') END;
END;
--> statement-breakpoint
CREATE TRIGGER TR_ATT_update BEFORE UPDATE ON ATTENDANCE WHEN COALESCE((SELECT completed_at FROM APP_SETUP WHERE setup_id=1),'') <> 'SEEDING' BEGIN
  SELECT CASE WHEN (SELECT attendance_locked FROM EVENTS WHERE event_id=NEW.event_id)=1 THEN RAISE(ABORT, 'LOCKED_ATTENDANCE') END;
  SELECT CASE WHEN (SELECT club_id FROM EVENTS WHERE event_id=NEW.event_id)<>(SELECT club_id FROM CLUB_MEMBERS WHERE club_member_id=NEW.club_member_id) THEN RAISE(ABORT, 'CROSS_CLUB') END;
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM EVENT_REGISTRATIONS WHERE registration_id=NEW.registration_id AND event_id=NEW.event_id AND club_member_id=NEW.club_member_id AND registration_status='CONFIRMED') THEN RAISE(ABORT, 'INVALID_STATE') END;
END;
--> statement-breakpoint
CREATE TRIGGER TR_FIN_update BEFORE UPDATE ON FINANCIAL_TRANSACTIONS WHEN COALESCE((SELECT completed_at FROM APP_SETUP WHERE setup_id=1),'') <> 'SEEDING' BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM FINANCE_CATEGORIES WHERE category_id=NEW.category_id AND club_id=NEW.club_id AND category_type=NEW.transaction_type) THEN RAISE(ABORT, 'CROSS_CLUB') END;
  SELECT CASE WHEN NEW.event_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM EVENTS WHERE event_id=NEW.event_id AND club_id=NEW.club_id) THEN RAISE(ABORT, 'CROSS_CLUB') END;
  SELECT CASE WHEN NEW.related_member_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM CLUB_MEMBERS WHERE club_member_id=NEW.related_member_id AND club_id=NEW.club_id) THEN RAISE(ABORT, 'CROSS_CLUB') END;
  SELECT CASE WHEN NEW.transaction_type='EXPENSE' AND NEW.transaction_status IN ('APPROVED','POSTED') AND (NEW.approved_by IS NULL OR NEW.approved_by=NEW.created_by) THEN RAISE(ABORT, 'INVALID_STATE') END;
END;
--> statement-breakpoint
CREATE TRIGGER TR_ROLE_update BEFORE UPDATE ON USER_ROLES WHEN COALESCE((SELECT completed_at FROM APP_SETUP WHERE setup_id=1),'') <> 'SEEDING' BEGIN
  SELECT CASE WHEN ((SELECT role_code FROM ROLES WHERE role_id=NEW.role_id)='ADMIN' AND NEW.club_id IS NOT NULL) OR ((SELECT role_code FROM ROLES WHERE role_id=NEW.role_id)<>'ADMIN' AND NEW.club_id IS NULL) THEN RAISE(ABORT, 'INVALID_STATE') END;
END;
--> statement-breakpoint
CREATE TRIGGER TR_EVENT_CAPACITY BEFORE UPDATE ON EVENTS WHEN COALESCE((SELECT completed_at FROM APP_SETUP WHERE setup_id=1),'') <> 'SEEDING' BEGIN
  SELECT CASE WHEN NEW.capacity IS NOT NULL AND NEW.capacity<(SELECT COUNT(*) FROM EVENT_REGISTRATIONS WHERE event_id=NEW.event_id AND registration_status='CONFIRMED') THEN RAISE(ABORT, 'CAPACITY') END;
END;
--> statement-breakpoint
CREATE TRIGGER TR_FIN_IMMUTABLE BEFORE UPDATE ON FINANCIAL_TRANSACTIONS WHEN COALESCE((SELECT completed_at FROM APP_SETUP WHERE setup_id=1),'') <> 'SEEDING' BEGIN
  SELECT CASE WHEN OLD.transaction_status='POSTED' AND (NEW.amount<>OLD.amount OR NEW.transaction_type<>OLD.transaction_type OR NEW.transaction_date<>OLD.transaction_date OR NEW.category_id<>OLD.category_id OR NEW.transaction_status NOT IN ('POSTED','CANCELLED')) THEN RAISE(ABORT, 'INVALID_STATE') END;
  SELECT CASE WHEN OLD.transaction_status='CANCELLED' AND NEW.transaction_status<>'CANCELLED' THEN RAISE(ABORT, 'INVALID_STATE') END;
END;
--> statement-breakpoint
CREATE UNIQUE INDEX UX_USER_ROLES_GLOBAL ON USER_ROLES(user_id,role_id) WHERE club_id IS NULL;
CREATE TRIGGER TR_KEEP_LAST_MANAGER BEFORE UPDATE OF active_flag ON USER_ROLES
WHEN OLD.active_flag=1 AND NEW.active_flag=0 AND COALESCE((SELECT completed_at FROM APP_SETUP WHERE setup_id=1),'')<>'SEEDING'
BEGIN
 SELECT CASE WHEN (SELECT role_code FROM ROLES WHERE role_id=OLD.role_id) IN ('ADMIN','LEADER')
 AND (OLD.club_id IS NULL OR EXISTS(SELECT 1 FROM CLUBS WHERE club_id=OLD.club_id AND club_status='ACTIVE'))
 AND NOT EXISTS(SELECT 1 FROM USER_ROLES ur JOIN USERS u ON u.user_id=ur.user_id WHERE ur.role_id=OLD.role_id AND (ur.club_id=OLD.club_id OR (ur.club_id IS NULL AND OLD.club_id IS NULL)) AND ur.user_role_id<>OLD.user_role_id AND ur.active_flag=1 AND u.account_status='ACTIVE')
 THEN RAISE(ABORT,'INVALID_STATE_LAST_MANAGER') END;
END;
--> statement-breakpoint
CREATE TRIGGER TR_KEEP_LAST_ACTIVE_ACCOUNT BEFORE UPDATE OF account_status ON USERS
WHEN OLD.account_status='ACTIVE' AND NEW.account_status<>'ACTIVE' AND COALESCE((SELECT completed_at FROM APP_SETUP WHERE setup_id=1),'')<>'SEEDING'
BEGIN
 SELECT CASE WHEN EXISTS(
 SELECT 1 FROM USER_ROLES own JOIN ROLES r ON r.role_id=own.role_id
 WHERE own.user_id=OLD.user_id AND own.active_flag=1 AND r.role_code IN ('ADMIN','LEADER')
 AND (own.club_id IS NULL OR EXISTS(SELECT 1 FROM CLUBS WHERE club_id=own.club_id AND club_status='ACTIVE'))
 AND NOT EXISTS(SELECT 1 FROM USER_ROLES other JOIN USERS u ON u.user_id=other.user_id WHERE other.role_id=own.role_id AND (other.club_id=own.club_id OR (other.club_id IS NULL AND own.club_id IS NULL)) AND other.user_id<>OLD.user_id AND other.active_flag=1 AND u.account_status='ACTIVE'))
 THEN RAISE(ABORT,'INVALID_STATE_LAST_MANAGER') END;
END;
--> statement-breakpoint
CREATE TRIGGER TR_REG_STATE_CHANGE BEFORE UPDATE OF registration_status ON EVENT_REGISTRATIONS
WHEN COALESCE((SELECT completed_at FROM APP_SETUP WHERE setup_id=1),'')<>'SEEDING'
BEGIN
 SELECT CASE WHEN NEW.registration_status IN ('PENDING','CONFIRMED') AND NEW.reviewed_by IS NULL
 AND NOT EXISTS(SELECT 1 FROM EVENTS WHERE event_id=NEW.event_id AND event_status='OPEN' AND registration_deadline>=strftime('%Y-%m-%dT%H:%M:%S','now','+7 hours'))
 THEN RAISE(ABORT,'INVALID_STATE_REGISTRATION_CLOSED') END;
END;
--> statement-breakpoint
CREATE TRIGGER TR_REG_STATE_INSERT BEFORE INSERT ON EVENT_REGISTRATIONS
WHEN COALESCE((SELECT completed_at FROM APP_SETUP WHERE setup_id=1),'')<>'SEEDING'
BEGIN
 SELECT CASE WHEN NEW.registration_status IN ('PENDING','CONFIRMED') AND NEW.reviewed_by IS NULL
 AND NOT EXISTS(SELECT 1 FROM EVENTS WHERE event_id=NEW.event_id AND event_status='OPEN' AND registration_deadline>=strftime('%Y-%m-%dT%H:%M:%S','now','+7 hours'))
 THEN RAISE(ABORT,'INVALID_STATE_REGISTRATION_CLOSED') END;
END;

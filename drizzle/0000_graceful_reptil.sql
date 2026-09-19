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
CREATE INDEX `IX_USER_ROLES_user_club_active` ON `USER_ROLES` (`user_id`,`club_id`,`active_flag`);
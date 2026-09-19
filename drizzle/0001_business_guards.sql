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

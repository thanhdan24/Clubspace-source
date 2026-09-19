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

from pathlib import Path
import re
root=Path(__file__).resolve().parent.parent
s=(root/'database/original/data.sql').read_text(encoding='utf-16')
statements=[]
for m in re.finditer(r'CREATE\s+VIEW \[dbo\]\.\[(.*?)\](.*?)\nGO',s,re.S):
 name,body=m.groups();body=body.replace('dbo.','').replace('ISNULL(','COALESCE(');statements.append('CREATE VIEW '+name+' '+body.strip().rstrip(';')+';')
# Explicitly bypass time/state guards only within the atomic initial preview import.
guard="COALESCE((SELECT completed_at FROM APP_SETUP WHERE setup_id=1),'') <> 'SEEDING'"
def trigger(name,table,event,checks):
 statements.append(f'CREATE TRIGGER {name} BEFORE {event} ON {table} WHEN {guard} BEGIN\n'+''.join(f"  SELECT CASE WHEN {expr} THEN RAISE(ABORT, '{message}') END;\n" for expr,message in checks)+'END;')
for event in ['INSERT','UPDATE']:
 suffix=event.lower()
 trigger('TR_REG_'+suffix,'EVENT_REGISTRATIONS',event,[
 ("(SELECT club_id FROM EVENTS WHERE event_id=NEW.event_id) <> (SELECT club_id FROM CLUB_MEMBERS WHERE club_member_id=NEW.club_member_id)",'CROSS_CLUB'),
 ("NEW.registration_status='CONFIRMED' AND (SELECT capacity FROM EVENTS WHERE event_id=NEW.event_id) IS NOT NULL AND (SELECT COUNT(*) FROM EVENT_REGISTRATIONS WHERE event_id=NEW.event_id AND registration_status='CONFIRMED'"+(" AND registration_id<>OLD.registration_id" if event=='UPDATE' else '')+") >= (SELECT capacity FROM EVENTS WHERE event_id=NEW.event_id)",'CAPACITY'),
 ("NEW.registration_status IN ('CONFIRMED','PENDING') AND (SELECT member_status FROM CLUB_MEMBERS WHERE club_member_id=NEW.club_member_id)<>'ACTIVE'",'INACTIVE_MEMBER'),
 ("NEW.registration_status IN ('CONFIRMED','PENDING') AND (SELECT event_status FROM EVENTS WHERE event_id=NEW.event_id) NOT IN ('OPEN','CLOSED','ONGOING')",'INVALID_STATE')])
 trigger('TR_ATT_'+suffix,'ATTENDANCE',event,[
 ("(SELECT attendance_locked FROM EVENTS WHERE event_id=NEW.event_id)=1",'LOCKED_ATTENDANCE'),
 ("(SELECT club_id FROM EVENTS WHERE event_id=NEW.event_id)<>(SELECT club_id FROM CLUB_MEMBERS WHERE club_member_id=NEW.club_member_id)",'CROSS_CLUB'),
 ("NOT EXISTS(SELECT 1 FROM EVENT_REGISTRATIONS WHERE registration_id=NEW.registration_id AND event_id=NEW.event_id AND club_member_id=NEW.club_member_id AND registration_status='CONFIRMED')",'INVALID_STATE')])
 trigger('TR_FIN_'+suffix,'FINANCIAL_TRANSACTIONS',event,[
 ("NOT EXISTS(SELECT 1 FROM FINANCE_CATEGORIES WHERE category_id=NEW.category_id AND club_id=NEW.club_id AND category_type=NEW.transaction_type)",'CROSS_CLUB'),
 ("NEW.event_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM EVENTS WHERE event_id=NEW.event_id AND club_id=NEW.club_id)",'CROSS_CLUB'),
 ("NEW.related_member_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM CLUB_MEMBERS WHERE club_member_id=NEW.related_member_id AND club_id=NEW.club_id)",'CROSS_CLUB'),
 ("NEW.transaction_type='EXPENSE' AND NEW.transaction_status IN ('APPROVED','POSTED') AND (NEW.approved_by IS NULL OR NEW.approved_by=NEW.created_by)",'INVALID_STATE')])
 trigger('TR_ROLE_'+suffix,'USER_ROLES',event,[("((SELECT role_code FROM ROLES WHERE role_id=NEW.role_id)='ADMIN' AND NEW.club_id IS NOT NULL) OR ((SELECT role_code FROM ROLES WHERE role_id=NEW.role_id)<>'ADMIN' AND NEW.club_id IS NULL)",'INVALID_STATE')])
trigger('TR_EVENT_CAPACITY','EVENTS','UPDATE',[("NEW.capacity IS NOT NULL AND NEW.capacity<(SELECT COUNT(*) FROM EVENT_REGISTRATIONS WHERE event_id=NEW.event_id AND registration_status='CONFIRMED')",'CAPACITY')])
trigger('TR_FIN_IMMUTABLE','FINANCIAL_TRANSACTIONS','UPDATE',[("OLD.transaction_status='POSTED' AND (NEW.amount<>OLD.amount OR NEW.transaction_type<>OLD.transaction_type OR NEW.transaction_date<>OLD.transaction_date OR NEW.category_id<>OLD.category_id OR NEW.transaction_status NOT IN ('POSTED','CANCELLED'))",'INVALID_STATE'),("OLD.transaction_status='CANCELLED' AND NEW.transaction_status<>'CANCELLED'",'INVALID_STATE')])
statements.append('CREATE UNIQUE INDEX UX_USER_ROLES_GLOBAL ON USER_ROLES(user_id,role_id) WHERE club_id IS NULL;')
(root/'drizzle/0001_business_guards.sql').write_text('\n--> statement-breakpoint\n'.join(statements)+'\n')
print('Generated',len(statements),'bounded schema statements.')

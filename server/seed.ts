// Explicit preview-only seed; never runs against a non-empty business database.
import original from "../database/imported-data.json";
import bcrypt from "bcryptjs";
import { one, stmt, now, type Database } from "./core";
export async function seedPreview(db: Database, env: any) {
  if (env.DEMO_MODE !== "true" || !env.DEMO_PASSWORD) return;
  if (await one(db, "SELECT setup_id FROM APP_SETUP WHERE setup_id=1")) return;
  if (Number((await one(db, "SELECT COUNT(*) AS n FROM USERS"))?.n) > 0) return;
  const order = [
    "USERS",
    "ROLES",
    "CLUBS",
    "USER_ROLES",
    "CLUB_MEMBERS",
    "MEMBER_STATUS_HISTORY",
    "EVENTS",
    "EVENT_REGISTRATIONS",
    "ATTENDANCE",
    "FINANCE_CATEGORIES",
    "FINANCIAL_TRANSACTIONS",
    "AUDIT_LOGS",
  ];
  const entries: any[] = [
    stmt(db, "INSERT INTO APP_SETUP(setup_id,completed_at) VALUES (1,?)", [
      "SEEDING",
    ]),
  ];
  for (const table of order)
    for (const row of (original as any)[table]) {
      const keys = Object.keys(row);
      entries.push(
        stmt(
          db,
          `INSERT INTO ${table} (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`,
          Object.values(row),
        ),
      );
    }
  const password_hash = await bcrypt.hash(env.DEMO_PASSWORD, 10);
  const demos = [
    ["ADMIN", "Quản trị trải nghiệm"],
    ["LEADER", "Minh Anh · Trải nghiệm"],
    ["OFFICER", "Thu Hà · Trải nghiệm"],
    ["TREASURER", "Quốc Bảo · Trải nghiệm"],
    ["MEMBER", "Gia Huy · Trải nghiệm"],
  ];
  for (let i = 0; i < demos.length; i++) {
    const [role, name] = demos[i];
    const id = 10001 + i;
    entries.push(
      stmt(
        db,
        "INSERT INTO USERS(user_id,username,password_hash,full_name,account_status,created_at) VALUES (?,?,?,?,?,?)",
        [
          id,
          "demo_" + role.toLowerCase(),
          password_hash,
          name,
          "ACTIVE",
          now(),
        ],
      ),
    );
    entries.push(
      stmt(
        db,
        "INSERT INTO USER_ROLES(user_id,role_id,club_id,assigned_by,assigned_at,active_flag) VALUES (?,?,?,?,?,1)",
        [id, i + 1, i === 0 ? null : 1, 1, now()],
      ),
    );
    if (i > 0) {
      entries.push(
        stmt(
          db,
          "INSERT INTO CLUB_MEMBERS(club_id,user_id,member_code,join_date,member_status,department_name,position_name,created_at) VALUES (?,?,?,?,?,?,?,?)",
          [
            1,
            id,
            "DEMO00" + i,
            now().slice(0, 10),
            "ACTIVE",
            "Nhóm trải nghiệm",
            role,
            now(),
          ],
        ),
      );
      if (role !== "MEMBER")
        entries.push(
          stmt(
            db,
            "INSERT INTO USER_ROLES(user_id,role_id,club_id,assigned_by,assigned_at,active_flag) VALUES (?,5,1,1,?,1)",
            [id, now()],
          ),
        );
    }
  }
  entries.push(
    stmt(db, "UPDATE APP_SETUP SET completed_at=? WHERE setup_id=1", [now()]),
  );
  try {
    await db.batch(entries);
  } catch (e) {
    if (!(await one(db, "SELECT setup_id FROM APP_SETUP WHERE setup_id=1")))
      throw e;
  }
}

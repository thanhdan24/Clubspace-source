import { z } from "zod";
import bcrypt from "bcryptjs";
import {
  all,
  one,
  stmt,
  now,
  day,
  fail,
  permit,
  readPermit,
  has,
  isStaff,
  json,
  body,
  str,
  opt,
  date,
  idSchema,
  audit,
  change,
  insert,
  scoped,
  list,
  paging,
  member,
  cleanUser,
  csv,
  type Context,
} from "./core";
export async function peopleRoute(c: Context, path: string, req: Request) {
  const url = new URL(req.url),
    method = req.method;
  if (path === "me" && method === "GET") {
    const clubs = await all(
      c.db,
      c.admin
        ? "SELECT * FROM CLUBS ORDER BY club_name"
        : "SELECT DISTINCT c.* FROM CLUBS c JOIN USER_ROLES ur ON ur.club_id=c.club_id WHERE ur.user_id=? AND ur.active_flag=1 ORDER BY c.club_name",
      c.admin ? [] : [c.user.user_id],
    );
    return json({
      user: cleanUser(c.user),
      clubs,
      club_id: c.club,
      roles: c.roles,
      admin: c.admin,
      demo: c.env.DEMO_MODE === "true",
    });
  }
  if (path === "profile" && method === "GET")
    return json({
      user: cleanUser(c.user),
      membership: await one(
        c.db,
        "SELECT * FROM CLUB_MEMBERS WHERE user_id=? AND club_id=?",
        [c.user.user_id, c.club],
      ),
    });
  if (path === "profile" && method === "PATCH") {
    const b = z
      .object({
        full_name: str(150),
        email: z
          .union([
            z.string().email("Email không hợp lệ."),
            z.literal(""),
            z.null(),
          ])
          .optional()
          .transform((v) => v || null),
        phone: opt(20),
        faculty: opt(150),
        class_name: opt(100),
      })
      .parse(await body(req));
    await change(
      c,
      "USERS",
      "user_id",
      c.user.user_id,
      { ...b, updated_at: now() },
      cleanUser(c.user),
      "UPDATE_PROFILE",
    );
    return json({ ok: true });
  }
  if (path === "profile/password" && method === "POST") {
    const b = z
      .object({
        current_password: str(200),
        password: z.string().min(10, "Mật khẩu cần ít nhất 10 ký tự.").max(72),
      })
      .parse(await body(req));
    fail(
      await bcrypt.compare(b.current_password, c.user.password_hash),
      "Mật khẩu hiện tại không đúng.",
    );
    await c.db.batch([
      stmt(
        c.db,
        "UPDATE USERS SET password_hash=?,updated_at=? WHERE user_id=?",
        [await bcrypt.hash(b.password, 12), now(), c.user.user_id],
      ),
      stmt(c.db, "DELETE FROM AUTH_SESSIONS WHERE user_id=?", [c.user.user_id]),
      audit(c, "CHANGE_PASSWORD", "USERS", c.user.user_id, null, {
        changed: true,
      }),
    ]);
    return json({ ok: true, relogin: true });
  }
  if (path === "notifications" && method === "GET") {
    return json({
      rows: await all(
        c.db,
        "SELECT a.audit_id,a.action_code,a.created_at,e.event_id,e.event_name FROM AUDIT_LOGS a JOIN EVENTS e ON CAST(e.event_id AS varchar(80))=a.entity_id JOIN EVENT_REGISTRATIONS r ON r.event_id=e.event_id JOIN CLUB_MEMBERS m ON m.club_member_id=r.club_member_id WHERE a.entity_name='EVENTS' AND a.action_code IN ('UPDATE_EVENT','CANCEL_EVENT','CLOSE_EVENT','START_EVENT') AND a.club_id=? AND m.user_id=? AND a.created_at>=r.registered_at ORDER BY a.created_at DESC,a.audit_id DESC LIMIT 10",
        [c.club, c.user.user_id],
      ),
    });
  }
  if (path === "options" && method === "GET") {
    const result: any = {
      events: await all(
        c.db,
        "SELECT event_id,event_name FROM EVENTS WHERE club_id=? AND event_status<>'DRAFT' ORDER BY start_at DESC",
        [c.club],
      ),
    };
    if (isStaff(c))
      result.members = await all(
        c.db,
        "SELECT cm.club_member_id,cm.member_code,u.full_name,cm.user_id FROM CLUB_MEMBERS cm JOIN USERS u ON u.user_id=cm.user_id WHERE cm.club_id=? ORDER BY u.full_name",
        [c.club],
      );
    if (c.admin || has(c, "LEADER", "OFFICER"))
      result.users = await all(
        c.db,
        "SELECT user_id,full_name,student_code,username FROM USERS ORDER BY full_name",
      );
    if (isStaff(c))
      result.categories = await all(
        c.db,
        "SELECT * FROM FINANCE_CATEGORIES WHERE club_id=? ORDER BY category_name",
        [c.club],
      );
    return json(result);
  }
  if (path === "members" && method === "GET") {
    readPermit(c, "LEADER", "OFFICER", "TREASURER");
    const { q, status } = paging(url);
    const p: any[] = [c.club, "%" + q + "%", "%" + q + "%"];
    let sql =
      "SELECT cm.*,u.full_name,u.student_code,u.email,u.phone,u.faculty,u.class_name,u.account_status FROM CLUB_MEMBERS cm JOIN USERS u ON u.user_id=cm.user_id WHERE cm.club_id=? AND (u.full_name LIKE ? OR cm.member_code LIKE ?)";
    if (status) {
      sql += " AND cm.member_status=?";
      p.push(status);
    }
    const department = url.searchParams.get("department");
    if (department) {
      sql += " AND cm.department_name=?";
      p.push(department);
    }
    if (url.searchParams.get("export") === "csv")
      return csv(
        await all(c.db, sql + " ORDER BY cm.club_member_id", p),
        {
          member_code: "Mã thành viên",
          full_name: "Họ và tên",
          student_code: "Mã sinh viên",
          department_name: "Ban / nhóm",
          position_name: "Chức vụ",
          member_status: "Trạng thái",
          join_date: "Ngày gia nhập",
        },
        "thanh-vien",
      );
    return json(await list(c, sql, p, "cm.club_member_id DESC", url));
  }
  if (path === "members" && method === "POST") {
    permit(c, "OFFICER");
    const b = z
      .object({
        user_id: idSchema,
        member_code: str(30),
        join_date: date,
        department_name: opt(120),
        position_name: opt(120),
      })
      .parse(await body(req));
    fail(
      await one(c.db, "SELECT user_id FROM USERS WHERE user_id=?", [b.user_id]),
      "Tài khoản không tồn tại.",
    );
    fail(
      !(await one(
        c.db,
        "SELECT club_member_id FROM CLUB_MEMBERS WHERE club_id=? AND (user_id=? OR member_code=?)",
        [c.club, b.user_id, b.member_code],
      )),
      "Tài khoản hoặc mã thành viên đã tồn tại trong CLB.",
      409,
    );
    const role = await one(
      c.db,
      "SELECT role_id FROM ROLES WHERE role_code=?",
      ["MEMBER"],
    );
    const existing = await one(
      c.db,
      "SELECT * FROM USER_ROLES WHERE user_id=? AND club_id=? AND role_id=?",
      [b.user_id, c.club, role!.role_id],
    );
    const grant = existing
      ? stmt(
          c.db,
          "UPDATE USER_ROLES SET active_flag=1,assigned_by=?,assigned_at=? WHERE user_role_id=?",
          [c.user.user_id, now(), existing.user_role_id],
        )
      : stmt(
          c.db,
          "INSERT INTO USER_ROLES(user_id,role_id,club_id,assigned_by,assigned_at,active_flag) VALUES (?,?,?,?,?,1)",
          [b.user_id, role!.role_id, c.club, c.user.user_id, now()],
        );
    const id = await insert(
      c,
      "CLUB_MEMBERS",
      { ...b, club_id: c.club, member_status: "ACTIVE", created_at: now() },
      "CREATE_MEMBER",
      [grant],
    );
    return json({ club_member_id: id }, 201);
  }
  const m = path.match(/^members\/(\d+)(?:\/(history))?$/);
  if (m) {
    readPermit(c, "LEADER", "OFFICER", "TREASURER");
    const row = await scoped(c, "CLUB_MEMBERS", "club_member_id", Number(m[1]));
    if (method === "GET")
      return json({
        member: row,
        user: cleanUser(
          (await one(c.db, "SELECT * FROM USERS WHERE user_id=?", [
            row.user_id,
          ]))!,
        ),
        history: await all(
          c.db,
          "SELECT h.*,u.full_name FROM MEMBER_STATUS_HISTORY h JOIN USERS u ON u.user_id=h.changed_by WHERE club_member_id=? ORDER BY changed_at DESC",
          [row.club_member_id],
        ),
      });
    if (method === "PATCH") {
      permit(c, "OFFICER", "LEADER");
      const b = z
        .object({
          member_code: str(30),
          join_date: date,
          leave_date: z
            .union([date, z.literal(""), z.null()])
            .optional()
            .transform((v) => v || null),
          member_status: z.enum(["ACTIVE", "PAUSED", "LEFT"]),
          department_name: opt(120),
          position_name: opt(120),
          reason: opt(500),
        })
        .parse(await body(req));
      fail(
        !b.leave_date || b.leave_date >= b.join_date,
        "Ngày rời không được trước ngày gia nhập.",
      );
      fail(
        b.member_status !== "LEFT" || b.leave_date,
        "Vui lòng nhập ngày rời câu lạc bộ.",
      );
      fail(
        b.member_status === "LEFT" || !b.leave_date,
        "Chỉ nhập ngày rời khi thành viên đã rời CLB.",
      );
      const extras = [];
      if (b.member_status !== row.member_status) {
        fail(b.reason, "Vui lòng nhập lý do thay đổi trạng thái.");
        extras.push(
          stmt(
            c.db,
            "INSERT INTO MEMBER_STATUS_HISTORY(club_member_id,old_status,new_status,reason,changed_by,changed_at) VALUES (?,?,?,?,?,?)",
            [
              row.club_member_id,
              row.member_status,
              b.member_status,
              b.reason,
              c.user.user_id,
              now(),
            ],
          ),
        );
      }
      const { reason, ...fields } = b;
      await change(
        c,
        "CLUB_MEMBERS",
        "club_member_id",
        row.club_member_id,
        { ...fields, updated_at: now() },
        row,
        "UPDATE_MEMBER",
        extras,
      );
      return json({ ok: true });
    }
  }
  if (path === "accounts" && method === "GET") {
    permit(c, "ADMIN");
    const { q, status } = paging(url);
    let sql =
      "SELECT user_id,username,full_name,student_code,email,phone,faculty,class_name,account_status,created_at FROM USERS WHERE (full_name LIKE ? OR username LIKE ?)";
    const p: any[] = ["%" + q + "%", "%" + q + "%"];
    if (status) {
      sql += " AND account_status=?";
      p.push(status);
    }
    return json(await list(c, sql, p, "user_id DESC", url));
  }
  if (path === "accounts" && method === "POST") {
    permit(c, "ADMIN");
    const b = z
      .object({
        username: str(50).regex(
          /^[a-zA-Z0-9_.-]+$/,
          "Tên đăng nhập chỉ gồm chữ, số, dấu chấm, gạch dưới.",
        ),
        full_name: str(150),
        student_code: opt(30),
        email: z
          .union([z.string().email(), z.literal(""), z.null()])
          .optional()
          .transform((v) => v || null),
        password: z.string().min(10).max(72),
      })
      .parse(await body(req));
    const { password, ...fields } = b;
    const out = await c.db.batch([
      stmt(
        c.db,
        "INSERT INTO USERS(username,full_name,student_code,email,password_hash,account_status,created_at) VALUES (?,?,?,?,?,?,?)",
        [
          b.username,
          b.full_name,
          b.student_code,
          b.email,
          await bcrypt.hash(password, 12),
          "ACTIVE",
          now(),
        ],
      ),
      audit(c, "CREATE_ACCOUNT", "USERS", b.username, null, fields),
    ]);
    return json({ user_id: out[0].meta?.last_row_id }, 201);
  }
  const acc = path.match(/^accounts\/(\d+)$/);
  if (acc && method === "PATCH") {
    permit(c, "ADMIN");
    const id = Number(acc[1]);
    const before = await one(c.db, "SELECT * FROM USERS WHERE user_id=?", [id]);
    fail(before, "Không tìm thấy tài khoản.", 404);
    const b = z
      .object({
        account_status: z.enum(["ACTIVE", "LOCKED", "INACTIVE"]).optional(),
        password: z.string().min(10).max(72).optional(),
      })
      .parse(await body(req));
    fail(b.account_status || b.password, "Không có thay đổi.");
    fail(
      !(
        id === c.user.user_id &&
        b.account_status &&
        b.account_status !== "ACTIVE"
      ),
      "Không thể khóa tài khoản đang sử dụng.",
    );
    if (b.account_status && b.account_status !== "ACTIVE") {
      const leaderClubs = await all(
        c.db,
        "SELECT ur.club_id FROM USER_ROLES ur JOIN ROLES r ON r.role_id=ur.role_id JOIN CLUBS c ON c.club_id=ur.club_id WHERE ur.user_id=? AND ur.active_flag=1 AND r.role_code='LEADER' AND c.club_status='ACTIVE'",
        [id],
      );
      for (const club of leaderClubs) {
        const n = await one(
          c.db,
          "SELECT COUNT(*) AS n FROM USER_ROLES ur JOIN ROLES r ON r.role_id=ur.role_id JOIN USERS u ON u.user_id=ur.user_id WHERE ur.club_id=? AND r.role_code='LEADER' AND ur.active_flag=1 AND u.account_status='ACTIVE' AND u.user_id<>?",
          [club.club_id, id],
        );
        fail(
          Number(n?.n) > 0,
          "Không thể khóa chủ nhiệm hoạt động cuối cùng của CLB.",
        );
      }
    }
    const fields: any = { updated_at: now() };
    if (b.account_status) fields.account_status = b.account_status;
    if (b.password) fields.password_hash = await bcrypt.hash(b.password, 12);
    const keys = Object.keys(fields);
    await c.db.batch([
      stmt(
        c.db,
        `UPDATE USERS SET ${keys.map((k) => k + "=?").join(",")} WHERE user_id=?`,
        [...Object.values(fields), id],
      ),
      stmt(c.db, "DELETE FROM AUTH_SESSIONS WHERE user_id=?", [id]),
      audit(
        c,
        "UPDATE_ACCOUNT",
        "USERS",
        id,
        { account_status: before!.account_status },
        { account_status: b.account_status, password_reset: !!b.password },
      ),
    ]);
    return json({ ok: true });
  }
  if (path === "clubs" && method === "GET") {
    permit(c, "ADMIN");
    return json({
      rows: await all(c.db, "SELECT * FROM CLUBS ORDER BY club_id"),
      total: 0,
    });
  }
  if (path === "clubs" && method === "POST") {
    permit(c, "ADMIN");
    const b = z
      .object({
        club_code: str(30),
        club_name: str(200),
        description: opt(3000),
        founded_date: z
          .union([date, z.literal(""), z.null()])
          .optional()
          .transform((v) => v || null),
        leader_user_id: idSchema,
      })
      .parse(await body(req));
    fail(
      await one(
        c.db,
        "SELECT user_id FROM USERS WHERE user_id=? AND account_status='ACTIVE'",
        [b.leader_user_id],
      ),
      "Cần chọn tài khoản chủ nhiệm đang hoạt động.",
    );
    const { leader_user_id, ...fields } = b;
    const keys = Object.keys(fields);
    await c.db.batch([
      stmt(
        c.db,
        `INSERT INTO CLUBS (${keys.join(",")},club_status,created_at) VALUES (${keys.map(() => "?").join(",")},'ACTIVE',?)`,
        [...Object.values(fields), now()],
      ),
      stmt(
        c.db,
        "INSERT INTO USER_ROLES(user_id,role_id,club_id,assigned_by,assigned_at,active_flag) SELECT ?,r.role_id,c.club_id,?,?,1 FROM ROLES r CROSS JOIN CLUBS c WHERE r.role_code='LEADER' AND c.club_code=?",
        [leader_user_id, c.user.user_id, now(), b.club_code],
      ),
      audit(c, "CREATE_CLUB", "CLUBS", b.club_code, null, fields),
    ]);
    return json({ ok: true }, 201);
  }
  if (path === "club" && method === "GET") {
    return json(await scoped(c, "CLUBS", "club_id", c.club));
  }
  if (path === "club" && method === "PATCH") {
    permit(c, "ADMIN", "LEADER");
    const b = z
      .object({
        club_name: str(200),
        description: opt(3000),
        founded_date: z
          .union([date, z.literal(""), z.null()])
          .optional()
          .transform((v) => v || null),
        club_status: z.enum(["ACTIVE", "INACTIVE"]),
      })
      .parse(await body(req));
    const old = await scoped(c, "CLUBS", "club_id", c.club);
    await change(c, "CLUBS", "club_id", c.club, b, old, "UPDATE_CLUB");
    return json({ ok: true });
  }
  if (path === "roles" && method === "GET") {
    permit(c, "ADMIN", "LEADER");
    return json({
      roles: await all(c.db, "SELECT * FROM ROLES ORDER BY role_id"),
      rows: await all(
        c.db,
        "SELECT ur.*,r.role_code,r.role_name,u.full_name,u.username FROM USER_ROLES ur JOIN USERS u ON u.user_id=ur.user_id JOIN ROLES r ON r.role_id=ur.role_id WHERE ur.club_id=?" +
          (c.admin ? " OR ur.club_id IS NULL" : "") +
          " ORDER BY ur.active_flag DESC,ur.user_role_id",
        [c.club],
      ),
    });
  }
  if (path === "roles" && method === "POST") {
    permit(c, "ADMIN", "LEADER");
    const b = z
      .object({
        user_id: idSchema,
        role_code: z.enum([
          "ADMIN",
          "LEADER",
          "OFFICER",
          "TREASURER",
          "MEMBER",
        ]),
        active_flag: z.coerce.number().int().min(0).max(1),
      })
      .parse(await body(req));
    if (!c.admin)
      fail(
        ["OFFICER", "TREASURER"].includes(b.role_code),
        "Chủ nhiệm chỉ được phân công cán bộ và thủ quỹ.",
        403,
      );
    const club = b.role_code === "ADMIN" ? null : c.club;
    const role = await one(c.db, "SELECT * FROM ROLES WHERE role_code=?", [
      b.role_code,
    ]);
    const scope = club === null ? "club_id IS NULL" : "club_id=?";
    const p =
      club === null
        ? [b.user_id, role!.role_id]
        : [b.user_id, role!.role_id, club];
    const old = await one(
      c.db,
      `SELECT * FROM USER_ROLES WHERE user_id=? AND role_id=? AND ${scope}`,
      p,
    );
    fail(
      await one(c.db, "SELECT user_id FROM USERS WHERE user_id=?", [b.user_id]),
      "Tài khoản không tồn tại.",
    );
    if (!c.admin)
      fail(
        await one(
          c.db,
          "SELECT club_member_id FROM CLUB_MEMBERS WHERE user_id=? AND club_id=? AND member_status=?",
          [b.user_id, c.club, "ACTIVE"],
        ),
        "Chỉ được phân công thành viên đang hoạt động của CLB.",
      );
    if (b.active_flag === 0 && ["LEADER", "ADMIN"].includes(b.role_code)) {
      const n = await one(
        c.db,
        `SELECT COUNT(*) AS n FROM USER_ROLES ur JOIN USERS u ON u.user_id=ur.user_id WHERE ur.role_id=? AND ${club === null ? "ur.club_id IS NULL" : "ur.club_id=?"} AND ur.active_flag=1 AND u.account_status='ACTIVE' AND ur.user_id<>?`,
        club === null
          ? [role!.role_id, b.user_id]
          : [role!.role_id, club, b.user_id],
      );
      fail(Number(n?.n) > 0, "Không thể gỡ người quản lý hoạt động cuối cùng.");
    }
    if (old)
      await change(
        c,
        "USER_ROLES",
        "user_role_id",
        old.user_role_id,
        {
          active_flag: b.active_flag,
          assigned_by: c.user.user_id,
          assigned_at: now(),
        },
        old,
        "ASSIGN_ROLE",
      );
    else if (b.active_flag)
      await insert(
        c,
        "USER_ROLES",
        {
          user_id: b.user_id,
          role_id: role!.role_id,
          club_id: club,
          active_flag: 1,
          assigned_by: c.user.user_id,
          assigned_at: now(),
        },
        "ASSIGN_ROLE",
      );
    return json({ ok: true });
  }
  if (path === "role-catalog" && method === "PATCH") {
    permit(c, "ADMIN");
    const b = z
      .object({ role_id: idSchema, role_name: str(100) })
      .parse(await body(req));
    const old = await one(c.db, "SELECT * FROM ROLES WHERE role_id=?", [
      b.role_id,
    ]);
    fail(old, "Vai trò không tồn tại.", 404);
    await change(
      c,
      "ROLES",
      "role_id",
      b.role_id,
      { role_name: b.role_name },
      old!,
      "UPDATE_ROLE_NAME",
    );
    return json({ ok: true });
  }
  if (path === "audit" && method === "GET") {
    permit(c, "ADMIN", "LEADER");
    const { q } = paging(url);
    return json(
      await list(
        c,
        "SELECT a.*,u.full_name FROM AUDIT_LOGS a LEFT JOIN USERS u ON u.user_id=a.user_id WHERE " +
          (c.admin ? "(a.club_id=? OR a.club_id IS NULL)" : "a.club_id=?") +
          " AND (a.action_code LIKE ? OR a.entity_name LIKE ?) ",
        [c.club, "%" + q + "%", "%" + q + "%"],
        "a.audit_id DESC",
        url,
      ),
    );
  }
  return null;
}

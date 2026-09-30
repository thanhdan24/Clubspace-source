import { test, before } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import { handleApi } from "../server/api";
import { seedPreview } from "../server/seed";
import { now } from "../server/core";
import { convertSqlToPostgres } from "../server/prisma";
const sqlite = new DatabaseSync(":memory:");
sqlite.exec("PRAGMA foreign_keys=ON");
const schemaSql = fs.readFileSync("tests/test-schema.sql", "utf8");
for (const statement of schemaSql
  .split("--> statement-breakpoint")
  .filter((s) => s.trim())) {
  sqlite.exec(statement);
}
class S {
  constructor(
    public query: string,
    public values: any[] = [],
  ) {}
  bind(...v: any[]) {
    return new S(this.query, v);
  }
  async all() {
    return { results: sqlite.prepare(this.query).all(...this.values) };
  }
  async first() {
    return sqlite.prepare(this.query).get(...this.values) || null;
  }
  async run() {
    const r = sqlite.prepare(this.query).run(...this.values);
    return {
      success: true,
      meta: {
        changes: Number(r.changes),
        last_row_id: Number(r.lastInsertRowid),
      },
    };
  }
}
const db: any = {
  prepare: (q: string) => new S(q),
  batch: async (ss: S[]) => {
    sqlite.exec("BEGIN");
    try {
      const out = [];
      for (const s of ss) out.push(await s.run());
      sqlite.exec("COMMIT");
      return out;
    } catch (e) {
      sqlite.exec("ROLLBACK");
      throw e;
    }
  },
};
const env = { DEMO_MODE: "true", DEMO_PASSWORD: "Test-only-password-2026" };
const cookies: Record<string, string> = {};
async function call(
  role: string,
  path: string,
  method = "GET",
  data?: any,
  club = 1,
  extra: Record<string, string> = {},
) {
  const req = new Request(
    `http://test.local/api/${path}${path.includes("?") ? "&" : "?"}club=${club}`,
    {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(cookies[role] ? { Cookie: cookies[role] } : {}),
        ...extra,
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    },
  );
  const res = await handleApi(req, db, env);
  const b = res.headers.get("content-type")?.includes("application/json")
    ? await res.json()
    : await res.text();
  return {
    status: res.status,
    data: b as any,
    cookie: res.headers.get("set-cookie"),
  };
}
const sql = (s: string, ...p: any[]) => sqlite.prepare(s).get(...p) as any;
const future = (days = 5, hour = "08:00") =>
  new Date(Date.now() + days * 86400000 + 7 * 3600000)
    .toISOString()
    .slice(0, 10) +
  "T" +
  hour;
let eventId = 0,
  expenseId = 0;
before(async () => {
  await seedPreview(db, env);
  for (const role of ["ADMIN", "LEADER", "OFFICER", "TREASURER", "MEMBER"]) {
    const r = await call("", "auth/demo", "POST", { role });
    assert.equal(r.status, 200);
    cookies[role] = r.cookie!.split(";")[0];
  }
});
test("Original import preserves counts, records, balances and hashes", () => {
  assert.equal(sql("SELECT COUNT(*) n FROM USERS WHERE user_id<10000").n, 14);
  assert.equal(
    sql(
      "SELECT COUNT(*) n FROM CLUB_MEMBERS WHERE member_code NOT LIKE ?",
      "DEMO%",
    ).n,
    13,
  );
  assert.equal(
    sql("SELECT balance FROM vw_club_fund_summary WHERE club_id=1").balance,
    11000000,
  );
  assert.equal(sql("SELECT COUNT(*) n FROM EVENTS").n, 4);
  assert.match(
    sql("SELECT password_hash FROM USERS WHERE user_id=1").password_hash,
    /^\$2y\$/,
  );
  assert.equal(sql("PRAGMA foreign_key_check"), undefined);
});
test("Authentication rejects missing session, bad passwords, locked accounts; current state checked every request", async () => {
  assert.equal((await call("", "members")).status, 401);
  assert.equal(
    (
      await call("", "auth/login", "POST", {
        username: "demo_member",
        password: "wrong",
      })
    ).status,
    401,
  );
  sqlite
    .prepare(
      "UPDATE USERS SET account_status='LOCKED' WHERE username='demo_member'",
    )
    .run();
  assert.equal((await call("MEMBER", "me")).status, 401);
  assert.equal(
    (
      await call("", "auth/login", "POST", {
        username: "demo_member",
        password: env.DEMO_PASSWORD,
      })
    ).status,
    401,
  );
  sqlite
    .prepare(
      "UPDATE USERS SET account_status='ACTIVE' WHERE username='demo_member'",
    )
    .run();
});
test("Backend isolates roles and clubs; ADMIN has no implicit business write rights", async () => {
  assert.equal((await call("MEMBER", "members")).status, 403);
  assert.equal((await call("MEMBER", "finance")).status, 403);
  assert.equal(
    (await call("MEMBER", "events", "GET", undefined, 2)).status,
    403,
  );
  assert.equal((await call("ADMIN", "events", "POST", {})).status, 403);
  assert.equal((await call("TREASURER", "events", "POST", {})).status, 403);
  assert.equal((await call("OFFICER", "roles")).status, 403);
  assert.equal((await call("MEMBER", "finance/1")).status, 403);
  assert.equal((await call("MEMBER", "dashboard")).data.personal, true);
});
test("Cross-site mutation and malformed body rejected", async () => {
  assert.equal(
    (
      await call("LEADER", "roles", "POST", {}, 1, {
        Origin: "https://evil.example",
      })
    ).status,
    403,
  );
  assert.equal(
    (await call("OFFICER", "events", "POST", { event_name: "bad" })).status,
    422,
  );
});
test("Duplicate membership is rejected, status reason required, history retained", async () => {
  const duplicate = await call("OFFICER", "members", "POST", {
    user_id: 5,
    member_code: "NEW",
    join_date: "2026-09-13",
  });
  assert.equal(duplicate.status, 409);
  const m = sql("SELECT * FROM CLUB_MEMBERS WHERE club_member_id=4");
  assert.equal(
    (
      await call("OFFICER", "members/4", "PATCH", {
        ...m,
        member_status: "PAUSED",
        leave_date: null,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call("OFFICER", "members/4", "PATCH", {
        ...m,
        member_status: "PAUSED",
        leave_date: null,
        reason: "Tạm nghỉ học kỳ",
      })
    ).status,
    200,
  );
  assert.equal(
    sql("SELECT COUNT(*) n FROM MEMBER_STATUS_HISTORY WHERE club_member_id=4")
      .n,
    1,
  );
  assert.equal(
    (
      await call("OFFICER", "members/4", "PATCH", {
        ...m,
        leave_date: null,
        reason: "Tiếp tục sinh hoạt",
      })
    ).status,
    200,
  );
});
test("Event validation and publish workflow", async () => {
  const b = {
    event_name: "Kiểm thử đăng ký",
    event_type: "WORKSHOP",
    location: "A301",
    start_at: future(),
    end_at: future(5, "11:00"),
    registration_deadline: future(4),
    capacity: 1,
    approval_required: 0,
  };
  assert.equal(
    (await call("OFFICER", "events", "POST", { ...b, end_at: b.start_at }))
      .status,
    400,
  );
  const r = await call("OFFICER", "events", "POST", b);
  assert.equal(r.status, 201);
  eventId = r.data.event_id;
  assert.equal((await call("MEMBER", "events/" + eventId)).status, 404);
  const officerPublish = await call(
    "OFFICER",
    `events/${eventId}/action`,
    "POST",
    {
      action: "publish",
    },
  );
  assert.equal(officerPublish.status, 403);
  assert.equal(
    officerPublish.data.error,
    "Chỉ Chủ nhiệm câu lạc bộ mới có quyền công bố sự kiện.",
  );

  assert.equal(
    (
      await call("LEADER", `events/${eventId}/action`, "POST", {
        action: "publish",
      })
    ).status,
    200,
  );
});
test("Registration is idempotent, capacity safe, cancellation restores a place, deadline enforced", async () => {
  assert.equal(
    (
      await call("MEMBER", `events/${eventId}/registration`, "POST", {
        action: "register",
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await call("MEMBER", `events/${eventId}/registration`, "POST", {
        action: "register",
      })
    ).status,
    200,
  );
  assert.equal(
    sql("SELECT COUNT(*) n FROM EVENT_REGISTRATIONS WHERE event_id=?", eventId)
      .n,
    1,
  );
  assert.equal(
    (
      await call("OFFICER", `events/${eventId}/registration`, "POST", {
        action: "register",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await call("MEMBER", `events/${eventId}/registration`, "POST", {
        action: "cancel",
      })
    ).status,
    200,
  );
  const results = await Promise.all([
    call("MEMBER", `events/${eventId}/registration`, "POST", {
      action: "register",
    }),
    call("OFFICER", `events/${eventId}/registration`, "POST", {
      action: "register",
    }),
  ]);
  assert.equal(results.filter((r) => [200, 201].includes(r.status)).length, 1);
  assert.equal(
    sql(
      "SELECT COUNT(*) n FROM EVENT_REGISTRATIONS WHERE event_id=? AND registration_status='CONFIRMED'",
      eventId,
    ).n,
    1,
  );
  assert.equal(
    (
      await call("MEMBER", "events/3/registration", "POST", {
        action: "register",
      })
    ).status,
    400,
  );
});
test("Registration review stores reviewer and respects capacity", async () => {
  const b = {
    event_name: "Chờ duyệt",
    event_type: "MEETING",
    location: "A1",
    start_at: future(),
    end_at: future(5, "10:00"),
    registration_deadline: future(4),
    capacity: 1,
    approval_required: 1,
  };
  const made = await call("OFFICER", "events", "POST", b),
    id = made.data.event_id;
  await call("LEADER", `events/${id}/action`, "POST", { action: "publish" });
  await call("MEMBER", `events/${id}/registration`, "POST", {
    action: "register",
  });
  await call("OFFICER", `events/${id}/registration`, "POST", {
    action: "register",
  });
  const regs = sqlite
    .prepare("SELECT * FROM EVENT_REGISTRATIONS WHERE event_id=?")
    .all(id) as any[];
  assert.equal(
    (
      await call("OFFICER", `events/${id}/registrations`, "PATCH", {
        registration_id: regs[0].registration_id,
        status: "CONFIRMED",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await call("OFFICER", `events/${id}/registrations`, "PATCH", {
        registration_id: regs[1].registration_id,
        status: "CONFIRMED",
      })
    ).status,
    409,
  );
  // Rejecting without reason fails (400)
  assert.equal(
    (
      await call("OFFICER", `events/${id}/registrations`, "PATCH", {
        registration_id: regs[1].registration_id,
        status: "REJECTED",
      })
    ).status,
    400,
  );
  // Rejecting with reason succeeds (200) by either LEADER or OFFICER
  assert.equal(
    (
      await call("LEADER", `events/${id}/registrations`, "PATCH", {
        registration_id: regs[1].registration_id,
        status: "REJECTED",
        reason: "Không phù hợp thời gian sự kiện",
      })
    ).status,
    200,
  );
  assert.ok(
    sql(
      "SELECT reviewed_by,reviewed_at FROM EVENT_REGISTRATIONS WHERE registration_id=?",
      regs[0].registration_id,
    ).reviewed_at,
  );
});
test("Attendance denies self editing, requires unlocked event, upserts without duplicates and locks results", async () => {
  assert.equal(
    (await call("MEMBER", "events/1/attendance", "PUT", { records: [] }))
      .status,
    403,
  );
  assert.equal(
    (
      await call("OFFICER", "events/1/attendance", "PUT", {
        records: [{ club_member_id: 4, status: "PRESENT" }],
      })
    ).status,
    409,
  );
  await call("LEADER", "events/1/action", "POST", {
    action: "unlock",
    reason: "Đính chính theo minh chứng",
  });
  const edit = {
    records: [{ club_member_id: 4, status: "LATE" }],
    reason: "Cập nhật thời điểm đến",
  };
  assert.equal(
    (await call("OFFICER", "events/1/attendance", "PUT", edit)).status,
    200,
  );
  assert.equal(
    sql(
      "SELECT COUNT(*) n FROM ATTENDANCE WHERE event_id=1 AND club_member_id=4",
    ).n,
    1,
  );
  assert.equal(
    (await call("OFFICER", "events/1/action", "POST", { action: "complete" }))
      .status,
    200,
  );
  assert.equal(
    sql("SELECT attendance_locked FROM EVENTS WHERE event_id=1")
      .attendance_locked,
    1,
  );
});
test("Finance rejects invalid money, wrong category, cross-club references and self approval", async () => {
  const b = {
    transaction_type: "EXPENSE",
    category_id: 3,
    event_id: null,
    related_member_id: null,
    amount: 125000,
    transaction_date: "2026-09-13",
    description: "Mua vật tư kiểm thử",
    evidence_url: "https://example.org/evidence.pdf",
  };
  assert.equal(
    (await call("TREASURER", "finance", "POST", { ...b, amount: -1 })).status,
    422,
  );
  assert.equal(
    (await call("TREASURER", "finance", "POST", { ...b, category_id: 1 }))
      .status,
    400,
  );
  assert.equal(
    (await call("TREASURER", "finance", "POST", { ...b, event_id: 4 })).status,
    404,
  );
  const made = await call("TREASURER", "finance", "POST", b);
  assert.equal(made.status, 201);
  expenseId = made.data.transaction_id;
  assert.equal(
    (
      await call("TREASURER", `finance/${expenseId}/action`, "POST", {
        action: "post",
      })
    ).status,
    400,
  );
  await call("TREASURER", `finance/${expenseId}/action`, "POST", {
    action: "submit",
  });
  assert.equal(
    (
      await call("TREASURER", `finance/${expenseId}/action`, "POST", {
        action: "approve",
      })
    ).status,
    403,
  );
  sqlite
    .prepare(
      "INSERT INTO USER_ROLES(user_id,role_id,club_id,assigned_by,assigned_at,active_flag) VALUES (10004,2,1,1,?,1)",
    )
    .run(now());
  assert.equal(
    (
      await call("TREASURER", `finance/${expenseId}/action`, "POST", {
        action: "approve",
      })
    ).status,
    403,
  );
});
test("Expense approval, posting, immutable money and cancellation give correct fund balance", async () => {
  assert.equal(
    (
      await call("LEADER", `finance/${expenseId}/action`, "POST", {
        action: "reject",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call("LEADER", `finance/${expenseId}/action`, "POST", {
        action: "approve",
      })
    ).status,
    200,
  );
  assert.equal(
    sql("SELECT balance FROM vw_club_fund_summary WHERE club_id=1").balance,
    11000000,
  );
  assert.equal(
    (
      await call("TREASURER", `finance/${expenseId}/action`, "POST", {
        action: "post",
      })
    ).status,
    200,
  );
  assert.equal(
    sql("SELECT balance FROM vw_club_fund_summary WHERE club_id=1").balance,
    10875000,
  );
  assert.equal(
    (await call("TREASURER", `finance/${expenseId}`, "PATCH", { amount: 1 }))
      .status,
    400,
  );
  assert.equal(
    (
      await call("LEADER", `finance/${expenseId}/action`, "POST", {
        action: "cancel",
        reason: "Hủy khoản ghi sai",
      })
    ).status,
    200,
  );
  assert.equal(
    sql("SELECT balance FROM vw_club_fund_summary WHERE club_id=1").balance,
    11000000,
  );
});
test("Leader cannot grant ADMIN, member cannot read audit; reports and CSV respect scope", async () => {
  assert.equal(
    (
      await call("LEADER", "roles", "POST", {
        user_id: 5,
        role_code: "ADMIN",
        active_flag: 1,
      })
    ).status,
    403,
  );
  assert.equal((await call("MEMBER", "audit")).status, 403);
  assert.equal((await call("OFFICER", "reports?type=finance")).status, 403);
  const csv = await call("OFFICER", "members?export=csv");
  assert.equal(csv.status, 200);
  assert.match(csv.data, /Họ và tên/);
  assert.ok(
    sql("SELECT COUNT(*) n FROM AUDIT_LOGS WHERE user_id>=10001").n > 10,
  );
});
test("Pagination and SQL injection are handled as data", async () => {
  const r = await call("OFFICER", "members?size=2&page=2");
  assert.equal(r.data.rows.length, 2);
  assert.equal(r.data.page, 2);
  assert.equal(
    (await call("OFFICER", "members?q=" + encodeURIComponent("' OR 1=1--")))
      .data.total,
    0,
  );
  assert.ok(sql("SELECT COUNT(*) n FROM USERS").n > 0);
});
test("Prisma adapter binds parameters and quotes table names without user interpolation", () => {
  const out = convertSqlToPostgres(
    "SELECT * FROM USERS WHERE username=? ORDER BY user_id LIMIT ? OFFSET ?",
    ["x'; DROP TABLE USERS;--", 10, 20],
  );
  assert.equal(
    out.text,
    'SELECT * FROM "USERS" WHERE username=$1 ORDER BY user_id LIMIT $2 OFFSET $3',
  );
  assert.equal(out.parameters[0], "x'; DROP TABLE USERS;--");
});
test("Account creation supports optional fields and does not expose password hash", async () => {
  const r = await call("ADMIN", "accounts", "POST", {
    username: "qa_created",
    full_name: "Tài khoản kiểm thử",
    password: "Valid-test-password-123",
  });
  assert.equal(r.status, 201);
  const found = await call("ADMIN", "accounts?q=qa_created");
  assert.equal(found.data.rows.length, 1);
  assert.equal(found.data.rows[0].password_hash, undefined);
});
test("Club creation is atomic with initial leader, and last active leader is protected", async () => {
  const r = await call("ADMIN", "clubs", "POST", {
    club_code: "QA_CLUB",
    club_name: "CLB kiểm thử",
    leader_user_id: 10002,
  });
  assert.equal(r.status, 201);
  const club = sql(
    "SELECT club_id FROM CLUBS WHERE club_code='QA_CLUB'",
  ).club_id;
  assert.equal(
    (
      await call(
        "ADMIN",
        "roles",
        "POST",
        { user_id: 10002, role_code: "LEADER", active_flag: 0 },
        club,
      )
    ).status,
    400,
  );
  assert.equal(
    (await call("LEADER", "me", "GET", undefined, club)).status,
    200,
  );
});
test("Invalid calendar dates and impossible times are rejected", async () => {
  assert.equal(
    (
      await call("OFFICER", "events", "POST", {
        event_name: "Ngày không tồn tại",
        event_type: "MEETING",
        location: "A",
        start_at: "2026-02-31T08:00",
        end_at: "2026-03-05T09:00",
        registration_deadline: "2026-02-20T08:00",
        capacity: null,
        approval_required: 0,
      })
    ).status,
    422,
  );
});
test("Approved expense can receive evidence without reopening amount editing", async () => {
  const made = await call("TREASURER", "finance", "POST", {
    transaction_type: "EXPENSE",
    category_id: 3,
    event_id: null,
    related_member_id: null,
    amount: 80000,
    transaction_date: "2026-09-14",
    description: "Bổ sung chứng từ sau duyệt",
    evidence_url: null,
  });
  assert.equal(made.status, 201);
  const id = made.data.transaction_id;
  assert.equal(
    (
      await call("TREASURER", `finance/${id}/action`, "POST", {
        action: "submit",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await call("LEADER", `finance/${id}/action`, "POST", {
        action: "approve",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await call("TREASURER", `finance/${id}/action`, "POST", {
        action: "post",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call("TREASURER", `finance/${id}/evidence`, "PATCH", {
        evidence_url: "https://example.org/file.pdf",
      })
    ).status,
    200,
  );
  assert.equal(
    sql("SELECT amount FROM FINANCIAL_TRANSACTIONS WHERE transaction_id=?", id)
      .amount,
    80000,
  );
  assert.equal(
    (await call("TREASURER", `finance/${id}`, "PATCH", { amount: 1 })).status,
    400,
  );
  assert.equal(
    (
      await call("TREASURER", `finance/${id}/action`, "POST", {
        action: "post",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await call("TREASURER", `finance/${id}/evidence`, "PATCH", {
        evidence_url: "https://example.org/changed.pdf",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call(
        "TREASURER",
        "finance/7/evidence",
        "PATCH",
        { evidence_url: "https://example.org/file.pdf" },
        2,
      )
    ).status,
    403,
  );
});
test("Inactive clubs block business writes and can be restored by a leader", async () => {
  const club = sql("SELECT * FROM CLUBS WHERE club_id=1");
  assert.equal(
    (
      await call("LEADER", "club", "PATCH", {
        ...club,
        club_status: "INACTIVE",
      })
    ).status,
    200,
  );
  assert.equal((await call("OFFICER", "events", "POST", {})).status, 403);
  assert.equal(
    (await call("MEMBER", "club", "PATCH", { ...club, club_status: "ACTIVE" }))
      .status,
    403,
  );
  assert.equal(
    (await call("LEADER", "club", "PATCH", { ...club, club_status: "ACTIVE" }))
      .status,
    200,
  );
});
test("Member reports filter actual join dates and reject reversed ranges", async () => {
  assert.equal(
    (
      await call(
        "OFFICER",
        "reports?type=members&from=2099-01-01&to=2099-12-31",
      )
    ).data.counts.total,
    0,
  );
  assert.equal(
    (await call("OFFICER", "reports?from=2026-12-01&to=2026-01-01")).status,
    400,
  );
});
test("Evidence upload validates content and restricts download to club staff", async () => {
  const files = new Map<string, any>();
  const bucket = {
    put: async (k: string, b: Uint8Array, m: any) =>
      files.set(k, { body: b, ...m }),
    get: async (k: string) => files.get(k),
  };
  const upload = async (role: string, file: File) => {
    const f = new FormData();
    f.set("file", file);
    return handleApi(
      new Request("http://test.local/api/evidence?club=1", {
        method: "POST",
        headers: { Cookie: cookies[role] },
        body: f,
      }),
      db,
      { ...env, BUCKET: bucket },
    );
  };
  assert.equal(
    (
      await upload(
        "MEMBER",
        new File(["%PDF-1.4 test"], "test.pdf", { type: "application/pdf" }),
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await upload(
        "TREASURER",
        new File(["bad"], "test.pdf", { type: "application/pdf" }),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await upload(
        "TREASURER",
        new File(["<svg/>"], "test.svg", { type: "image/svg+xml" }),
      )
    ).status,
    400,
  );
  const r = await upload(
    "TREASURER",
    new File(["%PDF-1.4 test"], "test.pdf", { type: "application/pdf" }),
  );
  assert.equal(r.status, 201);
  const b: any = await r.json();
  const get = (role: string, club = 1) =>
    handleApi(
      new Request("http://test.local" + b.evidence_url + "?club=" + club, {
        headers: { Cookie: cookies[role] },
      }),
      db,
      { ...env, BUCKET: bucket },
    );
  assert.equal((await get("MEMBER")).status, 403);
  assert.equal((await get("ADMIN", 2)).status, 403);
  const proof = await get("LEADER");
  assert.equal(proof.status, 200);
  assert.match(proof.headers.get("content-disposition")!, /^attachment/);
  assert.equal(await proof.text(), "%PDF-1.4 test");
});
test("Event scope restricts registration: INTERNAL allows only club members, PUBLIC allows cross-club users", async () => {
  const internalEvent = {
    event_name: "Sự kiện nội bộ",
    event_type: "MEETING",
    scope: "INTERNAL",
    location: "Phòng họp CLB",
    start_at: future(10),
    end_at: future(10, "11:00"),
    registration_deadline: future(9),
    capacity: 10,
    approval_required: 0,
  };
  const createRes = await call("OFFICER", "events", "POST", internalEvent, 1);
  assert.equal(createRes.status, 201);
  const intId = createRes.data.event_id;

  assert.equal(
    (
      await call(
        "LEADER",
        `events/${intId}/action`,
        "POST",
        { action: "publish" },
        1,
      )
    ).status,
    200,
  );

  assert.equal(
    (
      await call(
        "MEMBER",
        `events/${intId}/registration`,
        "POST",
        { action: "register" },
        1,
      )
    ).status,
    201,
  );

  const externalUser = {
    student_code: "EXT_99999",
    username: "ext_user",
    password: "Password@123",
    full_name: "External Student",
    email: "ext@student.ptit.edu.vn",
  };
  const regUser = await call("ADMIN", "accounts", "POST", externalUser);
  assert.equal(regUser.status, 201);

  const loginRes = await call("", "auth/login", "POST", {
    username: externalUser.username,
    password: externalUser.password,
  });
  assert.equal(loginRes.status, 200);
  const extCookie = loginRes.cookie!.split(";")[0];

  const extCall = async (
    path: string,
    method = "GET",
    data?: any,
    club = 1,
  ) => {
    const req = new Request(
      `http://test.local/api/${path}${path.includes("?") ? "&" : "?"}club=${club}`,
      {
        method,
        headers: {
          "Content-Type": "application/json",
          Cookie: extCookie,
        },
        body: data === undefined ? undefined : JSON.stringify(data),
      },
    );
    const res = await handleApi(req, db, env);
    return { status: res.status, data: await res.json().catch(() => null) };
  };

  const regInternal = await extCall(
    `events/${intId}/registration`,
    "POST",
    { action: "register" },
    1,
  );
  assert.equal(regInternal.status, 403);
  assert.match(regInternal.data.error, /nội bộ/);

  const publicEvent = {
    event_name: "Sự kiện toàn trường",
    event_type: "WORKSHOP",
    scope: "PUBLIC",
    location: "Hội trường A",
    start_at: future(12),
    end_at: future(12, "11:00"),
    registration_deadline: future(11),
    capacity: 50,
    approval_required: 0,
  };
  const pubRes = await call("OFFICER", "events", "POST", publicEvent, 1);
  assert.equal(pubRes.status, 201);
  const pubId = pubRes.data.event_id;

  assert.equal(
    (
      await call(
        "LEADER",
        `events/${pubId}/action`,
        "POST",
        { action: "publish" },
        1,
      )
    ).status,
    200,
  );

  const regPublic = await extCall(
    `events/${pubId}/registration`,
    "POST",
    { action: "register" },
    1,
  );
  assert.equal(regPublic.status, 201);
  assert.equal(regPublic.data.registration_status, "CONFIRMED");

  const guestMember = sql(
    "SELECT * FROM CLUB_MEMBERS WHERE club_id=1 AND user_id=?",
    regUser.data.user_id,
  );
  assert.equal(guestMember.department_name, "Khách tham gia");

  const regInternalAgain = await extCall(
    `events/${intId}/registration`,
    "POST",
    { action: "register" },
    1,
  );
  assert.equal(regInternalAgain.status, 403);
  assert.match(regInternalAgain.data.error, /nội bộ/);
});
test("Club Leader of Club 1 can view, register for, and cancel public event of Club 2", async () => {
  // Ensure event 4 in Club 2 is an open public event with future deadline
  sqlite
    .prepare(
      "UPDATE EVENTS SET start_at=?, end_at=?, registration_deadline=?, scope='PUBLIC', event_status='OPEN', approval_required=0, capacity=50 WHERE event_id=4",
    )
    .run(future(16), future(16, "18:00"), future(15));

  // 1. Leader of Club 1 views Event 4 details (sent with club=1 context)
  const viewRes = await call("LEADER", "events/4", "GET", undefined, 1);
  assert.equal(viewRes.status, 200);
  assert.equal(viewRes.data.event.event_name, "English Speaking Day");
  assert.equal(viewRes.data.mine, null);

  // 2. Leader of Club 1 registers for Event 4 of Club 2
  const regRes = await call(
    "LEADER",
    "events/4/registration",
    "POST",
    { action: "register" },
    1,
  );
  assert.equal(regRes.status, 201);
  assert.equal(regRes.data.registration_status, "CONFIRMED");

  // Verify Leader is added as a guest member in Club 2
  const leaderUser = sql("SELECT user_id FROM USERS WHERE username='demo_leader'");
  const guestMember = sql(
    "SELECT * FROM CLUB_MEMBERS WHERE club_id=2 AND user_id=?",
    leaderUser.user_id,
  );
  assert.ok(guestMember);
  assert.equal(guestMember.department_name, "Khách tham gia");
  assert.equal(guestMember.position_name, "Người tham dự");

  // 3. Leader checks event 4 detail again - mine should now be populated
  const viewRes2 = await call("LEADER", "events/4", "GET", undefined, 1);
  assert.equal(viewRes2.status, 200);
  assert.ok(viewRes2.data.mine);
  assert.equal(viewRes2.data.mine.registration_status, "CONFIRMED");

  // 4. Leader can see Event 4 in my-registrations
  const myRegs = await call("LEADER", "my-registrations", "GET", undefined, 1);
  assert.equal(myRegs.status, 200);
  const found = myRegs.data.rows.find((r: any) => r.event_id === 4);
  assert.ok(found, "Leader should see Event 4 in their registrations");
  assert.equal(found.registration_status, "CONFIRMED");

  // 5. Leader cancels registration
  const cancelRes = await call(
    "LEADER",
    "events/4/registration",
    "POST",
    { action: "cancel" },
    1,
  );
  assert.equal(cancelRes.status, 200);
  const cancelledReg = sql(
    "SELECT registration_status FROM EVENT_REGISTRATIONS WHERE event_id=4 AND club_member_id=?",
    guestMember.club_member_id,
  );
  assert.equal(cancelledReg.registration_status, "CANCELLED");
});
test("Club join application and review workflow: submit, duplicate prevention, review permissions, approval, and rejection", async () => {
  // Create a new applicant account
  const applicant = {
    student_code: "APP_00001",
    username: "applicant_user",
    password: "Password@123",
    full_name: "Nguyen Van A",
    email: "applicant_a@ptit.edu.vn",
  };
  const regUser = await call("ADMIN", "accounts", "POST", applicant);
  assert.equal(regUser.status, 201);
  const applicantUserId = regUser.data.user_id;

  const loginRes = await call("", "auth/login", "POST", {
    username: applicant.username,
    password: applicant.password,
  });
  assert.equal(loginRes.status, 200);
  const applicantCookie = loginRes.cookie!.split(";")[0];

  const appCall = async (
    path: string,
    method = "GET",
    data?: any,
    club = 0,
  ) => {
    const req = new Request(
      `http://test.local/api/${path}${path.includes("?") ? "&" : "?"}club=${club}`,
      {
        method,
        headers: {
          "Content-Type": "application/json",
          Cookie: applicantCookie,
        },
        body: data === undefined ? undefined : JSON.stringify(data),
      },
    );
    const res = await handleApi(req, db, env);
    return { status: res.status, data: await res.json().catch(() => null) };
  };

  // 1. Applicant views clubs list
  const clubsList = await appCall("clubs", "GET");
  assert.equal(clubsList.status, 200);
  assert.ok(Array.isArray(clubsList.data.rows));
  assert.ok(clubsList.data.rows.length > 0);

  // 2. Submit join request to Club 1
  const submitRes = await appCall("clubs/1/join", "POST", {
    message: "Em muốn tham gia Ban Kỹ thuật để phát triển dự án.",
  });
  assert.equal(submitRes.status, 201);
  const requestId = submitRes.data.request_id;
  assert.ok(requestId > 0);

  // 3. Prevent duplicate while pending
  const dupRes = await appCall("clubs/1/join", "POST", {
    message: "Thử gửi lại lần 2",
  });
  assert.equal(dupRes.status, 400);
  assert.match(dupRes.data.error, /đang chờ xét duyệt/);

  // 4. Regular member cannot review join requests
  const memberReview = await call(
    "MEMBER",
    `join-requests/${requestId}`,
    "PATCH",
    { status: "APPROVED" },
    1,
  );
  assert.equal(memberReview.status, 403);

  // 5. Officer reviews and approves join request
  const officerApprove = await call(
    "OFFICER",
    `join-requests/${requestId}`,
    "PATCH",
    {
      status: "APPROVED",
      department_name: "Ban Kỹ thuật",
      reason: "Đạt yêu cầu phỏng vấn",
    },
    1,
  );
  assert.equal(officerApprove.status, 200);

  // 6. Verify applicant is now an active member in Club 1
  const newMember = sql(
    "SELECT * FROM CLUB_MEMBERS WHERE club_id=1 AND user_id=?",
    applicantUserId,
  );
  assert.equal(newMember.member_status, "ACTIVE");
  assert.equal(newMember.department_name, "Ban Kỹ thuật");
  assert.equal(newMember.position_name, "Thành viên");

  // Verify role MEMBER in USER_ROLES for Club 1
  const userRole = sql(
    "SELECT ur.*, r.role_code FROM USER_ROLES ur JOIN ROLES r ON r.role_id=ur.role_id WHERE ur.club_id=1 AND ur.user_id=? AND ur.active_flag=1",
    applicantUserId,
  );
  assert.equal(userRole.role_code, "MEMBER");

  // 7. Now applicant cannot re-apply to Club 1
  const reApply = await appCall("clubs/1/join", "POST", {
    message: "Xin vào lại",
  });
  assert.equal(reApply.status, 400);
  assert.match(reApply.data.error, /thành viên chính thức/);

  // 8. Rejection flow test: Create another applicant and test rejection
  const applicant2 = {
    student_code: "APP_00002",
    username: "applicant_user2",
    password: "Password@123",
    full_name: "Tran Van B",
    email: "applicant_b@ptit.edu.vn",
  };
  const regUser2 = await call("ADMIN", "accounts", "POST", applicant2);
  const loginRes2 = await call("", "auth/login", "POST", {
    username: applicant2.username,
    password: applicant2.password,
  });
  const cookie2 = loginRes2.cookie!.split(";")[0];

  const app2Req = new Request("http://test.local/api/clubs/1/join?club=0", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie2 },
    body: JSON.stringify({ message: "Đăng ký xin gia nhập" }),
  });
  const submitRes2: any = await (await handleApi(app2Req, db, env)).json();

  // Leader rejects join request
  const rejectRes = await call(
    "LEADER",
    `join-requests/${submitRes2.request_id}`,
    "PATCH",
    { status: "REJECTED", reason: "Chưa đạt chỉ tiêu đợt tuyển này" },
    1,
  );
  assert.equal(rejectRes.status, 200);

  const reqRecord = sql(
    "SELECT * FROM CLUB_JOIN_REQUESTS WHERE request_id=?",
    submitRes2.request_id,
  );
  assert.equal(reqRecord.status, "REJECTED");
  assert.equal(reqRecord.review_reason, "Chưa đạt chỉ tiêu đợt tuyển này");
});

test("Forgot password and reset password flow: verifies ownership, rejects invalid OTP/data, updates password and invalidates sessions", async () => {
  // 1. Rejects unknown username
  const badUser = await call("", "auth/forgot-password", "POST", {
    username: "non_existent_user_999",
    verify: "someone@ptit.edu.vn",
  });
  assert.equal(badUser.status, 400);

  // 2. Rejects mismatched email/MSSV
  const wrongVerify = await call("", "auth/forgot-password", "POST", {
    username: "leader_it",
    verify: "wrong_email@gmail.com",
  });
  assert.equal(wrongVerify.status, 400);
  assert.match(wrongVerify.data.error, /không khớp/);

  // 3. Accepts matching username + email (or MSSV)
  const forgotOk = await call("", "auth/forgot-password", "POST", {
    username: "leader_it",
    verify: "minhanh@svclub.local",
  });
  assert.equal(forgotOk.status, 200);
  assert.equal(forgotOk.data.ok, true);
  assert.equal(typeof forgotOk.data.reset_token, "string");
  assert.equal(typeof forgotOk.data.otp_code, "string");
  assert.equal(forgotOk.data.otp_code.length, 6);

  const resetToken = forgotOk.data.reset_token;
  const otpCode = forgotOk.data.otp_code;

  // 4. Rejects invalid OTP
  const badOtp = await call("", "auth/reset-password", "POST", {
    reset_token: resetToken,
    otp: "000000",
    password: "NewPassword1234!",
  });
  assert.equal(badOtp.status, 400);
  assert.match(badOtp.data.error, /OTP không đúng/);

  // 5. Rejects password less than 10 characters (Zod schema validation -> 422)
  const shortPass = await call("", "auth/reset-password", "POST", {
    reset_token: resetToken,
    otp: otpCode,
    password: "short",
  });
  assert.equal(shortPass.status, 422);

  // 6. Successfully resets password with valid OTP and >=10 char password
  const newPassword = "BrandNewSecurePassword123!";
  const resetOk = await call("", "auth/reset-password", "POST", {
    reset_token: resetToken,
    otp: otpCode,
    password: newPassword,
  });
  assert.equal(resetOk.status, 200);
  assert.equal(resetOk.data.ok, true);

  // 7. Old password no longer works
  const oldLogin = await call("", "auth/login", "POST", {
    username: "leader_it",
    password: env.DEMO_PASSWORD,
  });
  assert.equal(oldLogin.status, 401);

  // 8. New password logs in successfully
  const newLogin = await call("", "auth/login", "POST", {
    username: "leader_it",
    password: newPassword,
  });
  assert.equal(newLogin.status, 200);
  assert.equal(newLogin.data.user.username, "leader_it");

  // 9. Reset token cannot be reused
  const reuseToken = await call("", "auth/reset-password", "POST", {
    reset_token: resetToken,
    otp: otpCode,
    password: "AnotherPassword123!",
  });
  assert.equal(reuseToken.status, 400);

  // Restore original password for any subsequent tests/fixtures
  const originalHash = sql(
    "SELECT password_hash FROM USERS WHERE username='officer_it'",
  ).password_hash;
  sqlite
    .prepare("UPDATE USERS SET password_hash=? WHERE username='leader_it'")
    .run(originalHash);
});

test("Leave club workflow: voluntary leave, role deactivation, status history, and last leader protection", async () => {
  // 1. Leader cannot leave if sole leader
  // Temporarily deactivate all other leaders in Club 1 so demo_leader is the ONLY active leader
  sqlite
    .prepare(
      "UPDATE USER_ROLES SET active_flag=0 WHERE club_id=1 AND role_id=2 AND user_id<>10002",
    )
    .run();
  const leaderLeave = await call(
    "LEADER",
    "clubs/1/leave",
    "POST",
    {
      reason: "Thử rời CLB",
    },
    1,
  );
  assert.equal(leaderLeave.status, 400);
  assert.match(leaderLeave.data.error, /Chủ nhiệm duy nhất/);
  // Restore leaders in Club 1
  sqlite
    .prepare(
      "UPDATE USER_ROLES SET active_flag=1 WHERE club_id=1 AND role_id=2",
    )
    .run();

  // 2. Member leaves club voluntarily
  const memberLeave = await call(
    "MEMBER",
    "clubs/1/leave",
    "POST",
    {
      reason: "Bận việc học kỳ cuối",
    },
    1,
  );
  assert.equal(memberLeave.status, 200);
  assert.equal(memberLeave.data.ok, true);

  // 3. Member status is now LEFT
  const memberRow = sql(
    "SELECT cm.*, ur.active_flag FROM CLUB_MEMBERS cm JOIN USER_ROLES ur ON ur.user_id=cm.user_id AND ur.club_id=cm.club_id WHERE cm.club_id=1 AND cm.user_id=(SELECT user_id FROM USERS WHERE username='demo_member')",
  );
  assert.equal(memberRow.member_status, "LEFT");
  assert.equal(memberRow.active_flag, 0);

  // 4. Status history is recorded
  const history = sql(
    "SELECT * FROM MEMBER_STATUS_HISTORY WHERE club_member_id=? ORDER BY history_id DESC LIMIT 1",
    memberRow.club_member_id,
  );
  assert.equal(history.new_status, "LEFT");
  assert.equal(history.reason, "Bận việc học kỳ cuối");

  // Restore member for fixture consistency
  sqlite
    .prepare(
      "UPDATE CLUB_MEMBERS SET member_status='ACTIVE', leave_date=null WHERE club_member_id=?",
    )
    .run(memberRow.club_member_id);
  sqlite
    .prepare(
      "UPDATE USER_ROLES SET active_flag=1 WHERE club_id=1 AND user_id=(SELECT user_id FROM USERS WHERE username='demo_member')",
    )
    .run();
});

test("Admin overview: only ADMIN can access, returns system-wide macro stats", async () => {
  // 1. Non-admin is rejected with 403
  const memberRes = await call("MEMBER", "admin/overview");
  assert.equal(memberRes.status, 403);

  const leaderRes = await call("LEADER", "admin/overview");
  assert.equal(leaderRes.status, 403);

  // 2. ADMIN accesses successfully
  const adminRes = await call("ADMIN", "admin/overview");
  assert.equal(adminRes.status, 200);
  assert.ok(adminRes.data.clubs.total >= 1);
  assert.ok(adminRes.data.accounts.total >= 1);
  assert.ok(Array.isArray(adminRes.data.recentClubs));
  assert.ok(Array.isArray(adminRes.data.recentAudits));
});

test("Route verification: all 16 application routes work correctly with appropriate role access and valid data", async () => {
  // Route 1: Dashboard (Admin: admin/overview, Club: dashboard)
  const rAdminDashboard = await call("ADMIN", "admin/overview");
  assert.equal(rAdminDashboard.status, 200);
  const rClubDashboard = await call("LEADER", "dashboard", "GET", undefined, 1);
  assert.equal(rClubDashboard.status, 200);

  // Route 2: Explore Clubs (clubs and join-requests)
  const rExplore = await call("MEMBER", "clubs");
  assert.equal(rExplore.status, 200);
  assert.ok(
    Array.isArray(rExplore.data.rows || rExplore.data.clubs || rExplore.data),
  );

  // Route 3: Members (members)
  const rMembers = await call("LEADER", "members", "GET", undefined, 1);
  assert.equal(rMembers.status, 200);
  assert.ok(
    Array.isArray(rMembers.data.rows || rMembers.data.members || rMembers.data),
  );

  // Route 4: Events list (events)
  const rEvents = await call("MEMBER", "events", "GET", undefined, 1);
  assert.equal(rEvents.status, 200);
  assert.ok(
    Array.isArray(rEvents.data.rows || rEvents.data.events || rEvents.data),
  );
  assert.ok(rEvents.data.counts !== undefined);
  assert.equal(typeof rEvents.data.counts.active, "number");
  assert.equal(typeof rEvents.data.counts.cancelled, "number");

  const rActive = await call(
    "MEMBER",
    "events?group=active",
    "GET",
    undefined,
    1,
  );
  assert.equal(rActive.status, 200);
  for (const ev of rActive.data.rows) {
    assert.notEqual(ev.event_status, "CANCELLED");
  }

  const rCancelled = await call(
    "MEMBER",
    "events?group=cancelled",
    "GET",
    undefined,
    1,
  );
  assert.equal(rCancelled.status, 200);
  for (const ev of rCancelled.data.rows) {
    assert.equal(ev.event_status, "CANCELLED");
  }

  // Route 5: Event detail (events/:id and registrations)
  const rEventDetail = await call("MEMBER", "events/1", "GET", undefined, 1);
  assert.equal(rEventDetail.status, 200);
  const rAttendees = await call(
    "LEADER",
    "events/1/registrations",
    "GET",
    undefined,
    1,
  );
  assert.equal(rAttendees.status, 200);
  assert.ok(Array.isArray(rAttendees.data.rows || rAttendees.data));

  // Route 6: Finance (finance)
  const rFinance = await call("TREASURER", "finance", "GET", undefined, 1);
  assert.equal(rFinance.status, 200);
  assert.ok(Array.isArray(rFinance.data.rows || rFinance.data));

  // Route 7: Approvals (finance with status=PENDING_APPROVAL)
  const rApprovals = await call(
    "LEADER",
    "finance?status=PENDING_APPROVAL",
    "GET",
    undefined,
    1,
  );
  assert.equal(rApprovals.status, 200);
  assert.ok(Array.isArray(rApprovals.data.rows || rApprovals.data));

  // Route 8: Categories (categories)
  const rCategories = await call(
    "TREASURER",
    "categories",
    "GET",
    undefined,
    1,
  );
  assert.equal(rCategories.status, 200);
  assert.ok(
    Array.isArray(
      rCategories.data.rows || rCategories.data.categories || rCategories.data,
    ),
  );

  // Route 9: Reports (reports?type=events, reports?type=finance, reports?type=members)
  const rRepFinance = await call(
    "LEADER",
    "reports?type=finance",
    "GET",
    undefined,
    1,
  );
  assert.equal(rRepFinance.status, 200);
  const rRepEvents = await call(
    "LEADER",
    "reports?type=events",
    "GET",
    undefined,
    1,
  );
  assert.equal(rRepEvents.status, 200);
  const rRepMembers = await call(
    "LEADER",
    "reports?type=members",
    "GET",
    undefined,
    1,
  );
  assert.equal(rRepMembers.status, 200);

  // Route 10: Accounts (accounts - Admin only)
  const rAccounts = await call("ADMIN", "accounts");
  assert.equal(rAccounts.status, 200);
  assert.ok(
    Array.isArray(
      rAccounts.data.rows || rAccounts.data.accounts || rAccounts.data,
    ),
  );

  // Route 11: Clubs (clubs - Admin only)
  const rClubs = await call("ADMIN", "clubs");
  assert.equal(rClubs.status, 200);
  assert.ok(
    Array.isArray(rClubs.data.rows || rClubs.data.clubs || rClubs.data),
  );

  // Route 12: Roles (roles - Admin / Leader)
  const rRolesAdmin = await call("ADMIN", "roles");
  assert.equal(rRolesAdmin.status, 200);
  const rRolesLeader = await call("LEADER", "roles", "GET", undefined, 1);
  assert.equal(rRolesLeader.status, 200);
  assert.ok(
    Array.isArray(
      rRolesLeader.data.rows || rRolesLeader.data.roles || rRolesLeader.data,
    ),
  );

  // Route 13: Audit log (audit - Admin / Leader)
  const rAudit = await call("ADMIN", "audit");
  assert.equal(rAudit.status, 200);
  assert.ok(
    Array.isArray(rAudit.data.rows || rAudit.data.audits || rAudit.data),
  );

  // Route 14: Settings (club - Leader / Admin)
  const rSettings = await call("LEADER", "club", "GET", undefined, 1);
  assert.equal(rSettings.status, 200);

  // Route 15: Profile (profile)
  const rProfile = await call("MEMBER", "profile");
  assert.equal(rProfile.status, 200);

  // Route 16: Registrations (my-registrations - Member)
  const rRegistrations = await call(
    "MEMBER",
    "my-registrations",
    "GET",
    undefined,
    1,
  );
  assert.equal(rRegistrations.status, 200);
  assert.ok(
    Array.isArray(
      rRegistrations.data.rows ||
        rRegistrations.data.registrations ||
        rRegistrations.data,
    ),
  );
});

test("Club join request with file attachment: upload attachment, submit join request, review attachment, and download security check", async () => {
  const files = new Map<string, any>();
  const testBucket = {
    put: async (k: string, b: Uint8Array, m: any) =>
      files.set(k, { body: b, ...m }),
    get: async (k: string) => files.get(k),
  };

  // 1. Create a dedicated applicant account
  const applicantData = {
    student_code: "ATTACH_001",
    username: "attach_user_01",
    password: "Password@123",
    full_name: "Hoang Van Attach",
    email: "attach_user@ptit.edu.vn",
  };
  await call("ADMIN", "accounts", "POST", applicantData);
  const loginRes = await call("", "auth/login", "POST", {
    username: applicantData.username,
    password: applicantData.password,
  });
  const applicantCookie = loginRes.cookie!.split(";")[0];

  // 2. Upload an attachment (CV PDF)
  const form = new FormData();
  form.set(
    "file",
    new File(
      ["%PDF-1.4 Mock CV of Hoang Van Attach"],
      "CV_HoangVanAttach.pdf",
      {
        type: "application/pdf",
      },
    ),
  );
  const uploadReq = new Request("http://test.local/api/attachments", {
    method: "POST",
    headers: { Cookie: applicantCookie },
    body: form,
  });
  const uploadRes = await handleApi(uploadReq, db, {
    ...env,
    BUCKET: testBucket,
  });
  assert.equal(uploadRes.status, 201);
  const uploadData: any = await uploadRes.json();
  assert.ok(uploadData.file_url.startsWith("/api/attachments/requests/"));
  assert.equal(uploadData.file_name, "CV_HoangVanAttach.pdf");

  // 3. Submit join request to Club 1 with the attachment
  const joinReq = new Request("http://test.local/api/clubs/1/join?club=0", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: applicantCookie,
    },
    body: JSON.stringify({
      message: "Em xin gia nhập và đã đính kèm CV chi tiết.",
      file_url: uploadData.file_url,
      file_name: uploadData.file_name,
    }),
  });
  const joinRes = await handleApi(joinReq, db, { ...env, BUCKET: testBucket });
  assert.equal(joinRes.status, 201);
  const joinData: any = await joinRes.json();
  assert.ok(joinData.request_id > 0);

  // 4. Verify request in database has file_url and file_name
  const reqInDb = sql(
    "SELECT * FROM CLUB_JOIN_REQUESTS WHERE request_id=?",
    joinData.request_id,
  );
  assert.equal(reqInDb.file_url, uploadData.file_url);
  assert.equal(reqInDb.file_name, "CV_HoangVanAttach.pdf");

  // 5. Club Leader views join requests and sees the attachment
  const leaderReqs = await call("LEADER", "join-requests", "GET", undefined, 1);
  assert.equal(leaderReqs.status, 200);
  const foundReq = leaderReqs.data.rows.find(
    (r: any) => r.request_id === joinData.request_id,
  );
  assert.ok(foundReq);
  assert.equal(foundReq.file_url, uploadData.file_url);
  assert.equal(foundReq.file_name, "CV_HoangVanAttach.pdf");

  // 6. Test download access permissions:
  // Applicant can download their own file
  const appDownloadReq = new Request(
    `http://test.local${uploadData.file_url}`,
    {
      method: "GET",
      headers: { Cookie: applicantCookie },
    },
  );
  const appDownloadRes = await handleApi(appDownloadReq, db, {
    ...env,
    BUCKET: testBucket,
  });
  assert.equal(appDownloadRes.status, 200);

  // Club Leader can download the applicant's file
  const leaderDownloadReq = new Request(
    `http://test.local${uploadData.file_url}?club=1`,
    {
      method: "GET",
      headers: { Cookie: cookies["LEADER"] },
    },
  );
  const leaderDownloadRes = await handleApi(leaderDownloadReq, db, {
    ...env,
    BUCKET: testBucket,
  });
  assert.equal(leaderDownloadRes.status, 200);

  // Unauthorized third party member without staff role cannot download
  const strangerLogin = await call("", "auth/login", "POST", {
    username: "demo_member",
    password: env.DEMO_PASSWORD,
  });
  const strangerCookie = strangerLogin.cookie!.split(";")[0];
  const strangerDownloadReq = new Request(
    `http://test.local${uploadData.file_url}?club=0`,
    {
      method: "GET",
      headers: { Cookie: strangerCookie },
    },
  );
  const strangerDownloadRes = await handleApi(strangerDownloadReq, db, {
    ...env,
    BUCKET: testBucket,
  });
  assert.equal(strangerDownloadRes.status, 403);
});

test("Notification lifecycle: trigger, list, mark read, mark all read, and delete", async () => {
  // 1. Initially check LEADER notifications
  const initialNotifs = await call(
    "LEADER",
    "notifications",
    "GET",
    undefined,
    1,
  );
  assert.equal(initialNotifs.status, 200);
  assert.ok(Array.isArray(initialNotifs.data.rows));
  const initialUnread = initialNotifs.data.unread_count;

  // 2. Create a test applicant and submit a join request to Club 1
  const appUsername = "applicant_notif_test";
  const createAcc = await call("ADMIN", "accounts", "POST", {
    student_code: "SV99999",
    username: appUsername,
    password: "Password@123",
    full_name: "Nguyễn Văn Thông Báo",
  });
  assert.equal(createAcc.status, 201);
  const appLogin = await call("", "auth/login", "POST", {
    username: appUsername,
    password: "Password@123",
  });
  assert.ok(appLogin.cookie);
  const appCookie = appLogin.cookie!.split(";")[0];

  const joinRes = await handleApi(
    new Request("http://test.local/api/clubs/1/join?club=0", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: appCookie,
      },
      body: JSON.stringify({ message: "Xin chào CLB, tôi muốn gia nhập" }),
    }),
    db,
    env,
  );
  assert.equal(joinRes.status, 201);
  const joinData: any = await joinRes.json();

  // 3. LEADER should receive a notification about the new join request
  const leaderNotifs = await call(
    "LEADER",
    "notifications",
    "GET",
    undefined,
    1,
  );
  assert.equal(leaderNotifs.status, 200);
  assert.equal(leaderNotifs.data.unread_count, initialUnread + 1);
  const latestNotif = leaderNotifs.data.rows.find(
    (n: any) => n.type === "JOIN_REQUEST",
  );
  assert.ok(latestNotif);
  assert.equal(latestNotif.is_read, false);
  assert.ok(latestNotif.title.includes("Đơn xin gia nhập"));

  // 4. Mark the specific notification as read
  const markReadRes = await call(
    "LEADER",
    `notifications/${latestNotif.notification_id}/read`,
    "PATCH",
    undefined,
    1,
  );
  assert.equal(markReadRes.status, 200);

  // Verify it is now read
  const afterRead = await call("LEADER", "notifications", "GET", undefined, 1);
  const updatedNotif = afterRead.data.rows.find(
    (n: any) => n.notification_id === latestNotif.notification_id,
  );
  assert.equal(updatedNotif.is_read, true);
  assert.equal(afterRead.data.unread_count, initialUnread);

  // 5. Test unread_only filter
  const unreadOnlyRes = await call(
    "LEADER",
    "notifications?unread_only=true",
    "GET",
    undefined,
    1,
  );
  assert.equal(unreadOnlyRes.status, 200);
  assert.ok(
    !unreadOnlyRes.data.rows.some(
      (n: any) => n.notification_id === latestNotif.notification_id,
    ),
  );

  // 6. Test LEADER approves join request -> Applicant gets notification
  const approveRes = await call(
    "LEADER",
    `join-requests/${joinData.request_id}`,
    "PATCH",
    { status: "APPROVED", department_name: "Ban Kỹ thuật" },
    1,
  );
  assert.equal(approveRes.status, 200);

  // Applicant checks their notifications
  const appNotifsRes = await handleApi(
    new Request("http://test.local/api/notifications", {
      method: "GET",
      headers: { Cookie: appCookie },
    }),
    db,
    env,
  );
  assert.equal(appNotifsRes.status, 200);
  const appNotifs: any = await appNotifsRes.json();
  assert.ok(appNotifs.rows.length >= 1);
  const appApprovalNotif = appNotifs.rows[0];
  assert.ok(appApprovalNotif.title.includes("phê duyệt"));
  assert.equal(appApprovalNotif.is_read, false);

  // 7. Applicant marks all notifications as read
  const readAllRes = await handleApi(
    new Request("http://test.local/api/notifications/read-all", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: appCookie,
      },
      body: JSON.stringify({}),
    }),
    db,
    env,
  );
  assert.equal(readAllRes.status, 200);

  const appNotifsAfterAll = await (
    await handleApi(
      new Request("http://test.local/api/notifications", {
        method: "GET",
        headers: { Cookie: appCookie },
      }),
      db,
      env,
    )
  ).json();
  assert.equal((appNotifsAfterAll as any).unread_count, 0);

  // 8. Delete notification
  const delRes = await handleApi(
    new Request(
      `http://test.local/api/notifications/${appApprovalNotif.notification_id}`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Cookie: appCookie,
        },
      },
    ),
    db,
    env,
  );
  assert.equal(delRes.status, 200);

  const appNotifsAfterDel = await (
    await handleApi(
      new Request("http://test.local/api/notifications", {
        method: "GET",
        headers: { Cookie: appCookie },
      }),
      db,
      env,
    )
  ).json();
  assert.ok(
    !(appNotifsAfterDel as any).rows.some(
      (n: any) => n.notification_id === appApprovalNotif.notification_id,
    ),
  );
});

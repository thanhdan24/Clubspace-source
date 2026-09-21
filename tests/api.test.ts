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
  assert.equal(
    (
      await call("OFFICER", `events/${eventId}/action`, "POST", {
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
  await call("OFFICER", `events/${id}/action`, "POST", { action: "publish" });
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

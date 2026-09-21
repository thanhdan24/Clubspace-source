import { z } from "zod";
export type Row = Record<string, any>;
export type Statement = {
  bind(...params: any[]): Statement;
  all(): Promise<any>;
  first(): Promise<any>;
  run(): Promise<any>;
};
export type Database = {
  prepare(sql: string): Statement;
  batch(statements: Statement[]): Promise<any[]>;
  dialect?: string;
};
export type Context = {
  db: Database;
  user: Row;
  club: number;
  roles: string[];
  admin: boolean;
  env: any;
  request: Request;
};
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const fail = (condition: any, message: string, status = 400) => {
  if (!condition) throw new ApiError(status, message);
};
export const now = () =>
  new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 19);
export const day = () => now().slice(0, 10);
const statementSource = new WeakMap<object, { sql: string; params: any[] }>();
export function stmt(db: Database, s: string, p: any[] = []) {
  const params = p.map((v) => (v === undefined ? null : v));
  const prepared = db.prepare(s).bind(...params);
  statementSource.set(prepared, { sql: s, params });
  return prepared;
}
function ifChanged(db: Database, s: Statement) {
  if (db.dialect === "sqlserver" || db.dialect === "postgres") return s;
  const source = statementSource.get(s)!;
  let sql = source.sql;
  if (/^INSERT/i.test(sql))
    sql = sql.replace(
      /VALUES\s*\(([\s\S]*)\)\s*$/i,
      "SELECT $1 WHERE changes()>0",
    );
  else if (/^UPDATE/i.test(sql)) sql += " AND changes()>0";
  else throw new Error("Unsupported guarded statement");
  return stmt(db, sql, source.params);
}
export const all = async (db: Database, s: string, p: any[] = []) =>
  ((await stmt(db, s, p).all()).results ?? []) as Row[];
export const one = async (db: Database, s: string, p: any[] = []) =>
  (await stmt(db, s, p).first()) as Row | null;
export const execute = async (db: Database, s: string, p: any[] = []) =>
  await stmt(db, s, p).run();
export const has = (c: Context, ...roles: string[]) =>
  roles.some((r) => c.roles.includes(r));
export function permit(c: Context, ...roles: string[]) {
  fail(has(c, ...roles), "Bạn không có quyền thực hiện thao tác này.", 403);
}
export function readPermit(c: Context, ...roles: string[]) {
  fail(c.admin || has(c, ...roles), "Bạn không có quyền xem dữ liệu này.", 403);
}
export const isStaff = (c: Context) =>
  c.admin || has(c, "LEADER", "OFFICER", "TREASURER");
export function json(data: any, status = 200, extra: any = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
      ...extra,
    },
  });
}
export const idSchema = z.coerce
  .number()
  .int()
  .positive()
  .max(Number.MAX_SAFE_INTEGER);
export const str = (max = 200) =>
  z
    .string()
    .trim()
    .min(1, "Không được để trống.")
    .max(max, `Tối đa ${max} ký tự.`);
export const opt = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => v || null);
export const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày không hợp lệ.")
  .refine((v) => {
    const d = new Date(v);
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, "Ngày không tồn tại.");
export const datetime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/, "Thời gian không hợp lệ.")
  .transform((v) => (v.length === 16 ? v + ":00" : v))
  .refine((v) => {
    const d = new Date(v + "+07:00");
    return (
      !isNaN(d.getTime()) &&
      new Date(d.getTime() + 7 * 3600000).toISOString().slice(0, 19) === v
    );
  }, "Thời gian không tồn tại.");
export async function body(req: Request) {
  fail(
    Number(req.headers.get("content-length") || 0) < 100000,
    "Nội dung quá lớn.",
    413,
  );
  try {
    return await req.json();
  } catch {
    throw new ApiError(400, "Dữ liệu gửi lên không đúng định dạng.");
  }
}
export function audit(
  c: Context,
  action: string,
  entity: string,
  id: any,
  before: any,
  after: any,
) {
  return stmt(
    c.db,
    "INSERT INTO AUDIT_LOGS (user_id,club_id,action_code,entity_name,entity_id,old_value,new_value,created_at) VALUES (?,?,?,?,?,?,?,?)",
    [
      c.user.user_id,
      c.club || null,
      action,
      entity,
      String(id ?? ""),
      before ? JSON.stringify(before) : null,
      after ? JSON.stringify(after) : null,
      now(),
    ],
  );
}
export async function change(
  c: Context,
  table: string,
  idcol: string,
  id: number,
  fields: Row,
  before: Row,
  action = "UPDATE",
  extras: Statement[] = [],
) {
  const keys = Object.keys(fields);
  const guards =
    (
      {
        EVENTS: ["event_status", "attendance_locked"],
        EVENT_REGISTRATIONS: ["registration_status"],
        FINANCIAL_TRANSACTIONS: ["transaction_status"],
        CLUB_MEMBERS: ["member_status"],
        USER_ROLES: ["active_flag"],
        FINANCE_CATEGORIES: ["active_flag"],
      } as Record<string, string[]>
    )[table] || [];
  const sql =
    `UPDATE ${table} SET ${keys.map((k) => k + "=?").join(",")} WHERE ${idcol}=?` +
    guards.map((k) => ` AND ${k}=?`).join("");
  const history = extras
    .slice()
    .sort(
      (a, b) =>
        Number(statementSource.get(b)?.sql.includes("AUDIT_LOGS")) -
        Number(statementSource.get(a)?.sql.includes("AUDIT_LOGS")),
    );
  const out = await c.db.batch([
    stmt(c.db, sql, [
      ...keys.map((k) => fields[k]),
      id,
      ...guards.map((k) => before[k]),
    ]),
    ifChanged(c.db, audit(c, action, table, id, before, fields)),
    ...history.map((s) => ifChanged(c.db, s)),
  ]);
  fail(
    (out[0].meta?.changes ?? out[0].changes ?? 1) > 0,
    "Dữ liệu vừa thay đổi. Hãy tải lại và thử lại.",
    409,
  );
  return { ...before, ...fields };
}
export async function insert(
  c: Context,
  table: string,
  values: Row,
  action = "CREATE",
  extras: Statement[] = [],
) {
  const keys = Object.keys(values);
  const out = await c.db.batch([
    stmt(
      c.db,
      `INSERT INTO ${table} (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`,
      keys.map((k) => values[k]),
    ),
    ...extras,
    audit(c, action, table, null, null, values),
  ]);
  return Number(out[0].meta?.last_row_id ?? 0);
}
export async function scoped(
  c: Context,
  table: string,
  col: string,
  id: number,
) {
  const row = await one(
    c.db,
    `SELECT * FROM ${table} WHERE ${col}=? AND club_id=?`,
    [id, c.club],
  );
  fail(row, "Không tìm thấy dữ liệu trong câu lạc bộ này.", 404);
  return row!;
}
export function paging(url: URL) {
  return {
    page: Math.max(
      1,
      Math.min(100000, Number(url.searchParams.get("page")) || 1),
    ),
    size: Math.max(
      1,
      Math.min(100, Number(url.searchParams.get("size")) || 10),
    ),
    q: (url.searchParams.get("q") || "").slice(0, 100),
    status: url.searchParams.get("status") || "",
  };
}
export async function list(
  c: Context,
  sql: string,
  params: any[],
  order: string,
  url: URL,
) {
  const { page, size } = paging(url);
  const count = await one(
    c.db,
    `SELECT COUNT(*) AS total FROM (${sql}) counted`,
    params,
  );
  const rows = await all(c.db, sql + ` ORDER BY ${order} LIMIT ? OFFSET ?`, [
    ...params,
    size,
    (page - 1) * size,
  ]);
  return { rows, total: Number(count?.total || 0), page, size };
}
export async function member(c: Context) {
  const m = await one(
    c.db,
    "SELECT * FROM CLUB_MEMBERS WHERE club_id=? AND user_id=?",
    [c.club, c.user.user_id],
  );
  fail(m, "Bạn chưa có hồ sơ thành viên trong câu lạc bộ này.", 403);
  return m!;
}
export function cleanUser(u: Row) {
  const { password_hash, ...rest } = u;
  return rest;
}
export function csv(
  rows: Row[],
  columns: Record<string, string>,
  filename: string,
) {
  const cell = (v: any) => {
    let s = String(v ?? "");
    if (/^[\s]*[=+@\-]/.test(s) || /^[\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  return new Response(
    "\ufeff" +
      [
        Object.values(columns).map(cell).join(","),
        ...rows.map((r) =>
          Object.keys(columns)
            .map((k) => cell(r[k]))
            .join(","),
        ),
      ].join("\r\n"),
    {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.csv"`,
        "Cache-Control": "no-store",
      },
    },
  );
}

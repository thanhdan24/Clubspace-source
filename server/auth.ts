import bcrypt from "bcryptjs";
import { z } from "zod";
import {
  all,
  one,
  execute,
  now,
  fail,
  json,
  body,
  str,
  cleanUser,
  ApiError,
  type Context,
  type Database,
  type Row,
} from "./core";
export async function digest(token: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)),
    ),
  )
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
}
export function cookie(req: Request, value: string, maxAge = 28800) {
  return `clubspace_session=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${new URL(req.url).protocol === "https:" ? "; Secure" : ""}`;
}
export async function authenticate(db: Database, req: Request) {
  const token = (req.headers.get("cookie") || "").match(
    /(?:^|; )clubspace_session=([^;]+)/,
  )?.[1];
  if (!token) return null;
  return await one(
    db,
    "SELECT u.* FROM AUTH_SESSIONS s JOIN USERS u ON u.user_id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.account_status=?",
    [await digest(token), Date.now(), "ACTIVE"],
  );
}
export type AuthEnv = Record<string, unknown> & {
  DEMO_MODE?: string;
  DEMO_PASSWORD?: string;
};
export async function session(db: Database, req: Request, user: Row) {
  const token = crypto.randomUUID() + crypto.randomUUID();
  await execute(
    db,
    "INSERT INTO AUTH_SESSIONS (token_hash,user_id,expires_at,created_at) VALUES (?,?,?,?)",
    [await digest(token), user.user_id, Date.now() + 28800000, now()],
  );
  return json({ user: cleanUser(user) }, 200, {
    "Set-Cookie": cookie(req, token),
  });
}
export async function authRoute(
  db: Database,
  req: Request,
  path: string,
  env: AuthEnv,
) {
  if (path === "auth/info" && req.method === "GET")
    return json({
      demo: env.DEMO_MODE === "true",
      database:
        db.dialect === "postgres" ? "Supabase PostgreSQL" : "Local",
    });
  if (path === "auth/login" && req.method === "POST") {
    const b = z
      .object({ username: str(50), password: str(200) })
      .parse(await body(req));
    const identifier = await digest(b.username.toLowerCase());
    const tries = await one(
      db,
      "SELECT COUNT(*) AS n FROM AUTH_ATTEMPTS WHERE identifier=? AND attempted_at>?",
      [identifier, Date.now() - 900000],
    );
    fail(
      Number(tries?.n) < 10,
      "Quá nhiều lần đăng nhập thất bại. Vui lòng thử lại sau 15 phút.",
      429,
    );
    const user = await one(db, "SELECT * FROM USERS WHERE username=?", [
      b.username,
    ]);
    const valid = user
      ? await bcrypt.compare(b.password, user.password_hash)
      : false;
    if (!user || !valid || user.account_status !== "ACTIVE") {
      await execute(
        db,
        "INSERT INTO AUTH_ATTEMPTS(identifier,attempted_at) VALUES (?,?)",
        [identifier, Date.now()],
      );
      throw new ApiError(
        401,
        "Tên đăng nhập, mật khẩu không đúng hoặc tài khoản đã bị khóa.",
      );
    }
    await execute(
      db,
      "DELETE FROM AUTH_ATTEMPTS WHERE identifier=? OR attempted_at<?",
      [identifier, Date.now() - 86400000],
    );
    return session(db, req, user);
  }
  if (path === "auth/demo" && req.method === "POST") {
    fail(
      env.DEMO_MODE === "true" && env.DEMO_PASSWORD,
      "Tài khoản trải nghiệm đã tắt.",
      404,
    );
    const { role } = z
      .object({
        role: z.enum(["LEADER", "OFFICER", "TREASURER", "MEMBER", "ADMIN"]),
      })
      .parse(await body(req));
    const user = await one(
      db,
      "SELECT * FROM USERS WHERE username=? AND account_status=?",
      ["demo_" + role.toLowerCase(), "ACTIVE"],
    );
    fail(
      user &&
        env.DEMO_PASSWORD &&
        (await bcrypt.compare(env.DEMO_PASSWORD, String(user.password_hash))),
      "Tài khoản trải nghiệm chưa được khởi tạo.",
      503,
    );
    return session(db, req, user!);
  }
  if (path === "auth/logout" && req.method === "POST") {
    const token = (req.headers.get("cookie") || "").match(
      /(?:^|; )clubspace_session=([^;]+)/,
    )?.[1];
    if (token)
      await execute(db, "DELETE FROM AUTH_SESSIONS WHERE token_hash=?", [
        await digest(token),
      ]);
    return json({ ok: true }, 200, { "Set-Cookie": cookie(req, "", 0) });
  }
  return null;
}
export async function context(
  db: Database,
  req: Request,
  env: AuthEnv,
): Promise<Context> {
  const user = await authenticate(db, req);
  fail(user, "Vui lòng đăng nhập để tiếp tục.", 401);
  const grants = await all(
    db,
    "SELECT r.role_code,ur.club_id FROM USER_ROLES ur JOIN ROLES r ON r.role_id=ur.role_id WHERE ur.user_id=? AND ur.active_flag=1",
    [user!.user_id],
  );
  const admin = grants.some(
    (r) => r.role_code === "ADMIN" && r.club_id === null,
  );
  const rawClub = new URL(req.url).searchParams.get("club");
  const requested = rawClub ? Number(rawClub) : 0;
  const club =
    requested > 0
      ? requested
      : Number(
          grants.find((r) => r.club_id)?.club_id ||
            (admin
              ? (
                  await one(
                    db,
                    "SELECT club_id FROM CLUBS ORDER BY club_id LIMIT 1",
                  )
                )?.club_id
              : 0),
        );
  const isPublicEventAccess =
    /^\/api\/events\/\d+(?:\/registration)?\/?$/.test(
      new URL(req.url).pathname,
    );
  if (club && !isPublicEventAccess)
    fail(
      admin || grants.some((r) => Number(r.club_id) === club),
      "Bạn không có quyền truy cập câu lạc bộ này.",
      403,
    );
  const accountOrSettings =
    /^\/api\/(club|clubs|profile(?:\/password)?|accounts(?:\/\d+)?|roles|role-catalog)\/?$/.test(
      new URL(req.url).pathname,
    );
  if (club && req.method !== "GET" && !accountOrSettings && !isPublicEventAccess) {
    const r = await one(db, "SELECT club_status FROM CLUBS WHERE club_id=?", [
      club,
    ]);
    fail(r?.club_status === "ACTIVE", "Câu lạc bộ đang ngừng hoạt động.", 403);
  }
  const roles = grants
    .filter((r) => Number(r.club_id) === club)
    .map((r) => r.role_code);
  if (admin) roles.push("ADMIN");
  if (!roles.length && isPublicEventAccess) roles.push("MEMBER");
  return { db, user: user!, club, roles, admin, env, request: req };
}

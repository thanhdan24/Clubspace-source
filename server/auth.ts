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
      database: db.dialect === "postgres" ? "Supabase PostgreSQL" : "Local",
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
  if (path === "auth/forgot-password" && req.method === "POST") {
    const b = z
      .object({
        username: str(50),
        verify: z
          .string()
          .trim()
          .min(1, "Vui lòng nhập Email hoặc Mã sinh viên.")
          .max(150),
      })
      .parse(await body(req));
    const identifier = await digest("forgot:" + b.username.toLowerCase());
    const tries = await one(
      db,
      "SELECT COUNT(*) AS n FROM AUTH_ATTEMPTS WHERE identifier=? AND attempted_at>?",
      [identifier, Date.now() - 900000],
    );
    fail(
      Number(tries?.n) < 5,
      "Quá nhiều yêu cầu khôi phục mật khẩu. Vui lòng thử lại sau 15 phút.",
      429,
    );
    const user = await one(
      db,
      "SELECT * FROM USERS WHERE LOWER(username)=LOWER(?) OR LOWER(student_code)=LOWER(?)",
      [b.username, b.username],
    );
    const verifyInput = b.verify.toLowerCase().trim();
    const emailMatch =
      user?.email && user.email.toLowerCase().trim() === verifyInput;
    const studentCodeMatch =
      user?.student_code &&
      user.student_code.toLowerCase().trim() === verifyInput;
    const phoneMatch = user?.phone && user.phone.trim() === verifyInput;

    if (
      !user ||
      user.account_status !== "ACTIVE" ||
      (!emailMatch && !studentCodeMatch && !phoneMatch)
    ) {
      await execute(
        db,
        "INSERT INTO AUTH_ATTEMPTS(identifier,attempted_at) VALUES (?,?)",
        [identifier, Date.now()],
      );
      throw new ApiError(
        400,
        "Thông tin xác minh không khớp hoặc tài khoản không hoạt động.",
      );
    }
    await execute(
      db,
      "DELETE FROM AUTH_ATTEMPTS WHERE identifier=? OR attempted_at<?",
      [identifier, Date.now() - 86400000],
    );
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const ts = Date.now();
    const sig = await digest(
      `${user.user_id}:${otp}:${String(user.password_hash).slice(-10)}:${ts}:clubspace_reset_salt`,
    );
    const resetToken = `${user.user_id}.${ts}.${sig}`;
    const maskedTarget = user.email
      ? user.email.replace(
          /^(.)(.*)(@.*)$/,
          (_: string, a: string, b: string, c: string) =>
            a + "*".repeat(Math.max(2, b.length)) + c,
        )
      : user.student_code
        ? user.student_code.slice(0, 2) + "****" + user.student_code.slice(-2)
        : "thông tin xác thực";

    return json({
      ok: true,
      reset_token: resetToken,
      otp_code: otp,
      full_name: user.full_name,
      username: user.username,
      masked_target: maskedTarget,
      message:
        "Xác thực tài khoản thành công. Vui lòng nhập mã xác nhận OTP và mật khẩu mới.",
    });
  }
  if (path === "auth/reset-password" && req.method === "POST") {
    const b = z
      .object({
        reset_token: str(250),
        otp: z.string().trim().length(6, "Mã xác thực OTP gồm 6 chữ số."),
        password: z
          .string()
          .min(10, "Mật khẩu mới cần ít nhất 10 ký tự.")
          .max(72, "Mật khẩu tối đa 72 ký tự."),
      })
      .parse(await body(req));
    const parts = b.reset_token.split(".");
    fail(parts.length === 3, "Phiên đặt lại mật khẩu không hợp lệ.", 400);
    const [userIdStr, tsStr, sig] = parts;
    const userId = Number(userIdStr);
    const ts = Number(tsStr);
    fail(userId > 0 && !isNaN(ts), "Phiên đặt lại mật khẩu không hợp lệ.", 400);
    fail(
      Date.now() - ts < 15 * 60 * 1000,
      "Mã xác thực đã hết hạn (quá 15 phút). Vui lòng thực hiện lại.",
      400,
    );
    const identifier = await digest("reset:" + userId);
    const tries = await one(
      db,
      "SELECT COUNT(*) AS n FROM AUTH_ATTEMPTS WHERE identifier=? AND attempted_at>?",
      [identifier, Date.now() - 900000],
    );
    fail(
      Number(tries?.n) < 5,
      "Quá nhiều lần nhập sai mã xác thực. Vui lòng thử lại sau 15 phút.",
      429,
    );
    const user = await one(
      db,
      "SELECT * FROM USERS WHERE user_id=? AND account_status='ACTIVE'",
      [userId],
    );
    if (!user) {
      throw new ApiError(404, "Tài khoản không tồn tại hoặc đã bị khóa.");
    }
    const expectedSig = await digest(
      `${user.user_id}:${b.otp.trim()}:${String(user.password_hash).slice(-10)}:${ts}:clubspace_reset_salt`,
    );
    if (sig !== expectedSig) {
      await execute(
        db,
        "INSERT INTO AUTH_ATTEMPTS(identifier,attempted_at) VALUES (?,?)",
        [identifier, Date.now()],
      );
      throw new ApiError(
        400,
        "Mã xác thực OTP không đúng hoặc phiên đã hết hiệu lực.",
      );
    }
    const newHash = await bcrypt.hash(b.password, 12);
    await execute(
      db,
      "UPDATE USERS SET password_hash=?, updated_at=? WHERE user_id=?",
      [newHash, now(), user.user_id],
    );
    await execute(db, "DELETE FROM AUTH_SESSIONS WHERE user_id=?", [
      user.user_id,
    ]);
    await execute(db, "DELETE FROM AUTH_ATTEMPTS WHERE identifier=?", [
      identifier,
    ]);
    await execute(
      db,
      "INSERT INTO AUDIT_LOGS (user_id,club_id,action_code,entity_name,entity_id,old_value,new_value,created_at) VALUES (?,null,'RESET_PASSWORD','USERS',?,null,?,?)",
      [
        user.user_id,
        String(user.user_id),
        JSON.stringify({ reset: true }),
        now(),
      ],
    );
    return json({
      ok: true,
      username: user.username,
      message:
        "Đặt lại mật khẩu thành công! Bạn có thể đăng nhập bằng mật khẩu mới.",
    });
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
  const isPublicEventAccess = /^\/api\/events\/\d+(?:\/registration)?\/?$/.test(
    new URL(req.url).pathname,
  );
  const isAttachmentAccess = /^\/api\/attachments(?:\/.*)?$/.test(
    new URL(req.url).pathname,
  );
  if (club && !isPublicEventAccess && !isAttachmentAccess)
    fail(
      admin || grants.some((r) => Number(r.club_id) === club),
      "Bạn không có quyền truy cập câu lạc bộ này.",
      403,
    );
  const accountOrSettings =
    /^\/api\/(club|clubs(?:\/\d+\/(?:join|leave))?|my-join-requests|join-requests(?:\/\d+)?|notifications(?:\/.*)?|profile(?:\/password)?|accounts(?:\/\d+)?|roles|role-catalog|admin\/overview|attachments(?:\/.*)?)\/?$/.test(
      new URL(req.url).pathname,
    );
  if (
    club &&
    req.method !== "GET" &&
    !accountOrSettings &&
    !isPublicEventAccess &&
    !isAttachmentAccess
  ) {
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

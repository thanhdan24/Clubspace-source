import { z } from "zod";
import {
  all,
  one,
  stmt,
  now,
  day,
  fail,
  permit,
  json,
  body,
  idSchema,
  change,
  insert,
  scoped,
  list,
  type Context,
} from "./core";

export async function joinRequestsRoute(
  c: Context,
  path: string,
  req: Request,
) {
  if (path === "discover-clubs" && req.method === "GET") {
    return json({
      rows: await all(
        c.db,
        `SELECT cl.club_id,cl.club_code,cl.club_name,cl.description,cl.founded_date,
       m.member_status,j.request_status,j.message,j.review_note
       FROM CLUBS cl
       LEFT JOIN CLUB_MEMBERS m ON m.club_id=cl.club_id AND m.user_id=?
       LEFT JOIN CLUB_JOIN_REQUESTS j ON j.club_id=cl.club_id AND j.user_id=?
       WHERE cl.club_status='ACTIVE' ORDER BY cl.club_name`,
        [c.user.user_id, c.user.user_id],
      ),
    });
  }
  const join = path.match(/^discover-clubs\/(\d+)\/join$/);
  if (join && req.method === "POST") {
    const clubId = idSchema.parse(join[1]);
    const b = z
      .object({ message: z.string().trim().max(1000).optional() })
      .parse(await body(req));
    const club = await one(
      c.db,
      "SELECT club_status FROM CLUBS WHERE club_id=?",
      [clubId],
    );
    fail(
      club?.club_status === "ACTIVE",
      "Câu lạc bộ không nhận yêu cầu tham gia.",
      409,
    );
    fail(
      !(await one(
        c.db,
        "SELECT club_member_id FROM CLUB_MEMBERS WHERE club_id=? AND user_id=?",
        [clubId, c.user.user_id],
      )),
      "Bạn đã có hồ sơ tại CLB này. Hãy liên hệ người quản lý nếu cần khôi phục sinh hoạt.",
      409,
    );
    const previous = await one(
      c.db,
      "SELECT * FROM CLUB_JOIN_REQUESTS WHERE club_id=? AND user_id=?",
      [clubId, c.user.user_id],
    );
    const fields = {
      request_status: "PENDING",
      message: b.message || null,
      review_note: null,
      created_at: now(),
      reviewed_by: null,
      reviewed_at: null,
    };
    const target = { ...c, club: clubId };
    if (previous) {
      fail(
        previous.request_status === "REJECTED",
        "Bạn đã gửi yêu cầu tham gia CLB này.",
        409,
      );
      await change(
        target,
        "CLUB_JOIN_REQUESTS",
        "request_id",
        previous.request_id,
        fields,
        previous,
        "REQUEST_JOIN_CLUB",
      );
    } else {
      await insert(
        target,
        "CLUB_JOIN_REQUESTS",
        { ...fields, club_id: clubId, user_id: c.user.user_id },
        "REQUEST_JOIN_CLUB",
      );
    }
    return json({ ok: true }, 201);
  }
  if (path === "join-requests" && req.method === "GET") {
    permit(c, "LEADER", "OFFICER");
    return json(
      await list(
        c,
        "SELECT j.*,u.full_name,u.student_code,u.username FROM CLUB_JOIN_REQUESTS j JOIN USERS u ON u.user_id=j.user_id WHERE j.club_id=? AND j.request_status='PENDING'",
        [c.club],
        "j.created_at,j.request_id",
        new URL(req.url),
      ),
    );
  }
  const review = path.match(/^join-requests\/(\d+)$/);
  if (review && req.method === "PATCH") {
    permit(c, "LEADER", "OFFICER");
    const request = await scoped(
      c,
      "CLUB_JOIN_REQUESTS",
      "request_id",
      idSchema.parse(review[1]),
    );
    fail(
      request.request_status === "PENDING",
      "Yêu cầu đã được xử lý. Hãy tải lại danh sách.",
      409,
    );
    const b = z
      .object({
        status: z.enum(["APPROVED", "REJECTED"]),
        review_note: z.string().trim().max(1000).optional(),
      })
      .parse(await body(req));
    const extras = [];
    if (b.status === "APPROVED") {
      fail(
        await one(
          c.db,
          "SELECT user_id FROM USERS WHERE user_id=? AND account_status='ACTIVE'",
          [request.user_id],
        ),
        "Tài khoản đang bị khóa.",
        409,
      );
      fail(
        !(await one(
          c.db,
          "SELECT club_member_id FROM CLUB_MEMBERS WHERE club_id=? AND user_id=?",
          [c.club, request.user_id],
        )),
        "Tài khoản đã có hồ sơ thành viên tại CLB.",
        409,
      );
      extras.push(
        stmt(
          c.db,
          "INSERT INTO CLUB_MEMBERS(club_id,user_id,member_code,join_date,member_status,created_at) VALUES (?,?,?,?,?,?)",
          [
            c.club,
            request.user_id,
            "JOIN-" + crypto.randomUUID().replaceAll("-", "").slice(0, 20),
            day(),
            "ACTIVE",
            now(),
          ],
        ),
      );
      const role = await one(
        c.db,
        "SELECT role_id FROM ROLES WHERE role_code='MEMBER'",
      );
      fail(role, "Chưa cấu hình vai trò thành viên.", 409);
      const grant = await one(
        c.db,
        "SELECT user_role_id FROM USER_ROLES WHERE club_id=? AND user_id=? AND role_id=?",
        [c.club, request.user_id, role!.role_id],
      );
      extras.push(
        grant
          ? stmt(
              c.db,
              "UPDATE USER_ROLES SET active_flag=1,assigned_by=?,assigned_at=? WHERE user_role_id=?",
              [c.user.user_id, now(), grant.user_role_id],
            )
          : stmt(
              c.db,
              "INSERT INTO USER_ROLES(user_id,role_id,club_id,assigned_by,assigned_at,active_flag) VALUES (?,?,?,?,?,1)",
              [request.user_id, role!.role_id, c.club, c.user.user_id, now()],
            ),
      );
    }
    await change(
      c,
      "CLUB_JOIN_REQUESTS",
      "request_id",
      request.request_id,
      {
        request_status: b.status,
        review_note: b.review_note || null,
        reviewed_by: c.user.user_id,
        reviewed_at: now(),
      },
      request,
      b.status === "APPROVED" ? "APPROVE_JOIN_CLUB" : "REJECT_JOIN_CLUB",
      extras,
    );
    return json({ ok: true });
  }
  return null;
}

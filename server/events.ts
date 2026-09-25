import { z } from "zod";
import {
  all,
  one,
  stmt,
  now,
  day,
  fail,
  permit,
  has,
  isStaff,
  json,
  body,
  str,
  datetime,
  idSchema,
  audit,
  change,
  insert,
  scoped,
  list,
  paging,
  member,
  csv,
  execute,
  createNotification,
  notifyClubRoles,
  notifyClubMembers,
  notifyConfirmedAttendees,
  type Context,
} from "./core";
const eventForm = z.object({
  event_name: str(200),
  event_type: str(100),
  scope: z.enum(["INTERNAL", "PUBLIC"]).default("PUBLIC"),
  location: str(255),
  start_at: datetime,
  end_at: datetime,
  registration_deadline: datetime,
  capacity: z
    .union([idSchema, z.null(), z.literal("")])
    .transform((v) => (v === "" ? null : v)),
  approval_required: z.coerce.number().int().min(0).max(1),
});
async function checkEvent(c: Context, event: any) {
  if (!event.event_id) {
    fail(
      event.start_at.slice(0, 10) >= day(),
      "Thời gian bắt đầu sự kiện phải từ ngày hôm nay trở đi.",
    );
  }
  fail(
    event.end_at > event.start_at,
    "Thời gian kết thúc phải sau thời gian bắt đầu.",
  );
  fail(
    event.registration_deadline <= event.start_at,
    "Hạn đăng ký phải trước hoặc bằng thời gian bắt đầu.",
  );
  if (event.event_id && event.capacity) {
    const n = await one(
      c.db,
      "SELECT COUNT(*) AS n FROM EVENT_REGISTRATIONS WHERE event_id=? AND registration_status='CONFIRMED'",
      [event.event_id],
    );
    fail(
      Number(n?.n) <= event.capacity,
      "Sức chứa không được nhỏ hơn số người đã xác nhận.",
    );
  }
}
async function capacity(c: Context, e: any) {
  if (e.capacity) {
    const n = await one(
      c.db,
      "SELECT COUNT(*) AS n FROM EVENT_REGISTRATIONS WHERE event_id=? AND registration_status='CONFIRMED'",
      [e.event_id],
    );
    fail(Number(n?.n) < Number(e.capacity), "Sự kiện đã đủ sức chứa.", 409);
  }
}
export async function eventsRoute(c: Context, path: string, req: Request) {
  if (
    path !== "events" &&
    !path.startsWith("events/") &&
    path !== "my-registrations"
  ) {
    return null;
  }
  const method = req.method,
    url = new URL(req.url);

  // Tự động chuyển các sự kiện đã công bố (OPEN hoặc CLOSED) sang ONGOING khi đến giờ bắt đầu
  await execute(
    c.db,
    "UPDATE EVENTS SET event_status='ONGOING', updated_at=? WHERE event_status IN ('OPEN', 'CLOSED') AND start_at <= ?",
    [now(), now()],
  );

  if (path === "events" && method === "GET") {
    const { q, status } = paging(url);
    const scope = url.searchParams.get("scope");
    const type = url.searchParams.get("type");
    const group = url.searchParams.get("group");

    let baseWhere = "";
    const pBase: any[] = [];
    if (c.club > 0) {
      if (isStaff(c)) {
        baseWhere =
          "(e.club_id=? OR (e.scope='PUBLIC' AND e.event_status<>'DRAFT'))";
      } else {
        baseWhere =
          "((e.club_id=? AND e.event_status<>'DRAFT') OR (e.scope='PUBLIC' AND e.event_status<>'DRAFT'))";
      }
      pBase.push(c.club);
    } else {
      baseWhere = "(e.scope='PUBLIC' AND e.event_status<>'DRAFT')";
    }

    const countsRow = await one(
      c.db,
      `SELECT 
        SUM(CASE WHEN e.event_status IN ('OPEN', 'ONGOING', 'CLOSED', 'DRAFT') THEN 1 ELSE 0 END) AS active_count,
        SUM(CASE WHEN e.event_status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed_count,
        SUM(CASE WHEN e.event_status = 'CANCELLED' THEN 1 ELSE 0 END) AS cancelled_count,
        COUNT(*) AS all_count
      FROM EVENTS e WHERE ${baseWhere}`,
      pBase,
    );

    let sql =
      "SELECT e.*, c_info.club_name, s.confirmed_count, s.pending_count, s.attended_count, s.attendance_rate_percent FROM EVENTS e JOIN CLUBS c_info ON c_info.club_id=e.club_id JOIN vw_event_statistics s ON s.event_id=e.event_id WHERE " +
      baseWhere;
    const p: any[] = [...pBase];
    sql += " AND e.event_name LIKE ?";
    p.push("%" + q + "%");

    if (group === "active") {
      sql += " AND e.event_status IN ('OPEN', 'ONGOING', 'CLOSED', 'DRAFT')";
    } else if (group === "completed") {
      sql += " AND e.event_status = 'COMPLETED'";
    } else if (group === "cancelled") {
      sql += " AND e.event_status = 'CANCELLED'";
    }

    if (status) {
      sql += " AND e.event_status=?";
      p.push(status);
    }
    if (type) {
      sql += " AND e.event_type=?";
      p.push(type);
    }
    if (scope) {
      sql += " AND e.scope=?";
      p.push(scope);
    }
    const result = await list(c, sql, p, "e.start_at DESC", url);
    return json({
      ...result,
      counts: {
        active: Number(countsRow?.active_count || 0),
        completed: Number(countsRow?.completed_count || 0),
        cancelled: Number(countsRow?.cancelled_count || 0),
        all: Number(countsRow?.all_count || 0),
      },
    });
  }
  if (path === "events" && method === "POST") {
    permit(c, "OFFICER", "LEADER");
    const b = eventForm.parse(await body(req));
    await checkEvent(c, b);
    const id = await insert(
      c,
      "EVENTS",
      {
        ...b,
        club_id: c.club,
        created_by: c.user.user_id,
        event_status: "DRAFT",
        attendance_locked: 0,
        created_at: now(),
      },
      "CREATE_EVENT",
    );
    return json({ event_id: id }, 201);
  }
  if (path === "my-registrations" && method === "GET") {
    const { q, status } = paging(url);
    let sql =
      "SELECT r.*,e.event_name,e.event_type,e.start_at,e.location,e.registration_deadline,e.event_status,a.attendance_status,c_info.club_name FROM EVENT_REGISTRATIONS r JOIN EVENTS e ON e.event_id=r.event_id JOIN CLUBS c_info ON c_info.club_id=e.club_id JOIN CLUB_MEMBERS m ON m.club_member_id=r.club_member_id LEFT JOIN ATTENDANCE a ON a.event_id=r.event_id AND a.club_member_id=r.club_member_id WHERE m.user_id=? AND e.event_name LIKE ?";
    const p: any[] = [c.user.user_id, "%" + q + "%"];
    if (status) {
      sql += " AND r.registration_status=?";
      p.push(status);
    }
    return json(await list(c, sql, p, "e.start_at DESC", url));
  }
  const match = path.match(
    /^events\/(\d+)(?:\/(action|registration|registrations|attendance|participants))?$/,
  );
  if (!match) return null;
  const eventId = Number(match[1]);
  const sub = match[2];

  const event = await one(
    c.db,
    "SELECT e.*, c_info.club_name FROM EVENTS e JOIN CLUBS c_info ON c_info.club_id=e.club_id WHERE e.event_id=?",
    [eventId],
  );
  fail(event, "Không tìm thấy sự kiện.", 404);

  // Sự kiện của CLB khác chỉ xem được nếu là PUBLIC và không phải DRAFT
  if (event.club_id !== c.club) {
    fail(
      event.scope === "PUBLIC" && event.event_status !== "DRAFT",
      "Không tìm thấy sự kiện trong câu lạc bộ này.",
      404,
    );
  }

  // Sự kiện trong CLB: thành viên không được xem DRAFT
  fail(
    isStaff(c) || event.club_id !== c.club || event.event_status !== "DRAFT",
    "Không tìm thấy sự kiện.",
    404,
  );

  if (!sub && method === "GET") {
    const me = await one(
      c.db,
      "SELECT * FROM CLUB_MEMBERS WHERE club_id=? AND user_id=?",
      [event.club_id, c.user.user_id],
    );
    return json({
      event,
      stats: await one(
        c.db,
        "SELECT * FROM vw_event_statistics WHERE event_id=?",
        [event.event_id],
      ),
      mine: me
        ? await one(
            c.db,
            "SELECT * FROM EVENT_REGISTRATIONS WHERE event_id=? AND club_member_id=?",
            [event.event_id, me.club_member_id],
          )
        : null,
      membership: me,
    });
  }
  if (!sub && method === "PATCH") {
    fail(
      event.club_id === c.club,
      "Bạn không có quyền chỉnh sửa sự kiện của câu lạc bộ khác.",
      403,
    );
    permit(c, "OFFICER", "LEADER");
    fail(
      !["COMPLETED", "CANCELLED"].includes(event.event_status),
      "Không thể sửa sự kiện đã hoàn tất hoặc hủy.",
    );
    const b = eventForm.parse(await body(req));
    await checkEvent(c, { ...b, event_id: event.event_id });
    await change(
      c,
      "EVENTS",
      "event_id",
      event.event_id,
      { ...b, updated_at: now() },
      event,
      "UPDATE_EVENT",
    );
    return json({ ok: true });
  }
  if (sub === "action" && method === "POST") {
    fail(
      event.club_id === c.club,
      "Bạn không có quyền điều hành sự kiện của câu lạc bộ khác.",
      403,
    );
    const b = z
      .object({
        action: z.enum([
          "publish",
          "close",
          "start",
          "complete",
          "cancel",
          "reopen",
          "unlock",
        ]),
        reason: z.string().trim().max(500).optional(),
      })
      .parse(await body(req));
    if (b.action === "publish") {
      fail(
        has(c, "LEADER"),
        "Chỉ Chủ nhiệm câu lạc bộ mới có quyền công bố sự kiện.",
        403,
      );
    } else if (["reopen", "unlock"].includes(b.action)) {
      permit(c, "LEADER");
    } else if (b.action === "cancel" && event.event_status === "ONGOING") {
      fail(
        has(c, "LEADER"),
        "Sự kiện đang diễn ra chỉ có Chủ nhiệm mới có quyền hủy.",
        403,
      );
    } else {
      permit(c, "OFFICER", "LEADER");
    }
    const transitions: any = {
      publish: { from: ["DRAFT"], to: "OPEN" },
      close: { from: ["OPEN"], to: "CLOSED" },
      start: { from: ["OPEN", "CLOSED"], to: "ONGOING" },
      complete: { from: ["ONGOING", "CLOSED"], to: "COMPLETED" },
      cancel: { from: ["DRAFT", "OPEN", "CLOSED", "ONGOING"], to: "CANCELLED" },
      reopen: { from: ["CLOSED"], to: "OPEN" },
      unlock: { from: ["COMPLETED"], to: "ONGOING" },
    };
    const t = transitions[b.action];
    fail(
      t.from.includes(event.event_status),
      "Trạng thái sự kiện không cho phép thao tác này.",
      409,
    );
    if (["cancel", "reopen", "unlock"].includes(b.action))
      fail(b.reason, "Vui lòng nhập lý do.");
    if (["publish", "reopen"].includes(b.action)) {
      await checkEvent(c, event);
      fail(
        event.registration_deadline >= now(),
        "Hạn đăng ký đã qua. Hãy cập nhật thời gian trước khi công bố.",
      );
    }
    if (["start", "complete"].includes(b.action))
      fail(event.start_at <= now(), "Sự kiện chưa đến thời gian bắt đầu.");
    if (b.action === "complete") {
      const missing = await one(
        c.db,
        "SELECT COUNT(*) AS n FROM EVENT_REGISTRATIONS r LEFT JOIN ATTENDANCE a ON a.event_id=r.event_id AND a.club_member_id=r.club_member_id WHERE r.event_id=? AND r.registration_status='CONFIRMED' AND a.attendance_id IS NULL",
        [event.event_id],
      );
      fail(
        Number(missing?.n) === 0,
        "Cần ghi nhận điểm danh cho toàn bộ người đã xác nhận trước khi khóa.",
      );
    }
    const fields: any = { event_status: t.to, updated_at: now() };
    if (b.action === "complete") fields.attendance_locked = 1;
    if (b.action === "unlock") fields.attendance_locked = 0;
    const extras = [];
    if (b.action === "cancel")
      extras.push(
        stmt(
          c.db,
          "UPDATE EVENT_REGISTRATIONS SET registration_status='CANCELLED',cancelled_at=? WHERE event_id=? AND registration_status IN ('PENDING','CONFIRMED')",
          [now(), event.event_id],
        ),
      );
    extras.push(
      audit(
        c,
        b.action.toUpperCase() + "_EVENT_REASON",
        "EVENTS",
        event.event_id,
        null,
        { reason: b.reason || null },
      ),
    );
    await change(
      c,
      "EVENTS",
      "event_id",
      event.event_id,
      fields,
      event,
      b.action.toUpperCase() + "_EVENT",
      extras,
    );
    if (b.action === "publish") {
      await notifyClubMembers(
        c.db,
        event.club_id,
        {
          title: `Sự kiện mới: ${event.event_name}`,
          content: `Câu lạc bộ vừa công bố sự kiện "${event.event_name}". Đăng ký tham gia ngay trước khi hết hạn!`,
          type: "EVENT",
          linkUrl: `events/${event.event_id}`,
        },
        c.user.user_id,
      );
    }
    if (b.action === "cancel") {
      await notifyConfirmedAttendees(c.db, event.event_id, event.club_id, {
        title: `Sự kiện đã bị hủy: ${event.event_name}`,
        content: `Sự kiện "${event.event_name}" đã bị hủy. Lý do: ${b.reason || "Không có lý do cụ thể"}`,
        type: "EVENT",
        linkUrl: `events/${event.event_id}`,
      });
    }
    return json({ ok: true });
  }
  if (sub === "registration" && method === "POST") {
    permit(c, "MEMBER", "LEADER", "OFFICER", "TREASURER");
    fail(
      c.user.account_status === "ACTIVE",
      "Tài khoản của bạn không trong trạng thái hoạt động.",
      403,
    );
    let m = await one(
      c.db,
      "SELECT * FROM CLUB_MEMBERS WHERE club_id=? AND user_id=?",
      [event.club_id, c.user.user_id],
    );
    if (!m) {
      fail(
        event.scope !== "INTERNAL",
        "Sự kiện này là sự kiện nội bộ, chỉ dành cho thành viên của câu lạc bộ.",
        403,
      );
      const code = c.user.student_code || `GUEST_${c.user.user_id}`;
      const existing = await one(
        c.db,
        "SELECT club_member_id FROM CLUB_MEMBERS WHERE club_id=? AND member_code=?",
        [event.club_id, code],
      );
      const finalCode = existing ? `${code}_${c.user.user_id}` : code;
      const id = await insert(
        c,
        "CLUB_MEMBERS",
        {
          club_id: event.club_id,
          user_id: c.user.user_id,
          member_code: finalCode,
          join_date: day(),
          member_status: "ACTIVE",
          department_name: "Khách tham gia",
          position_name: "Người tham dự",
          created_at: now(),
        },
        "REGISTER_EVENT_GUEST",
      );
      m = await one(c.db, "SELECT * FROM CLUB_MEMBERS WHERE club_member_id=?", [
        id,
      ]);
    }
    if (event.scope === "INTERNAL") {
      fail(
        m && m.department_name !== "Khách tham gia",
        "Sự kiện này là sự kiện nội bộ, chỉ dành cho thành viên của câu lạc bộ.",
        403,
      );
    }
    fail(
      m && m.member_status === "ACTIVE",
      "Chỉ thành viên đang sinh hoạt được đăng ký.",
      403,
    );
    const b = z
      .object({ action: z.enum(["register", "cancel"]) })
      .parse(await body(req));
    const old = await one(
      c.db,
      "SELECT * FROM EVENT_REGISTRATIONS WHERE event_id=? AND club_member_id=?",
      [event.event_id, m!.club_member_id],
    );
    if (
      b.action === "register" &&
      old &&
      ["PENDING", "CONFIRMED"].includes(old.registration_status)
    )
      return json(old);
    fail(event.event_status === "OPEN", "Sự kiện đã đóng đăng ký.");
    fail(
      event.registration_deadline >= now(),
      "Đã hết hạn đăng ký hoặc hủy đăng ký.",
    );
    if (b.action === "cancel") {
      fail(
        old && ["PENDING", "CONFIRMED"].includes(old.registration_status),
        "Không có đăng ký có thể hủy.",
      );
      await change(
        c,
        "EVENT_REGISTRATIONS",
        "registration_id",
        old!.registration_id,
        { registration_status: "CANCELLED", cancelled_at: now() },
        old!,
        "CANCEL_REGISTRATION",
      );
      return json({ ok: true });
    }
    if (!event.approval_required) await capacity(c, event);
    const status = event.approval_required ? "PENDING" : "CONFIRMED";
    const fields = {
      registration_status: status,
      registered_at: now(),
      reviewed_by: null,
      reviewed_at: null,
      cancelled_at: null,
    };
    if (old)
      await change(
        c,
        "EVENT_REGISTRATIONS",
        "registration_id",
        old.registration_id,
        fields,
        old,
        "REGISTER_EVENT",
      );
    else
      await insert(
        c,
        "EVENT_REGISTRATIONS",
        {
          ...fields,
          event_id: event.event_id,
          club_member_id: m!.club_member_id,
        },
        "REGISTER_EVENT",
      );
    if (event.approval_required) {
      await notifyClubRoles(c.db, event.club_id, ["LEADER", "OFFICER"], {
        title: "Đăng ký sự kiện cần duyệt",
        content: `${c.user.full_name} đã đăng ký tham gia sự kiện "${event.event_name}" và đang chờ duyệt.`,
        type: "EVENT",
        linkUrl: `events/${event.event_id}`,
      });
    }
    return json({ registration_status: status }, 201);
  }
  if (sub === "registrations" && method === "GET") {
    fail(isStaff(c), "Bạn không có quyền xem danh sách tham dự.", 403);
    fail(
      event.club_id === c.club,
      "Bạn không có quyền xem danh sách tham dự của câu lạc bộ khác.",
      403,
    );
    const { q, status } = paging(url);
    let sql =
      "SELECT r.*,u.full_name,u.student_code,cm.member_code,cm.department_name,a.attendance_status,a.recorded_at FROM EVENT_REGISTRATIONS r JOIN CLUB_MEMBERS cm ON cm.club_member_id=r.club_member_id JOIN USERS u ON u.user_id=cm.user_id LEFT JOIN ATTENDANCE a ON a.event_id=r.event_id AND a.club_member_id=r.club_member_id WHERE r.event_id=? AND cm.club_id=? AND (u.full_name LIKE ? OR cm.member_code LIKE ?)";
    const p: any[] = [
      event.event_id,
      event.club_id,
      "%" + q + "%",
      "%" + q + "%",
    ];
    if (status) {
      sql += " AND r.registration_status=?";
      p.push(status);
    }
    if (url.searchParams.get("export") === "csv")
      return csv(
        await all(c.db, sql, p),
        {
          member_code: "Mã thành viên",
          full_name: "Họ và tên",
          registration_status: "Đăng ký",
          attendance_status: "Điểm danh",
          recorded_at: "Thời điểm ghi nhận",
        },
        "danh-sach-tham-du",
      );
    return json(await list(c, sql, p, "r.registration_id", url));
  }
  if (sub === "registrations" && method === "PATCH") {
    fail(
      event.club_id === c.club,
      "Bạn không có quyền duyệt đăng ký sự kiện của câu lạc bộ khác.",
      403,
    );
    permit(c, "OFFICER", "LEADER");
    fail(
      !["COMPLETED", "CANCELLED"].includes(event.event_status),
      "Không thể duyệt đăng ký cho sự kiện đã hoàn tất hoặc bị hủy.",
      409,
    );
    const b = z
      .object({
        registration_id: idSchema,
        status: z.enum(["CONFIRMED", "REJECTED"]),
        reason: z.string().trim().max(500).optional(),
      })
      .parse(await body(req));
    if (b.status === "REJECTED") {
      fail(
        b.reason && b.reason.trim().length > 0,
        "Vui lòng nhập lý do từ chối đăng ký.",
        400,
      );
    }
    const old = await one(
      c.db,
      "SELECT r.*,cm.member_status,u.account_status,cm.user_id FROM EVENT_REGISTRATIONS r JOIN CLUB_MEMBERS cm ON cm.club_member_id=r.club_member_id JOIN USERS u ON u.user_id=cm.user_id WHERE r.registration_id=? AND r.event_id=? AND cm.club_id=?",
      [b.registration_id, event.event_id, event.club_id],
    );
    fail(old, "Không tìm thấy đăng ký.", 404);
    fail(
      old!.registration_status === "PENDING",
      "Chỉ được duyệt đăng ký đang chờ.",
      409,
    );
    if (b.status === "CONFIRMED") {
      fail(
        old!.member_status === "ACTIVE" && old!.account_status === "ACTIVE",
        "Thành viên hoặc tài khoản không còn hoạt động.",
      );
      await capacity(c, event);
    }
    await change(
      c,
      "EVENT_REGISTRATIONS",
      "registration_id",
      b.registration_id,
      {
        registration_status: b.status,
        reviewed_by: c.user.user_id,
        reviewed_at: now(),
      },
      old!,
      "REVIEW_REGISTRATION",
      [
        audit(
          c,
          "REVIEW_REASON",
          "EVENT_REGISTRATIONS",
          b.registration_id,
          null,
          { reason: b.reason || null },
        ),
      ],
    );
    await createNotification(c.db, {
      userId: old!.user_id,
      clubId: event.club_id,
      title: `Đăng ký sự kiện: ${b.status === "CONFIRMED" ? "Đã được phê duyệt" : "Bị từ chối"}`,
      content: `Đăng ký tham gia sự kiện "${event.event_name}" của bạn đã ${b.status === "CONFIRMED" ? "được xác nhận tham dự thành công." : "bị từ chối" + (b.reason ? `: ${b.reason}` : ".")}`,
      type: "EVENT",
      linkUrl: `events/${event.event_id}`,
    });
    return json({ ok: true });
  }
  if (sub === "participants" && method === "POST") {
    fail(
      event.club_id === c.club,
      "Bạn không có quyền bổ sung người tham dự cho câu lạc bộ khác.",
      403,
    );
    permit(c, "OFFICER", "LEADER");
    fail(
      ["CLOSED", "ONGOING"].includes(event.event_status) &&
        !event.attendance_locked,
      "Chỉ bổ sung vào sự kiện đã chốt/đang diễn ra và chưa khóa.",
    );
    const b = z
      .object({ club_member_id: idSchema, reason: str(500) })
      .parse(await body(req));
    const m = await scoped(
      c,
      "CLUB_MEMBERS",
      "club_member_id",
      b.club_member_id,
    );
    fail(m.member_status === "ACTIVE", "Thành viên không hoạt động.");
    await capacity(c, event);
    const old = await one(
      c.db,
      "SELECT * FROM EVENT_REGISTRATIONS WHERE event_id=? AND club_member_id=?",
      [event.event_id, b.club_member_id],
    );
    fail(!old, "Thành viên đã có đăng ký; hãy xử lý bản ghi hiện có.");
    await insert(
      c,
      "EVENT_REGISTRATIONS",
      {
        event_id: event.event_id,
        club_member_id: b.club_member_id,
        registration_status: "CONFIRMED",
        registered_at: now(),
        reviewed_by: c.user.user_id,
        reviewed_at: now(),
      },
      "ADD_PARTICIPANT",
      [audit(c, "ADD_PARTICIPANT_REASON", "EVENTS", event.event_id, null, b)],
    );
    return json({ ok: true }, 201);
  }
  if (sub === "attendance" && method === "PUT") {
    fail(
      event.club_id === c.club,
      "Bạn không có quyền điểm danh sự kiện của câu lạc bộ khác.",
      403,
    );
    permit(c, "OFFICER", "LEADER");
    fail(
      !event.attendance_locked,
      "Điểm danh đã khóa. Chủ nhiệm cần mở khóa trước.",
      409,
    );
    fail(
      ["ONGOING", "CLOSED"].includes(event.event_status) &&
        event.start_at <= now(),
      "Chỉ điểm danh sự kiện đã chốt và đến thời gian diễn ra.",
    );
    const b = z
      .object({
        records: z
          .array(
            z.object({
              club_member_id: idSchema,
              status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
            }),
          )
          .min(1)
          .max(100),
        reason: z.string().trim().max(500).optional(),
      })
      .parse(await body(req));
    fail(
      new Set(b.records.map((r) => r.club_member_id)).size === b.records.length,
      "Danh sách có thành viên trùng.",
    );
    const statements = [];
    const notifQueue: any[] = [];
    const statusLabels: Record<string, string> = {
      PRESENT: "Có mặt",
      LATE: "Đến muộn",
      ABSENT: "Vắng mặt",
      EXCUSED: "Có phép",
    };
    for (const row of b.records) {
      const reg = await one(
        c.db,
        "SELECT r.registration_id, cm.user_id FROM EVENT_REGISTRATIONS r JOIN CLUB_MEMBERS cm ON cm.club_member_id=r.club_member_id WHERE r.event_id=? AND r.club_member_id=? AND cm.club_id=? AND r.registration_status='CONFIRMED'",
        [event.event_id, row.club_member_id, event.club_id],
      );
      fail(reg, "Chỉ điểm danh thành viên đã được xác nhận.");
      if (reg?.user_id) {
        notifQueue.push({
          userId: reg.user_id,
          clubId: event.club_id,
          title: `Kết quả điểm danh: ${event.event_name}`,
          content: `Kết quả điểm danh của bạn tại sự kiện "${event.event_name}": ${statusLabels[row.status] || row.status}.`,
          type: "EVENT",
          linkUrl: `events/${event.event_id}`,
        });
      }
      const old = await one(
        c.db,
        "SELECT * FROM ATTENDANCE WHERE event_id=? AND club_member_id=?",
        [event.event_id, row.club_member_id],
      );
      const at = ["PRESENT", "LATE"].includes(row.status) ? now() : null;
      if (old) {
        fail(b.reason, "Vui lòng nhập lý do sửa kết quả điểm danh.");
        statements.push(
          stmt(
            c.db,
            "UPDATE ATTENDANCE SET attendance_status=?,check_in_at=?,recorded_by=?,recorded_at=? WHERE attendance_id=?",
            [row.status, at, c.user.user_id, now(), old.attendance_id],
          ),
        );
      } else
        statements.push(
          stmt(
            c.db,
            "INSERT INTO ATTENDANCE(event_id,club_member_id,registration_id,attendance_status,check_in_at,recorded_by,recorded_at) VALUES (?,?,?,?,?,?,?)",
            [
              event.event_id,
              row.club_member_id,
              reg!.registration_id,
              row.status,
              at,
              c.user.user_id,
              now(),
            ],
          ),
        );
      statements.push(
        audit(
          c,
          "RECORD_ATTENDANCE",
          "ATTENDANCE",
          old?.attendance_id || `${event.event_id}:${row.club_member_id}`,
          old,
          { ...row, reason: b.reason || null },
        ),
      );
    }
    await c.db.batch(statements);
    for (const notif of notifQueue) {
      await createNotification(c.db, notif);
    }
    return json({ ok: true });
  }
  return null;
}

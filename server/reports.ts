import {
  all,
  one,
  now,
  fail,
  has,
  isStaff,
  json,
  member,
  csv,
  date,
  type Context,
} from "./core";

/**
 * Không phụ thuộc vào vw_event_statistics để tránh lỗi khi view chưa được tạo
 * hoặc khác biệt giữa D1/SQLite và SQL Server.
 *
 * CTE dưới đây dùng cú pháp tương thích với cả SQLite/D1 và SQL Server.
 */
function eventStatisticsSql(where: string) {
  return `
    WITH RegAgg AS (
      SELECT
        event_id,
        COUNT(*) AS total_registrations,
        SUM(CASE WHEN registration_status='PENDING' THEN 1 ELSE 0 END) AS pending_count,
        SUM(CASE WHEN registration_status='CONFIRMED' THEN 1 ELSE 0 END) AS confirmed_count,
        SUM(CASE WHEN registration_status='REJECTED' THEN 1 ELSE 0 END) AS rejected_count,
        SUM(CASE WHEN registration_status='CANCELLED' THEN 1 ELSE 0 END) AS cancelled_count
      FROM EVENT_REGISTRATIONS
      GROUP BY event_id
    ),
    AttAgg AS (
      SELECT
        event_id,
        COUNT(*) AS attendance_record_count,
        SUM(CASE WHEN attendance_status IN ('PRESENT','LATE') THEN 1 ELSE 0 END) AS attended_count,
        SUM(CASE WHEN attendance_status='ABSENT' THEN 1 ELSE 0 END) AS absent_count,
        SUM(CASE WHEN attendance_status='EXCUSED' THEN 1 ELSE 0 END) AS excused_count
      FROM ATTENDANCE
      GROUP BY event_id
    )
    SELECT
      e.event_id,
      e.club_id,
      e.event_name,
      e.event_type,
      e.location,
      e.start_at,
      e.end_at,
      e.registration_deadline,
      e.approval_required,
      e.event_status,
      e.capacity,
      COALESCE(r.total_registrations,0) AS total_registrations,
      COALESCE(r.pending_count,0) AS pending_count,
      COALESCE(r.confirmed_count,0) AS confirmed_count,
      COALESCE(r.rejected_count,0) AS rejected_count,
      COALESCE(r.cancelled_count,0) AS cancelled_count,
      COALESCE(a.attendance_record_count,0) AS attendance_record_count,
      COALESCE(a.attended_count,0) AS attended_count,
      COALESCE(a.absent_count,0) AS absent_count,
      COALESCE(a.excused_count,0) AS excused_count,
      CASE
        WHEN COALESCE(r.confirmed_count,0)=0 THEN 0
        ELSE COALESCE(a.attended_count,0) * 100.0 / r.confirmed_count
      END AS attendance_rate_percent
    FROM EVENTS e
    LEFT JOIN RegAgg r ON r.event_id=e.event_id
    LEFT JOIN AttAgg a ON a.event_id=e.event_id
    WHERE ${where}
  `;
}

/**
 * Gom dữ liệu thu/chi theo tháng bằng TypeScript thay vì SUBSTR/SUBSTRING.
 * Điều này tránh lỗi SQL Server khi transaction_date có kiểu DATE.
 */
function groupFinanceByMonth(rows: any[]) {
  const grouped = new Map<string, { month: string; income: number; expense: number }>();

  for (const row of rows) {
    const month = String(row.transaction_date ?? "").slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) continue;

    const current = grouped.get(month) ?? {
      month,
      income: 0,
      expense: 0,
    };

    const amount = Number(row.amount || 0);
    if (row.transaction_type === "INCOME") current.income += amount;
    if (row.transaction_type === "EXPENSE") current.expense += amount;

    grouped.set(month, current);
  }

  return [...grouped.values()].sort((a, b) => a.month.localeCompare(b.month));
}

export async function reportsRoute(c: Context, path: string, req: Request) {
  if (!["dashboard", "reports"].includes(path) || req.method !== "GET") {
    return null;
  }

  const u = new URL(req.url);
  const from = u.searchParams.get("from") || "0001-01-01";
  const to = u.searchParams.get("to") || "9999-12-31";
  const type = u.searchParams.get("type") || "events";

  date.parse(from);
  date.parse(to);
  fail(from <= to, "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.");
  fail(
    ["events", "finance", "members"].includes(type),
    "Loại báo cáo không hợp lệ.",
  );
  fail(c.club > 0, "Vui lòng chọn câu lạc bộ để xem dữ liệu.", 400);

  // Thành viên thường chỉ xem dữ liệu cá nhân.
  if (!isStaff(c)) {
    const m = await member(c);

    const rows = await all(
      c.db,
      `SELECT
         r.*,
         e.event_name,
         e.start_at,
         e.event_status,
         a.attendance_status
       FROM EVENT_REGISTRATIONS r
       JOIN EVENTS e ON e.event_id=r.event_id
       LEFT JOIN ATTENDANCE a
         ON a.event_id=r.event_id
        AND a.club_member_id=r.club_member_id
       WHERE r.club_member_id=?
         AND e.club_id=?
         AND e.start_at>=?
         AND e.start_at<=?
       ORDER BY e.start_at DESC`,
      [m.club_member_id, c.club, from, to + "T23:59:59"],
    );

    const income = await all(
      c.db,
      `SELECT
         t.transaction_id,
         t.description,
         t.amount,
         t.transaction_date,
         t.transaction_status
       FROM FINANCIAL_TRANSACTIONS t
       WHERE t.related_member_id=?
         AND t.club_id=?
         AND t.transaction_type='INCOME'
         AND t.transaction_status='POSTED'
         AND t.transaction_date>=?
         AND t.transaction_date<=?
       ORDER BY t.transaction_date DESC, t.transaction_id DESC`,
      [m.club_member_id, c.club, from, to],
    );

    if (u.searchParams.get("export") === "csv") {
      return csv(
        rows,
        {
          event_name: "Sự kiện",
          start_at: "Thời gian",
          registration_status: "Đăng ký",
          attendance_status: "Điểm danh",
        },
        "lich-su-ca-nhan",
      );
    }

    const personalEvents = await all(
      c.db,
      eventStatisticsSql("e.club_id=? AND e.event_status='OPEN'") +
        " ORDER BY e.start_at DESC LIMIT 4",
      [c.club],
    );

    return json({
      personal: true,
      rows,
      income,
      membership: m,
      stats: {
        registrations: rows.length,
        confirmed: rows.filter((r) => r.registration_status === "CONFIRMED")
          .length,
        attended: rows.filter((r) =>
          ["PRESENT", "LATE"].includes(r.attendance_status),
        ).length,
      },
      events: personalEvents,
    });
  }

  const finance = c.admin || has(c, "LEADER", "TREASURER");
  const operations = c.admin || has(c, "LEADER", "OFFICER");

  if (path === "reports") {
    if (type === "finance") {
      fail(finance, "Bạn không có quyền xuất báo cáo tài chính.", 403);
    } else {
      fail(operations, "Bạn không có quyền xuất báo cáo nghiệp vụ.", 403);
    }
  }

  const memberFrom =
    path === "reports" && type === "members" ? from : "0001-01-01";
  const memberTo =
    path === "reports" && type === "members" ? to : "9999-12-31";

  const counts = await one(
    c.db,
    `SELECT
       COUNT(*) AS total,
       COALESCE(SUM(CASE WHEN member_status='ACTIVE' THEN 1 ELSE 0 END),0) AS active,
       COALESCE(SUM(CASE WHEN member_status='PAUSED' THEN 1 ELSE 0 END),0) AS paused,
       COALESCE(SUM(CASE WHEN member_status='LEFT' THEN 1 ELSE 0 END),0) AS departed
     FROM CLUB_MEMBERS
     WHERE club_id=?
       AND join_date>=?
       AND join_date<=?`,
    [c.club, memberFrom, memberTo],
  );

  let eventWhere = "e.club_id=? AND e.start_at>=? AND e.start_at<=?";
  const eventParams: any[] = [c.club, from, to + "T23:59:59"];

  const eventId = u.searchParams.get("event");
  if (eventId) {
    const parsedEventId = Number(eventId);
    fail(
      Number.isInteger(parsedEventId) && parsedEventId > 0,
      "Sự kiện không hợp lệ.",
    );
    eventWhere += " AND e.event_id=?";
    eventParams.push(parsedEventId);
  }

  const status = u.searchParams.get("status");
  if (status) {
    eventWhere += " AND e.event_status=?";
    eventParams.push(status);
  }

  const events = await all(
    c.db,
    eventStatisticsSql(eventWhere) + " ORDER BY e.start_at DESC",
    eventParams,
  );

  let fund: any = null;
  let monthly: any[] = [];
  let pending: any[] = [];

  if (finance) {
    fund = await one(
      c.db,
      `SELECT
         COALESCE(SUM(CASE WHEN transaction_type='INCOME' THEN amount ELSE 0 END),0) AS total_income,
         COALESCE(SUM(CASE WHEN transaction_type='EXPENSE' THEN amount ELSE 0 END),0) AS total_expense,
         COALESCE(SUM(CASE WHEN transaction_type='INCOME' THEN amount ELSE -amount END),0) AS balance
       FROM FINANCIAL_TRANSACTIONS
       WHERE club_id=?
         AND transaction_status='POSTED'
         AND transaction_date>=?
         AND transaction_date<=?`,
      [c.club, from, to],
    );

    // Không dùng SUBSTR/SUBSTRING trên DATE để tránh khác biệt SQL dialect.
    const postedTransactions = await all(
      c.db,
      `SELECT transaction_date, transaction_type, amount
       FROM FINANCIAL_TRANSACTIONS
       WHERE club_id=?
         AND transaction_status='POSTED'
         AND transaction_date>=?
         AND transaction_date<=?
       ORDER BY transaction_date ASC, transaction_id ASC`,
      [c.club, from, to],
    );
    monthly = groupFinanceByMonth(postedTransactions);

    pending = await all(
      c.db,
      `SELECT
         t.*,
         cat.category_name,
         u.full_name AS creator_name
       FROM FINANCIAL_TRANSACTIONS t
       JOIN FINANCE_CATEGORIES cat ON cat.category_id=t.category_id
       JOIN USERS u ON u.user_id=t.created_by
       WHERE t.club_id=?
         AND t.transaction_status='PENDING_APPROVAL'
       ORDER BY t.created_at DESC, t.transaction_id DESC`,
      [c.club],
    );
  }

  const departmentRows = await all(
    c.db,
    `SELECT department_name AS name, COUNT(*) AS value
     FROM CLUB_MEMBERS
     WHERE club_id=?
       AND member_status='ACTIVE'
       AND join_date>=?
       AND join_date<=?
     GROUP BY department_name
     ORDER BY COUNT(*) DESC`,
    [c.club, memberFrom, memberTo],
  );

  const departments = departmentRows.map((row) => ({
    ...row,
    name: row.name || "Chưa phân ban",
  }));

  const recentMembers = await all(
    c.db,
    `SELECT
       cm.member_code,
       cm.join_date,
       cm.department_name,
       u.full_name
     FROM CLUB_MEMBERS cm
     JOIN USERS u ON u.user_id=cm.user_id
     WHERE cm.club_id=?
     ORDER BY cm.created_at DESC, cm.club_member_id DESC
     LIMIT 4`,
    [c.club],
  );

  const activity =
    c.admin || has(c, "LEADER")
      ? await all(
          c.db,
          `SELECT a.*, u.full_name
           FROM AUDIT_LOGS a
           LEFT JOIN USERS u ON u.user_id=a.user_id
           WHERE a.club_id=?
           ORDER BY a.created_at DESC, a.audit_id DESC
           LIMIT 5`,
          [c.club],
        )
      : [];

  if (u.searchParams.get("export") === "csv") {
    if (type === "finance") {
      return csv(
        monthly,
        { month: "Tháng", income: "Tổng thu", expense: "Tổng chi" },
        "bao-cao-tai-chinh",
      );
    }

    if (type === "members") {
      return csv(
        departments,
        { name: "Ban / nhóm", value: "Thành viên đang sinh hoạt" },
        "bao-cao-thanh-vien",
      );
    }

    return csv(
      events,
      {
        event_name: "Sự kiện",
        start_at: "Bắt đầu",
        event_status: "Trạng thái",
        total_registrations: "Đăng ký",
        confirmed_count: "Xác nhận",
        attended_count: "Tham dự",
        absent_count: "Vắng",
        attendance_rate_percent: "Tỷ lệ tham dự (%)",
      },
      "bao-cao-su-kien",
    );
  }

  const closed = events.filter((e) => e.event_status === "COMPLETED");
  const confirmed = closed.reduce(
    (total, event) => total + Number(event.confirmed_count || 0),
    0,
  );
  const attended = closed.reduce(
    (total, event) => total + Number(event.attended_count || 0),
    0,
  );

  return json({
    counts: counts || {
      total: 0,
      active: 0,
      paused: 0,
      departed: 0,
    },
    events,
    fund,
    monthly,
    pending,
    departments,
    recentMembers,
    activity,
    stats: {
      events: events.length,
      open: events.filter((e) => e.event_status === "OPEN").length,
      registrations: events.reduce(
        (total, event) => total + Number(event.total_registrations || 0),
        0,
      ),
      pending: events.reduce(
        (total, event) => total + Number(event.pending_count || 0),
        0,
      ),
      attendance: confirmed ? Math.round((attended / confirmed) * 100) : 0,
    },
    as_of: now(),
  });
}

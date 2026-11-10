import { z } from "zod";
import {
  all,
  one,
  stmt,
  now,
  fail,
  permit,
  readPermit,
  has,
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
  csv,
  createNotification,
  notifyClubRoles,
  type Context,
} from "./core";
const transactionForm = z.object({
  transaction_type: z.enum(["INCOME", "EXPENSE"]),
  category_id: idSchema,
  event_id: idSchema.nullable().optional().default(null),
  related_member_id: idSchema.nullable().optional().default(null),
  replaces_transaction_id: idSchema.nullable().optional().default(null),
  amount: z.coerce
    .number()
    .positive("Số tiền phải lớn hơn 0.")
    .max(9999999999999.99)
    .refine(
      (v) => Math.abs(v * 100 - Math.round(v * 100)) < 0.01,
      "Số tiền có tối đa hai chữ số thập phân.",
    ),
  transaction_date: date,
  description: str(500),
  evidence_url: opt(500),
});
async function validate(c: Context, b: any) {
  const cat = await scoped(
    c,
    "FINANCE_CATEGORIES",
    "category_id",
    b.category_id,
  );
  fail(
    cat.active_flag && cat.category_type === b.transaction_type,
    "Hạng mục không hoạt động hoặc không khớp loại thu/chi.",
  );
  if (b.event_id) await scoped(c, "EVENTS", "event_id", b.event_id);
  if (b.related_member_id)
    await scoped(c, "CLUB_MEMBERS", "club_member_id", b.related_member_id);
  if (b.replaces_transaction_id) {
    const rep = await scoped(
      c,
      "FINANCIAL_TRANSACTIONS",
      "transaction_id",
      b.replaces_transaction_id,
    );
    fail(
      rep.transaction_status === "CANCELLED",
      "Chỉ được lập giao dịch điều chỉnh thay thế cho giao dịch đã bị hủy.",
    );
  }
  if (b.evidence_url)
    fail(
      /^https:\/\//.test(b.evidence_url) ||
        b.evidence_url.startsWith(`/api/evidence/${c.club}/`),
      "Chứng từ cần là liên kết HTTPS hoặc tệp được tải lên đúng CLB.",
    );
}
export async function financeRoute(c: Context, path: string, req: Request) {
  const method = req.method,
    url = new URL(req.url);
  if (path === "categories" && method === "GET") {
    readPermit(c, "LEADER", "OFFICER", "TREASURER");
    return json({
      rows: await all(
        c.db,
        "SELECT * FROM FINANCE_CATEGORIES WHERE club_id=? ORDER BY category_type,category_name",
        [c.club],
      ),
    });
  }
  if (path === "categories" && method === "POST") {
    permit(c, "TREASURER");
    const b = z
      .object({
        category_type: z.enum(["INCOME", "EXPENSE"]),
        category_name: str(150),
      })
      .parse(await body(req));
    return json(
      {
        category_id: await insert(c, "FINANCE_CATEGORIES", {
          ...b,
          club_id: c.club,
          active_flag: 1,
        }),
      },
      201,
    );
  }
  const cat = path.match(/^categories\/(\d+)$/);
  if (cat && method === "PATCH") {
    permit(c, "TREASURER");
    const old = await scoped(
      c,
      "FINANCE_CATEGORIES",
      "category_id",
      Number(cat[1]),
    );
    const b = z
      .object({
        category_name: str(150),
        active_flag: z.coerce.number().int().min(0).max(1),
      })
      .parse(await body(req));
    await change(
      c,
      "FINANCE_CATEGORIES",
      "category_id",
      old.category_id,
      b,
      old,
      "UPDATE_CATEGORY",
    );
    return json({ ok: true });
  }
  if (path === "finance" && method === "GET") {
    readPermit(c, "LEADER", "OFFICER", "TREASURER");
    const { q, status } = paging(url);
    let sql =
      "SELECT t.*,cat.category_name,e.event_name,COALESCE(e.planned_budget,0) AS event_planned_budget,u.full_name AS creator_name,ap.full_name AS approver_name FROM FINANCIAL_TRANSACTIONS t JOIN FINANCE_CATEGORIES cat ON cat.category_id=t.category_id JOIN USERS u ON u.user_id=t.created_by LEFT JOIN USERS ap ON ap.user_id=t.approved_by LEFT JOIN EVENTS e ON e.event_id=t.event_id WHERE t.club_id=? AND t.description LIKE ?";
    const p: any[] = [c.club, "%" + q + "%"];
    for (const [param, col] of [
      ["status", "transaction_status"],
      ["type", "transaction_type"],
      ["from", "transaction_date"],
      ["to", "transaction_date"],
      ["event", "event_id"],
      ["category", "category_id"],
    ]) {
      const value = url.searchParams.get(param);
      if (value) {
        sql += ` AND t.${col}${param === "from" ? ">=" : param === "to" ? "<=" : "="}?`;
        p.push(value);
      }
    }
    if (url.searchParams.get("export") === "csv")
      return csv(
        await all(c.db, sql + " ORDER BY t.transaction_date", p),
        {
          transaction_id: "Mã",
          transaction_date: "Ngày",
          description: "Nội dung",
          transaction_type: "Loại",
          category_name: "Hạng mục",
          amount: "Số tiền",
          transaction_status: "Trạng thái",
          creator_name: "Người tạo",
          approver_name: "Người duyệt",
        },
        "so-quy",
      );
    return json(
      await list(
        c,
        sql,
        p,
        "t.transaction_date DESC,t.transaction_id DESC",
        url,
      ),
    );
  }
  if (path === "finance" && method === "POST") {
    permit(c, "TREASURER");
    const b = transactionForm.parse(await body(req));
    await validate(c, b);
    return json(
      {
        transaction_id: await insert(
          c,
          "FINANCIAL_TRANSACTIONS",
          {
            ...b,
            club_id: c.club,
            created_by: c.user.user_id,
            transaction_status: "DRAFT",
            created_at: now(),
          },
          "CREATE_TRANSACTION",
        ),
      },
      201,
    );
  }
  const evidenceMatch = path.match(/^finance\/(\d+)\/evidence$/);
  if (evidenceMatch && method === "PATCH") {
    permit(c, "TREASURER");
    const old = await scoped(
      c,
      "FINANCIAL_TRANSACTIONS",
      "transaction_id",
      Number(evidenceMatch[1]),
    );
    fail(
      ["DRAFT", "REJECTED", "APPROVED"].includes(old.transaction_status),
      "Không thể đổi chứng từ của giao dịch đã ghi sổ hoặc đang chờ duyệt.",
    );
    const b = z.object({ evidence_url: str(500) }).parse(await body(req));
    await validate(c, { ...old, ...b });
    await change(
      c,
      "FINANCIAL_TRANSACTIONS",
      "transaction_id",
      old.transaction_id,
      b,
      old,
      "ATTACH_EVIDENCE",
    );
    return json({ ok: true });
  }
  const m = path.match(/^finance\/(\d+)(?:\/(action))?$/);
  if (!m) return null;
  readPermit(c, "LEADER", "OFFICER", "TREASURER");
  const old = await scoped(
    c,
    "FINANCIAL_TRANSACTIONS",
    "transaction_id",
    Number(m[1]),
  );
  if (method === "GET") {
    let event_budget: any = null;
    if (old.event_id) {
      const ev = await one(
        c.db,
        `SELECT e.event_id, e.event_name, e.event_status, COALESCE(e.planned_budget, 0) AS planned_budget,
                COALESCE(SUM(CASE WHEN t.transaction_type='EXPENSE' AND t.transaction_status='POSTED' THEN t.amount ELSE 0 END), 0) AS actual_expense,
                COALESCE(SUM(CASE WHEN t.transaction_type='EXPENSE' AND t.transaction_status IN ('PENDING_APPROVAL','APPROVED') AND t.transaction_id<>? THEN t.amount ELSE 0 END), 0) AS other_pending_expense,
                COALESCE(SUM(CASE WHEN t.transaction_type='INCOME' AND t.transaction_status='POSTED' THEN t.amount ELSE 0 END), 0) AS actual_income
         FROM EVENTS e
         LEFT JOIN FINANCIAL_TRANSACTIONS t ON t.event_id=e.event_id
         WHERE e.event_id=?
         GROUP BY e.event_id, e.event_name, e.event_status, e.planned_budget`,
        [old.transaction_id, old.event_id],
      );
      if (ev) {
        const planned = Number(ev.planned_budget || 0);
        const actual = Number(ev.actual_expense || 0);
        const otherPending = Number(ev.other_pending_expense || 0);
        const thisExpense =
          old.transaction_type === "EXPENSE" &&
          !["POSTED", "REJECTED", "CANCELLED"].includes(old.transaction_status)
            ? Number(old.amount || 0)
            : 0;
        const projected = actual + otherPending + thisExpense;
        event_budget = {
          event_id: ev.event_id,
          event_name: ev.event_name,
          event_status: ev.event_status,
          planned_budget: planned,
          actual_expense: actual,
          other_pending_expense: otherPending,
          projected_expense: projected,
          actual_income: Number(ev.actual_income || 0),
          deficit_amount: Math.max(0, actual - planned),
          projected_deficit: Math.max(0, projected - planned),
          is_over_budget: projected > planned,
        };
      }
    }
    let replaces_transaction: any = null;
    if (old.replaces_transaction_id) {
      replaces_transaction = await one(
        c.db,
        "SELECT transaction_id, description, amount, transaction_type, transaction_date FROM FINANCIAL_TRANSACTIONS WHERE transaction_id=? AND club_id=?",
        [old.replaces_transaction_id, c.club],
      );
    }
    const replaced_by = await all(
      c.db,
      "SELECT transaction_id, description, amount, transaction_status, transaction_date FROM FINANCIAL_TRANSACTIONS WHERE replaces_transaction_id=? AND club_id=? ORDER BY transaction_id DESC",
      [old.transaction_id, c.club],
    );
    let cancellation_reason: string | null = null;
    if (old.transaction_status === "CANCELLED") {
      const logRow = await one(
        c.db,
        "SELECT new_value FROM AUDIT_LOGS WHERE entity_name='FINANCIAL_TRANSACTIONS' AND entity_id=? AND action_code='TRANSACTION_REASON' ORDER BY audit_id DESC LIMIT 1",
        [String(old.transaction_id)],
      );
      if (logRow?.new_value) {
        try {
          cancellation_reason = JSON.parse(logRow.new_value).reason || null;
        } catch {}
      }
    }
    return json({
      ...old,
      event_budget,
      replaces_transaction,
      replaced_by,
      cancellation_reason,
    });
  }
  if (!m[2] && method === "PATCH") {
    permit(c, "TREASURER");
    fail(
      ["DRAFT", "REJECTED"].includes(old.transaction_status),
      "Chỉ được sửa bản nháp hoặc khoản bị từ chối.",
    );
    const b = transactionForm.parse(await body(req));
    await validate(c, b);
    await change(
      c,
      "FINANCIAL_TRANSACTIONS",
      "transaction_id",
      old.transaction_id,
      {
        ...b,
        transaction_status: "DRAFT",
        approved_by: null,
        approved_at: null,
        rejection_reason: null,
      },
      old,
      "EDIT_TRANSACTION",
    );
    return json({ ok: true });
  }
  if (m[2] && method === "POST") {
    const b = z
      .object({
        action: z.enum(["submit", "approve", "reject", "post", "cancel"]),
        reason: opt(500),
      })
      .parse(await body(req));
    const fields: any = {};
    if (["approve", "reject"].includes(b.action)) {
      permit(c, "LEADER");
      fail(
        old.transaction_type === "EXPENSE" &&
          old.transaction_status === "PENDING_APPROVAL",
        "Khoản chi không ở trạng thái chờ duyệt.",
        409,
      );
      fail(
        old.created_by !== c.user.user_id,
        "Người tạo không được tự phê duyệt khoản chi của mình.",
        403,
      );
      if (b.action === "reject") fail(b.reason, "Vui lòng nhập lý do từ chối.");
      Object.assign(fields, {
        transaction_status: b.action === "approve" ? "APPROVED" : "REJECTED",
        approved_by: c.user.user_id,
        approved_at: now(),
        rejection_reason: b.action === "reject" ? b.reason : null,
      });
    }
    if (b.action === "submit") {
      permit(c, "TREASURER");
      fail(
        old.transaction_type === "EXPENSE" &&
          old.transaction_status === "DRAFT",
        "Chỉ gửi duyệt đề nghị chi ở trạng thái nháp.",
      );
      fields.transaction_status = "PENDING_APPROVAL";
    }
    if (b.action === "post") {
      permit(c, "TREASURER");
      fail(
        (old.transaction_type === "INCOME" &&
          old.transaction_status === "DRAFT") ||
          (old.transaction_type === "EXPENSE" &&
            old.transaction_status === "APPROVED" &&
            old.approved_by &&
            old.approved_by !== old.created_by),
        "Khoản chi phải được người khác phê duyệt trước khi ghi sổ.",
      );
      await validate(c, old);
      if (old.transaction_type === "EXPENSE")
        fail(
          old.evidence_url,
          "Vui lòng bổ sung chứng từ trước khi ghi sổ khoản chi.",
        );
      fields.transaction_status = "POSTED";
    }
    if (b.action === "cancel") {
      if (old.transaction_status === "POSTED") permit(c, "LEADER");
      else permit(c, "TREASURER", "LEADER");
      fail(old.transaction_status !== "CANCELLED", "Giao dịch đã hủy.");
      fail(b.reason, "Vui lòng nhập lý do hủy giao dịch.");
      fields.transaction_status = "CANCELLED";
    }
    await change(
      c,
      "FINANCIAL_TRANSACTIONS",
      "transaction_id",
      old.transaction_id,
      fields,
      old,
      b.action.toUpperCase() + "_TRANSACTION",
      [
        audit(
          c,
          "TRANSACTION_REASON",
          "FINANCIAL_TRANSACTIONS",
          old.transaction_id,
          null,
          { reason: b.reason || null },
        ),
      ],
    );
    if (b.action === "submit") {
      await notifyClubRoles(c.db, c.club, ["LEADER"], {
        title: `Đề nghị duyệt chi: #${old.transaction_id}`,
        content: `Thủ quỹ ${c.user.full_name} đã gửi đề nghị phê duyệt chi cho khoản "${old.description}" (${Number(old.amount).toLocaleString("vi-VN")} đ).`,
        type: "FINANCE",
        linkUrl: "finance",
      });
    }
    if (["approve", "reject"].includes(b.action)) {
      await createNotification(c.db, {
        userId: old.created_by,
        clubId: c.club,
        title: `Đề xuất chi tiêu #${old.transaction_id}: ${b.action === "approve" ? "Đã được phê duyệt" : "Bị từ chối"}`,
        content: `Khoản chi "${old.description}" (${Number(old.amount).toLocaleString("vi-VN")} đ) đã ${b.action === "approve" ? "được Chủ nhiệm phê duyệt." : "bị từ chối" + (b.reason ? `: ${b.reason}` : ".")}`,
        type: "FINANCE",
        linkUrl: "finance",
      });
    }
    if (b.action === "cancel" && old.created_by !== c.user.user_id) {
      await createNotification(c.db, {
        userId: old.created_by,
        clubId: c.club,
        title: `Giao dịch #${old.transaction_id} đã bị hủy`,
        content: `Giao dịch "${old.description}" (${Number(old.amount).toLocaleString("vi-VN")} đ) đã bị hủy${b.reason ? `: ${b.reason}` : ""}. Bạn có thể lập bút toán điều chỉnh thay thế nếu cần.`,
        type: "FINANCE",
        linkUrl: "finance",
      });
    }
    return json({ ok: true });
  }
  return null;
}

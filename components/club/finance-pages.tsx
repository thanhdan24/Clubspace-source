"use client";
import { useState, useEffect } from "react";
import {
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  Clock,
  ReceiptText,
  Paperclip,
  Pencil,
  Download,
  Upload,
  FileText,
  Check,
  Users,
  CalendarDays,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  useApp,
  useResource,
  LoadState,
  PageTitle,
  Filters,
  useFilters,
  DataTable,
  Editor,
  Confirm,
  ExportButton,
  Badge,
  SelectBox,
  opts,
  labels,
  dateText,
  localNow,
  num,
  money,
  SectionHeader,
  EmptyState,
  Metric,
  fetchApi,
  apiUrl,
  type Row,
  type Field,
} from "./shared";
import { MoneyBars } from "./dashboard";
const transactionStatuses = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "POSTED",
  "CANCELLED",
];
function EvidenceInput({ value, onChange }: any) {
  const { club } = useApp(),
    [busy, setBusy] = useState(false);
  return (
    <div className="evidence-upload">
      <label className="upload-button">
        <Upload size={18} />
        {busy ? "Đang tải lên…" : "Đính kèm chứng từ"}
        <input
          type="file"
          disabled={busy}
          accept="application/pdf,image/png,image/jpeg"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setBusy(true);
            try {
              const form = new FormData();
              form.set("file", f);
              const r = await fetchApi("evidence", club, {
                method: "POST",
                body: form,
              });
              onChange(r.evidence_url);
              toast.success(
                "Đã tải chứng từ lên. Nhấn Lưu để gắn vào giao dịch.",
              );
            } catch (err: any) {
              toast.error(err.message);
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      <small>PDF, PNG, JPG · Tối đa 10 MB</small>
      {value && (
        <span className="uploaded-file">
          <Paperclip size={14} />
          {value.split("/").pop()}
        </span>
      )}
    </div>
  );
}
function TransactionEditor({ transaction = {}, onClose }: any) {
  const { mutate } = useApp(),
    options = useResource("options"),
    [type, setType] = useState(transaction.transaction_type || "EXPENSE");
  const categories = (options.data?.categories || []).filter(
    (c: Row) => c.category_type === type && c.active_flag,
  );
  const fields: Field[] = [
    {
      name: "transaction_type",
      label: "Loại giao dịch",
      type: "select",
      required: true,
      options: opts(["INCOME", "EXPENSE"]),
    },
    {
      name: "category_id",
      label: "Hạng mục",
      type: "select",
      required: true,
      options: [
        { value: "", label: "Chọn hạng mục" },
        ...(options.data?.categories || [])
          .filter((c: Row) => c.active_flag)
          .map((c: Row) => ({
            value: c.category_id,
            label:
              (c.category_type === "INCOME" ? "Thu · " : "Chi · ") +
              c.category_name,
          })),
      ],
    },
    {
      name: "amount",
      label: "Số tiền (VND)",
      type: "number",
      required: true,
      min: 0.01,
      max: 9999999999999.99,
    },
    {
      name: "transaction_date",
      label: "Ngày giao dịch",
      type: "date",
      required: true,
    },
    {
      name: "description",
      label: "Nội dung / nguồn tiền",
      type: "textarea",
      required: true,
      wide: true,
      maxLength: 500,
    },
    {
      name: "event_id",
      label: "Sự kiện liên quan",
      type: "select",
      options: [
        { value: "", label: "Không gắn sự kiện" },
        ...(options.data?.events || []).map((e: Row) => ({
          value: e.event_id,
          label: e.event_name,
        })),
      ],
    },
    {
      name: "related_member_id",
      label: "Người nộp / thành viên liên quan",
      type: "select",
      options: [
        { value: "", label: "Không gắn thành viên" },
        ...(options.data?.members || []).map((m: Row) => ({
          value: m.club_member_id,
          label: m.full_name,
        })),
      ],
    },
    {
      name: "evidence_url",
      label: "Liên kết chứng từ (nếu có)",
      type: "text",
      wide: true,
      placeholder: "https://…",
      help: "Hoặc tải tệp bên dưới.",
    },
  ];
  return (
    <Editor
      title={
        transaction.transaction_id
          ? "Cập nhật giao dịch"
          : "Lập khoản thu / chi"
      }
      initial={{
        transaction_type: "EXPENSE",
        transaction_date: localNow().slice(0, 10),
        ...transaction,
      }}
      fields={fields}
      onClose={onClose}
      extra={(v: Row, set: any) => (
        <EvidenceInput
          value={v.evidence_url}
          onChange={(url: string) => set({ evidence_url: url })}
        />
      )}
      onSave={(v: Row) => {
        const cat = (options.data?.categories || []).find(
          (c: Row) => String(c.category_id) === String(v.category_id),
        );
        if (cat?.category_type !== v.transaction_type)
          throw new Error("Hạng mục phải khớp loại thu / chi đã chọn.");
        return mutate(
          transaction.transaction_id
            ? "finance/" + transaction.transaction_id
            : "finance",
          {
            ...v,
            event_id: v.event_id ? Number(v.event_id) : null,
            related_member_id: v.related_member_id
              ? Number(v.related_member_id)
              : null,
            evidence_url: v.evidence_url || null,
          },
          transaction.transaction_id ? "PATCH" : "POST",
        );
      }}
    />
  );
}
function TransactionDetail({ row, onClose, onEdit }: any) {
  const { can, mutate, club, session } = useApp(),
    [confirm, setConfirm] = useState<Row | null>(null),
    [evidence, setEvidence] = useState(false);
  const r = useResource("finance/" + row.transaction_id),
    t = r.data;
  return (
    <>
      <Sheet open onOpenChange={(v) => !v && onClose()}>
        <SheetContent className="detail-sheet">
          <SheetHeader>
            <SheetTitle>
              Giao dịch #{String(row.transaction_id).padStart(4, "0")}
            </SheetTitle>
            <SheetDescription>{row.category_name}</SheetDescription>
          </SheetHeader>
          <div className="sheet-body">
            <LoadState {...r} variant="detail">
              {t && (
                <>
                  <div
                    className={
                      "transaction-amount " +
                      (t.transaction_type === "INCOME" ? "positive" : "")
                    }
                  >
                    <span>{labels[t.transaction_type]}</span>
                    <strong>
                      {t.transaction_type === "INCOME" ? "+" : "−"}
                      {money(t.amount)}
                    </strong>
                    <Badge value={t.transaction_status} />
                  </div>
                  <h3 className="transaction-description">{t.description}</h3>
                  <dl className="details-list">
                    {[
                      ["Ngày giao dịch", dateText(t.transaction_date)],
                      ["Hạng mục", row.category_name],
                      ["Sự kiện", row.event_name || "Không gắn sự kiện"],
                      ["Người lập", row.creator_name],
                      ["Người duyệt", row.approver_name],
                      ["Thời điểm duyệt", dateText(t.approved_at, true)],
                    ].map(([l, v]) => (
                      <div key={l}>
                        <dt>{l}</dt>
                        <dd>{v || "—"}</dd>
                      </div>
                    ))}
                  </dl>
                  {t.rejection_reason && (
                    <div className="inline-notice danger">
                      <strong>Lý do từ chối:</strong> {t.rejection_reason}
                    </div>
                  )}
                  <h3 className="subheading">Chứng từ</h3>
                  {t.evidence_url?.startsWith("/api/evidence/") ? (
                    <Button asChild variant="outline">
                      <a href={t.evidence_url + "?club=" + club} download>
                        <Download size={16} />
                        Tải chứng từ
                      </a>
                    </Button>
                  ) : t.evidence_url?.startsWith("https://") ? (
                    <Button asChild variant="outline">
                      <a
                        href={t.evidence_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ArrowUpRight size={16} />
                        Mở chứng từ
                      </a>
                    </Button>
                  ) : t.evidence_url ? (
                    <p className="muted">
                      Bản ghi gốc tham chiếu <code>{t.evidence_url}</code>. Tệp
                      này chưa được cung cấp.
                    </p>
                  ) : (
                    <p className="muted">Chưa đính kèm chứng từ.</p>
                  )}
                  <div className="transaction-actions">
                    {can("TREASURER") &&
                      ["DRAFT", "REJECTED"].includes(t.transaction_status) && (
                        <Button variant="outline" onClick={() => onEdit(t)}>
                          <Pencil size={16} />
                          Sửa giao dịch
                        </Button>
                      )}
                    {can("TREASURER") &&
                      ["DRAFT", "REJECTED", "APPROVED"].includes(
                        t.transaction_status,
                      ) && (
                        <Button
                          variant="outline"
                          onClick={() => setEvidence(true)}
                        >
                          <Paperclip size={16} />
                          Bổ sung chứng từ
                        </Button>
                      )}
                    {can("TREASURER") &&
                      t.transaction_type === "EXPENSE" &&
                      t.transaction_status === "DRAFT" && (
                        <Button
                          onClick={() =>
                            setConfirm({
                              action: "submit",
                              title: "Gửi đề nghị chi để phê duyệt?",
                            })
                          }
                        >
                          Gửi phê duyệt
                        </Button>
                      )}
                    {can("LEADER") &&
                      t.transaction_status === "PENDING_APPROVAL" &&
                      t.created_by !== session.user.user_id && (
                        <>
                          <Button
                            onClick={() =>
                              setConfirm({
                                action: "approve",
                                title: "Phê duyệt khoản chi?",
                              })
                            }
                          >
                            <Check size={16} />
                            Phê duyệt chi
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() =>
                              setConfirm({
                                action: "reject",
                                title: "Từ chối đề nghị chi?",
                                reason: true,
                              })
                            }
                          >
                            Từ chối
                          </Button>
                        </>
                      )}
                    {can("TREASURER") &&
                      ((t.transaction_type === "INCOME" &&
                        t.transaction_status === "DRAFT") ||
                        (t.transaction_type === "EXPENSE" &&
                          t.transaction_status === "APPROVED")) && (
                        <Button
                          onClick={() =>
                            setConfirm({
                              action: "post",
                              title: "Xác nhận tiền đã thực thu / thực chi?",
                              description:
                                "Giao dịch sẽ được ghi vào sổ quỹ và ảnh hưởng đến số dư. Chỉ xác nhận khi tiền đã thực sự được nhận hoặc thanh toán.",
                            })
                          }
                        >
                          Ghi sổ giao dịch
                        </Button>
                      )}
                    {t.transaction_status !== "CANCELLED" &&
                      (t.transaction_status === "POSTED"
                        ? can("LEADER")
                        : can("LEADER", "TREASURER")) && (
                        <Button
                          variant="ghost"
                          className="danger-text"
                          onClick={() =>
                            setConfirm({
                              action: "cancel",
                              title: "Hủy giao dịch?",
                              reason: true,
                              description:
                                "Giao dịch sẽ được giữ trong lịch sử và không còn được tính vào số dư.",
                            })
                          }
                        >
                          Hủy giao dịch
                        </Button>
                      )}
                  </div>
                </>
              )}
            </LoadState>
          </div>
        </SheetContent>
      </Sheet>
      {confirm && (
        <Confirm
          {...confirm}
          onClose={() => setConfirm(null)}
          onConfirm={(note: string) =>
            mutate("finance/" + row.transaction_id + "/action", {
              action: confirm.action,
              reason: note,
            })
          }
        />
      )}{" "}
      {evidence && (
        <Editor
          title="Bổ sung chứng từ"
          fields={[
            {
              name: "evidence_url",
              label: "Liên kết chứng từ",
              required: true,
              wide: true,
            },
          ]}
          initial={{ evidence_url: t.evidence_url || "" }}
          extra={(v: Row, set: any) => (
            <EvidenceInput
              value={v.evidence_url}
              onChange={(url: string) => set({ evidence_url: url })}
            />
          )}
          onClose={() => setEvidence(false)}
          onSave={(v: Row) =>
            mutate("finance/" + row.transaction_id + "/evidence", v, "PATCH")
          }
        />
      )}
    </>
  );
}
export function Finance({ approvals = false }: any) {
  const { can, navigate } = useApp(),
    f = useFilters(),
    [type, setType] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [event, setEvent] = useState(""),
    [category, setCategory] = useState(""),
    [editing, setEditing] = useState<Row | null>(null),
    [detail, setDetail] = useState<Row | null>(null),
    options = useResource("options");
  const params = `${f.query}${approvals ? "&status=PENDING_APPROVAL" : ""}&type=${type}&from=${from}&to=${to}&event=${event}&category=${category}`,
    r = useResource("finance?" + params),
    summary = useResource("dashboard");
  useEffect(() => {
    if (window.location.hash.includes("?new") && can("TREASURER"))
      setEditing({});
  }, []);
  return (
    <>
      <PageTitle
        eyebrow="TÀI CHÍNH MINH BẠCH"
        title={approvals ? "Đề nghị chờ phê duyệt" : "Sổ quỹ câu lạc bộ"}
        description={
          approvals
            ? "Xem xét khoản chi và lưu lại quyết định phê duyệt."
            : "Theo dõi dòng tiền, chứng từ và trạng thái từng giao dịch."
        }
      >
        <ExportButton path={"finance?" + params} />
        {can("TREASURER") && (
          <Button onClick={() => setEditing({})}>
            <Plus />
            Thêm thu chi
          </Button>
        )}
      </PageTitle>
      {!approvals && summary.data?.fund && (
        <div className="metrics-grid finance-metrics">
          <Metric
            label="Số dư hiện tại"
            value={money(summary.data.fund.balance)}
            caption="Toàn bộ giao dịch đã ghi sổ"
            icon={Wallet}
          />
          <Metric
            label="Tổng thu"
            value={money(summary.data.fund.total_income)}
            caption="Các khoản thực nhận"
            icon={ArrowDownLeft}
          />
          <Metric
            label="Tổng chi"
            value={money(summary.data.fund.total_expense)}
            caption="Các khoản đã thanh toán"
            icon={ArrowUpRight}
            tone="orange"
          />
        </div>
      )}
      <section className="panel">
        {!approvals && (
          <Tabs
            value={type || "all"}
            onValueChange={(v) => {
              setType(v === "all" ? "" : v);
              f.setPage(1);
            }}
            className="finance-tabs"
          >
            <TabsList variant="line">
              <TabsTrigger value="all">Tất cả giao dịch</TabsTrigger>
              <TabsTrigger value="INCOME">Khoản thu</TabsTrigger>
              <TabsTrigger value="EXPENSE">Khoản chi</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
        <Filters
          q={f.q}
          setQ={f.setQ}
          {...(!approvals
            ? {
                status: f.status,
                setStatus: f.setStatus,
                statuses: transactionStatuses,
              }
            : {})}
        >
          <label className="date-filter">
            Từ
            <input
              aria-label="Từ ngày"
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                f.setPage(1);
              }}
            />
          </label>
          <label className="date-filter">
            Đến
            <input
              aria-label="Đến ngày"
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                f.setPage(1);
              }}
            />
          </label>
        </Filters>
        <div className="secondary-filters">
          <SelectBox
            label="Lọc theo sự kiện"
            value={event}
            onChange={(v) => {
              setEvent(v);
              f.setPage(1);
            }}
            options={[
              { value: "", label: "Tất cả sự kiện" },
              ...(options.data?.events || []).map((e: Row) => ({
                value: e.event_id,
                label: e.event_name,
              })),
            ]}
          />
          <SelectBox
            label="Lọc hạng mục"
            value={category}
            onChange={(v) => {
              setCategory(v);
              f.setPage(1);
            }}
            options={[
              { value: "", label: "Tất cả hạng mục" },
              ...(options.data?.categories || []).map((c: Row) => ({
                value: c.category_id,
                label: c.category_name,
              })),
            ]}
          />
        </div>
        <LoadState {...r} variant="table">
          <DataTable
            data={r.data}
            page={f.page}
            setPage={f.setPage}
            columns={[
              {
                key: "date",
                title: "NGÀY",
                render: (r) => dateText(r.transaction_date),
              },
              {
                key: "description",
                title: "NỘI DUNG GIAO DỊCH",
                render: (r) => (
                  <div className="transaction-cell">
                    <span className={"transaction-icon " + r.transaction_type}>
                      {r.transaction_type === "INCOME" ? (
                        <ArrowDownLeft size={18} />
                      ) : (
                        <ArrowUpRight size={18} />
                      )}
                    </span>
                    <div>
                      <button
                        className="table-link"
                        onClick={() => setDetail(r)}
                      >
                        {r.description}
                      </button>
                      <small>
                        #{String(r.transaction_id).padStart(4, "0")} ·{" "}
                        {r.category_name}
                      </small>
                    </div>
                  </div>
                ),
              },
              {
                key: "amount",
                title: "SỐ TIỀN",
                render: (r) => (
                  <strong
                    className={
                      "amount " +
                      (r.transaction_type === "INCOME" ? "positive" : "")
                    }
                  >
                    {r.transaction_type === "INCOME" ? "+" : "−"}
                    {money(r.amount)}
                  </strong>
                ),
              },
              {
                key: "transaction_status",
                title: "TRẠNG THÁI",
                render: (r) => <Badge value={r.transaction_status} />,
              },
              {
                key: "detail",
                title: "",
                render: (r) => (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDetail(r)}
                  >
                    Chi tiết <ArrowUpRight size={15} />
                  </Button>
                ),
              },
            ]}
          />
        </LoadState>
      </section>
      {editing && (
        <TransactionEditor
          transaction={editing}
          onClose={() => {
            setEditing(null);
            if (window.location.hash.includes("?new")) navigate("finance");
          }}
        />
      )}{" "}
      {detail && (
        <TransactionDetail
          row={detail}
          onClose={() => setDetail(null)}
          onEdit={(t: Row) => {
            setDetail(null);
            setEditing(t);
          }}
        />
      )}
    </>
  );
}
export function Categories() {
  const { mutate } = useApp(),
    r = useResource("categories"),
    [editing, setEditing] = useState<Row | null>(null),
    [confirm, setConfirm] = useState<Row | null>(null);
  return (
    <>
      <PageTitle
        eyebrow="THIẾT LẬP TÀI CHÍNH"
        title="Danh mục thu chi"
        description="Phân loại giao dịch để theo dõi và đối soát quỹ."
      >
        <Button onClick={() => setEditing({ category_type: "INCOME" })}>
          <Plus />
          Thêm hạng mục
        </Button>
      </PageTitle>
      <section className="panel">
        <LoadState {...r} variant="table">
          <DataTable
            data={r.data}
            columns={[
              {
                key: "category_name",
                title: "TÊN HẠNG MỤC",
                render: (r) => <strong>{r.category_name}</strong>,
              },
              {
                key: "category_type",
                title: "LOẠI",
                render: (r) => <Badge value={r.category_type} />,
              },
              {
                key: "active_flag",
                title: "TRẠNG THÁI",
                render: (r) => (
                  <Badge value={r.active_flag ? "ACTIVE" : "INACTIVE"} />
                ),
              },
              {
                key: "action",
                title: "THAO TÁC",
                render: (r) => (
                  <div className="row-actions">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditing(r)}
                    >
                      <Pencil size={15} />
                      Sửa
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirm(r)}
                    >
                      {r.active_flag ? "Ngừng sử dụng" : "Kích hoạt"}
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        </LoadState>
      </section>
      {editing && (
        <Editor
          title={editing.category_id ? "Sửa hạng mục" : "Thêm hạng mục"}
          fields={[
            {
              name: "category_name",
              label: "Tên hạng mục",
              required: true,
              maxLength: 150,
            },
            ...(!editing.category_id
              ? [
                  {
                    name: "category_type",
                    label: "Loại",
                    type: "select",
                    required: true,
                    options: opts(["INCOME", "EXPENSE"]),
                  },
                ]
              : []),
          ]}
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={(v: Row) =>
            mutate(
              editing.category_id
                ? "categories/" + editing.category_id
                : "categories",
              v,
              editing.category_id ? "PATCH" : "POST",
            )
          }
        />
      )}{" "}
      {confirm && (
        <Confirm
          title={
            (confirm.active_flag ? "Ngừng sử dụng " : "Kích hoạt ") +
            confirm.category_name +
            "?"
          }
          description="Các giao dịch trước đây được giữ nguyên trong lịch sử."
          onClose={() => setConfirm(null)}
          onConfirm={() =>
            mutate(
              "categories/" + confirm.category_id,
              {
                category_name: confirm.category_name,
                active_flag: confirm.active_flag ? 0 : 1,
              },
              "PATCH",
            )
          }
        />
      )}
    </>
  );
}
export function Reports() {
  const { can, staff } = useApp(),
    [type, setType] = useState(
      can("TREASURER") && !can("LEADER", "OFFICER", "ADMIN")
        ? "finance"
        : "events",
    ),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [event, setEvent] = useState(""),
    [status, setStatus] = useState(""),
    options = useResource("options");
  const params = `type=${type}&from=${from}&to=${to}&event=${event}&status=${status}`,
    r = useResource("reports?" + params),
    d = r.data;
  return (
    <>
      <PageTitle
        eyebrow="DỮ LIỆU & GÓC NHÌN"
        title={staff ? "Báo cáo & thống kê" : "Báo cáo cá nhân"}
        description="Tổng hợp từ dữ liệu hoạt động đã được ghi nhận."
      >
        <ExportButton path={"reports?" + params} />
        <Button variant="outline" onClick={() => window.print()}>
          <FileText size={16} />
          In / Lưu PDF
        </Button>
      </PageTitle>
      <section className="panel report-filter">
        {staff && (
          <SelectBox
            label="Loại báo cáo"
            value={type}
            onChange={(v) => {
              setType(v);
              setStatus("");
              setEvent("");
            }}
            options={[
              ...(can("ADMIN", "LEADER", "OFFICER")
                ? [
                    { value: "events", label: "Sự kiện & tham dự" },
                    { value: "members", label: "Thành viên" },
                  ]
                : []),
              ...(can("ADMIN", "LEADER", "TREASURER")
                ? [{ value: "finance", label: "Tài chính" }]
                : []),
            ]}
          />
        )}
        <label className="date-filter">
          {type === "members" && staff ? "Ngày tham gia từ" : "Từ ngày"}
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="date-filter">
          Đến ngày
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        {staff && type === "events" && (
          <>
            <SelectBox
              label="Chọn sự kiện báo cáo"
              value={event}
              onChange={setEvent}
              options={[
                { value: "", label: "Tất cả sự kiện" },
                ...(options.data?.events || []).map((e: Row) => ({
                  value: e.event_id,
                  label: e.event_name,
                })),
              ]}
            />
            <SelectBox
              label="Trạng thái sự kiện báo cáo"
              value={status}
              onChange={setStatus}
              options={[
                { value: "", label: "Tất cả trạng thái" },
                ...opts([
                  "DRAFT",
                  "OPEN",
                  "CLOSED",
                  "ONGOING",
                  "COMPLETED",
                  "CANCELLED",
                ]),
              ]}
            />
          </>
        )}
      </section>
      <LoadState {...r} variant="finance">
        {d &&
          (d.personal ? (
            <>
              <div className="metrics-grid finance-metrics">
                <Metric
                  label="Đăng ký"
                  value={d.stats.registrations}
                  caption="Trong thời gian đã chọn"
                  icon={CalendarDays}
                />
                <Metric
                  label="Đã xác nhận"
                  value={d.stats.confirmed}
                  caption="Đăng ký được chấp nhận"
                  icon={Check}
                />
                <Metric
                  label="Đã tham dự"
                  value={d.stats.attended}
                  caption="Có mặt hoặc đến muộn"
                  icon={Users}
                />
              </div>
              <section className="panel">
                <SectionHeader title="Lịch sử tham dự" />
                <DataTable
                  data={{ rows: d.rows }}
                  columns={[
                    { key: "event_name", title: "SỰ KIỆN" },
                    {
                      key: "start_at",
                      title: "THỜI GIAN",
                      render: (r) => dateText(r.start_at, true),
                    },
                    {
                      key: "registration_status",
                      title: "ĐĂNG KÝ",
                      render: (r) => <Badge value={r.registration_status} />,
                    },
                    {
                      key: "attendance_status",
                      title: "ĐIỂM DANH",
                      render: (r) =>
                        r.attendance_status ? (
                          <Badge value={r.attendance_status} />
                        ) : (
                          <span>Chưa ghi nhận</span>
                        ),
                    },
                  ]}
                />
              </section>
              <section className="panel personal-income">
                <SectionHeader title="Các khoản đã nộp" />
                <DataTable
                  data={{ rows: d.income }}
                  columns={[
                    {
                      key: "transaction_date",
                      title: "NGÀY",
                      render: (r) => dateText(r.transaction_date),
                    },
                    { key: "description", title: "NỘI DUNG" },
                    {
                      key: "amount",
                      title: "SỐ TIỀN",
                      render: (r) => money(r.amount),
                    },
                  ]}
                />
              </section>
            </>
          ) : type === "finance" ? (
            <>
              <div className="metrics-grid finance-metrics">
                <Metric
                  label="Tổng thu trong kỳ"
                  value={money(d.fund?.total_income)}
                  caption="Giao dịch đã ghi sổ"
                  icon={ArrowDownLeft}
                />
                <Metric
                  label="Tổng chi trong kỳ"
                  value={money(d.fund?.total_expense)}
                  caption="Giao dịch đã ghi sổ"
                  icon={ArrowUpRight}
                  tone="orange"
                />
                <Metric
                  label="Chênh lệch thu chi"
                  value={money(d.fund?.balance)}
                  caption="Trong khoảng thời gian đã chọn"
                  icon={Wallet}
                />
              </div>
              <section className="panel">
                <SectionHeader title="Thu chi theo tháng" />
                <MoneyBars rows={d.monthly} />
                <DataTable
                  data={{ rows: d.monthly }}
                  columns={[
                    { key: "month", title: "THÁNG" },
                    {
                      key: "income",
                      title: "TỔNG THU",
                      render: (r) => (
                        <strong className="positive">{money(r.income)}</strong>
                      ),
                    },
                    {
                      key: "expense",
                      title: "TỔNG CHI",
                      render: (r) => money(r.expense),
                    },
                    {
                      key: "balance",
                      title: "CHÊNH LỆCH",
                      render: (r) =>
                        money(Number(r.income) - Number(r.expense)),
                    },
                  ]}
                />
              </section>
            </>
          ) : type === "members" ? (
            <>
              <div className="metrics-grid finance-metrics">
                <Metric
                  label="Tổng thành viên"
                  value={num(d.counts.total)}
                  caption="Theo ngày tham gia đã chọn"
                  icon={Users}
                />
                <Metric
                  label="Đang hoạt động"
                  value={num(d.counts.active)}
                  caption="Trạng thái hiện tại của nhóm đã chọn"
                  icon={Check}
                />
                <Metric
                  label="Tạm ngưng / đã rời"
                  value={`${num(d.counts.paused)} / ${num(d.counts.departed)}`}
                  caption="Giữ nguyên lịch sử tham gia"
                  icon={HistoryIcon}
                />
              </div>
              <section className="panel">
                <SectionHeader title="Phân bổ thành viên đang hoạt động" />
                <DataTable
                  data={{ rows: d.departments }}
                  columns={[
                    { key: "name", title: "BAN / NHÓM" },
                    { key: "value", title: "SỐ THÀNH VIÊN" },
                    {
                      key: "share",
                      title: "TỶ TRỌNG",
                      render: (r) =>
                        (
                          (Number(r.value) /
                            Math.max(1, Number(d.counts.active))) *
                          100
                        ).toFixed(1) + "%",
                    },
                  ]}
                />
              </section>
            </>
          ) : (
            <>
              <div className="metrics-grid finance-metrics">
                <Metric
                  label="Số sự kiện"
                  value={num(d.stats.events)}
                  caption="Trong thời gian đã chọn"
                  icon={CalendarDays}
                />
                <Metric
                  label="Lượt đăng ký"
                  value={num(d.stats.registrations)}
                  caption="Bao gồm các trạng thái đăng ký"
                  icon={Users}
                />
                <Metric
                  label="Tỷ lệ tham dự"
                  value={d.stats.attendance + "%"}
                  caption="Trên sự kiện đã hoàn tất"
                  icon={BarChart3}
                />
              </div>
              <section className="panel">
                <SectionHeader title="Hiệu quả tổ chức sự kiện" />
                <DataTable
                  data={{ rows: d.events }}
                  columns={[
                    { key: "event_name", title: "SỰ KIỆN" },
                    {
                      key: "event_status",
                      title: "TRẠNG THÁI",
                      render: (r) => <Badge value={r.event_status} />,
                    },
                    { key: "total_registrations", title: "ĐĂNG KÝ" },
                    { key: "confirmed_count", title: "XÁC NHẬN" },
                    { key: "attended_count", title: "THAM DỰ" },
                    { key: "absent_count", title: "VẮNG" },
                    {
                      key: "attendance_rate_percent",
                      title: "TỶ LỆ",
                      render: (r) =>
                        Number(r.attendance_rate_percent).toFixed(1) + "%",
                    },
                  ]}
                />
              </section>
            </>
          ))}
      </LoadState>
    </>
  );
}
const HistoryIcon = Clock;

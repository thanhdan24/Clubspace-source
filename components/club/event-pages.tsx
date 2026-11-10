"use client";
import { useState, useEffect } from "react";
import {
  Plus,
  MapPin,
  Clock,
  Users,
  ArrowUpRight,
  ArrowLeft,
  CalendarDays,
  Pencil,
  LockKeyhole,
  UnlockKeyhole,
  Check,
  X,
  Grid2X2,
  List,
  UserPlus,
  Save,
  AlertCircle,
  Sparkles,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
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
  Avatar,
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
  ActionButton,
  type Row,
  type Field,
} from "./shared";
const statuses = [
  "DRAFT",
  "OPEN",
  "CLOSED",
  "ONGOING",
  "COMPLETED",
  "CANCELLED",
];
function EventEditor({ event = {}, onClose, onSaved }: any) {
  const { mutate, navigate } = useApp();
  const nowIso = localNow();
  const today = nowIso.slice(0, 10);
  const start = new Date(Date.now() + 7 * 24 * 3600000 + 7 * 3600000)
    .toISOString()
    .slice(0, 10);
  const fields: Field[] = [
    {
      name: "event_name",
      label: "Tên sự kiện",
      required: true,
      wide: true,
      maxLength: 200,
    },
    {
      name: "event_type",
      label: "Loại sự kiện",
      required: true,
      type: "select",
      options: opts([
        "WORKSHOP",
        "MEETING",
        "COMPETITION",
        "ACADEMIC",
        "VOLUNTEER",
      ]),
    },
    {
      name: "scope",
      label: "Phạm vi sự kiện",
      type: "select",
      options: [
        { value: "PUBLIC", label: "Toàn trường (Công khai)" },
        { value: "INTERNAL", label: "Nội bộ (Chỉ thành viên CLB)" },
      ],
      required: true,
      help: "Sự kiện toàn trường cho phép tất cả sinh viên đăng ký. Sự kiện nội bộ chỉ mở cho thành viên CLB.",
    },
    { name: "location", label: "Địa điểm", required: true, maxLength: 255 },
    {
      name: "start_at",
      label: "Bắt đầu",
      type: "datetime-local",
      required: true,
      min: today + "T00:00",
      help: "Thời gian bắt đầu sự kiện từ ngày hôm nay trở đi.",
    },
    {
      name: "end_at",
      label: "Kết thúc",
      type: "datetime-local",
      required: true,
      min: today + "T00:00",
    },
    {
      name: "registration_deadline",
      label: "Hạn đăng ký",
      type: "datetime-local",
      required: true,
      min: today + "T00:00",
      help: "Hạn chót đăng ký (trước hoặc bằng giờ bắt đầu).",
    },
    {
      name: "capacity",
      label: "Sức chứa",
      type: "number",
      min: 1,
      help: "Để trống nếu không giới hạn.",
    },
    {
      name: "planned_budget",
      label: "Ngân sách kế hoạch (VND)",
      type: "number",
      min: 0,
      help: "Dự toán kinh phí trình Chủ nhiệm phê duyệt trước khi công bố (nhập 0 nếu không dùng kinh phí).",
    },
    {
      name: "approval_required",
      label: "Duyệt đăng ký",
      type: "select",
      options: [
        { value: 0, label: "Tự động xác nhận" },
        { value: 1, label: "Cán bộ phê duyệt" },
      ],
    },
  ];
  return (
    <Editor
      title={event.event_id ? "Chỉnh sửa sự kiện" : "Tạo sự kiện mới"}
      fields={fields}
      initial={{
        event_type: "WORKSHOP",
        scope: "PUBLIC",
        start_at: start + "T08:00",
        end_at: start + "T11:00",
        registration_deadline: start + "T07:00",
        capacity: "",
        planned_budget: event.planned_budget ?? 0,
        approval_required: 0,
        ...event,
      }}
      onClose={onClose}
      onSave={async (v: Row) => {
        const curToday = localNow().slice(0, 10);
        if (!event.event_id && v.start_at.slice(0, 10) < curToday)
          throw new Error(
            "Thời gian bắt đầu sự kiện phải từ ngày hôm nay trở đi.",
          );
        if (v.end_at <= v.start_at)
          throw new Error("Thời gian kết thúc phải sau khi bắt đầu.");
        if (v.registration_deadline > v.start_at)
          throw new Error("Hạn đăng ký phải trước hoặc bằng giờ bắt đầu.");
        if (!event.event_id && v.registration_deadline.slice(0, 10) < curToday)
          throw new Error("Hạn đăng ký phải từ ngày hôm nay trở đi.");
        const out = await mutate(
          event.event_id ? "events/" + event.event_id : "events",
          {
            ...v,
            capacity: v.capacity ? Number(v.capacity) : null,
            planned_budget:
              v.planned_budget !== "" && v.planned_budget !== undefined
                ? Number(v.planned_budget)
                : 0,
          },
          event.event_id ? "PATCH" : "POST",
        );
        if (onSaved) onSaved(out);
        else if (out.event_id) navigate("events/" + out.event_id);
      }}
    />
  );
}
function EventPagination({
  page,
  setPage,
  total,
  pageSize,
  setPageSize,
}: {
  page: number;
  setPage: (p: number) => void;
  total: number;
  pageSize: number;
  setPageSize?: (s: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize && totalPages <= 1) {
    if (total === 0) return null;
    return (
      <div className="event-pagination-summary">
        <span>
          Hiển thị tất cả <strong>{total}</strong> sự kiện
        </span>
      </div>
    );
  }

  const startItem = (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, total);

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push("...");
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (page < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === page) return;
    setPage(newPage);
    const elem =
      document.querySelector(".event-filters") ||
      document.querySelector(".event-status-tabs");
    if (elem) {
      elem.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="event-pagination-container">
      <div className="pagination-info">
        Hiển thị <strong>{startItem} – {endItem}</strong> trên{" "}
        <strong>{total}</strong> sự kiện
      </div>

      <div className="pagination-controls">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => handlePageChange(page - 1)}
          className="pagination-nav-btn"
        >
          <ChevronLeft size={16} />
          <span>Trước</span>
        </Button>

        <div className="pagination-pages">
          {getPageNumbers().map((p, idx) =>
            p === "..." ? (
              <span key={`dots-${idx}`} className="pagination-ellipsis">
                …
              </span>
            ) : (
              <button
                key={`page-${p}`}
                type="button"
                className={`pagination-num-btn ${page === p ? "active" : ""}`}
                onClick={() => handlePageChange(Number(p))}
              >
                {p}
              </button>
            ),
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => handlePageChange(page + 1)}
          className="pagination-nav-btn"
        >
          <span>Sau</span>
          <ChevronRight size={16} />
        </Button>
      </div>

      {setPageSize && (
        <div className="pagination-size-select">
          <span className="text-xs text-slate-500">Mỗi trang:</span>
          {[6, 9, 12].map((s) => (
            <button
              key={s}
              type="button"
              className={`size-btn ${pageSize === s ? "active" : ""}`}
              onClick={() => {
                setPageSize(s);
                setPage(1);
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Events() {
  const { can, navigate } = useApp(),
    f = useFilters(),
    [tab, setTab] = useState("active"),
    [type, setType] = useState(""),
    [scope, setScope] = useState(""),
    [view, setView] = useState("grid"),
    [pageSize, setPageSize] = useState(6),
    [editing, setEditing] = useState(false);

  const query =
    f.query +
    "&type=" +
    type +
    (scope ? "&scope=" + scope : "") +
    (tab !== "all" ? "&group=" + tab : "") +
    "&size=" +
    (view === "grid" ? pageSize : 10);

  const r = useResource("events?" + query);

  const handleTabChange = (newTab: string) => {
    setTab(newTab);
    f.setStatus("");
    f.setPage(1);
  };

  useEffect(() => {
    if (window.location.hash.includes("?new") && can("OFFICER", "LEADER"))
      setEditing(true);
  }, []);

  const counts = r.data?.counts || {
    active: 0,
    completed: 0,
    cancelled: 0,
    all: 0,
  };

  return (
    <>
      <PageTitle
        eyebrow="KẾT NỐI QUA HOẠT ĐỘNG"
        title="Sự kiện câu lạc bộ"
        description="Từ những buổi sinh hoạt đến trải nghiệm đáng nhớ."
      >
        {can("OFFICER", "LEADER") && (
          <Button onClick={() => setEditing(true)}>
            <Plus />
            Tạo sự kiện
          </Button>
        )}
      </PageTitle>

      <div className="event-status-tabs">
        <button
          type="button"
          className={`event-status-tab tab-active ${tab === "active" ? "active" : ""}`}
          onClick={() => handleTabChange("active")}
        >
          <Sparkles size={16} />
          <span>Đang hoạt động</span>
          <span className="event-tab-badge active">{counts.active}</span>
        </button>

        <button
          type="button"
          className={`event-status-tab tab-completed ${tab === "completed" ? "active" : ""}`}
          onClick={() => handleTabChange("completed")}
        >
          <CheckCircle2 size={16} />
          <span>Đã hoàn thành</span>
          <span className="event-tab-badge completed">{counts.completed}</span>
        </button>

        <button
          type="button"
          className={`event-status-tab tab-cancelled ${tab === "cancelled" ? "active" : ""}`}
          onClick={() => handleTabChange("cancelled")}
        >
          <XCircle size={16} />
          <span>Đã bị hủy</span>
          <span className="event-tab-badge cancelled">{counts.cancelled}</span>
        </button>

        <button
          type="button"
          className={`event-status-tab tab-all ${tab === "all" ? "active" : ""}`}
          onClick={() => handleTabChange("all")}
        >
          <CalendarDays size={16} />
          <span>Tất cả sự kiện</span>
          <span className="event-tab-badge all">{counts.all}</span>
        </button>
      </div>

      <section className="panel event-filters">
        <Filters
          {...f}
          statuses={
            tab === "active"
              ? [
                  "OPEN",
                  "ONGOING",
                  "CLOSED",
                  ...(can("ADMIN", "LEADER", "OFFICER", "TREASURER")
                    ? ["DRAFT"]
                    : []),
                ]
              : tab === "all"
              ? statuses.filter(
                  (s) =>
                    s !== "DRAFT" ||
                    can("ADMIN", "LEADER", "OFFICER", "TREASURER"),
                )
              : []
          }
        >
          <SelectBox
            label="Phạm vi"
            value={scope}
            onChange={(v) => {
              setScope(v);
              f.setPage(1);
            }}
            options={[
              { value: "", label: "Tất cả phạm vi" },
              { value: "PUBLIC", label: "Toàn trường (Công khai)" },
              { value: "INTERNAL", label: "Nội bộ CLB" },
            ]}
          />
          <SelectBox
            label="Loại sự kiện"
            value={type}
            onChange={(v) => {
              setType(v);
              f.setPage(1);
            }}
            options={[
              { value: "", label: "Tất cả hoạt động" },
              ...opts([
                "WORKSHOP",
                "MEETING",
                "COMPETITION",
                "ACADEMIC",
                "VOLUNTEER",
              ]),
            ]}
          />
          <Tabs
            value={view}
            onValueChange={(v) => {
              setView(v);
              f.setPage(1);
            }}
          >
            <TabsList>
              <TabsTrigger value="grid" aria-label="Dạng thẻ">
                <Grid2X2 size={17} />
              </TabsTrigger>
              <TabsTrigger value="list" aria-label="Dạng bảng">
                <List size={17} />
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </Filters>
      </section>
      <LoadState {...r} variant={view === "list" ? "table" : "events"}>
        {view === "list" ? (
          <section className="panel">
            <DataTable
              data={r.data}
              page={f.page}
              setPage={f.setPage}
              columns={[
                {
                  key: "event_name",
                  title: "SỰ KIỆN",
                  render: (r) => (
                    <button
                      className="table-link"
                      onClick={() => navigate("events/" + r.event_id)}
                    >
                      {r.event_name}
                    </button>
                  ),
                },
                {
                  key: "club_name",
                  title: "CLB TỔ CHỨC",
                  render: (r: Row) => (
                    <span className="font-medium text-slate-700">
                      {r.club_name || "CLB của bạn"}
                    </span>
                  ),
                },
                {
                  key: "event_type",
                  title: "HOẠT ĐỘNG",
                  render: (r) => labels[r.event_type] || r.event_type,
                },
                {
                  key: "start_at",
                  title: "THỜI GIAN",
                  render: (r) => dateText(r.start_at, true),
                },
                { key: "location", title: "ĐỊA ĐIỂM" },
                {
                  key: "confirmed_count",
                  title: "XÁC NHẬN",
                  render: (r) => `${r.confirmed_count} / ${r.capacity || "∞"}`,
                },
                ...(can("ADMIN", "LEADER", "OFFICER", "TREASURER")
                  ? [
                      {
                        key: "planned_budget",
                        title: "NGÂN SÁCH & THỰC CHI",
                        render: (r: Row) => {
                          const planned = Number(r.planned_budget || 0);
                          const actual = Number(r.actual_expense || 0);
                          const deficit = Number(r.deficit_amount || 0);
                          return (
                            <div className="text-xs">
                              <div className="font-semibold text-slate-800">
                                {money(actual)} / {money(planned)}
                              </div>
                              {deficit > 0 ? (
                                <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-semibold">
                                  Thâm hụt: +{money(deficit)}
                                </span>
                              ) : r.budget_status === "PROJECTED_OVER_BUDGET" ? (
                                <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">
                                  Sắp vượt dự toán
                                </span>
                              ) : planned > 0 ? (
                                <span className="text-emerald-700 font-medium">
                                  Còn dư {money(Math.max(0, planned - actual))}
                                </span>
                              ) : (
                                <span className="text-slate-400">
                                  Không dùng ngân sách
                                </span>
                              )}
                            </div>
                          );
                        },
                      },
                    ]
                  : []),
                {
                  key: "scope",
                  title: "PHẠM VI",
                  render: (r) => <Badge value={r.scope || "PUBLIC"} />,
                },
                {
                  key: "event_status",
                  title: "TRẠNG THÁI",
                  render: (r) => <Badge value={r.event_status} />,
                },
              ]}
            />
          </section>
        ) : (
          <>
            {!r.data?.rows?.length ? (
              <section className="panel">
                <EmptyState
                  title={
                    tab === "cancelled"
                      ? "Không có sự kiện nào bị hủy"
                      : tab === "completed"
                      ? "Chưa có sự kiện nào hoàn thành"
                      : tab === "active"
                      ? "Chưa có sự kiện nào đang hoạt động"
                      : "Chưa có sự kiện phù hợp"
                  }
                  description={
                    tab === "cancelled"
                      ? "Tất cả các sự kiện của câu lạc bộ đều diễn ra thuận lợi theo đúng kế hoạch."
                      : tab === "completed"
                      ? "Các sự kiện sau khi hoàn tất điểm danh sẽ được lưu trữ tại đây."
                      : tab === "active"
                      ? "Hãy tạo một hoạt động mới hoặc thay đổi bộ lọc để xem các sự kiện."
                      : "Thay đổi bộ lọc hoặc tạo một hoạt động mới cho câu lạc bộ."
                  }
                />
              </section>
            ) : (
              <div className="events-grid">
                {r.data.rows.map((e: Row, i: number) => {
                  const isCancelled = e.event_status === "CANCELLED";
                  return (
                    <article
                      className={`event-card ${isCancelled ? "is-cancelled" : ""}`}
                      key={e.event_id}
                    >
                      <div className={"event-cover cover-" + (i % 4)}>
                        {isCancelled && (
                          <div className="cancelled-card-ribbon">
                            <XCircle size={13} /> ĐÃ HỦY
                          </div>
                        )}
                        <span className="cover-kicker">
                          {labels[e.event_type] || e.event_type}
                        </span>
                        <div>
                          <span className="cover-day">
                            {String(e.start_at).slice(8, 10)}
                          </span>
                          <span className="cover-month">
                            THÁNG {Number(String(e.start_at).slice(5, 7))}
                            <br />
                            {String(e.start_at).slice(0, 4)}
                          </span>
                        </div>
                        <span className="cover-code">
                          CLUBSPACE / {String(e.event_id).padStart(3, "0")}
                        </span>
                        <CalendarDays
                          className="cover-icon"
                          size={64}
                          strokeWidth={1}
                        />
                      </div>
                      <div className="event-card-content">
                        {isCancelled && (
                          <div className="cancelled-strip">
                            <XCircle size={14} /> Hoạt động này đã bị hủy bỏ
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                          <Badge value={e.event_status} />
                          <Badge value={e.scope || "PUBLIC"} />
                          {e.club_name && (
                            <span className="text-xs text-slate-500 font-medium truncate max-w-[180px]">
                              · {e.club_name}
                            </span>
                          )}
                        </div>
                        <h2>
                          <a href={"#events/" + e.event_id}>{e.event_name}</a>
                        </h2>
                        <p>
                          <MapPin size={15} />
                          {e.location}
                        </p>
                        <p>
                          <Clock size={15} />
                          {dateText(e.start_at, true)}
                        </p>
                        <div className="capacity-label">
                          <span>{num(e.confirmed_count)} người xác nhận</span>
                          <span>
                            {e.capacity ? e.capacity + " chỗ" : "Không giới hạn"}
                          </span>
                        </div>
                        <Progress
                          value={
                            e.capacity
                              ? (Number(e.confirmed_count) / Number(e.capacity)) *
                                100
                              : 0
                          }
                        />
                        {can("ADMIN", "LEADER", "OFFICER", "TREASURER") && (
                          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                            <span className="text-slate-600 flex items-center gap-1">
                              <Wallet size={13} className="text-slate-400" />
                              Thực chi:{" "}
                              <strong className="text-slate-800">
                                {money(e.actual_expense || 0)}
                              </strong>{" "}
                              / {money(e.planned_budget || 0)}
                            </span>
                            {Number(e.deficit_amount || 0) > 0 ? (
                              <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-semibold shrink-0">
                                Thâm hụt +{money(e.deficit_amount)}
                              </span>
                            ) : e.budget_status === "PROJECTED_OVER_BUDGET" ? (
                              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold shrink-0">
                                Sắp vượt dự toán
                              </span>
                            ) : Number(e.planned_budget || 0) > 0 ? (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium shrink-0">
                                Trong dự toán
                              </span>
                            ) : null}
                          </div>
                        )}
                        <div className="event-card-footer">
                          <small>
                            {isCancelled
                              ? "Hoạt động đã dừng tổ chức"
                              : e.event_status === "OPEN" &&
                                e.registration_deadline < localNow()
                              ? "Đã hết hạn đăng ký"
                              : e.approval_required
                              ? "Cần duyệt đăng ký"
                              : "Tự động xác nhận"}
                          </small>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate("events/" + e.event_id)}
                          >
                            Chi tiết <ArrowUpRight size={15} />
                          </Button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
            {r.data?.rows?.length > 0 && (
              <EventPagination
                page={f.page}
                setPage={f.setPage}
                total={r.data?.total || 0}
                pageSize={pageSize}
                setPageSize={setPageSize}
              />
            )}
          </>
        )}
      </LoadState>
      {editing && (
        <EventEditor
          onClose={() => {
            setEditing(false);
            if (window.location.hash.includes("?new")) navigate("events");
          }}
        />
      )}
    </>
  );
}
function Roster({ event, attendance = false }: any) {
  const { can, mutate } = useApp(),
    f = useFilters(),
    r = useResource(
      `events/${event.event_id}/registrations?${f.query}${attendance ? "&status=CONFIRMED" : ""}`,
    ),
    options = useResource("options");
  const [confirm, setConfirm] = useState<Row | null>(null),
    [adding, setAdding] = useState(false),
    [marks, setMarks] = useState<Row>({}),
    [reason, setReason] = useState("");
  useEffect(() => setMarks({}), [r.data]);
  const canRecord =
    can("OFFICER", "LEADER") &&
    !event.attendance_locked &&
    ["ONGOING", "CLOSED"].includes(event.event_status) &&
    event.start_at <= localNow();
  return (
    <>
      <div className="roster-toolbar">
        <Filters
          q={f.q}
          setQ={f.setQ}
          {...(!attendance
            ? {
                status: f.status,
                setStatus: f.setStatus,
                statuses: ["PENDING", "CONFIRMED", "REJECTED", "CANCELLED"],
              }
            : {})}
        >
          <ExportButton
            path={`events/${event.event_id}/registrations?${f.query}${attendance ? "&status=CONFIRMED" : ""}`}
          />
          {can("OFFICER", "LEADER") &&
            ["CLOSED", "ONGOING"].includes(event.event_status) &&
            !event.attendance_locked && (
              <Button variant="outline" onClick={() => setAdding(true)}>
                <UserPlus size={15} />
                Bổ sung người tham dự
              </Button>
            )}
        </Filters>
      </div>
      {attendance && event.attendance_locked && (
        <div className="inline-notice">
          <LockKeyhole size={17} />
          Kết quả đã được khóa. Chủ nhiệm có thể mở lại để sửa ngoại lệ.
        </div>
      )}
      <LoadState {...r} variant="table">
        <DataTable
          data={r.data}
          page={f.page}
          setPage={f.setPage}
          columns={[
            {
              key: "name",
              title: "THÀNH VIÊN",
              render: (r, i) => (
                <div className="person-cell">
                  <Avatar name={r.full_name} index={i} />
                  <div>
                    <strong>{r.full_name}</strong>
                    <small>{r.member_code}</small>
                  </div>
                </div>
              ),
            },
            {
              key: "department_name",
              title: "BAN / ĐƠN VỊ",
              render: (r: Row) =>
                r.department_name === "Khách tham gia" ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                    Khách ngoài CLB
                  </span>
                ) : (
                  r.department_name || "Chưa phân ban"
                ),
            },
            ...(!attendance
              ? [
                  {
                    key: "registered_at",
                    title: "ĐĂNG KÝ LÚC",
                    render: (r: Row) => dateText(r.registered_at, true),
                  },
                  {
                    key: "registration_status",
                    title: "TRẠNG THÁI",
                    render: (r: Row) => <Badge value={r.registration_status} />,
                  },
                  {
                    key: "action",
                    title: "XỬ LÝ",
                    render: (r: Row) =>
                      r.registration_status === "PENDING" &&
                      can("OFFICER", "LEADER") && (
                        <div className="row-actions flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs font-semibold text-emerald-700 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
                            onClick={() =>
                              setConfirm({ row: r, status: "CONFIRMED" })
                            }
                          >
                            <Check size={14} className="mr-1" />
                            Duyệt
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-xs font-medium text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                            onClick={() =>
                              setConfirm({ row: r, status: "REJECTED" })
                            }
                          >
                            <X size={14} className="mr-1" />
                            Từ chối
                          </Button>
                        </div>
                      ),
                  },
                ]
              : [
                  {
                    key: "attendance_status",
                    title: "KẾT QUẢ",
                    render: (r: Row) =>
                      canRecord ? (
                        <SelectBox
                          label={"Điểm danh " + r.full_name}
                          value={
                            marks[r.club_member_id] || r.attendance_status || ""
                          }
                          onChange={(v) =>
                            setMarks({ ...marks, [r.club_member_id]: v })
                          }
                          options={[
                            { value: "", label: "Chưa điểm danh" },
                            ...opts(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
                          ]}
                        />
                      ) : r.attendance_status ? (
                        <Badge value={r.attendance_status} />
                      ) : (
                        <span className="muted">Chưa ghi nhận</span>
                      ),
                  },
                  {
                    key: "recorded_at",
                    title: "GHI NHẬN LÚC",
                    render: (r: Row) => dateText(r.recorded_at, true),
                  },
                ]),
          ]}
        />
      </LoadState>
      {canRecord && (
        <div className="attendance-save">
          <div className="field">
            <label htmlFor="attendance-reason">
              Lý do chỉnh sửa (nếu đã có kết quả)
            </label>
            <input
              id="attendance-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              placeholder="Bổ sung lý do để lưu lịch sử…"
            />
          </div>
          <ActionButton
            disabled={!Object.keys(marks).some((k) => marks[k])}
            variant="default"
            onClick={async () => {
              await mutate(
                `events/${event.event_id}/attendance`,
                {
                  records: Object.entries(marks)
                    .filter(([, v]) => v)
                    .map(([k, v]) => ({
                      club_member_id: Number(k),
                      status: v,
                    })),
                  reason,
                },
                "PUT",
              );
              setMarks({});
            }}
          >
            <Save size={16} />
            Lưu điểm danh
          </ActionButton>
        </div>
      )}
      {confirm && (
        <Confirm
          title={
            confirm.status === "CONFIRMED"
              ? "Xác nhận đăng ký tham gia?"
              : "Từ chối đăng ký tham gia?"
          }
          description={
            confirm.status === "CONFIRMED"
              ? `Xác nhận cho thành viên ${confirm.row.full_name} tham gia sự kiện.`
              : `Từ chối đăng ký của thành viên ${confirm.row.full_name}. Vui lòng nhập lý do từ chối bên dưới.`
          }
          reason={confirm.status === "REJECTED"}
          onClose={() => setConfirm(null)}
          onConfirm={(note: string) =>
            mutate(
              `events/${event.event_id}/registrations`,
              {
                registration_id: confirm.row.registration_id,
                status: confirm.status,
                reason: note || undefined,
              },
              "PATCH",
            )
          }
        />
      )}{" "}
      {adding && (
        <Editor
          title="Bổ sung người tham dự"
          fields={[
            {
              name: "club_member_id",
              label: "Thành viên",
              required: true,
              type: "select",
              options: [
                { value: "", label: "Chọn thành viên" },
                ...(options.data?.members || []).map((m: Row) => ({
                  value: m.club_member_id,
                  label: m.full_name + " · " + m.member_code,
                })),
              ],
            },
            {
              name: "reason",
              label: "Lý do bổ sung ngoại lệ",
              required: true,
              type: "textarea",
              wide: true,
              maxLength: 500,
            },
          ]}
          onClose={() => setAdding(false)}
          onSave={(v: Row) =>
            mutate(`events/${event.event_id}/participants`, v)
          }
        />
      )}
    </>
  );
}
export function EventDetail({ id }: any) {
  const { can, staff, mutate, navigate, club } = useApp(),
    r = useResource("events/" + id),
    [tab, setTab] = useState("overview"),
    [editing, setEditing] = useState(false),
    [confirm, setConfirm] = useState<Row | null>(null);
  const e = r.data?.event,
    s = r.data?.stats,
    mine = r.data?.mine,
    budget = r.data?.budget,
    transactions: Row[] = r.data?.transactions || [];
  const isHostClub = e && e.club_id === club;
  const actions: any = {
    DRAFT: [["publish", "Công bố sự kiện"]],
    OPEN: [
      ["close", "Chốt danh sách"],
      ...(e && e.start_at <= localNow()
        ? [["start", "Bắt đầu sự kiện"]]
        : []),
    ],
    CLOSED: [
      ...(e && e.start_at <= localNow()
        ? [["start", "Bắt đầu sự kiện"]]
        : []),
      ["complete", "Khóa & hoàn tất"],
    ],
    ONGOING: [["complete", "Khóa & hoàn tất"]],
  };
  return (
    <>
      <button className="back-link" onClick={() => navigate("events")}>
        <ArrowLeft size={16} />
        Tất cả sự kiện
      </button>
      <LoadState {...r} variant="detail">
        {e && (
          <>
            <PageTitle
              eyebrow={labels[e.event_type] || e.event_type}
              title={e.event_name}
              description={e.location}
            >
              {e.club_name && <Badge value={e.club_name} />}
              <Badge value={e.scope || "PUBLIC"} />
              <Badge value={e.event_status} />
              {can("OFFICER", "LEADER") &&
                isHostClub &&
                !["COMPLETED", "CANCELLED"].includes(e.event_status) && (
                  <Button variant="outline" onClick={() => setEditing(true)}>
                    <Pencil size={16} />
                    Chỉnh sửa
                  </Button>
                )}
            </PageTitle>
            <div className="event-detail-stats">
              <div>
                <CalendarDays />
                <span>
                  THỜI GIAN<strong>{dateText(e.start_at, true)}</strong>
                </span>
              </div>
              <div>
                <Clock />
                <span>
                  HẠN ĐĂNG KÝ
                  <strong>{dateText(e.registration_deadline, true)}</strong>
                </span>
              </div>
              <div>
                <Users />
                <span>
                  ĐÃ XÁC NHẬN
                  <strong>
                    {s.confirmed_count} / {e.capacity || "Không giới hạn"}
                  </strong>
                </span>
              </div>
              <div>
                <Check />
                <span>
                  ĐÃ THAM DỰ<strong>{s.attended_count} người</strong>
                </span>
              </div>
              {staff && isHostClub && budget && (
                <div>
                  <Wallet />
                  <span>
                    THỰC CHI / NGÂN SÁCH KẾ HOẠCH
                    <strong
                      className={budget.is_over_budget ? "text-rose-600" : ""}
                    >
                      {money(budget.actual_expense)} /{" "}
                      {money(budget.planned_budget)}
                    </strong>
                  </span>
                </div>
              )}
            </div>
            <Tabs value={tab} onValueChange={setTab} className="page-tabs">
              <TabsList variant="line">
                <TabsTrigger value="overview">Thông tin sự kiện</TabsTrigger>
                {staff && isHostClub && (
                  <TabsTrigger value="registrations">
                    Danh sách đăng ký{" "}
                    <span className="tab-count">{s.total_registrations}</span>
                  </TabsTrigger>
                )}
                {staff && isHostClub && (
                  <TabsTrigger value="attendance">Điểm danh</TabsTrigger>
                )}
                {staff && isHostClub && (
                  <TabsTrigger value="budget">
                    Ngân sách & Thu chi{" "}
                    {budget?.is_over_budget ? (
                      <span className="tab-count bg-rose-100 text-rose-700">
                        Thâm hụt
                      </span>
                    ) : (
                      <span className="tab-count">{transactions.length}</span>
                    )}
                  </TabsTrigger>
                )}
              </TabsList>
            </Tabs>
            {tab === "overview" ? (
              <div className="event-detail-grid">
                <section className="panel event-info">
                  <SectionHeader title="Thông tin hoạt động" />
                  <dl className="details-list">
                    {[
                      ["Tên sự kiện", e.event_name],
                      ["Đơn vị tổ chức", e.club_name || "CLB của bạn"],
                      [
                        "Phạm vi",
                        e.scope === "INTERNAL"
                          ? "Nội bộ (Chỉ thành viên CLB)"
                          : "Toàn trường (Công khai)",
                      ],
                      ["Loại hoạt động", labels[e.event_type] || e.event_type],
                      ["Địa điểm", e.location],
                      ["Bắt đầu", dateText(e.start_at, true)],
                      ["Kết thúc", dateText(e.end_at, true)],
                      ["Hạn đăng ký", dateText(e.registration_deadline, true)],
                      [
                        "Ngân sách kế hoạch",
                        money(e.planned_budget || 0),
                      ],
                      ...(staff && isHostClub && budget
                        ? [
                            [
                              "Thực chi hiện tại",
                              budget.is_over_budget
                                ? `${money(budget.actual_expense)} (Thâm hụt: +${money(budget.deficit_amount)})`
                                : money(budget.actual_expense),
                            ],
                          ]
                        : []),
                      [
                        "Xét duyệt",
                        e.approval_required
                          ? "Cán bộ xét duyệt từng đăng ký"
                          : "Tự động xác nhận khi còn chỗ",
                      ],
                      [
                        "Điểm danh",
                        e.attendance_locked ? "Đã khóa kết quả" : "Chưa khóa",
                      ],
                    ].map(([l, v]) => (
                      <div key={l}>
                        <dt>{l}</dt>
                        <dd>{v}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
                <div>
                  <section className="panel registration-card">
                    <SectionHeader title="Tham gia sự kiện" />
                    {mine && (
                      <div className="my-status">
                        <span>Đăng ký của bạn</span>
                        <Badge value={mine.registration_status} />
                      </div>
                    )}
                    {e.event_status === "OPEN" &&
                      e.registration_deadline < localNow() && (
                        <div className="inline-notice">
                          <Clock size={17} />
                          Sự kiện đã hết hạn đăng ký.
                        </div>
                      )}
                    <p>
                      {num(s.confirmed_count)} người đã xác nhận
                      {e.capacity
                        ? ` · Còn ${Math.max(0, e.capacity - s.confirmed_count)} chỗ`
                        : ""}
                    </p>
                    <Progress
                      value={
                        e.capacity ? (s.confirmed_count / e.capacity) * 100 : 0
                      }
                    />
                    {!can("ADMIN") && (
                      <div className="registration-button">
                        {mine &&
                        ["PENDING", "CONFIRMED"].includes(
                          mine.registration_status,
                        ) ? (
                          <Button
                            variant="outline"
                            disabled={
                              e.event_status !== "OPEN" ||
                              e.registration_deadline < localNow()
                            }
                            onClick={() =>
                              setConfirm({
                                action: "cancel-registration",
                                title: "Hủy đăng ký sự kiện?",
                              })
                            }
                          >
                            Hủy đăng ký
                          </Button>
                        ) : (
                          <ActionButton
                            variant="default"
                            disabled={
                              e.event_status !== "OPEN" ||
                              e.registration_deadline < localNow() ||
                              (r.data.membership &&
                                r.data.membership.member_status !== "ACTIVE")
                            }
                            onClick={() =>
                              mutate(`events/${id}/registration`, {
                                action: "register",
                              })
                            }
                          >
                            <Plus size={16} />
                            Đăng ký tham gia
                          </ActionButton>
                        )}
                      </div>
                    )}
                    <small>
                      Đăng ký và hủy đăng ký trước thời hạn công bố.
                    </small>
                  </section>
                  {can("OFFICER", "LEADER") && isHostClub && (
                    <section className="panel event-controls">
                      <SectionHeader title="Điều hành sự kiện" />
                      {e.event_status === "DRAFT" && budget && (
                        <div
                          className={`inline-notice mb-3 ${
                            budget.exceeds_club_fund ? "danger" : ""
                          }`}
                        >
                          <Wallet size={16} className="shrink-0" />
                          <div className="text-xs leading-relaxed">
                            <strong className="block text-sm mb-0.5">
                              Dự toán ngân sách trình duyệt:{" "}
                              {money(budget.planned_budget)}
                            </strong>
                            {budget.exceeds_club_fund ? (
                              <span>
                                Cảnh báo: Ngân sách kế hoạch vượt quá số dư quỹ
                                hiện tại của CLB ({money(budget.club_balance)}),
                                thiếu hụt{" "}
                                <strong>
                                  {money(
                                    budget.planned_budget - budget.club_balance,
                                  )}
                                </strong>
                                . Cần huy động thêm tài trợ/thu phí hoặc điều
                                chỉnh giảm dự toán.
                              </span>
                            ) : (
                              <span>
                                Quỹ CLB hiện có{" "}
                                <strong>{money(budget.club_balance)}</strong> —
                                đủ khả năng đảm bảo ngân sách kế hoạch cho sự
                                kiện này.
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      {budget?.is_over_budget && (
                        <div className="inline-notice danger mb-3">
                          <AlertCircle size={16} className="shrink-0" />
                          <div className="text-xs leading-relaxed">
                            <strong className="block text-sm mb-0.5">
                              Sự kiện đang thâm hụt ngân sách:{" "}
                              +{money(budget.deficit_amount)}
                            </strong>
                            <span>
                              Thực chi đã ghi sổ ({money(budget.actual_expense)})
                              vượt dự toán ban đầu ({money(budget.planned_budget)}
                              ). Xem chi tiết tại tab{" "}
                              <button
                                type="button"
                                className="underline font-semibold"
                                onClick={() => setTab("budget")}
                              >
                                Ngân sách & Thu chi
                              </button>
                              .
                            </span>
                          </div>
                        </div>
                      )}
                      {e.event_status === "DRAFT" && !can("LEADER") && (
                        <div className="inline-notice mb-3">
                          <AlertCircle size={16} />
                          Bản nháp đang chờ Chủ nhiệm câu lạc bộ phê duyệt & công bố.
                        </div>
                      )}
                      {(actions[e.event_status] || [])
                        .filter(
                          ([action]: string[]) =>
                            action !== "publish" || can("LEADER"),
                        )
                        .map(([action, label]: string[]) => (
                          <Button
                            key={action}
                            variant={
                              action === "publish" ? "default" : "outline"
                            }
                            onClick={() =>
                              setConfirm({ action, title: label + "?" })
                            }
                          >
                            {action === "complete" ? (
                              <LockKeyhole size={16} />
                            ) : (
                              <Check size={16} />
                            )}{" "}
                            {label}
                          </Button>
                        ))}
                      {can("LEADER") && e.event_status === "CLOSED" && (
                        <Button
                          variant="outline"
                          onClick={() =>
                            setConfirm({
                              action: "reopen",
                              title: "Mở lại đăng ký?",
                              reason: true,
                            })
                          }
                        >
                          <UnlockKeyhole size={16} />
                          Mở lại đăng ký
                        </Button>
                      )}
                      {can("LEADER") && e.event_status === "COMPLETED" && (
                        <Button
                          variant="outline"
                          onClick={() =>
                            setConfirm({
                              action: "unlock",
                              title: "Mở khóa điểm danh?",
                              reason: true,
                            })
                          }
                        >
                          <UnlockKeyhole size={16} />
                          Mở khóa điểm danh
                        </Button>
                      )}
                      {!["COMPLETED", "CANCELLED"].includes(e.event_status) &&
                        (e.event_status !== "ONGOING" || can("LEADER")) && (
                        <Button
                          variant="ghost"
                          className="danger-text"
                          onClick={() =>
                            setConfirm({
                              action: "cancel",
                              title: "Hủy sự kiện?",
                              reason: true,
                            })
                          }
                        >
                          Hủy sự kiện
                        </Button>
                      )}
                    </section>
                  )}
                </div>
              </div>
            ) : tab === "budget" && budget ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="panel p-5">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Ngân sách kế hoạch
                    </span>
                    <div className="text-2xl font-bold text-slate-900 mt-1">
                      {money(budget.planned_budget)}
                    </div>
                    <p className="text-xs text-slate-500 mt-1.5">
                      Số dư quỹ CLB hiện tại:{" "}
                      <strong>{money(budget.club_balance)}</strong>
                    </p>
                  </div>
                  <div className="panel p-5">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Thực chi (Đã xuất quỹ)
                    </span>
                    <div className="text-2xl font-bold text-slate-900 mt-1">
                      {money(budget.actual_expense)}
                    </div>
                    <p className="text-xs text-slate-500 mt-1.5">
                      Chờ duyệt / chờ xuất quỹ:{" "}
                      <strong>{money(budget.pending_expense)}</strong>
                    </p>
                  </div>
                  <div className="panel p-5">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {budget.is_over_budget
                        ? "Thâm hụt ngân sách"
                        : "Ngân sách còn lại"}
                    </span>
                    <div
                      className={`text-2xl font-bold mt-1 ${
                        budget.is_over_budget
                          ? "text-rose-600"
                          : "text-emerald-600"
                      }`}
                    >
                      {budget.is_over_budget
                        ? `−${money(budget.deficit_amount)}`
                        : money(Math.max(0, budget.budget_variance))}
                    </div>
                    <p className="text-xs text-slate-500 mt-1.5">
                      {budget.is_over_budget
                        ? `Vượt dự toán ${budget.utilization_percent}%`
                        : budget.is_projected_over_budget
                        ? `Dự kiến thâm hụt ${money(budget.projected_deficit_amount)} nếu duyệt hết`
                        : `Đã sử dụng ${budget.utilization_percent}% dự toán`}
                    </p>
                  </div>
                  <div className="panel p-5">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Thu từ sự kiện
                    </span>
                    <div className="text-2xl font-bold text-emerald-700 mt-1">
                      +{money(budget.actual_income)}
                    </div>
                    <p className="text-xs text-slate-500 mt-1.5">
                      Chênh lệch Thu − Chi thực tế:{" "}
                      <strong>
                        {money(budget.actual_income - budget.actual_expense)}
                      </strong>
                    </p>
                  </div>
                </div>

                <section className="panel">
                  <SectionHeader
                    title="Tiến độ giải ngân & Kiểm soát thâm hụt"
                    action={
                      <div className="flex items-center gap-2">
                        {can("OFFICER", "LEADER") &&
                          !["COMPLETED", "CANCELLED"].includes(
                            e.event_status,
                          ) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditing(true)}
                            >
                              <Pencil size={15} />
                              Điều chỉnh dự toán
                            </Button>
                          )}
                        {can("TREASURER") && (
                          <Button
                            size="sm"
                            onClick={() =>
                              navigate("finance?new&event=" + e.event_id)
                            }
                          >
                            <Plus size={15} />
                            Lập phiếu thu / chi
                          </Button>
                        )}
                      </div>
                    }
                  />
                  <div className="mt-2 space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span>
                        Tổng cam kết chi (Thực chi + Chờ duyệt/xuất quỹ):{" "}
                        <strong>{money(budget.total_committed_expense)}</strong>{" "}
                        / Dự toán <strong>{money(budget.planned_budget)}</strong>
                      </span>
                      <span
                        className={`font-semibold ${
                          budget.is_over_budget
                            ? "text-rose-600"
                            : budget.is_projected_over_budget
                            ? "text-amber-600"
                            : "text-emerald-600"
                        }`}
                      >
                        {budget.projected_utilization_percent}%
                      </span>
                    </div>
                    <Progress
                      value={Math.min(100, budget.projected_utilization_percent)}
                    />
                    {budget.is_over_budget && (
                      <div className="inline-notice danger">
                        <AlertCircle size={17} />
                        <div>
                          <strong>
                            Cảnh báo thâm hụt khi triển khai thực tế:
                          </strong>{" "}
                          Tổng thực chi đã xuất quỹ ({money(budget.actual_expense)}
                          ) vượt ngân sách kế hoạch được duyệt (
                          {money(budget.planned_budget)}) là{" "}
                          <strong>{money(budget.deficit_amount)}</strong>.
                        </div>
                      </div>
                    )}
                    {!budget.is_over_budget &&
                      budget.is_projected_over_budget && (
                        <div className="inline-notice">
                          <AlertCircle size={17} />
                          <div>
                            <strong>Cảnh báo sắp vượt dự toán:</strong> Nếu bao
                            gồm cả các khoản chi đang chờ duyệt/xuất quỹ (
                            {money(budget.pending_expense)}), tổng chi sự kiện sẽ
                            lên tới{" "}
                            <strong>
                              {money(budget.total_committed_expense)}
                            </strong>{" "}
                            (vượt dự toán{" "}
                            <strong>
                              {money(budget.projected_deficit_amount)}
                            </strong>
                            ).
                          </div>
                        </div>
                      )}
                  </div>
                </section>

                <section className="panel">
                  <SectionHeader title="Danh sách khoản thu / chi gắn với sự kiện" />
                  <DataTable
                    data={{ rows: transactions }}
                    columns={[
                      {
                        key: "transaction_date",
                        title: "NGÀY",
                        render: (t: Row) => dateText(t.transaction_date),
                      },
                      {
                        key: "description",
                        title: "NỘI DUNG GIAO DỊCH",
                        render: (t: Row) => (
                          <div>
                            <div className="font-medium text-slate-900">
                              {t.description}
                            </div>
                            <small className="text-slate-500">
                              #{String(t.transaction_id).padStart(4, "0")} ·{" "}
                              {t.category_name}
                            </small>
                          </div>
                        ),
                      },
                      {
                        key: "transaction_type",
                        title: "LOẠI",
                        render: (t: Row) => <Badge value={t.transaction_type} />,
                      },
                      {
                        key: "amount",
                        title: "SỐ TIỀN",
                        render: (t: Row) => (
                          <strong
                            className={
                              "amount " +
                              (t.transaction_type === "INCOME"
                                ? "positive"
                                : "")
                            }
                          >
                            {t.transaction_type === "INCOME" ? "+" : "−"}
                            {money(t.amount)}
                          </strong>
                        ),
                      },
                      {
                        key: "creator_name",
                        title: "NGƯỜI LẬP / DUYỆT",
                        render: (t: Row) => (
                          <div className="text-xs">
                            <div>Lập: {t.creator_name || "—"}</div>
                            {t.approver_name && (
                              <div className="text-slate-500">
                                Duyệt: {t.approver_name}
                              </div>
                            )}
                          </div>
                        ),
                      },
                      {
                        key: "transaction_status",
                        title: "TRẠNG THÁI",
                        render: (t: Row) => (
                          <Badge value={t.transaction_status} />
                        ),
                      },
                    ]}
                  />
                </section>
              </div>
            ) : (
              <section className="panel">
                <Roster key={tab} event={e} attendance={tab === "attendance"} />
              </section>
            )}
          </>
        )}
      </LoadState>
      {editing && <EventEditor event={e} onClose={() => setEditing(false)} />}{" "}
      {confirm && (
        <Confirm
          title={confirm.title}
          reason={confirm.reason}
          description={
            confirm.action === "complete"
              ? "Khóa kết quả điểm danh và đánh dấu sự kiện hoàn tất. Mọi người đã xác nhận cần có kết quả điểm danh."
              : confirm.action === "cancel"
                ? "Sự kiện và các đăng ký đang hiệu lực sẽ được chuyển sang đã hủy. Lịch sử được giữ lại."
                : "Xác nhận cập nhật cho sự kiện này."
          }
          onClose={() => setConfirm(null)}
          onConfirm={(note: string) =>
            mutate(
              `events/${id}/${confirm.action === "cancel-registration" ? "registration" : "action"}`,
              {
                action:
                  confirm.action === "cancel-registration"
                    ? "cancel"
                    : confirm.action,
                reason: note,
              },
            )
          }
        />
      )}
    </>
  );
}
export function MyRegistrations() {
  const { navigate } = useApp(),
    f = useFilters(),
    r = useResource("my-registrations?" + f.query);
  return (
    <>
      <PageTitle
        eyebrow="HOẠT ĐỘNG CỦA TÔI"
        title="Đăng ký & lịch sử tham dự"
        description="Theo dõi các sự kiện bạn đã đăng ký và kết quả điểm danh."
      />
      <section className="panel">
        <Filters
          {...f}
          statuses={["PENDING", "CONFIRMED", "REJECTED", "CANCELLED"]}
        />
        <LoadState {...r}>
          <DataTable
            data={r.data}
            page={f.page}
            setPage={f.setPage}
            columns={[
              {
                key: "event_name",
                title: "SỰ KIỆN",
                render: (r) => (
                  <button
                    className="table-link"
                    onClick={() => navigate("events/" + r.event_id)}
                  >
                    {r.event_name}
                  </button>
                ),
              },
              {
                key: "start_at",
                title: "THỜI GIAN",
                render: (r) => dateText(r.start_at, true),
              },
              { key: "location", title: "ĐỊA ĐIỂM" },
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
                    <span className="muted">Chưa ghi nhận</span>
                  ),
              },
              {
                key: "detail",
                title: "",
                render: (r) => (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate("events/" + r.event_id)}
                  >
                    Chi tiết <ArrowUpRight size={15} />
                  </Button>
                ),
              },
            ]}
          />
        </LoadState>
      </section>
    </>
  );
}

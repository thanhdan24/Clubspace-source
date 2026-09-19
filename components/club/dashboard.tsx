"use client";
import {
  Users,
  CalendarDays,
  Wallet,
  Activity,
  ArrowUpRight,
  ArrowRight,
  MapPin,
  Clock,
  Plus,
  UserPlus,
  CheckCheck,
  ReceiptText,
  ChevronRight,
  History,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  useApp,
  useResource,
  LoadState,
  PageTitle,
  Metric,
  SectionHeader,
  EmptyState,
  Avatar,
  Badge,
  labels,
  num,
  money,
  dateText,
  localNow,
} from "./shared";
export function MoneyBars({ rows }: any) {
  if (!rows?.length)
    return (
      <EmptyState
        title="Chưa có giao dịch ghi sổ"
        description="Biểu đồ được cập nhật từ các khoản thu, chi đã ghi sổ."
      />
    );
  const max = Math.max(
    ...rows.flatMap((r: any) => [Number(r.income), Number(r.expense)]),
    1,
  );
  return (
    <div className="money-chart">
      <div className="chart-legend">
        <span>
          <i className="legend-income" />
          Khoản thu
        </span>
        <span>
          <i className="legend-expense" />
          Khoản chi
        </span>
      </div>
      <div className="bar-chart">
        {rows.slice(-6).map((r: any) => (
          <div className="bar-pair" key={r.month}>
            <div className="bar-space">
              <div
                className="bar income"
                style={{
                  height: `${Math.max(2, (Number(r.income) / max) * 100)}%`,
                }}
                title={"Thu: " + money(r.income)}
              >
                <span>{money(r.income)}</span>
              </div>
              <div
                className="bar expense"
                style={{
                  height: `${Math.max(2, (Number(r.expense) / max) * 100)}%`,
                }}
                title={"Chi: " + money(r.expense)}
              >
                <span>{money(r.expense)}</span>
              </div>
            </div>
            <span>Tháng {Number(r.month.slice(5))}</span>
          </div>
        ))}
      </div>
      <p className="chart-caption">
        Đơn vị: VND · Chỉ tính giao dịch đã ghi sổ
      </p>
    </div>
  );
}
export function EventMini({ event }: any) {
  const { navigate } = useApp();
  const d = new Date(event.start_at + "+07:00");
  const expired =
    event.registration_deadline < localNow() && event.event_status === "OPEN";
  return (
    <button
      className="event-mini"
      onClick={() => navigate("events/" + event.event_id)}
    >
      <span className="event-date">
        <small>THÁNG {d.getMonth() + 1}</small>
        <strong>{String(d.getDate()).padStart(2, "0")}</strong>
      </span>
      <span className="event-mini-body">
        <span className="event-type">
          {labels[event.event_type] || event.event_type}
        </span>
        <strong>{event.event_name}</strong>
        <span className="event-meta">
          <MapPin size={13} />
          {event.location}
          <span>·</span>
          {String(event.start_at).slice(11, 16)}
        </span>
      </span>
      <span className="event-mini-end">
        <Badge value={event.event_status} />
        <small>
          {expired
            ? "Đã hết hạn đăng ký"
            : `${num(event.confirmed_count)} người xác nhận`}
        </small>
      </span>
      <ChevronRight size={18} />
    </button>
  );
}
export default function Dashboard() {
  const { session, can, navigate, activeClub, staff } = useApp(),
    r = useResource("dashboard");
  const d = r.data;
  const today = new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date());
  return (
    <>
      <PageTitle
        eyebrow="TỔNG QUAN"
        title={`Xin chào, ${session.user.full_name.split("·")[0].trim().split(" ").slice(-2).join(" ")}!`}
        description={today}
      >
        {can("OFFICER") && (
          <Button onClick={() => navigate("events?new")}>
            <Plus size={17} />
            Tạo sự kiện
          </Button>
        )}
      </PageTitle>
      <LoadState {...r}>
        {d && (
          <>
            <div className="club-banner">
              <div className="club-banner-copy">
                <span className="banner-label">KHÔNG GIAN CỦA CHÚNG TA</span>
                <h2>{activeClub?.club_name}</h2>
                <p>
                  {activeClub?.description ||
                    "Theo dõi hoạt động và kết nối các thành viên."}
                </p>
                <button onClick={() => navigate("events")}>
                  Khám phá các hoạt động <ArrowRight size={16} />
                </button>
              </div>
              <div className="banner-monogram" aria-hidden="true">
                <span>
                  {activeClub?.club_code?.includes("CNTT") ? "IT" : "CLB"}
                </span>
                <div className="banner-orbit" />
                <div className="banner-orbit two" />
              </div>
            </div>
            <div className="metrics-grid">
              {d.personal ? (
                <>
                  <Metric
                    label="Đăng ký của bạn"
                    value={num(d.stats.registrations)}
                    caption="Toàn bộ lịch sử sự kiện"
                    icon={CalendarDays}
                  />
                  <Metric
                    label="Đã xác nhận"
                    value={num(d.stats.confirmed)}
                    caption="Đăng ký được chấp nhận"
                    icon={CheckCheck}
                    tone="blue"
                  />
                  <Metric
                    label="Đã tham gia"
                    value={num(d.stats.attended)}
                    caption="Có mặt hoặc đến muộn"
                    icon={Activity}
                    tone="orange"
                  />
                  <Metric
                    label="Trạng thái thành viên"
                    value={labels[d.membership.member_status]}
                    caption={d.membership.member_code}
                    icon={Users}
                  />
                </>
              ) : (
                <>
                  <Metric
                    label="Tổng thành viên"
                    value={num(d.counts.total)}
                    caption={`${num(d.counts.active)} thành viên đang sinh hoạt`}
                    icon={Users}
                  />
                  <Metric
                    label="Sự kiện của CLB"
                    value={num(d.stats.events)}
                    caption={`${num(d.stats.open)} sự kiện đang công bố`}
                    icon={CalendarDays}
                    tone="blue"
                  />
                  {d.fund ? (
                    <Metric
                      label="Số dư quỹ"
                      value={money(d.fund.balance)}
                      caption="Từ các khoản đã ghi sổ"
                      icon={Wallet}
                    />
                  ) : (
                    <Metric
                      label="Lượt đăng ký"
                      value={num(d.stats.registrations)}
                      caption={`${num(d.stats.pending)} đăng ký đang chờ duyệt`}
                      icon={CheckCheck}
                    />
                  )}
                  <Metric
                    label="Tỷ lệ tham dự"
                    value={d.stats.attendance + "%"}
                    caption="Các sự kiện đã hoàn tất"
                    icon={Activity}
                    tone="orange"
                  />
                </>
              )}
            </div>
            <div className="dashboard-columns">
              <div className="dashboard-primary">
                <section className="panel">
                  <SectionHeader
                    title={
                      d.personal
                        ? "Sự kiện dành cho bạn"
                        : "Hoạt động câu lạc bộ"
                    }
                  >
                    <button
                      className="text-link"
                      onClick={() => navigate("events")}
                    >
                      Xem tất cả <ArrowUpRight size={16} />
                    </button>
                  </SectionHeader>
                  <div className="event-list">
                    {d.events?.length ? (
                      d.events
                        .slice(0, 3)
                        .map((e: any) => (
                          <EventMini key={e.event_id} event={e} />
                        ))
                    ) : (
                      <EmptyState
                        title="Chưa có sự kiện"
                        description="Các hoạt động của câu lạc bộ sẽ xuất hiện tại đây."
                      />
                    )}
                  </div>
                </section>
                {d.fund ? (
                  <section className="panel">
                    <SectionHeader title="Bức tranh thu chi">
                      <button
                        className="text-link"
                        onClick={() => navigate("finance")}
                      >
                        Sổ quỹ <ArrowUpRight size={16} />
                      </button>
                    </SectionHeader>
                    <div className="finance-totals">
                      <div>
                        <span>Tổng thu</span>
                        <strong className="positive">
                          {money(d.fund.total_income)}
                        </strong>
                      </div>
                      <div>
                        <span>Tổng chi</span>
                        <strong>{money(d.fund.total_expense)}</strong>
                      </div>
                    </div>
                    <MoneyBars rows={d.monthly} />
                  </section>
                ) : (
                  <section className="panel">
                    <SectionHeader
                      title={d.personal ? "Lịch sử tham gia" : "Thành viên mới"}
                    >
                      <button
                        className="text-link"
                        onClick={() =>
                          navigate(d.personal ? "registrations" : "members")
                        }
                      >
                        Xem thêm <ArrowRight size={16} />
                      </button>
                    </SectionHeader>
                    {(d.personal ? d.rows : d.recentMembers)?.length ? (
                      d.personal ? (
                        d.rows.slice(0, 4).map((row: any) => (
                          <div className="simple-row" key={row.registration_id}>
                            <CalendarDays size={20} />
                            <div>
                              <strong>{row.event_name}</strong>
                              <span>{dateText(row.start_at)}</span>
                            </div>
                            <Badge
                              value={
                                row.attendance_status || row.registration_status
                              }
                            />
                          </div>
                        ))
                      ) : (
                        d.recentMembers.map((m: any, i: number) => (
                          <div className="simple-row" key={m.member_code}>
                            <Avatar name={m.full_name} index={i} />
                            <div>
                              <strong>{m.full_name}</strong>
                              <span>{m.department_name}</span>
                            </div>
                            <small>{dateText(m.join_date)}</small>
                          </div>
                        ))
                      )
                    ) : (
                      <EmptyState />
                    )}
                  </section>
                )}
              </div>
              <aside className="dashboard-secondary">
                <section className="panel quick-actions">
                  <SectionHeader title="Thao tác nhanh" />
                  <div className="quick-grid">
                    {can("OFFICER") && (
                      <button onClick={() => navigate("members?new")}>
                        <span>
                          <UserPlus size={20} />
                        </span>
                        Thêm thành viên
                      </button>
                    )}
                    {can("OFFICER") && (
                      <button onClick={() => navigate("events?new")}>
                        <span>
                          <CalendarDays size={20} />
                        </span>
                        Tạo sự kiện
                      </button>
                    )}
                    {can("TREASURER") && (
                      <button onClick={() => navigate("finance?new")}>
                        <span>
                          <Wallet size={20} />
                        </span>
                        Thêm thu chi
                      </button>
                    )}
                    {can("LEADER") && (
                      <button onClick={() => navigate("approvals")}>
                        <span>
                          <CheckCheck size={20} />
                        </span>
                        Phê duyệt chi
                      </button>
                    )}
                    <button onClick={() => navigate("reports")}>
                      <span>
                        <ReceiptText size={20} />
                      </span>
                      Xem báo cáo
                    </button>
                    <button onClick={() => navigate("profile")}>
                      <span>
                        <Users size={20} />
                      </span>
                      Hồ sơ cá nhân
                    </button>
                  </div>
                </section>
                {d.departments && (
                  <section className="panel departments">
                    <SectionHeader title="Các ban & nhóm" />
                    <p className="section-note">Thành viên đang sinh hoạt</p>
                    {d.departments.map((item: any, i: number) => (
                      <div className="department-row" key={item.name}>
                        <div>
                          <span>
                            <i
                              className={"department-color color-" + (i % 5)}
                            />
                            {item.name}
                          </span>
                          <strong>{item.value}</strong>
                        </div>
                        <Progress
                          value={
                            (Number(item.value) /
                              Math.max(1, Number(d.counts.active))) *
                            100
                          }
                        />
                      </div>
                    ))}
                  </section>
                )}
                {d.pending?.length > 0 && (
                  <section className="panel approval-summary">
                    <span className="pending-icon">
                      <Clock size={21} />
                    </span>
                    <h3>{d.pending.length} đề nghị đang chờ</h3>
                    <p>
                      Tổng giá trị{" "}
                      {money(
                        d.pending.reduce(
                          (n: number, t: any) => n + Number(t.amount),
                          0,
                        ),
                      )}
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => navigate("approvals")}
                    >
                      Xem đề nghị <ArrowRight size={16} />
                    </Button>
                  </section>
                )}
                {d.personal && (
                  <section className="panel personal-card">
                    <span className="eyebrow">THẺ THÀNH VIÊN</span>
                    <Avatar name={session.user.full_name} />
                    <h3>{session.user.full_name.split("·")[0]}</h3>
                    <p>{d.membership.member_code}</p>
                    <Badge value={d.membership.member_status} />
                    <small>Gia nhập {dateText(d.membership.join_date)}</small>
                  </section>
                )}
              </aside>
            </div>
            {d.activity?.length > 0 && (
              <section className="panel activity-panel">
                <SectionHeader title="Hoạt động gần đây">
                  <button
                    className="text-link"
                    onClick={() => navigate("audit")}
                  >
                    Nhật ký hoạt động <ArrowUpRight size={16} />
                  </button>
                </SectionHeader>
                <div className="activity-grid">
                  {d.activity.slice(0, 3).map((a: any) => (
                    <div className="activity-item" key={a.audit_id}>
                      <span>
                        <History size={17} />
                      </span>
                      <div>
                        <strong>{a.full_name?.split("·")[0]}</strong>
                        <p>{actionLabel(a.action_code)}</p>
                        <small>{dateText(a.created_at, true)}</small>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </LoadState>
    </>
  );
}
export function actionLabel(a: string) {
  const map: Record<string, string> = {
    ASSIGN_ROLE: "Cập nhật phân quyền",
    CHANGE_MEMBER_STATUS: "Thay đổi trạng thái thành viên",
    UPDATE_MEMBER: "Cập nhật hồ sơ thành viên",
    CREATE_EVENT: "Tạo sự kiện",
    UPDATE_EVENT: "Cập nhật sự kiện",
    PUBLISH_EVENT: "Công bố sự kiện",
    APPROVE_EXPENSE: "Phê duyệt khoản chi",
    REJECT_EXPENSE: "Từ chối khoản chi",
    LOCK_ATTENDANCE: "Khóa điểm danh",
    CREATE_TRANSACTION: "Lập giao dịch",
    APPROVE_TRANSACTION: "Phê duyệt khoản chi",
    POST_TRANSACTION: "Ghi sổ giao dịch",
    RECORD_ATTENDANCE: "Ghi nhận điểm danh",
    REGISTER_EVENT: "Đăng ký sự kiện",
    CREATE_MEMBER: "Thêm thành viên",
    UPDATE_PROFILE: "Cập nhật hồ sơ",
    CREATE_ACCOUNT: "Tạo tài khoản",
    UPDATE_ACCOUNT: "Cập nhật tài khoản",
    CLOSE_EVENT: "Chốt danh sách",
    START_EVENT: "Bắt đầu sự kiện",
    COMPLETE_EVENT: "Hoàn tất sự kiện",
    CANCEL_EVENT: "Hủy sự kiện",
    REVIEW_REGISTRATION: "Duyệt đăng ký",
  };
  return map[a] || a.toLowerCase().replaceAll("_", " ");
}

"use client";
import { useState, useMemo, useEffect } from "react";
import {
  Plus,
  Download,
  MoreHorizontal,
  Pencil,
  History,
  LockKeyhole,
  UnlockKeyhole,
  UserRound,
  ShieldCheck,
  Building2,
  ArrowUpRight,
  KeyRound,
  Check,
  Trash2,
  Compass,
  Clock,
  Loader2,
  LogOut,
  Upload,
  Paperclip,
  FileText,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
  Avatar,
  Badge,
  SelectBox,
  opts,
  labels,
  dateText,
  localNow,
  SectionHeader,
  EmptyState,
  fetchApi,
  type Row,
  type Field,
} from "./shared";
import { actionLabel } from "./dashboard";
export const memberStatuses = ["ACTIVE", "PAUSED", "LEFT"];
export const clubPositions = [
  "Thành viên",
  "Chủ nhiệm",
  "Phó chủ nhiệm",
  "Trưởng ban",
  "Phó ban",
  "Thủ quỹ",
  "Cán bộ / Ủy viên",
  "Cộng tác viên",
];
const rowName = (r: Row, i: number) => (
  <div className="person-cell">
    <Avatar name={r.full_name} index={i} />
    <div>
      <strong>{r.full_name}</strong>
      <small>{r.student_code || r.username || r.member_code}</small>
    </div>
  </div>
);
function MemberDetail({ id, onClose }: any) {
  const r = useResource("members/" + id);
  return (
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="detail-sheet">
        <SheetHeader>
          <SheetTitle>Hồ sơ thành viên</SheetTitle>
          <SheetDescription>
            Thông tin sinh hoạt và lịch sử trạng thái.
          </SheetDescription>
        </SheetHeader>
        <div className="sheet-body">
          <LoadState {...r}>
            {r.data && (
              <>
                <div className="profile-heading">
                  <Avatar name={r.data.user.full_name} />
                  <div>
                    <h2>{r.data.user.full_name}</h2>
                    <span className="text-sm text-muted-foreground">
                      {r.data.member.position_name || "Thành viên"}
                      {r.data.member.department_name
                        ? ` · ${r.data.member.department_name}`
                        : ""}
                    </span>
                  </div>
                  <Badge value={r.data.member.member_status} />
                </div>
                {r.data.member.member_status === "PAUSED" && (
                  <div className="p-3 my-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
                    <Clock size={16} className="shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-medium">
                        Thành viên đang tạm ngưng sinh hoạt
                      </strong>
                      <span className="text-muted-foreground">
                        Tạm thời ngừng tham gia hoạt động và biểu quyết trong CLB.
                      </span>
                    </div>
                  </div>
                )}
                {r.data.member.member_status === "LEFT" && (
                  <div className="p-3 my-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                    <LogOut size={16} className="shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-medium">
                        Thành viên đã rời câu lạc bộ
                      </strong>
                      <span>
                        Chính thức thôi sinh hoạt
                        {r.data.member.leave_date
                          ? ` từ ngày ${dateText(r.data.member.leave_date)}`
                          : ""}
                        .
                      </span>
                    </div>
                  </div>
                )}
                <dl className="details-list">
                  {[
                    ["Mã thành viên", r.data.member.member_code],
                    ["Ban / nhóm", r.data.member.department_name || "Chưa phân ban"],
                    ["Chức vụ", r.data.member.position_name || "Thành viên"],
                    ["Ngày gia nhập", dateText(r.data.member.join_date)],
                    ...(r.data.member.leave_date
                      ? [["Ngày rời CLB", dateText(r.data.member.leave_date)]]
                      : []),
                    ["Email", r.data.user.email],
                    ["Điện thoại", r.data.user.phone],
                    ["Khoa", r.data.user.faculty],
                    ["Lớp", r.data.user.class_name],
                  ].map(([l, v]) => (
                    <div key={l}>
                      <dt>{l}</dt>
                      <dd>{v || "—"}</dd>
                    </div>
                  ))}
                </dl>
                <h3 className="subheading">Lịch sử trạng thái</h3>
                {r.data.history.length ? (
                  r.data.history.map((h: Row) => (
                    <div className="history-row" key={h.history_id}>
                      <span className="history-line" />
                      <div>
                        <Badge value={h.new_status} />
                        <p>{h.reason}</p>
                        <small>
                          {h.full_name} · {dateText(h.changed_at, true)}
                        </small>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState title="Chưa có thay đổi trạng thái" />
                )}
              </>
            )}
          </LoadState>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function JoinRequestsSection({
  hideTitle = false,
}: {
  hideTitle?: boolean;
}) {
  const { club, mutate, refresh, navigate } = useApp();
  const reqFilter = useFilters();
  const reqResource = useResource("join-requests?" + reqFilter.query);
  const options = useResource("options");
  const [approveModal, setApproveModal] = useState<Row | null>(null);
  const [rejectModal, setRejectModal] = useState<Row | null>(null);
  const [selectedDept, setSelectedDept] = useState("Ban Thành viên");
  const [selectedPosition, setSelectedPosition] = useState("Thành viên");
  const [customDept, setCustomDept] = useState("");
  const [isCreatingNewDept, setIsCreatingNewDept] = useState(false);

  const activeDepts = useMemo(() => {
    return (options.data?.departments || []).filter(
      (d: any) => d.active_flag !== 0,
    );
  }, [options.data?.departments]);

  useEffect(() => {
    if (approveModal) {
      setIsCreatingNewDept(false);
      setCustomDept("");
      setSelectedPosition("Thành viên");
      if (activeDepts.length > 0) {
        setSelectedDept(activeDepts[0].department_name);
      } else {
        setSelectedDept("Ban Thành viên");
      }
    }
  }, [approveModal, activeDepts]);

  return (
    <>
      {!hideTitle && (
        <PageTitle
          eyebrow="XÉT DUYỆT THÀNH VIÊN"
          title="Đơn đăng ký tham gia CLB"
          description="Xét duyệt sinh viên đăng ký tham gia câu lạc bộ và phân ban sinh hoạt."
        />
      )}
      <section className="panel">
        <Filters
          q={reqFilter.q}
          setQ={reqFilter.setQ}
          status={reqFilter.status}
          setStatus={reqFilter.setStatus}
          statuses={["PENDING", "APPROVED", "REJECTED"]}
        />
        <LoadState {...reqResource} variant="table">
          <DataTable
            data={reqResource.data}
            page={reqFilter.page}
            setPage={reqFilter.setPage}
            columns={[
              {
                key: "student",
                title: "SINH VIÊN",
                render: (r: Row) => (
                  <div className="person-cell">
                    <Avatar name={r.full_name} />
                    <div>
                      <strong>{r.full_name}</strong>
                      <small>{r.student_code || r.email || r.username}</small>
                    </div>
                  </div>
                ),
              },
              {
                key: "faculty",
                title: "KHOA / LỚP",
                render: (r: Row) => (
                  <span>
                    {r.faculty || "—"}
                    {r.class_name ? ` · ${r.class_name}` : ""}
                  </span>
                ),
              },
              {
                key: "contact",
                title: "LIÊN HỆ",
                render: (r: Row) => (
                  <div className="text-xs leading-relaxed">
                    <div>{r.email || "—"}</div>
                    <div className="text-muted">{r.phone || ""}</div>
                  </div>
                ),
              },
              {
                key: "message",
                title: "LỜI NHẮN / NGUYỆN VỌNG",
                render: (r: Row) => (
                  <span
                    className="line-clamp-2 max-w-xs text-xs"
                    title={r.message || ""}
                  >
                    {r.message || "—"}
                  </span>
                ),
              },
              {
                key: "attachment",
                title: "HỒ SƠ ĐÍNH KÈM",
                render: (r: Row) =>
                  r.file_url ? (
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1.5 font-medium border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
                    >
                      <a
                        href={r.file_url + "?club=" + club}
                        download={r.file_name || "ho-so-dinh-kem"}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={r.file_name || "Xem tệp đính kèm"}
                      >
                        <Paperclip size={13} />
                        <span className="max-w-[120px] truncate">
                          {r.file_name || "Tải hồ sơ"}
                        </span>
                      </a>
                    </Button>
                  ) : (
                    <span className="text-muted text-xs">—</span>
                  ),
              },
              {
                key: "created_at",
                title: "NGÀY NỘP",
                render: (r: Row) => dateText(r.created_at, true),
              },
              {
                key: "status",
                title: "TRẠNG THÁI",
                render: (r: Row) => <Badge value={r.status} />,
              },
              {
                key: "actions",
                title: "",
                render: (r: Row) =>
                  r.status === "PENDING" ? (
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => setApproveModal(r)}
                      >
                        Duyệt
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setRejectModal(r)}
                      >
                        Từ chối
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-muted">
                      {r.reviewer_name
                        ? `${r.status === "APPROVED" ? "Duyệt" : "Từ chối"}: ${r.reviewer_name}`
                        : "—"}
                    </span>
                  ),
              },
            ]}
          />
        </LoadState>
      </section>

      {approveModal && (
        <Dialog open onOpenChange={(v) => !v && setApproveModal(null)}>
          <DialogContent className="editor-dialog">
            <DialogHeader>
              <DialogTitle>Duyệt đơn gia nhập câu lạc bộ</DialogTitle>
              <DialogDescription>
                Phê duyệt sinh viên <strong>{approveModal.full_name}</strong> (
                {approveModal.student_code || approveModal.email}) vào câu lạc
                bộ.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {approveModal.message && (
                <div className="bg-muted p-3.5 rounded-xl text-sm">
                  <span className="text-muted block text-xs mb-1 font-medium">
                    Lời nhắn của sinh viên:
                  </span>
                  <p className="italic font-normal">"{approveModal.message}"</p>
                </div>
              )}
              {approveModal.file_url && (
                <div className="flex items-center justify-between p-3.5 rounded-xl border border-primary/20 bg-primary/5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileText size={18} className="text-primary shrink-0" />
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-foreground truncate block">
                        {approveModal.file_name ||
                          "Hồ sơ đính kèm của ứng viên"}
                      </span>
                      <span className="text-[11px] text-muted block">
                        Tệp nộp kèm đơn đăng ký
                      </span>
                    </div>
                  </div>
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1 text-primary shrink-0 font-medium"
                  >
                    <a
                      href={approveModal.file_url + "?club=" + club}
                      download={approveModal.file_name || "ho-so"}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Download size={13} />
                      Tải về
                    </a>
                  </Button>
                </div>
              )}
              <div className="field">
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="dept-select" className="font-semibold text-sm">
                    Phân ban / nhóm sinh hoạt
                  </label>
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline font-medium"
                    onClick={() => setIsCreatingNewDept(!isCreatingNewDept)}
                  >
                    {isCreatingNewDept ? "← Chọn từ ban có sẵn" : "+ Tạo ban / nhóm mới"}
                  </button>
                </div>
                {isCreatingNewDept ? (
                  <div>
                    <Input
                      placeholder="Nhập tên ban / nhóm mới cho CLB..."
                      value={customDept}
                      onChange={(e: any) => setCustomDept(e.target.value)}
                      maxLength={100}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Ban này sẽ được tự động lưu vào cơ sở dữ liệu CLB khi bạn duyệt.
                    </p>
                  </div>
                ) : (
                  <div>
                    <SelectBox
                      label="Chọn ban / nhóm"
                      value={selectedDept}
                      onChange={setSelectedDept}
                      options={
                        activeDepts.length > 0
                          ? activeDepts.map((d: any) => ({
                              value: d.department_name,
                              label: `${d.department_name}${d.description ? ` (${d.description})` : ""}`,
                            }))
                          : [
                              {
                                value: "Ban Thành viên",
                                label: "Ban Thành viên (Chung)",
                              },
                              {
                                value: "Ban Kỹ thuật",
                                label: "Ban Kỹ thuật / Dự án",
                              },
                              {
                                value: "Ban Truyền thông",
                                label: "Ban Truyền thông & Báo chí",
                              },
                              {
                                value: "Ban Sự kiện",
                                label: "Ban Sự kiện & Hoạt động",
                              },
                              {
                                value: "Ban Tài chính",
                                label: "Ban Tài chính",
                              },
                            ]
                      }
                    />
                    <div className="flex items-center justify-between mt-1.5 text-xs text-muted-foreground">
                      <span>Dữ liệu lấy từ danh mục ban / nhóm của CLB.</span>
                      <button
                        type="button"
                        className="text-primary hover:underline font-medium inline-flex items-center gap-1"
                        onClick={() => {
                          setApproveModal(null);
                          navigate("departments");
                        }}
                      >
                        Quản lý ban / nhóm →
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div className="field mt-3">
                <label className="font-semibold text-sm mb-1.5 block">
                  Chức vụ khi gia nhập
                </label>
                <SelectBox
                  label="Chọn chức vụ"
                  value={selectedPosition}
                  onChange={setSelectedPosition}
                  options={clubPositions.map((pos) => ({
                    value: pos,
                    label: pos,
                  }))}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Mặc định phân công chức vụ "Thành viên" khi mới gia nhập câu lạc bộ.
                </p>
              </div>
            </div>
            <div className="editor-footer">
              <Button variant="outline" onClick={() => setApproveModal(null)}>
                Hủy
              </Button>
              <Button
                onClick={async () => {
                  const deptToAssign = isCreatingNewDept
                    ? customDept.trim()
                    : selectedDept;
                  if (isCreatingNewDept && !deptToAssign) {
                    toast.error("Vui lòng nhập tên ban / nhóm mới.");
                    return;
                  }
                  await mutate(
                    "join-requests/" + approveModal.request_id,
                    {
                      status: "APPROVED",
                      department_name: deptToAssign,
                      position_name: selectedPosition || "Thành viên",
                    },
                    "PATCH",
                  );
                  toast.success(
                    `Đã duyệt và phân sinh viên vào "${deptToAssign}"!`,
                  );
                  setApproveModal(null);
                  refresh();
                }}
              >
                Xác nhận kết nạp
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {rejectModal && (
        <Confirm
          title="Từ chối đơn gia nhập?"
          description={`Bạn có chắc muốn từ chối đơn của sinh viên ${rejectModal.full_name} (${rejectModal.student_code || rejectModal.email})?`}
          reason={true}
          onClose={() => setRejectModal(null)}
          onConfirm={async (reason: string) => {
            await mutate(
              "join-requests/" + rejectModal.request_id,
              {
                status: "REJECTED",
                reason,
              },
              "PATCH",
            );
            toast.success("Đã từ chối đơn đăng ký.");
            setRejectModal(null);
            refresh();
          }}
        />
      )}
    </>
  );
}

export function Members({
  initialTab = "members",
}: {
  initialTab?: "members" | "requests";
} = {}) {
  const { can, mutate, club, refresh, route } = useApp();
  const urlDept = useMemo(() => {
    if (typeof window !== "undefined") {
      const currentRoute =
        (typeof route === "string" ? route : "") ||
        (window.location.hash ? window.location.hash.slice(1) : "");
      const match = currentRoute.match(/[?&]department=([^&]+)/);
      return match ? decodeURIComponent(match[1]) : "";
    }
    return "";
  }, [route]);
  const [deptFilter, setDeptFilter] = useState(urlDept);
  useEffect(() => {
    if (urlDept) setDeptFilter(urlDept);
  }, [urlDept]);

  const f = useFilters();
  const membersQuery = `${f.query}${deptFilter ? `&department=${encodeURIComponent(deptFilter)}` : ""}`;
  const r = useResource("members?" + membersQuery);
  const options = useResource("options");
  const isOfficerOrLeader = can("OFFICER", "LEADER");
  const [tab, setTab] = useState<"members" | "requests">(initialTab);
  const pendingRequests = useResource(
    isOfficerOrLeader ? "join-requests?status=PENDING" : null,
  );
  const [editing, setEditing] = useState<Row | null>(
      typeof window !== "undefined" && window.location.hash.includes("?new")
        ? {}
        : null,
    ),
    [view, setView] = useState<number | null>(null);

  const activeDepts = useMemo(() => {
    return (options.data?.departments || []).filter(
      (d: any) => d.active_flag !== 0,
    );
  }, [options.data?.departments]);

  const getFields = (values: Row): Field[] => {
    const isNew = !editing?.club_member_id;
    const currentStatus =
      values.member_status || editing?.member_status || "ACTIVE";
    const isLeft = currentStatus === "LEFT";
    const statusChanged =
      editing?.club_member_id && currentStatus !== editing.member_status;

    return [
      ...(isNew
        ? [
            {
              name: "user_id",
              label: "Tài khoản thành viên",
              type: "select",
              required: true,
              options: [
                { value: "", label: "Chọn tài khoản" },
                ...(options.data?.users || []).map((u: Row) => ({
                  value: u.user_id,
                  label: u.full_name + " · " + u.username,
                })),
              ],
            },
          ]
        : []),
      {
        name: "member_code",
        label: "Mã thành viên",
        placeholder: options.data?.next_member_code || "Tự động sinh theo quy định CLB",
        help: isNew
          ? `Mã thành viên được hệ thống tự động sinh và tăng dần (${options.data?.next_member_code || "theo tiền tố " + (options.data?.member_code_prefix || "CLB")}) theo quy định của Ban chủ nhiệm.`
          : "Mã định danh thành viên trong câu lạc bộ.",
        disabled: true,
        readOnly: true,
        maxLength: 30,
      },
      {
        name: "join_date",
        label: "Ngày gia nhập",
        type: "date",
        required: true,
      },
      {
        name: "department_name",
        label: "Ban / nhóm",
        type: "select",
        options: [
          { value: "", label: "Chưa phân ban / Không thuộc ban nào" },
          ...activeDepts.map((d: any) => ({
            value: d.department_name,
            label: d.department_name,
          })),
          ...(values.department_name &&
          !activeDepts.some(
            (d: any) => d.department_name === values.department_name,
          )
            ? [{ value: values.department_name, label: values.department_name }]
            : []),
        ],
        maxLength: 120,
      },
      {
        name: "position_name",
        label: "Chức vụ",
        type: "select",
        required: true,
        options: [
          ...clubPositions.map((p) => ({ value: p, label: p })),
          ...(values.position_name &&
          !clubPositions.includes(values.position_name)
            ? [{ value: values.position_name, label: values.position_name }]
            : []),
        ],
      },
      ...(!isNew
        ? [
            {
              name: "member_status",
              label: "Trạng thái sinh hoạt",
              type: "select",
              options: opts(memberStatuses),
              required: true,
              help: isLeft
                ? "Thành viên rời CLB sẽ được ghi nhận và vô hiệu hóa vai trò cán bộ trong CLB."
                : currentStatus === "PAUSED"
                  ? "Tạm ngưng sinh hoạt tại CLB (không tham gia biểu quyết/hoạt động)."
                  : "Đang sinh hoạt bình thường tại câu lạc bộ.",
            },
            ...(isLeft
              ? [
                  {
                    name: "leave_date",
                    label: "Ngày rời CLB",
                    type: "date",
                    required: true,
                    help: "Bắt buộc khi trạng thái là 'Đã rời CLB'.",
                  },
                ]
              : []),
            {
              name: "reason",
              label: statusChanged
                ? `Lý do đổi sang "${labels[currentStatus] || currentStatus}"`
                : "Lý do thay đổi trạng thái",
              type: "textarea",
              wide: true,
              required: statusChanged,
              help: statusChanged
                ? "Bắt buộc nhập lý do khi thay đổi trạng thái sinh hoạt."
                : "Ghi chú thêm nếu cần cập nhật thông tin.",
              maxLength: 500,
            },
          ]
        : []),
    ];
  };
  return (
    <>
      <PageTitle
        eyebrow="QUẢN LÝ THÀNH VIÊN"
        title="Những người làm nên câu lạc bộ"
        description="Hồ sơ, ban nhóm và hành trình sinh hoạt của từng thành viên."
      >
        <ExportButton path={"members?" + membersQuery} />
        {can("OFFICER") && (
          <Button
            onClick={() => setEditing({ join_date: localNow().slice(0, 10) })}
          >
            <Plus />
            Thêm thành viên
          </Button>
        )}
      </PageTitle>
      {isOfficerOrLeader && (
        <Tabs
          value={tab}
          onValueChange={(v: any) => setTab(v)}
          className="page-tabs mb-4"
        >
          <TabsList variant="line">
            <TabsTrigger value="members">Danh sách thành viên</TabsTrigger>
            <TabsTrigger value="requests">
              Đơn xin gia nhập
              {Number(pendingRequests.data?.total) > 0 && (
                <span className="tab-count">{pendingRequests.data.total}</span>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}
      {tab === "members" ? (
        <section className="panel">
          <Filters {...f} statuses={memberStatuses}>
            <SelectBox
              label="Lọc ban / nhóm"
              value={deptFilter}
              onChange={(v: string) => {
                setDeptFilter(v);
                f.setPage(1);
              }}
              options={[
                { value: "", label: "Tất cả ban / nhóm" },
                ...activeDepts.map((d: any) => ({
                  value: d.department_name,
                  label: d.department_name,
                })),
              ]}
            />
          </Filters>
          <LoadState {...r} variant="table">
            <DataTable
              data={r.data}
              page={f.page}
              setPage={f.setPage}
              columns={[
                { key: "name", title: "THÀNH VIÊN", render: rowName },
                { key: "member_code", title: "MÃ THÀNH VIÊN" },
                {
                  key: "department_name",
                  title: "BAN / NHÓM",
                  render: (r: Row) =>
                    r.department_name ? (
                      <span className="font-medium text-foreground">
                        {r.department_name}
                      </span>
                    ) : (
                      <span className="text-muted-foreground italic text-xs">
                        Chưa phân ban
                      </span>
                    ),
                },
                {
                  key: "position_name",
                  title: "CHỨC VỤ",
                  render: (r: Row) => (
                    <div>
                      <span className="font-medium text-foreground">
                        {r.position_name || "Thành viên"}
                      </span>
                      {r.member_status === "LEFT" && (
                        <span className="block text-[11px] text-muted-foreground">
                          (Cựu thành viên)
                        </span>
                      )}
                    </div>
                  ),
                },
                {
                  key: "join_date",
                  title: "THỜI GIAN",
                  render: (r: Row) => (
                    <div className="text-xs space-y-0.5">
                      <div>Gia nhập: {dateText(r.join_date)}</div>
                      {r.leave_date && (
                        <div className="text-muted-foreground">
                          Rời: {dateText(r.leave_date)}
                        </div>
                      )}
                    </div>
                  ),
                },
                {
                  key: "member_status",
                  title: "TRẠNG THÁI",
                  render: (r: Row) => <Badge value={r.member_status} />,
                },
                {
                  key: "actions",
                  title: "",
                  render: (r) => (
                    <div className="row-actions">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={"Xem hồ sơ " + r.full_name}
                        onClick={() => setView(r.club_member_id)}
                      >
                        <UserRound size={17} />
                      </Button>
                      {can("OFFICER", "LEADER") && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={"Sửa " + r.full_name}
                          onClick={() => setEditing(r)}
                        >
                          <Pencil size={17} />
                        </Button>
                      )}
                    </div>
                  ),
                },
              ]}
            />
          </LoadState>
        </section>
      ) : (
        <JoinRequestsSection hideTitle={true} />
      )}
      {editing && (
        <Editor
          title={
            editing.club_member_id ? "Cập nhật thành viên" : "Thêm thành viên"
          }
          fields={getFields}
          initial={{
            join_date: localNow().slice(0, 10),
            position_name: "Thành viên",
            member_code:
              editing.club_member_id
                ? editing.member_code
                : options.data?.next_member_code || "",
            ...editing,
            leave_date:
              editing?.leave_date ||
              (editing?.member_status === "LEFT"
                ? localNow().slice(0, 10)
                : ""),
          }}
          onClose={() => setEditing(null)}
          onSave={(v: Row) => {
            const isLeft = v.member_status === "LEFT";
            return mutate(
              editing.club_member_id
                ? "members/" + editing.club_member_id
                : "members",
              {
                ...v,
                member_code: editing.club_member_id
                  ? v.member_code
                  : options.data?.next_member_code || "AUTO",
                position_name: v.position_name || "Thành viên",
                leave_date: isLeft
                  ? v.leave_date || localNow().slice(0, 10)
                  : null,
                reason:
                  v.reason ||
                  (editing.club_member_id &&
                  v.member_status !== editing.member_status
                    ? `Chuyển trạng thái sang ${labels[v.member_status] || v.member_status}`
                    : undefined),
              },
              editing.club_member_id ? "PATCH" : "POST",
            );
          }}
        />
      )}{" "}
      {view && <MemberDetail id={view} onClose={() => setView(null)} />}
    </>
  );
}

export function Departments() {
  const { mutate, can, navigate } = useApp(),
    r = useResource("departments"),
    [editing, setEditing] = useState<Row | null>(null),
    [confirmToggle, setConfirmToggle] = useState<Row | null>(null),
    [confirmDelete, setConfirmDelete] = useState<Row | null>(null);

  const isLeaderOrOfficer = can("LEADER", "OFFICER");

  return (
    <>
      <PageTitle
        eyebrow="CƠ CẤU TỔ CHỨC"
        title="Ban / Nhóm câu lạc bộ"
        description="Chủ nhiệm và cán bộ có thể khởi tạo, quản lý các ban nhóm và phân bổ thành viên trong CLB."
      >
        {isLeaderOrOfficer && (
          <Button onClick={() => setEditing({})}>
            <Plus />
            Thêm ban / nhóm
          </Button>
        )}
      </PageTitle>
      <section className="panel">
        <LoadState {...r} variant="table">
          <DataTable
            data={r.data}
            columns={[
              {
                key: "department_name",
                title: "TÊN BAN / NHÓM",
                render: (row: Row) => (
                  <div>
                    <strong className="block font-medium">
                      {row.department_name}
                    </strong>
                    {row.description && (
                      <span className="text-xs text-muted-foreground line-clamp-1">
                        {row.description}
                      </span>
                    )}
                  </div>
                ),
              },
              {
                key: "member_count",
                title: "THÀNH VIÊN",
                render: (row: Row) => (
                  <Button
                    variant="link"
                    size="sm"
                    className="p-0 h-auto font-medium text-primary"
                    onClick={() =>
                      navigate(
                        "members?department=" +
                          encodeURIComponent(row.department_name),
                      )
                    }
                  >
                    {row.member_count ?? 0} thành viên
                  </Button>
                ),
              },
              {
                key: "active_flag",
                title: "TRẠNG THÁI",
                render: (row: Row) => (
                  <Badge value={row.active_flag ? "ACTIVE" : "INACTIVE"} />
                ),
              },
              {
                key: "created_at",
                title: "NGÀY TẠO",
                render: (row: Row) => dateText(row.created_at),
              },
              {
                key: "action",
                title: "THAO TÁC",
                render: (row: Row) => (
                  <div className="row-actions">
                    {isLeaderOrOfficer && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditing(row)}
                      >
                        <Pencil size={15} />
                        Sửa
                      </Button>
                    )}
                    {isLeaderOrOfficer && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmToggle(row)}
                      >
                        {row.active_flag ? "Ngừng hoạt động" : "Kích hoạt"}
                      </Button>
                    )}
                    {can("LEADER") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setConfirmDelete(row)}
                      >
                        <Trash2 size={15} />
                        Xóa
                      </Button>
                    )}
                  </div>
                ),
              },
            ]}
          />
        </LoadState>
      </section>

      {editing && (
        <Editor
          title={
            editing.department_id ? "Sửa ban / nhóm" : "Thêm ban / nhóm mới"
          }
          fields={[
            {
              name: "department_name",
              label: "Tên ban / nhóm",
              required: true,
              maxLength: 100,
            },
            {
              name: "description",
              label: "Mô tả vai trò / chức năng",
              type: "textarea",
              maxLength: 500,
            },
          ]}
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={(v: Row) =>
            mutate(
              editing.department_id
                ? "departments/" + editing.department_id
                : "departments",
              v,
              editing.department_id ? "PATCH" : "POST",
            )
          }
        />
      )}

      {confirmToggle && (
        <Confirm
          title={
            (confirmToggle.active_flag ? "Ngừng hoạt động " : "Kích hoạt ") +
            confirmToggle.department_name +
            "?"
          }
          description={
            confirmToggle.active_flag
              ? "Ban / nhóm này sẽ ngưng hiển thị khi tuyển hoặc phân ban cho thành viên mới."
              : "Ban / nhóm này sẽ sẵn sàng tiếp nhận và phân công thành viên."
          }
          onClose={() => setConfirmToggle(null)}
          onConfirm={() =>
            mutate(
              "departments/" + confirmToggle.department_id,
              {
                active_flag: confirmToggle.active_flag ? 0 : 1,
              },
              "PATCH",
            )
          }
        />
      )}

      {confirmDelete && (
        <Confirm
          title={`Xóa ban / nhóm "${confirmDelete.department_name}"?`}
          description={
            Number(confirmDelete.member_count) > 0
              ? `Ban này đang có ${confirmDelete.member_count} thành viên đang hoạt động. Vui lòng chuyển họ sang ban khác trước khi xóa.`
              : "Thao tác này sẽ xóa ban / nhóm khỏi danh sách của câu lạc bộ."
          }
          onClose={() => setConfirmDelete(null)}
          onConfirm={() =>
            mutate("departments/" + confirmDelete.department_id, {}, "DELETE")
          }
        />
      )}
    </>
  );
}

export function Accounts() {
  const { mutate } = useApp(),
    f = useFilters(),
    r = useResource("accounts?" + f.query);
  const [edit, setEdit] = useState<Row | null>(null),
    [reset, setReset] = useState<Row | null>(null),
    [confirm, setConfirm] = useState<Row | null>(null);
  return (
    <>
      <PageTitle
        eyebrow="QUẢN TRỊ HỆ THỐNG"
        title="Tài khoản người dùng"
        description="Tạo tài khoản và kiểm soát quyền truy cập hệ thống."
      >
        <Button onClick={() => setEdit({})}>
          <Plus />
          Tạo tài khoản
        </Button>
      </PageTitle>
      <section className="panel">
        <Filters {...f} statuses={["ACTIVE", "LOCKED", "INACTIVE"]} />
        <LoadState {...r} variant="table">
          <DataTable
            data={r.data}
            page={f.page}
            setPage={f.setPage}
            columns={[
              { key: "name", title: "NGƯỜI DÙNG", render: rowName },
              { key: "username", title: "TÊN ĐĂNG NHẬP" },
              { key: "email", title: "EMAIL" },
              {
                key: "account_status",
                title: "TRẠNG THÁI",
                render: (r) => <Badge value={r.account_status} />,
              },
              {
                key: "actions",
                title: "THAO TÁC",
                render: (r) => (
                  <div className="row-actions">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={"Đặt lại mật khẩu " + r.username}
                      onClick={() => setReset(r)}
                    >
                      <KeyRound size={17} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={
                        (r.account_status === "ACTIVE" ? "Khóa " : "Mở khóa ") +
                        r.username
                      }
                      onClick={() => setConfirm(r)}
                    >
                      {r.account_status === "ACTIVE" ? (
                        <LockKeyhole size={17} />
                      ) : (
                        <UnlockKeyhole size={17} />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={"Cập nhật trạng thái " + r.username}
                      onClick={() => setEdit(r)}
                    >
                      <Pencil size={17} />
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        </LoadState>
      </section>
      {edit && (
        <Editor
          title={edit.user_id ? "Trạng thái tài khoản" : "Tạo tài khoản"}
          initial={edit}
          fields={
            edit.user_id
              ? [
                  {
                    name: "account_status",
                    label: "Trạng thái tài khoản",
                    type: "select",
                    options: opts(["ACTIVE", "LOCKED", "INACTIVE"]),
                    required: true,
                  },
                ]
              : [
                  {
                    name: "full_name",
                    label: "Họ và tên",
                    required: true,
                    maxLength: 150,
                  },
                  {
                    name: "username",
                    label: "Tên đăng nhập",
                    required: true,
                    maxLength: 50,
                  },
                  {
                    name: "student_code",
                    label: "Mã sinh viên",
                    maxLength: 30,
                  },
                  { name: "email", label: "Email", type: "email" },
                  {
                    name: "password",
                    label: "Mật khẩu ban đầu",
                    type: "password",
                    required: true,
                    help: "Tối thiểu 10 ký tự. Người dùng có thể đổi trong hồ sơ.",
                  },
                ]
          }
          onClose={() => setEdit(null)}
          onSave={(v: Row) =>
            edit.user_id
              ? mutate(
                  "accounts/" + edit.user_id,
                  { account_status: v.account_status },
                  "PATCH",
                )
              : mutate("accounts", v)
          }
        />
      )}{" "}
      {reset && (
        <Editor
          title={"Đặt lại mật khẩu · " + reset.username}
          fields={[
            {
              name: "password",
              label: "Mật khẩu mới",
              type: "password",
              required: true,
              help: "Tối thiểu 10 ký tự. Các phiên đăng nhập hiện tại sẽ được thu hồi.",
            },
          ]}
          onClose={() => setReset(null)}
          onSave={(v: Row) => mutate("accounts/" + reset.user_id, v, "PATCH")}
        />
      )}{" "}
      {confirm && (
        <Confirm
          title={
            (confirm.account_status === "ACTIVE"
              ? "Khóa tài khoản "
              : "Mở khóa tài khoản ") +
            confirm.username +
            "?"
          }
          onClose={() => setConfirm(null)}
          onConfirm={() =>
            mutate(
              "accounts/" + confirm.user_id,
              {
                account_status:
                  confirm.account_status === "ACTIVE" ? "LOCKED" : "ACTIVE",
              },
              "PATCH",
            )
          }
        />
      )}
    </>
  );
}
export function Roles() {
  const { can, mutate } = useApp(),
    r = useResource("roles"),
    options = useResource("options");
  const [edit, setEdit] = useState(false),
    [remove, setRemove] = useState<Row | null>(null),
    [catalog, setCatalog] = useState<Row | null>(null);
  return (
    <>
      <PageTitle
        eyebrow="PHÂN CÔNG & TRÁCH NHIỆM"
        title="Vai trò trong câu lạc bộ"
        description="Một tài khoản có thể kiêm nhiều vai trò. Quyền được giới hạn theo từng CLB."
      >
        <Button onClick={() => setEdit(true)}>
          <Plus />
          Phân công vai trò
        </Button>
      </PageTitle>
      <LoadState {...r} variant="cards">
        <div className="role-cards">
          {r.data?.roles.map((role: Row) => (
            <div className="panel role-card" key={role.role_id}>
              <ShieldCheck size={24} />
              <strong>{labels[role.role_code]}</strong>
              <span>{role.role_name}</span>
              {can("ADMIN") && (
                <button className="text-link" onClick={() => setCatalog(role)}>
                  Sửa tên hiển thị <Pencil size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
        <section className="panel">
          <SectionHeader title="Danh sách phân công" />
          <DataTable
            data={r.data}
            columns={[
              { key: "full_name", title: "NGƯỜI DÙNG", render: rowName },
              {
                key: "role_code",
                title: "VAI TRÒ",
                render: (r) => (
                  <span className="role-tag">{labels[r.role_code]}</span>
                ),
              },
              {
                key: "club_id",
                title: "PHẠM VI",
                render: (r) => (r.club_id ? "CLB hiện tại" : "Toàn hệ thống"),
              },
              {
                key: "active_flag",
                title: "TRẠNG THÁI",
                render: (r) => (
                  <Badge value={r.active_flag ? "ACTIVE" : "INACTIVE"} />
                ),
              },
              {
                key: "assigned_at",
                title: "ĐƯỢC GÁN",
                render: (r) => dateText(r.assigned_at, true),
              },
              {
                key: "actions",
                title: "",
                render: (r) =>
                  (can("ADMIN") ||
                    ["OFFICER", "TREASURER"].includes(r.role_code)) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setRemove(r)}
                    >
                      {r.active_flag ? "Gỡ vai trò" : "Kích hoạt"}
                    </Button>
                  ),
              },
            ]}
          />
        </section>
      </LoadState>
      {edit && (
        <Editor
          title="Phân công vai trò"
          fields={[
            {
              name: "user_id",
              label: "Người được phân công",
              type: "select",
              required: true,
              options: [
                { value: "", label: "Chọn người dùng" },
                ...(options.data?.users || []).map((u: Row) => ({
                  value: u.user_id,
                  label: u.full_name + " · " + u.username,
                })),
              ],
            },
            {
              name: "role_code",
              label: "Vai trò",
              type: "select",
              required: true,
              options: [
                { value: "", label: "Chọn vai trò" },
                ...opts(
                  can("ADMIN")
                    ? ["ADMIN", "LEADER", "OFFICER", "TREASURER", "MEMBER"]
                    : ["OFFICER", "TREASURER"],
                ),
              ],
            },
          ]}
          onSave={(v: Row) => mutate("roles", { ...v, active_flag: 1 })}
          onClose={() => setEdit(false)}
        />
      )}{" "}
      {remove && (
        <Confirm
          title={`${remove.active_flag ? "Gỡ" : "Kích hoạt"} vai trò ${labels[remove.role_code]}?`}
          description={remove.full_name}
          onClose={() => setRemove(null)}
          onConfirm={() =>
            mutate("roles", {
              user_id: remove.user_id,
              role_code: remove.role_code,
              active_flag: remove.active_flag ? 0 : 1,
            })
          }
        />
      )}{" "}
      {catalog && (
        <Editor
          title="Tên vai trò"
          initial={catalog}
          fields={[
            {
              name: "role_name",
              label: "Tên hiển thị",
              required: true,
              maxLength: 100,
            },
          ]}
          onClose={() => setCatalog(null)}
          onSave={(v: Row) =>
            mutate(
              "role-catalog",
              { role_id: catalog.role_id, role_name: v.role_name },
              "PATCH",
            )
          }
        />
      )}
    </>
  );
}
export function Clubs() {
  const { mutate, switchClub } = useApp(),
    r = useResource("clubs"),
    options = useResource("options");
  const [edit, setEdit] = useState(false);
  return (
    <>
      <PageTitle
        eyebrow="QUẢN TRỊ HỆ THỐNG"
        title="Các câu lạc bộ"
        description="Quản lý thông tin và người phụ trách ban đầu của từng câu lạc bộ."
      >
        <Button onClick={() => setEdit(true)}>
          <Plus />
          Tạo câu lạc bộ
        </Button>
      </PageTitle>
      <LoadState {...r} variant="cards">
        <div className="club-cards">
          {r.data?.rows.map((c: Row) => (
            <section className="panel club-card" key={c.club_id}>
              <span className="club-card-icon">
                <Building2 />
              </span>
              <Badge value={c.club_status} />
              <h2>{c.club_name}</h2>
              <p>{c.description}</p>
              <small>
                {c.club_code} · Thành lập {dateText(c.founded_date)}
              </small>
              <Button
                variant="outline"
                onClick={() => switchClub(c.club_id, "settings")}
              >
                Quản lý câu lạc bộ <ArrowUpRight size={15} />
              </Button>
            </section>
          ))}
        </div>
      </LoadState>
      {edit && (
        <Editor
          title="Tạo câu lạc bộ"
          fields={[
            {
              name: "club_code",
              label: "Mã CLB",
              required: true,
              maxLength: 30,
            },
            {
              name: "club_name",
              label: "Tên CLB",
              required: true,
              maxLength: 200,
            },
            { name: "founded_date", label: "Ngày thành lập", type: "date" },
            {
              name: "leader_user_id",
              label: "Chủ nhiệm ban đầu",
              type: "select",
              required: true,
              options: [
                { value: "", label: "Chọn chủ nhiệm" },
                ...(options.data?.users || []).map((u: Row) => ({
                  value: u.user_id,
                  label: u.full_name + " · " + u.username,
                })),
              ],
            },
            {
              name: "description",
              label: "Giới thiệu",
              type: "textarea",
              wide: true,
            },
          ]}
          onSave={async (v: Row) => {
            await mutate("clubs", v);
          }}
          onClose={() => setEdit(false)}
        />
      )}
    </>
  );
}
export function ClubSettings() {
  const { mutate, reloadSession } = useApp(),
    r = useResource("club"),
    options = useResource("options");
  const [edit, setEdit] = useState(false);
  return (
    <>
      <PageTitle
        eyebrow="CÀI ĐẶT"
        title="Thông tin câu lạc bộ"
        description="Tên gọi, giới thiệu và trạng thái hoạt động."
      />
      <LoadState {...r} variant="detail">
        {r.data && (
          <section className="panel settings-panel">
            <span className="club-card-icon">
              <Building2 />
            </span>
            <h2>{r.data.club_name}</h2>
            <Badge value={r.data.club_status} />
            <dl className="details-list">
              <div>
                <dt>Mã câu lạc bộ</dt>
                <dd>{r.data.club_code}</dd>
              </div>
              <div>
                <dt>Quy tắc mã thành viên</dt>
                <dd>
                  <span className="font-semibold text-primary">
                    {r.data.member_code_prefix || options.data?.member_code_prefix || "MB"}
                  </span>
                  <span className="text-muted text-xs ml-2">
                    (Mã tiếp theo dự kiến: {options.data?.next_member_code || `${r.data.member_code_prefix || "MB"}001`})
                  </span>
                </dd>
              </div>
              <div>
                <dt>Ngày thành lập</dt>
                <dd>{dateText(r.data.founded_date)}</dd>
              </div>
              <div>
                <dt>Giới thiệu</dt>
                <dd>{r.data.description || "Chưa có giới thiệu"}</dd>
              </div>
            </dl>
            <Button onClick={() => setEdit(true)}>
              <Pencil size={16} />
              Cập nhật thông tin
            </Button>
          </section>
        )}
      </LoadState>
      {edit && (
        <Editor
          title="Cập nhật câu lạc bộ"
          initial={r.data}
          fields={[
            {
              name: "club_name",
              label: "Tên câu lạc bộ",
              required: true,
              maxLength: 200,
            },
            {
              name: "member_code_prefix",
              label: "Tiền tố mã thành viên",
              placeholder: "Ví dụ: CNTT, TA, MB...",
              help: "Tiền tố do Ban chủ nhiệm quy định để hệ thống tự động sinh và đánh số tăng dần cho mã thành viên mới (VD: CNTT001, CNTT002,...).",
              maxLength: 20,
            },
            { name: "founded_date", label: "Ngày thành lập", type: "date" },
            {
              name: "club_status",
              label: "Trạng thái",
              type: "select",
              required: true,
              options: opts(["ACTIVE", "INACTIVE"]),
            },
            {
              name: "description",
              label: "Giới thiệu",
              type: "textarea",
              wide: true,
            },
          ]}
          onSave={async (v: Row) => {
            await mutate("club", v, "PATCH");
            await reloadSession();
          }}
          onClose={() => setEdit(false)}
        />
      )}
    </>
  );
}
export function Profile() {
  const { mutate, logout, reloadSession, session, refresh, navigate } =
      useApp(),
    r = useResource("profile");
  const [edit, setEdit] = useState(false),
    [password, setPassword] = useState(false),
    [leaveModal, setLeaveModal] = useState(false);
  return (
    <>
      <PageTitle
        eyebrow="KHÔNG GIAN CÁ NHÂN"
        title="Hồ sơ của tôi"
        description="Thông tin liên hệ và bảo mật tài khoản."
      />
      <LoadState {...r} variant="detail">
        {r.data && (
          <div className="profile-layout">
            <section className="panel profile-card">
              <Avatar name={r.data.user.full_name} />
              <h2>{r.data.user.full_name}</h2>
              <span>@{r.data.user.username}</span>
              <div className="role-chips">
                {session.roles.map((role: string) => (
                  <span className="role-tag" key={role}>
                    {labels[role]}
                  </span>
                ))}
              </div>
              {r.data.membership && (
                <>
                  <hr />
                  <p>{r.data.membership.member_code}</p>
                  <Badge value={r.data.membership.member_status} />
                  <small>
                    Gia nhập {dateText(r.data.membership.join_date)}
                  </small>
                  {r.data.membership.member_status === "ACTIVE" && (
                    <div className="w-full pt-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 text-xs w-full"
                        onClick={() => setLeaveModal(true)}
                      >
                        <LogOut size={14} className="mr-1.5" />
                        Rời câu lạc bộ này
                      </Button>
                    </div>
                  )}
                </>
              )}
            </section>
            <section className="panel profile-information">
              <SectionHeader title="Thông tin cá nhân">
                <Button variant="outline" onClick={() => setEdit(true)}>
                  <Pencil size={15} />
                  Chỉnh sửa
                </Button>
              </SectionHeader>
              <dl className="details-list">
                {[
                  ["Họ và tên", "full_name"],
                  ["Mã sinh viên", "student_code"],
                  ["Email", "email"],
                  ["Điện thoại", "phone"],
                  ["Khoa / viện", "faculty"],
                  ["Lớp", "class_name"],
                ].map(([label, key]) => (
                  <div key={key}>
                    <dt>{label}</dt>
                    <dd>{r.data.user[key] || "Chưa cập nhật"}</dd>
                  </div>
                ))}
              </dl>
              <div className="security-row">
                <span>
                  <LockKeyhole />
                  <strong>Bảo mật tài khoản</strong>
                </span>
                <Button variant="outline" onClick={() => setPassword(true)}>
                  Đổi mật khẩu
                </Button>
              </div>
            </section>
          </div>
        )}
      </LoadState>
      {edit && (
        <Editor
          title="Chỉnh sửa hồ sơ"
          initial={r.data.user}
          fields={[
            {
              name: "full_name",
              label: "Họ và tên",
              required: true,
              maxLength: 150,
            },
            { name: "email", label: "Email", type: "email", maxLength: 150 },
            { name: "phone", label: "Điện thoại", maxLength: 20 },
            { name: "faculty", label: "Khoa / viện", maxLength: 150 },
            { name: "class_name", label: "Lớp", maxLength: 100 },
          ]}
          onSave={async (v: Row) => {
            await mutate("profile", v, "PATCH");
            await reloadSession();
          }}
          onClose={() => setEdit(false)}
        />
      )}{" "}
      {password && (
        <Editor
          title="Đổi mật khẩu"
          fields={[
            {
              name: "current_password",
              label: "Mật khẩu hiện tại",
              type: "password",
              required: true,
            },
            {
              name: "password",
              label: "Mật khẩu mới",
              type: "password",
              required: true,
              help: "Tối thiểu 10 ký tự. Bạn sẽ đăng nhập lại sau khi đổi.",
            },
          ]}
          onSave={async (v: Row) => {
            await mutate("profile/password", v);
            await logout();
          }}
          onClose={() => setPassword(false)}
        />
      )}
      {leaveModal && (
        <Confirm
          title="Rời câu lạc bộ?"
          description="Bạn có chắc chắn muốn rời câu lạc bộ này không? Bạn sẽ không còn quyền truy cập vào các hoạt động và dữ liệu nội bộ của CLB."
          reason={true}
          onClose={() => setLeaveModal(false)}
          onConfirm={async (reason: string) => {
            await mutate(`clubs/${session.club_id}/leave`, { reason }, "POST");
            toast.success("Bạn đã rời câu lạc bộ thành công.");
            setLeaveModal(false);
            await reloadSession(0);
            navigate("dashboard");
            refresh();
          }}
        />
      )}
    </>
  );
}
export function Audit() {
  const { can, session } = useApp();
  const f = useFilters();
  const [clubFilter, setClubFilter] = useState("all");
  const query = `${f.query}${can("ADMIN") ? `&clubFilter=${clubFilter}` : ""}`;
  const r = useResource("audit?" + query);
  const [detail, setDetail] = useState<Row | null>(null);
  return (
    <>
      <PageTitle
        eyebrow="TRUY VẾT"
        title="Nhật ký hoạt động"
        description={
          can("ADMIN")
            ? "Toàn bộ lịch sử thao tác và thay đổi quan trọng trên hệ thống."
            : "Lịch sử thao tác và những thay đổi quan trọng trong câu lạc bộ."
        }
      />
      <section className="panel">
        <Filters q={f.q} setQ={f.setQ}>
          {can("ADMIN") && (session?.clubs?.length ?? 0) > 0 && (
            <SelectBox
              label="Phạm vi câu lạc bộ"
              value={clubFilter}
              onChange={(v: string) => {
                setClubFilter(v);
                f.setPage(1);
              }}
              options={[
                { value: "all", label: "Tất cả CLB & Hệ thống" },
                { value: "system", label: "Chỉ hoạt động Hệ thống (Admin)" },
                ...(session?.clubs || []).map((c: any) => ({
                  value: String(c.club_id),
                  label: c.club_name,
                })),
              ]}
            />
          )}
        </Filters>
        <LoadState {...r} variant="table">
          <DataTable
            data={r.data}
            page={f.page}
            setPage={f.setPage}
            columns={[
              {
                key: "created_at",
                title: "THỜI GIAN",
                render: (r) => dateText(r.created_at, true),
              },
              ...(can("ADMIN")
                ? [
                    {
                      key: "club_name",
                      title: "CÂU LẠC BỘ",
                      render: (r: any) =>
                        r.club_name ? (
                          <span className="font-medium text-xs">
                            {r.club_name}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs italic">
                            Hệ thống chung
                          </span>
                        ),
                    },
                  ]
                : []),
              {
                key: "full_name",
                title: "NGƯỜI THỰC HIỆN",
                render: (r: any) => (
                  <div>
                    <strong>{r.full_name || "—"}</strong>
                    {r.username && (
                      <span className="text-muted-foreground text-xs block">
                        @{r.username}
                      </span>
                    )}
                  </div>
                ),
              },
              {
                key: "action_code",
                title: "HOẠT ĐỘNG",
                render: (r) => <strong>{actionLabel(r.action_code)}</strong>,
              },
              { key: "entity_name", title: "ĐỐI TƯỢNG" },
              { key: "entity_id", title: "MÃ BẢN GHI" },
              {
                key: "detail",
                title: "",
                render: (r) => (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDetail(r)}
                  >
                    Chi tiết
                  </Button>
                ),
              },
            ]}
          />
        </LoadState>
      </section>
      {detail && (
        <Sheet open onOpenChange={(v) => !v && setDetail(null)}>
          <SheetContent className="detail-sheet">
            <SheetHeader>
              <SheetTitle>{actionLabel(detail.action_code)}</SheetTitle>
              <SheetDescription>
                {detail.full_name} · {dateText(detail.created_at, true)}
              </SheetDescription>
            </SheetHeader>
            <div className="sheet-body">
              <h3 className="subheading">Trước thay đổi</h3>
              <pre className="json-detail">
                {detail.old_value
                  ? JSON.stringify(JSON.parse(detail.old_value), null, 2)
                  : "Không có"}
              </pre>
              <h3 className="subheading">Sau thay đổi</h3>
              <pre className="json-detail">
                {detail.new_value
                  ? JSON.stringify(JSON.parse(detail.new_value), null, 2)
                  : "Không có"}
              </pre>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}

function AttachmentUpload({
  fileUrl,
  fileName,
  onUpload,
  onRemove,
  disabled = false,
}: {
  fileUrl?: string | null;
  fileName?: string | null;
  onUpload: (fileUrl: string, fileName: string) => void;
  onRemove: () => void;
  disabled?: boolean;
}) {
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Tệp quá lớn. Vui lòng chọn tệp nhỏ hơn 10 MB.");
      return;
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.set("file", file);
      const res = await fetchApi("attachments", 0, {
        method: "POST",
        body: form,
      });
      onUpload(res.file_url, res.file_name);
      toast.success("Đã tải tệp lên thành công!");
    } catch (err: any) {
      toast.error(err.message || "Không thể tải tệp lên.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  if (fileUrl) {
    return (
      <div className="flex items-center justify-between p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
            <FileText size={18} />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-semibold text-foreground truncate block">
              {fileName || "Tệp đính kèm"}
            </span>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
              Đã tải lên sẵn sàng gửi kèm đơn
            </span>
          </div>
        </div>
        {!disabled && (
          <button
            type="button"
            className="p-1 text-muted hover:text-rose-600 rounded-md transition-colors"
            onClick={onRemove}
            title="Xóa tệp này"
          >
            <X size={16} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="attachment-dropzone">
      <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all text-center">
        <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-1.5">
          {uploading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Upload size={18} />
          )}
        </div>
        <span className="text-xs font-semibold text-foreground">
          {uploading
            ? "Đang tải tệp lên máy chủ..."
            : "Nhấn để chọn tệp hồ sơ đính kèm"}
        </span>
        <span className="text-[11px] text-muted mt-0.5">
          PDF, Word (DOC, DOCX), Ảnh (PNG, JPG) · Tối đa 10 MB
        </span>
        <input
          type="file"
          className="hidden"
          disabled={uploading || disabled}
          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg"
          onChange={handleFileChange}
        />
      </label>
    </div>
  );
}

export function ExploreClubs({ onboarding = false }: { onboarding?: boolean }) {
  const { session, switchClub, mutate, refresh, reloadSession } = useApp();
  const r = useResource("clubs");
  const [applyingClub, setApplyingClub] = useState<Row | null>(null);
  const [leavingClub, setLeavingClub] = useState<Row | null>(null);
  const [message, setMessage] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <>
      <PageTitle
        eyebrow="CÁC CÂU LẠC BỘ"
        title="Khám phá các Câu lạc bộ"
        description="Tìm hiểu các câu lạc bộ trong trường và đăng ký tham gia sinh hoạt."
      />

      {onboarding && (
        <div className="panel p-6 mb-6 bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-sm">
              <Compass size={28} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-emerald-950 mb-1">
                Chào mừng bạn đến với Clubspace! 🎉
              </h2>
              <p className="text-sm text-emerald-800 leading-relaxed">
                Bạn hiện chưa là thành viên của câu lạc bộ nào. Hãy khám phá các
                câu lạc bộ dưới đây và bấm <strong>"Đăng ký tham gia"</strong>{" "}
                để bắt đầu sinh hoạt cùng các bạn sinh viên nhé!
              </p>
            </div>
          </div>
        </div>
      )}

      <LoadState {...r} variant="cards">
        <div className="club-cards">
          {r.data?.rows.map((c: Row) => (
            <section className="panel club-card" key={c.club_id}>
              <span className="club-card-icon">
                <Building2 />
              </span>
              <div className="flex items-center gap-1.5 mb-2">
                <Badge value={c.club_status} />
                {c.is_member && (
                  <span className="status status-ACTIVE">
                    <span className="status-dot" />
                    Thành viên
                  </span>
                )}
              </div>
              <h2>{c.club_name}</h2>
              <p>{c.description || "Chưa có mô tả cho câu lạc bộ này."}</p>
              <small>
                {c.club_code} · {c.active_members_count ?? 0} thành viên · Thành
                lập {dateText(c.founded_date)}
              </small>
              <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                {c.is_member ? (
                  <div className="flex items-center gap-2 w-full">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => switchClub(c.club_id, "dashboard")}
                    >
                      Vào không gian CLB <ArrowUpRight size={15} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                      onClick={() => setLeavingClub(c)}
                      title="Rời câu lạc bộ"
                    >
                      <LogOut size={15} />
                      <span className="hidden sm:inline">Rời CLB</span>
                    </Button>
                  </div>
                ) : c.join_request?.status === "PENDING" ? (
                  <div className="flex items-center justify-between w-full text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-xl border border-amber-200">
                    <span className="inline-flex items-center gap-1 font-medium">
                      <Clock size={14} /> Đơn đang chờ CLB duyệt
                      {c.join_request.file_name && (
                        <span className="ml-1 text-[11px] text-amber-800 bg-amber-200/60 px-1.5 py-0.5 rounded font-medium inline-flex items-center gap-0.5">
                          <Paperclip size={11} /> Có tệp
                        </span>
                      )}
                    </span>
                    <span className="text-muted text-[11px]">
                      {dateText(c.join_request.created_at)}
                    </span>
                  </div>
                ) : c.join_request?.status === "REJECTED" ? (
                  <div className="flex flex-col gap-2 w-full">
                    <div className="text-xs text-rose-700 bg-rose-50 px-3 py-2 rounded-xl border border-rose-200">
                      <strong>Đơn trước bị từ chối:</strong>{" "}
                      {c.join_request.review_reason || "Chưa đạt tiêu chí"}
                    </div>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => {
                        setApplyingClub(c);
                        setMessage("");
                        setFileUrl("");
                        setFileName("");
                      }}
                    >
                      Đăng ký lại
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="default"
                    className="w-full"
                    onClick={() => {
                      setApplyingClub(c);
                      setMessage("");
                      setFileUrl("");
                      setFileName("");
                    }}
                  >
                    Đăng ký tham gia
                  </Button>
                )}
              </div>
            </section>
          ))}
        </div>
      </LoadState>

      {applyingClub && (
        <Dialog
          open
          onOpenChange={(open) => !open && !busy && setApplyingClub(null)}
        >
          <DialogContent className="editor-dialog">
            <DialogHeader>
              <DialogTitle>
                Đăng ký tham gia {applyingClub.club_name}
              </DialogTitle>
              <DialogDescription>
                Đơn đăng ký của bạn sẽ được gửi tới Ban chủ nhiệm câu lạc bộ để
                xét duyệt.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3 text-sm bg-muted/50 p-3.5 rounded-xl border border-border">
                <div>
                  <span className="text-muted block text-xs">Họ và tên</span>
                  <strong>{session.user.full_name}</strong>
                </div>
                <div>
                  <span className="text-muted block text-xs">Mã sinh viên</span>
                  <strong>{session.user.student_code || "—"}</strong>
                </div>
                <div>
                  <span className="text-muted block text-xs">Email</span>
                  <span>{session.user.email || "—"}</span>
                </div>
                <div>
                  <span className="text-muted block text-xs">Khoa / Lớp</span>
                  <span>
                    {session.user.faculty || "—"} ·{" "}
                    {session.user.class_name || "—"}
                  </span>
                </div>
              </div>

              <div className="field">
                <label htmlFor="join-message">
                  Lời nhắn / Nguyện vọng & Ban mong muốn tham gia
                </label>
                <textarea
                  id="join-message"
                  rows={3}
                  value={message}
                  maxLength={1000}
                  placeholder="Ví dụ: Em muốn ứng tuyển vào Ban Kỹ thuật / Ban Truyền thông. Em có kỹ năng tổ chức sự kiện..."
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full rounded-xl border border-input p-3 text-sm"
                />
                <small className="text-muted">
                  Giới thiệu ngắn gọn lý do bạn muốn tham gia CLB này.
                </small>
              </div>

              <div className="field">
                <label>
                  Hồ sơ / Minh chứng đính kèm (CV, Portfolio, Giấy chứng nhận...
                  nếu có)
                </label>
                <AttachmentUpload
                  fileUrl={fileUrl}
                  fileName={fileName}
                  onUpload={(url, name) => {
                    setFileUrl(url);
                    setFileName(name);
                  }}
                  onRemove={() => {
                    setFileUrl("");
                    setFileName("");
                  }}
                  disabled={busy}
                />
                <small className="text-muted">
                  Đính kèm CV hoặc các tài liệu liên quan giúp Ban chủ nhiệm
                  đánh giá đơn của bạn nhanh hơn.
                </small>
              </div>
            </div>
            <div className="editor-footer">
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => setApplyingClub(null)}
              >
                Hủy
              </Button>
              <Button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await mutate("clubs/" + applyingClub.club_id + "/join", {
                      message,
                      file_url: fileUrl || undefined,
                      file_name: fileName || undefined,
                    });
                    toast.success("Đã gửi đơn đăng ký tham gia câu lạc bộ!");
                    setApplyingClub(null);
                    setFileUrl("");
                    setFileName("");
                    refresh();
                  } catch (e: any) {
                    toast.error(e.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy && <Loader2 className="animate-spin" size={16} />} Gửi đơn
                đăng ký
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
      {leavingClub && (
        <Confirm
          title={`Rời câu lạc bộ ${leavingClub.club_name}?`}
          description="Bạn có chắc chắn muốn rời câu lạc bộ này không? Bạn sẽ không còn quyền truy cập vào các hoạt động và tài nguyên nội bộ của CLB."
          reason={true}
          onClose={() => setLeavingClub(null)}
          onConfirm={async (reason: string) => {
            await mutate(
              `clubs/${leavingClub.club_id}/leave`,
              { reason },
              "POST",
            );
            toast.success(`Bạn đã rời câu lạc bộ ${leavingClub.club_name}.`);
            setLeavingClub(null);
            await reloadSession(0);
            refresh();
          }}
        />
      )}
    </>
  );
}

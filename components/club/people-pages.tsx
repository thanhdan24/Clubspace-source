"use client";
import { useState } from "react";
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
const memberStatuses = ["ACTIVE", "PAUSED", "LEFT"];
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
                  <h2>{r.data.user.full_name}</h2>
                  <Badge value={r.data.member.member_status} />
                </div>
                <dl className="details-list">
                  {[
                    ["Mã thành viên", r.data.member.member_code],
                    ["Ban / nhóm", r.data.member.department_name],
                    ["Chức vụ", r.data.member.position_name],
                    ["Ngày gia nhập", dateText(r.data.member.join_date)],
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
export function Members() {
  const { can, mutate, club } = useApp(),
    f = useFilters(),
    r = useResource("members?" + f.query),
    options = useResource("options");
  const [editing, setEditing] = useState<Row | null>(
      typeof window !== "undefined" && window.location.hash.includes("?new")
        ? {}
        : null,
    ),
    [view, setView] = useState<number | null>(null);
  const fields: Field[] = [
    ...(!editing?.club_member_id
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
      required: true,
      maxLength: 30,
    },
    { name: "join_date", label: "Ngày gia nhập", type: "date", required: true },
    { name: "department_name", label: "Ban / nhóm", maxLength: 120 },
    { name: "position_name", label: "Chức vụ", maxLength: 120 },
    ...(editing?.club_member_id
      ? [
          {
            name: "member_status",
            label: "Trạng thái",
            type: "select",
            options: opts(memberStatuses),
            required: true,
          },
          { name: "leave_date", label: "Ngày rời CLB", type: "date" },
          {
            name: "reason",
            label: "Lý do thay đổi trạng thái",
            type: "textarea",
            wide: true,
            help: "Bắt buộc khi đổi trạng thái sinh hoạt.",
            maxLength: 500,
          },
        ]
      : []),
  ];
  return (
    <>
      <PageTitle
        eyebrow="QUẢN LÝ THÀNH VIÊN"
        title="Những người làm nên câu lạc bộ"
        description="Hồ sơ, ban nhóm và hành trình sinh hoạt của từng thành viên."
      >
        <ExportButton path={"members?" + f.query} />
        {can("OFFICER") && (
          <Button
            onClick={() => setEditing({ join_date: localNow().slice(0, 10) })}
          >
            <Plus />
            Thêm thành viên
          </Button>
        )}
      </PageTitle>
      <section className="panel">
        <Filters {...f} statuses={memberStatuses} />
        <LoadState {...r}>
          <DataTable
            data={r.data}
            page={f.page}
            setPage={f.setPage}
            columns={[
              { key: "name", title: "THÀNH VIÊN", render: rowName },
              { key: "member_code", title: "MÃ THÀNH VIÊN" },
              { key: "department_name", title: "BAN / NHÓM" },
              { key: "position_name", title: "CHỨC VỤ" },
              {
                key: "join_date",
                title: "GIA NHẬP",
                render: (r) => dateText(r.join_date),
              },
              {
                key: "member_status",
                title: "TRẠNG THÁI",
                render: (r) => <Badge value={r.member_status} />,
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
      {editing && (
        <Editor
          title={
            editing.club_member_id ? "Cập nhật thành viên" : "Thêm thành viên"
          }
          fields={fields}
          initial={{ join_date: localNow().slice(0, 10), ...editing }}
          onClose={() => setEditing(null)}
          onSave={(v: Row) =>
            mutate(
              editing.club_member_id
                ? "members/" + editing.club_member_id
                : "members",
              {
                ...v,
                ...(editing.club_member_id
                  ? { leave_date: v.leave_date || null }
                  : {}),
              },
              editing.club_member_id ? "PATCH" : "POST",
            )
          }
        />
      )}{" "}
      {view && <MemberDetail id={view} onClose={() => setView(null)} />}
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
        <LoadState {...r}>
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
      <LoadState {...r}>
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
      <LoadState {...r}>
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
    r = useResource("club");
  const [edit, setEdit] = useState(false);
  return (
    <>
      <PageTitle
        eyebrow="CÀI ĐẶT"
        title="Thông tin câu lạc bộ"
        description="Tên gọi, giới thiệu và trạng thái hoạt động."
      />
      <LoadState {...r}>
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
  const { mutate, logout, reloadSession, session } = useApp(),
    r = useResource("profile");
  const [edit, setEdit] = useState(false),
    [password, setPassword] = useState(false);
  return (
    <>
      <PageTitle
        eyebrow="KHÔNG GIAN CÁ NHÂN"
        title="Hồ sơ của tôi"
        description="Thông tin liên hệ và bảo mật tài khoản."
      />
      <LoadState {...r}>
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
    </>
  );
}
export function Audit() {
  const f = useFilters(),
    r = useResource("audit?" + f.query);
  const [detail, setDetail] = useState<Row | null>(null);
  return (
    <>
      <PageTitle
        eyebrow="TRUY VẾT"
        title="Nhật ký hoạt động"
        description="Lịch sử thao tác và những thay đổi quan trọng trong câu lạc bộ."
      />
      <section className="panel">
        <Filters q={f.q} setQ={f.setQ} />
        <LoadState {...r}>
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
              { key: "full_name", title: "NGƯỜI THỰC HIỆN" },
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

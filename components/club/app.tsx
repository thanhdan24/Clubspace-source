"use client";
import React, { useState, useEffect, useCallback } from "react";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Wallet,
  BarChart3,
  ShieldCheck,
  Settings,
  LogOut,
  ChevronsUpDown,
  ArrowRight,
  BookOpen,
  UserRound,
  CheckCheck,
  Building2,
  History,
  Plus,
  Command,
  Loader2,
  LockKeyhole,
  GraduationCap,
  Eye,
  EyeOff,
  Sparkles,
} from "lucide-react";
import { Toaster, toast } from "sonner";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { AppContext, fetchApi, Avatar, labels, SelectBox } from "./shared";
import Dashboard from "./dashboard";
import WebTools from "./web-tools";
import Notifications from "./notifications";
import {
  Members,
  Accounts,
  Roles,
  Clubs,
  Profile,
  ClubSettings,
  Audit,
} from "./people-pages";
import { Events, EventDetail, MyRegistrations } from "./event-pages";
import { Finance, Categories, Reports } from "./finance-pages";
const navigation = [
  { id: "dashboard", label: "Tổng quan", icon: LayoutDashboard, roles: [] },
  {
    id: "members",
    label: "Thành viên",
    icon: Users,
    roles: ["ADMIN", "LEADER", "OFFICER", "TREASURER"],
  },
  { id: "events", label: "Sự kiện", icon: CalendarDays, roles: [] },
  {
    id: "finance",
    label: "Tài chính",
    icon: Wallet,
    roles: ["ADMIN", "LEADER", "OFFICER", "TREASURER"],
  },
  {
    id: "approvals",
    label: "Phê duyệt",
    icon: CheckCheck,
    roles: ["LEADER", "TREASURER"],
  },
  { id: "reports", label: "Báo cáo & thống kê", icon: BarChart3, roles: [] },
  {
    id: "registrations",
    label: "Đăng ký của tôi",
    icon: BookOpen,
    roles: ["MEMBER"],
  },
];
const management = [
  { id: "accounts", label: "Tài khoản", icon: UserRound, roles: ["ADMIN"] },
  { id: "clubs", label: "Câu lạc bộ", icon: Building2, roles: ["ADMIN"] },
  {
    id: "roles",
    label: "Phân quyền",
    icon: ShieldCheck,
    roles: ["ADMIN", "LEADER"],
  },
  {
    id: "categories",
    label: "Danh mục thu chi",
    icon: Wallet,
    roles: ["TREASURER"],
  },
  {
    id: "audit",
    label: "Nhật ký hoạt động",
    icon: History,
    roles: ["ADMIN", "LEADER"],
  },
  {
    id: "settings",
    label: "Cài đặt câu lạc bộ",
    icon: Settings,
    roles: ["ADMIN", "LEADER"],
  },
];
function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <Command size={23} />
      </span>
      <span>
        clubspace<span className="brand-dot">.</span>
      </span>
    </div>
  );
}
function Login({ onLogin, demo }: any) {
  const [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [showPassword, setShowPassword] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState("");
  async function signIn(role?: string) {
    setBusy(role || "login");
    setError("");
    try {
      await fetchApi(role ? "auth/demo" : "auth/login", 0, {
        method: "POST",
        body: JSON.stringify(role ? { role } : { username, password }),
      });
      onLogin();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  return (
    <div className="login-page">
      <div className="login-story">
        <div className="login-story-header">
          <Brand />
          <span className="platform-tag">NỀN TẢNG CLB SINH VIÊN</span>
        </div>
        <div className="login-story-content">
          <span className="overline">KHÔNG GIAN CÂU LẠC BỘ HIỆN ĐẠI</span>
          <h1>
            Cùng nhau.
            <br />
            Làm nên
            <br />
            <em>điều ý nghĩa.</em>
          </h1>
          <p>
            Số hóa toàn diện quản lý thành viên, vòng đời sự kiện và tài chính minh bạch cho các câu lạc bộ sinh viên.
          </p>

          <div className="login-highlights">
            <div className="highlight-card">
              <span className="highlight-icon green">
                <Users size={18} />
              </span>
              <div>
                <strong>Hồ sơ & Phân quyền</strong>
                <small>5 vai trò RBAC chặt chẽ</small>
              </div>
            </div>
            <div className="highlight-card">
              <span className="highlight-icon blue">
                <CalendarDays size={18} />
              </span>
              <div>
                <strong>Vòng đời Sự kiện</strong>
                <small>Đăng ký, duyệt & điểm danh</small>
              </div>
            </div>
            <div className="highlight-card">
              <span className="highlight-icon amber">
                <ShieldCheck size={18} />
              </span>
              <div>
                <strong>Tài chính Minh bạch</strong>
                <small>Phê duyệt 2 lớp & Audit log</small>
              </div>
            </div>
          </div>
        </div>
        <div className="login-story-footer">
          <span>Clubspace · Nhóm 11 PTTKHTPM</span>
          <span>Bảo toàn lịch sử · An toàn dữ liệu</span>
        </div>
      </div>
      <main className="login-main">
        <div className="login-mobile-brand">
          <Brand />
        </div>
        <div className="login-card-container">
          <div className="login-form">
            <div className="login-header-group">
              <span className="login-icon">
                <LockKeyhole size={22} />
              </span>
              <div>
                <h2>Chào mừng trở lại</h2>
                <p>Đăng nhập để vào không gian quản lý câu lạc bộ của bạn.</p>
              </div>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                signIn();
              }}
            >
              <div className="field">
                <label htmlFor="username">Tên đăng nhập</label>
                <div className="input-with-icon">
                  <UserRound size={17} className="input-icon" />
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    maxLength={50}
                    autoComplete="username"
                    placeholder="Nhập tên đăng nhập"
                  />
                </div>
              </div>
              <div className="field">
                <label htmlFor="password">Mật khẩu</label>
                <div className="input-with-icon">
                  <LockKeyhole size={17} className="input-icon" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    maxLength={200}
                    autoComplete="current-password"
                    placeholder="Nhập mật khẩu"
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              {error && (
                <p role="alert" className="form-error">
                  {error}
                </p>
              )}
              <Button type="submit" className="login-submit" disabled={!!busy}>
                {busy === "login" ? <Loader2 className="animate-spin" /> : null}
                Đăng nhập vào hệ thống <ArrowRight size={17} />
              </Button>
            </form>
            {demo && (
              <div className="demo-login">
                <div className="divider-label">Khám phá nhanh theo vai trò</div>
                <p>Chọn tài khoản để thử chức năng tương ứng:</p>
                <div className="demo-roles">
                  {["LEADER", "OFFICER", "TREASURER", "MEMBER", "ADMIN"].map(
                    (role) => (
                      <Button
                        key={role}
                        disabled={!!busy}
                        variant="outline"
                        className={"demo-chip demo-" + role.toLowerCase()}
                        onClick={() => signIn(role)}
                      >
                        {busy === role ? (
                          <Loader2 className="animate-spin" size={13} />
                        ) : null}
                        {labels[role]}
                      </Button>
                    ),
                  )}
                </div>
              </div>
            )}
            <p className="login-help">
              Chưa có tài khoản? Liên hệ quản trị viên của câu lạc bộ.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
function Nav({ items, roles, route, navigate }: any) {
  const { setOpenMobile } = useSidebar();
  return (
    <SidebarMenu>
      {items
        .filter(
          (n: any) =>
            !n.roles.length || n.roles.some((r: string) => roles.includes(r)),
        )
        .map((n: any) => (
          <SidebarMenuItem key={n.id}>
            <SidebarMenuButton
              asChild
              isActive={route.split("/")[0] === n.id}
              className="nav-link"
            >
              <a href={"#" + n.id} onClick={() => setOpenMobile(false)}>
                <n.icon size={19} />
                <span>{n.label}</span>
                {n.id === "events" && <span className="nav-shortcut">S</span>}
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
    </SidebarMenu>
  );
}
export default function ClubApp() {
  const [session, setSession] = useState<any>(null),
    [club, setClub] = useState(0),
    [version, setVersion] = useState(0),
    [route, setRoute] = useState("dashboard"),
    [loading, setLoading] = useState(true),
    [demo, setDemo] = useState(false),
    [error, setError] = useState("");
  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  const navigate = (r: string) => {
    window.location.hash = r;
  };
  const load = useCallback(async (id = 0) => {
    setLoading(true);
    try {
      const s = await fetchApi("me", id);
      setSession(s);
      setClub(s.club_id);
    } catch (e: any) {
      if (e.status !== 401) setError(e.message);
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    fetchApi("auth/info", 0)
      .then((d) => setDemo(d.demo))
      .catch((e) => setError(e.message));
    load();
    const onHash = () => {
      setRoute(window.location.hash.slice(1) || "dashboard");
      window.scrollTo(0, 0);
    };
    onHash();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [load]);
  if (loading)
    return (
      <div className="startup">
        <Brand />
        <Loader2 className="animate-spin" />
        <p>Đang mở không gian của bạn…</p>
      </div>
    );
  if (!session)
    return (
      <>
        <Login onLogin={() => load()} demo={demo} />
        {error && (
          <div className="connection-error" role="alert">
            {error}
            <Button
              variant="outline"
              onClick={() => {
                setError("");
                load();
              }}
            >
              Thử lại
            </Button>
          </div>
        )}
        <Toaster richColors position="top-right" />
      </>
    );
  const routePath = route.split("?")[0];
  const roleList = session.roles as string[],
    can = (...r: string[]) => r.some((v) => roleList.includes(v)),
    staff = can("ADMIN", "LEADER", "OFFICER", "TREASURER");
  const activeClub = session.clubs.find((c: any) => c.club_id === club);
  const title =
    [
      ...navigation,
      ...management,
      { id: "profile", label: "Hồ sơ cá nhân" },
    ].find((n) => n.id === routePath.split("/")[0])?.label || "Sự kiện";
  const logout = async () => {
    await fetchApi("auth/logout", club, { method: "POST", body: "{}" });
    setSession(null);
    setClub(0);
    navigate("dashboard");
  };
  let page: React.ReactNode;
  if (routePath.startsWith("events/"))
    page = <EventDetail key={routePath} id={Number(routePath.split("/")[1])} />;
  else
    switch (routePath) {
      case "members":
        page = <Members />;
        break;
      case "events":
        page = <Events />;
        break;
      case "finance":
      case "approvals":
        page = <Finance approvals={routePath === "approvals"} />;
        break;
      case "categories":
        page = <Categories />;
        break;
      case "reports":
        page = <Reports />;
        break;
      case "accounts":
        page = <Accounts />;
        break;
      case "roles":
        page = <Roles />;
        break;
      case "clubs":
        page = <Clubs />;
        break;
      case "audit":
        page = <Audit />;
        break;
      case "settings":
        page = <ClubSettings />;
        break;
      case "profile":
        page = <Profile />;
        break;
      case "registrations":
        page = <MyRegistrations />;
        break;
      default:
        page = <Dashboard />;
    }
  return (
    <AppContext.Provider
      value={{
        session,
        club,
        version,
        refresh,
        navigate,
        can,
        staff,
        activeClub,
        logout,
        switchClub: async (id: number, target = "dashboard") => {
          await load(id);
          navigate(target);
          refresh();
        },
        reloadSession: () => load(club),
        mutate: async (path: string, data: any, method = "POST") => {
          const r = await fetchApi(path, club, {
            method,
            body: JSON.stringify(data),
          });
          refresh();
          return r;
        },
      }}
    >
      <WebTools />
      <SidebarProvider
        style={{ "--sidebar-width": "252px" } as React.CSSProperties}
      >
        <Sidebar className="club-sidebar">
          <SidebarHeader className="sidebar-brand">
            <Brand />
          </SidebarHeader>
          <SidebarContent>
            <div className="club-switch">
              <span className="club-initial">
                {activeClub?.club_code?.includes("CNTT") ? "IT" : "CLB"}
              </span>
              <div>
                <span>CÂU LẠC BỘ CỦA BẠN</span>
                <SelectBox
                  label="Chọn câu lạc bộ"
                  value={club}
                  onChange={(v) => {
                    load(Number(v));
                    refresh();
                  }}
                  options={session.clubs.map((c: any) => ({
                    value: c.club_id,
                    label: c.club_name.replace("CLB ", ""),
                  }))}
                />
              </div>
            </div>
            <SidebarGroup>
              <SidebarGroupLabel>KHÔNG GIAN LÀM VIỆC</SidebarGroupLabel>
              <Nav
                items={navigation}
                roles={roleList}
                route={routePath}
                navigate={navigate}
              />
            </SidebarGroup>
            {management.some((n) => n.roles.some((r) => can(r))) && (
              <SidebarGroup>
                <SidebarGroupLabel>QUẢN LÝ</SidebarGroupLabel>
                <Nav
                  items={management}
                  roles={roleList}
                  route={routePath}
                  navigate={navigate}
                />
              </SidebarGroup>
            )}
          </SidebarContent>
          <SidebarFooter>
            <div className="sidebar-bottom-note">
              <GraduationCap size={25} />
              <div>
                <strong>Mỗi kết nối đều có giá trị.</strong>
                <span>Cùng phát triển câu lạc bộ.</span>
              </div>
            </div>
            <button
              className="sidebar-profile"
              onClick={() => navigate("profile")}
            >
              <Avatar name={session.user.full_name} />
              <span>
                <strong>{session.user.full_name.split("·")[0]}</strong>
                <small>
                  {labels[roleList.find((r) => r !== "MEMBER") || "MEMBER"]}
                </small>
              </span>
              <ArrowRight size={17} />
            </button>
          </SidebarFooter>
        </Sidebar>
        <div className="app-main">
          <header className="topbar">
            <div className="topbar-left">
              <SidebarTrigger aria-label="Mở điều hướng" />
              <span className="breadcrumb">
                Không gian làm việc <span>/</span> <strong>{title}</strong>
              </span>
            </div>
            <div className="topbar-right">
              <Notifications />
              {session.demo && (
                <span className="preview-badge">Bản trải nghiệm</span>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="user-trigger"
                    aria-label="Tùy chọn tài khoản"
                  >
                    <Avatar name={session.user.full_name} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>
                    {session.user.full_name}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => navigate("profile")}>
                    <UserRound />
                    Hồ sơ cá nhân
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() =>
                      logout().catch((e) => toast.error(e.message))
                    }
                  >
                    <LogOut />
                    Đăng xuất
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main
            className="workspace"
            id="main-content"
            key={String(club) + route}
          >
            {page}
          </main>
          <footer className="app-footer">
            <span>Clubspace · Không gian câu lạc bộ sinh viên</span>
            <span>Giờ Việt Nam (UTC+7)</span>
          </footer>
        </div>
      </SidebarProvider>
      <Toaster position="top-right" richColors closeButton />
    </AppContext.Provider>
  );
}

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
import { DiscoverClubs, JoinRequests } from "./join-pages";
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
  { id: "discover", label: "Khám phá CLB", icon: Building2, roles: [] },
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
  {
    id: "join-requests",
    label: "Yêu cầu tham gia",
    icon: Users,
    roles: ["LEADER", "OFFICER"],
  },
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
        <Brand />
        <div className="login-story-content">
          <span className="overline">KHÔNG GIAN CÂU LẠC BỘ SINH VIÊN</span>
          <h1>
            Cùng nhau.
            <br />
            Làm nên
            <br />
            <em>điều ý nghĩa.</em>
          </h1>
          <p>
            Mỗi thành viên, mỗi sự kiện, mỗi hành trình.
            <br />
            Tất cả kết nối trong một không gian.
          </p>
          <div className="login-symbols">
            <span>
              <Users />
            </span>
            <span>
              <CalendarDays />
            </span>
            <span>
              <GraduationCap />
            </span>
          </div>
        </div>
        <div className="login-story-footer">
          Clubspace <span>Thành viên · Hoạt động · Kết nối</span>
        </div>
      </div>
      <main className="login-main">
        <div className="login-mobile-brand">
          <Brand />
        </div>
        <div className="login-form">
          <span className="login-icon">
            <LockKeyhole size={24} />
          </span>
          <h2>Chào mừng trở lại</h2>
          <p>Đăng nhập để bắt đầu quản lý câu lạc bộ của bạn.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              signIn();
            }}
          >
            <div className="field">
              <label htmlFor="username">Tên đăng nhập</label>
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
            <div className="field">
              <label htmlFor="password">Mật khẩu</label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                maxLength={200}
                autoComplete="current-password"
                placeholder="Nhập mật khẩu"
              />
            </div>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <Button type="submit" className="login-submit" disabled={!!busy}>
              {busy === "login" ? <Loader2 className="animate-spin" /> : null}
              Đăng nhập <ArrowRight size={17} />
            </Button>
          </form>
          {demo && (
            <div className="demo-login">
              <div className="divider-label">Khám phá bản trải nghiệm</div>
              <p>Chọn vai trò để thử các chức năng tương ứng.</p>
              <div className="demo-roles">
                {["LEADER", "OFFICER", "TREASURER", "MEMBER", "ADMIN"].map(
                  (role) => (
                    <Button
                      key={role}
                      disabled={!!busy}
                      variant="outline"
                      onClick={() => signIn(role)}
                    >
                      {busy === role ? (
                        <Loader2 className="animate-spin" size={14} />
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
  const requestedRoute = route.split("?")[0];
  const routePath =
    !club &&
    !["profile", "accounts", "clubs", "roles", "audit"].includes(requestedRoute)
      ? "discover"
      : requestedRoute;
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
      case "discover":
        page = <DiscoverClubs />;
        break;
      case "join-requests":
        page = <JoinRequests />;
        break;
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
                {session.clubs.length === 0 ? (
                  <p>Chưa tham gia CLB</p>
                ) : (
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
                )}
              </div>
            </div>
            <SidebarGroup>
              <SidebarGroupLabel>KHÔNG GIAN LÀM VIỆC</SidebarGroupLabel>
              <Nav
                items={
                  club
                    ? navigation
                    : navigation.filter((n) => n.id === "discover")
                }
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
                  {roleList.length
                    ? labels[roleList.find((r) => r !== "MEMBER") || "MEMBER"]
                    : "Chưa tham gia CLB"}
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
              {club > 0 && <Notifications />}
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

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
  Compass,
  KeyRound,
  Mail,
  ArrowLeft,
  CheckCircle2,
  Check,
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
import {
  AppContext,
  fetchApi,
  Avatar,
  labels,
  SelectBox,
  prefetchResource,
  clearResourceCache,
} from "./shared";
import Dashboard, { AdminDashboard } from "./dashboard";
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
  ExploreClubs,
} from "./people-pages";
import { Events, EventDetail, MyRegistrations } from "./event-pages";
import { Finance, Categories, Reports, ApprovalCenter } from "./finance-pages";
const navigation = [
  { id: "dashboard", label: "Tổng quan", icon: LayoutDashboard, roles: [] },
  { id: "explore-clubs", label: "Khám phá CLB", icon: Compass, roles: [] },
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
    roles: ["LEADER"],
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
const adminNavigation = [
  {
    id: "dashboard",
    label: "Tổng quan hệ thống",
    icon: LayoutDashboard,
    roles: ["ADMIN"],
  },
  {
    id: "accounts",
    label: "Tài khoản người dùng",
    icon: UserRound,
    roles: ["ADMIN"],
  },
  {
    id: "clubs",
    label: "Quản lý câu lạc bộ",
    icon: Building2,
    roles: ["ADMIN"],
  },
  {
    id: "roles",
    label: "Phân quyền hệ thống",
    icon: ShieldCheck,
    roles: ["ADMIN"],
  },
  { id: "audit", label: "Nhật ký hoạt động", icon: History, roles: ["ADMIN"] },
];
const adminSupervision = [
  {
    id: "explore-clubs",
    label: "Khám phá CLB",
    icon: Compass,
    roles: ["ADMIN"],
  },
  { id: "members", label: "Thành viên CLB", icon: Users, roles: ["ADMIN"] },
  { id: "events", label: "Sự kiện CLB", icon: CalendarDays, roles: ["ADMIN"] },
  { id: "finance", label: "Tài chính CLB", icon: Wallet, roles: ["ADMIN"] },
  { id: "reports", label: "Báo cáo CLB", icon: BarChart3, roles: ["ADMIN"] },
  { id: "settings", label: "Cài đặt CLB", icon: Settings, roles: ["ADMIN"] },
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
const roleInfo: Record<string, { label: string; icon: string; desc: string }> =
  {
    LEADER: {
      label: "Chủ nhiệm CLB",
      icon: "👑",
      desc: "Toàn quyền điều hành CLB",
    },
    OFFICER: {
      label: "Cán bộ / BTC",
      icon: "📋",
      desc: "Tổ chức sự kiện & điểm danh",
    },
    TREASURER: {
      label: "Thủ quỹ",
      icon: "💰",
      desc: "Quản lý quỹ & sổ thu chi",
    },
    MEMBER: {
      label: "Hội viên CLB",
      icon: "🎒",
      desc: "Đăng ký tham gia sinh hoạt",
    },
    ADMIN: { label: "Quản trị viên", icon: "🛡️", desc: "Quản trị toàn trường" },
  };

function Login({ onLogin, demo }: any) {
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [forgotStep, setForgotStep] = useState<1 | 2>(1);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [busy, setBusy] = useState("");

  // Forgot password form states
  const [forgotUser, setForgotUser] = useState("");
  const [forgotVerify, setForgotVerify] = useState("");
  const [forgotData, setForgotData] = useState<{
    reset_token: string;
    otp_code: string;
    full_name: string;
    username: string;
    masked_target: string;
  } | null>(null);
  const [otpInput, setOtpInput] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  async function signIn(role?: string) {
    setBusy(role || "login");
    setError("");
    setSuccessMsg("");
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

  async function handleForgotVerify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy("forgot-verify");
    try {
      const res = await fetchApi("auth/forgot-password", 0, {
        method: "POST",
        body: JSON.stringify({
          username: forgotUser.trim(),
          verify: forgotVerify.trim(),
        }),
      });
      setForgotData(res);
      setOtpInput(res.otp_code || "");
      setForgotStep(2);
      toast.success("Xác minh thành công! Mã OTP đã được cấp.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!otpInput || otpInput.trim().length !== 6) {
      setError("Vui lòng nhập đủ 6 chữ số mã xác thực OTP.");
      return;
    }
    if (newPassword.length < 10) {
      setError("Mật khẩu mới cần ít nhất 10 ký tự.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp với mật khẩu mới.");
      return;
    }
    setBusy("reset-password");
    try {
      await fetchApi("auth/reset-password", 0, {
        method: "POST",
        body: JSON.stringify({
          reset_token: forgotData?.reset_token,
          otp: otpInput.trim(),
          password: newPassword,
        }),
      });
      toast.success("Đặt lại mật khẩu thành công!");
      setUsername(forgotData?.username || forgotUser);
      setPassword("");
      setSuccessMsg(
        "Đặt lại mật khẩu thành công! Bạn có thể đăng nhập bằng mật khẩu mới.",
      );
      setMode("login");
      setForgotStep(1);
      setForgotData(null);
      setOtpInput("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="login-page">
      <div className="login-story">
        <div className="login-story-header">
          <Brand />
          <span className="platform-tag">CỔNG THÔNG TIN CLB SINH VIÊN</span>
        </div>
        <div className="login-story-content">
          <h1>
            Không gian sinh hoạt
            <br />
            của <em>Câu lạc bộ Sinh viên</em>
          </h1>
          <p>
            Nơi hội tụ các câu lạc bộ học thuật, nghệ thuật, thể thao và tình
            nguyện. Cùng nhau tổ chức hoạt động, gắn kết hội viên và lưu giữ
            những kỷ niệm thanh xuân rực rỡ.
          </p>

          <div className="login-highlights">
            <div className="highlight-card">
              <span className="highlight-icon green">
                <Users size={19} />
              </span>
              <div>
                <strong>Sinh hoạt & Gắn kết Hội viên</strong>
                <small>
                  Họp mặt định kỳ, sinh hoạt chuyên môn, dã ngoại và gắn kết
                  thành viên
                </small>
              </div>
            </div>
            <div className="highlight-card">
              <span className="highlight-icon blue">
                <CalendarDays size={19} />
              </span>
              <div>
                <strong>Sự kiện, Workshop & Hoạt động</strong>
                <small>
                  Đăng ký tham gia, điểm danh hoạt động và cập nhật thông báo
                  mới
                </small>
              </div>
            </div>
            <div className="highlight-card">
              <span className="highlight-icon amber">
                <Wallet size={19} />
              </span>
              <div>
                <strong>Thu chi & Quỹ sinh hoạt rõ ràng</strong>
                <small>
                  Quản lý đóng quỹ thành viên, công khai minh bạch mọi chi phí
                  hoạt động
                </small>
              </div>
            </div>
          </div>
        </div>
        <div className="login-story-footer">
          <span>Clubspace · Đồng hành cùng hoạt động sinh viên</span>
          <span>Năng động · Gắn kết · Minh bạch</span>
        </div>
      </div>
      <main className="login-main">
        <div className="login-mobile-brand">
          <Brand />
        </div>
        <div className="login-card-container">
          {mode === "forgot" ? (
            <div className="login-form">
              <div className="login-header-group">
                <span className="login-icon forgot-badge">
                  <KeyRound size={22} />
                </span>
                <div>
                  <h2>Khôi phục mật khẩu</h2>
                  <p>
                    {forgotStep === 1
                      ? "Xác minh danh tính qua tên đăng nhập và email (hoặc MSSV) đăng ký."
                      : `Nhập mã xác thực OTP và mật khẩu mới cho ${forgotData?.full_name || forgotUser}.`}
                  </p>
                </div>
              </div>

              {forgotStep === 1 ? (
                <form onSubmit={handleForgotVerify}>
                  <div className="field">
                    <label htmlFor="forgot-user">Tên đăng nhập</label>
                    <div className="input-with-icon">
                      <UserRound size={17} className="input-icon" />
                      <Input
                        id="forgot-user"
                        value={forgotUser}
                        onChange={(e) => setForgotUser(e.target.value)}
                        required
                        maxLength={50}
                        placeholder="Nhập tên đăng nhập (ví dụ: leader_it, sv230001...)"
                      />
                    </div>
                  </div>
                  <div className="field">
                    <label htmlFor="forgot-verify">
                      Email hoặc Mã số sinh viên (MSSV)
                    </label>
                    <div className="input-with-icon">
                      <Mail size={17} className="input-icon" />
                      <Input
                        id="forgot-verify"
                        value={forgotVerify}
                        onChange={(e) => setForgotVerify(e.target.value)}
                        required
                        maxLength={150}
                        placeholder="Nhập email hoặc MSSV đã đăng ký trong hồ sơ"
                      />
                    </div>
                    <small className="field-hint">
                      Hệ thống đối chiếu với hồ sơ để bảo vệ an toàn danh tính
                      của bạn.
                    </small>
                  </div>

                  {error && (
                    <p role="alert" className="form-error">
                      {error}
                    </p>
                  )}

                  <Button
                    type="submit"
                    className="login-submit"
                    disabled={!!busy}
                  >
                    {busy === "forgot-verify" ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : null}
                    Xác minh tài khoản <ArrowRight size={17} />
                  </Button>

                  <button
                    type="button"
                    className="login-back-btn"
                    onClick={() => {
                      setMode("login");
                      setError("");
                    }}
                  >
                    <ArrowLeft size={15} /> Quay lại đăng nhập
                  </button>
                </form>
              ) : (
                <form onSubmit={handleResetPassword}>
                  <div className="otp-verification-card">
                    <div className="otp-card-header">
                      <CheckCircle2 size={18} className="otp-card-icon" />
                      <div>
                        <strong>
                          Xác minh thành công: {forgotData?.full_name}
                        </strong>
                        <p className="otp-target-hint">
                          Thông tin liên kết: {forgotData?.masked_target}
                        </p>
                      </div>
                    </div>
                    <div className="otp-display-badge">
                      <span className="otp-label">MÃ XÁC THỰC (OTP):</span>
                      <span className="otp-value">{forgotData?.otp_code}</span>
                    </div>
                    <p className="otp-hint">
                      Mã OTP có hiệu lực trong 15 phút. Nhập mã này và mật khẩu
                      mới bên dưới.
                    </p>
                  </div>

                  <div className="field">
                    <label htmlFor="otp-input">
                      Mã xác thực (OTP 6 chữ số)
                    </label>
                    <div className="input-with-icon">
                      <ShieldCheck size={17} className="input-icon" />
                      <Input
                        id="otp-input"
                        value={otpInput}
                        onChange={(e) =>
                          setOtpInput(
                            e.target.value.replace(/\D/g, "").slice(0, 6),
                          )
                        }
                        required
                        maxLength={6}
                        placeholder="Nhập 6 chữ số OTP"
                        className="otp-code-input"
                      />
                    </div>
                  </div>

                  <div className="field">
                    <label htmlFor="new-password">Mật khẩu mới</label>
                    <div className="input-with-icon">
                      <LockKeyhole size={17} className="input-icon" />
                      <Input
                        id="new-password"
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        minLength={10}
                        maxLength={72}
                        placeholder="Ít nhất 10 ký tự"
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        aria-label={
                          showNewPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"
                        }
                        onClick={() => setShowNewPassword(!showNewPassword)}
                      >
                        {showNewPassword ? (
                          <EyeOff size={16} />
                        ) : (
                          <Eye size={16} />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="field">
                    <label htmlFor="confirm-password">
                      Xác nhận mật khẩu mới
                    </label>
                    <div className="input-with-icon">
                      <LockKeyhole size={17} className="input-icon" />
                      <Input
                        id="confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        minLength={10}
                        maxLength={72}
                        placeholder="Nhập lại mật khẩu mới"
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        aria-label={
                          showConfirmPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"
                        }
                        onClick={() =>
                          setShowConfirmPassword(!showConfirmPassword)
                        }
                      >
                        {showConfirmPassword ? (
                          <EyeOff size={16} />
                        ) : (
                          <Eye size={16} />
                        )}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <p role="alert" className="form-error">
                      {error}
                    </p>
                  )}

                  <Button
                    type="submit"
                    className="login-submit"
                    disabled={!!busy}
                  >
                    {busy === "reset-password" ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : null}
                    Hoàn tất đổi mật khẩu <Check size={17} />
                  </Button>

                  <div className="forgot-actions">
                    <button
                      type="button"
                      className="login-back-btn"
                      onClick={() => {
                        setForgotStep(1);
                        setError("");
                      }}
                    >
                      <ArrowLeft size={15} /> Bước trước
                    </button>
                    <button
                      type="button"
                      className="login-back-btn text-muted"
                      onClick={() => {
                        setMode("login");
                        setError("");
                      }}
                    >
                      Hủy bỏ
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            <div className="login-form">
              <div className="login-header-group">
                <span className="login-icon">
                  <LockKeyhole size={22} />
                </span>
                <div>
                  <h2>Đăng nhập</h2>
                  <p>
                    Nhập thông tin tài khoản để vào không gian sinh hoạt của
                    bạn.
                  </p>
                </div>
              </div>

              {successMsg && (
                <div className="form-success">
                  <CheckCircle2 size={17} className="shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

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
                      placeholder="Nhập tên đăng nhập của bạn"
                    />
                  </div>
                </div>
                <div className="field">
                  <div className="field-header">
                    <label htmlFor="password">Mật khẩu</label>
                    <button
                      type="button"
                      className="forgot-link"
                      onClick={() => {
                        setMode("forgot");
                        setForgotStep(1);
                        setError("");
                        setSuccessMsg("");
                        if (username) setForgotUser(username);
                      }}
                    >
                      Quên mật khẩu?
                    </button>
                  </div>
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
                      aria-label={
                        showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"
                      }
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
                <Button
                  type="submit"
                  className="login-submit"
                  disabled={!!busy}
                >
                  {busy === "login" ? (
                    <Loader2 className="animate-spin" />
                  ) : null}
                  Đăng nhập <ArrowRight size={17} />
                </Button>
              </form>
              {demo && (
                <div className="demo-login">
                  <div className="divider-label">
                    Tài khoản trải nghiệm nhanh
                  </div>
                  <p>Bấm chọn vai trò để thử giao diện tương ứng:</p>
                  <div className="demo-roles">
                    {["LEADER", "OFFICER", "TREASURER", "MEMBER", "ADMIN"].map(
                      (role) => (
                        <Button
                          key={role}
                          disabled={!!busy}
                          variant="outline"
                          className={"demo-chip demo-" + role.toLowerCase()}
                          onClick={() => signIn(role)}
                          title={roleInfo[role]?.desc}
                        >
                          {busy === role ? (
                            <Loader2 className="animate-spin" size={13} />
                          ) : null}
                          <span>
                            {roleInfo[role]?.icon} {roleInfo[role]?.label}
                          </span>
                        </Button>
                      ),
                    )}
                  </div>
                </div>
              )}
              <p className="login-help">
                Chưa có tài khoản? Liên hệ Ban chủ nhiệm câu lạc bộ của bạn để
                được cấp quyền.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
const navPrefetchPaths: Record<string, string> = {
  dashboard: "dashboard",
  events: "events?limit=12",
  members: "members?limit=12",
  finance: "finance?period=this_month",
  accounts: "accounts?limit=12",
  clubs: "clubs?limit=12",
  roles: "roles",
  categories: "categories",
  audit: "audit?limit=15",
};

function Nav({ items, roles, route, navigate, club }: any) {
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
              <a
                href={"#" + n.id}
                onClick={() => setOpenMobile(false)}
                onMouseEnter={() => {
                  if (club && navPrefetchPaths[n.id]) {
                    prefetchResource(navPrefetchPaths[n.id], club);
                  }
                }}
              >
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
      ...adminNavigation,
      ...adminSupervision,
      { id: "profile", label: "Hồ sơ cá nhân" },
    ].find((n) => n.id === routePath.split("/")[0])?.label || "Tổng quan";
  const logout = async () => {
    await fetchApi("auth/logout", club, { method: "POST", body: "{}" });
    clearResourceCache();
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
        page = <Finance />;
        break;
      case "approvals":
        page = <ApprovalCenter />;
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
      case "explore-clubs":
        page = <ExploreClubs />;
        break;
      default:
        page = can("ADMIN") ? (
          <AdminDashboard />
        ) : session.clubs.length === 0 ? (
          <ExploreClubs onboarding />
        ) : (
          <Dashboard />
        );
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
        reloadSession: (id?: number) => load(id !== undefined ? id : club),
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
          <SidebarHeader className="sidebar-header-area">
            <Brand />
            {can("ADMIN") && (
              <div className="sidebar-admin-badge">
                <ShieldCheck size={15} />
                <span>QUẢN TRỊ TOÀN TRƯỜNG</span>
              </div>
            )}
            <div className="club-switch">
              <span className="club-initial">
                {can("ADMIN")
                  ? "AD"
                  : activeClub?.club_code?.includes("CNTT")
                    ? "IT"
                    : "CLB"}
              </span>
              <div>
                <span>
                  {can("ADMIN") ? "GIÁM SÁT DỮ LIỆU CLB" : "CÂU LẠC BỘ CỦA BẠN"}
                </span>
                {session.clubs.length > 0 ? (
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
                ) : (
                  <button
                    className="text-xs text-primary font-medium hover:underline text-left block mt-1"
                    onClick={() => navigate("explore-clubs")}
                  >
                    Khám phá & tham gia ➔
                  </button>
                )}
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent>
            {can("ADMIN") ? (
              <>
                <SidebarGroup>
                  <SidebarGroupLabel>QUẢN TRỊ HỆ THỐNG</SidebarGroupLabel>
                  <Nav
                    items={adminNavigation}
                    roles={roleList}
                    route={routePath}
                    navigate={navigate}
                    club={club}
                  />
                </SidebarGroup>
                <SidebarGroup>
                  <SidebarGroupLabel>GIÁM SÁT CÂU LẠC BỘ</SidebarGroupLabel>
                  <Nav
                    items={adminSupervision}
                    roles={roleList}
                    route={routePath}
                    navigate={navigate}
                    club={club}
                  />
                </SidebarGroup>
              </>
            ) : (
              <>
                <SidebarGroup>
                  <SidebarGroupLabel>KHÔNG GIAN LÀM VIỆC</SidebarGroupLabel>
                  <Nav
                    items={navigation}
                    roles={roleList}
                    route={routePath}
                    navigate={navigate}
                    club={club}
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
                      club={club}
                    />
                  </SidebarGroup>
                )}
              </>
            )}
          </SidebarContent>
          <SidebarFooter>
            <button
              className="sidebar-profile"
              onClick={() => navigate("profile")}
            >
              <Avatar name={session.user.full_name} />
              <span>
                <strong>{session.user.full_name.split("·")[0]}</strong>
                <small
                  className={
                    can("ADMIN")
                      ? "text-amber-600 dark:text-amber-400 font-semibold"
                      : ""
                  }
                >
                  {can("ADMIN")
                    ? "Quản trị viên toàn trường"
                    : labels[roleList.find((r) => r !== "MEMBER") || "MEMBER"]}
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
                {can("ADMIN") ? "Quản trị hệ thống" : "Không gian làm việc"}{" "}
                <span>/</span> <strong>{title}</strong>
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

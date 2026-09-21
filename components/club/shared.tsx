"use client";
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Inbox,
  RefreshCw,
  Loader2,
  Download,
  AlertCircle,
  ArrowUpRight,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
export type Row = Record<string, any>;
export const AppContext = createContext<any>(null);
export const useApp = () => useContext(AppContext);
export const labels: Record<string, string> = {
  ADMIN: "Quản trị viên",
  LEADER: "Chủ nhiệm",
  OFFICER: "Cán bộ",
  TREASURER: "Thủ quỹ",
  MEMBER: "Thành viên",
  ACTIVE: "Đang hoạt động",
  PAUSED: "Tạm ngưng",
  LEFT: "Đã rời CLB",
  LOCKED: "Đã khóa",
  INACTIVE: "Ngừng hoạt động",
  DRAFT: "Bản nháp",
  OPEN: "Đang mở đăng ký",
  CLOSED: "Đã chốt danh sách",
  ONGOING: "Đang diễn ra",
  COMPLETED: "Đã hoàn tất",
  CANCELLED: "Đã hủy",
  PENDING: "Chờ xác nhận",
  CONFIRMED: "Đã xác nhận",
  REJECTED: "Đã từ chối",
  PRESENT: "Có mặt",
  ABSENT: "Vắng mặt",
  LATE: "Đến muộn",
  EXCUSED: "Có phép",
  INCOME: "Khoản thu",
  EXPENSE: "Khoản chi",
  PENDING_APPROVAL: "Chờ phê duyệt",
  APPROVED: "Đã phê duyệt",
  POSTED: "Đã ghi sổ",
  WORKSHOP: "Workshop",
  MEETING: "Sinh hoạt CLB",
  COMPETITION: "Cuộc thi",
  ACADEMIC: "Học thuật",
  VOLUNTEER: "Tình nguyện",
  INTERNAL: "Nội bộ CLB",
  PUBLIC: "Toàn trường",
};
export const opts = (values: string[]) =>
  values.map((value) => ({ value, label: labels[value] || value }));
export const money = (n: any) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);
export const num = (n: any) =>
  new Intl.NumberFormat("vi-VN").format(Number(n) || 0);
export const dateText = (d: any, withTime = false) =>
  d
    ? new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
        timeZone: "Asia/Ho_Chi_Minh",
      }).format(
        new Date(
          String(d).length === 10
            ? d + "T00:00:00+07:00"
            : /[Z+]\d*:?\d*$/.test(d)
              ? d
              : d + "+07:00",
        ),
      )
    : "—";
export const initials = (name: string = "") =>
  name
    .split("·")[0]
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((s) => s[0])
    .join("");
export const localNow = () =>
  new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 16);
export function Badge({ value }: { value: string }) {
  return (
    <span className={"status status-" + value}>
      <span className="status-dot" aria-hidden="true" />
      {labels[value] || value}
    </span>
  );
}
export function Avatar({ name, index = 0 }: { name: string; index?: number }) {
  return <span className={"avatar tone-" + (index % 5)}>{initials(name)}</span>;
}
export function SelectBox({
  value,
  onChange,
  options,
  label = "Chọn",
  disabled = false,
}: {
  value: any;
  onChange: (v: string) => void;
  options: { value: any; label: string }[];
  label?: string;
  disabled?: boolean;
}) {
  return (
    <Select
      value={String(value ?? "") || "__all"}
      onValueChange={(v) => onChange(v === "__all" ? "" : v)}
      disabled={disabled}
    >
      <SelectTrigger aria-label={label} className="select-control">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem
            key={String(o.value) || "__all"}
            value={String(o.value) || "__all"}
          >
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
export function apiUrl(path: string, club: number) {
  const p = path.includes("?") ? "&" : "?";
  return club > 0 ? "/api/" + path + p + "club=" + club : "/api/" + path;
}
export async function fetchApi(path: string, club: number, options: any = {}) {
  const response = await fetch(apiUrl(path, club), {
    ...options,
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });
  const data: any = await response.json();
  if (!response.ok) {
    const e: any = new Error(data.error || "Không thể xử lý yêu cầu.");
    e.fields = data.fields;
    e.status = response.status;
    throw e;
  }
  return data;
}
// ----------------------------------------------------
// Client-side In-Memory Cache with Stale-While-Revalidate (SWR)
// ----------------------------------------------------
// Client-side In-Memory Cache with Pure SWR (Always Revalidate)
// Chiến lược: Hiển thị ngay tức thì từ cache (0ms), đồng thời LUÔN làm mới
// ngầm từ máy chủ ở mọi lượt điều hướng và khi quay lại tab trình duyệt.
// ----------------------------------------------------
interface CacheEntry {
  data: any;
  timestamp: number;
  version: number;
}

const resourceCache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<any>>();
const FOCUS_THROTTLE_MS = 4000; // Throttle 4s để tránh dồn request khi người dùng Alt-Tab liên tục

export function getCachedResource(key: string, currentVersion: number) {
  const entry = resourceCache.get(key);
  if (!entry) return null;
  // Khi version thay đổi (sau thao tác mutation tạo/sửa/xóa), bỏ qua cache cũ để tải dữ liệu mới
  if (entry.version !== currentVersion) return null;
  return entry;
}

export function setCachedResource(key: string, data: any, version: number) {
  if (resourceCache.size > 120) {
    const firstKey = resourceCache.keys().next().value;
    if (firstKey) resourceCache.delete(firstKey);
  }
  resourceCache.set(key, {
    data,
    timestamp: Date.now(),
    version,
  });
}

export function clearResourceCache(clubId?: number) {
  if (clubId !== undefined) {
    for (const key of resourceCache.keys()) {
      if (key.startsWith(`${clubId}:`)) {
        resourceCache.delete(key);
      }
    }
  } else {
    resourceCache.clear();
  }
}

/**
 * Prefetch dữ liệu khi người dùng hover qua menu / link trước khi bấm
 */
export function prefetchResource(path: string, club: number) {
  if (!path) return;
  const key = `${club}:${path}`;
  if (resourceCache.has(key) || inFlightRequests.has(key)) return;
  const promise = fetchApi(path, club);
  inFlightRequests.set(key, promise);
  promise
    .then((data) => {
      setCachedResource(key, data, 0);
    })
    .catch(() => {})
    .finally(() => {
      inFlightRequests.delete(key);
    });
}

export function useResource(path: string | null) {
  const { club, version } = useApp();
  const cacheKey = path ? `${club}:${path}` : null;
  const cached = cacheKey ? getCachedResource(cacheKey, version) : null;

  // Nếu có dữ liệu trong cache: render ngay lập tức (0ms), không để người dùng chờ skeleton
  const [data, setData] = useState<any>(cached ? cached.data : null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState<boolean>(!cached && !!path);
  const [revalidating, setRevalidating] = useState<boolean>(!!path);

  useEffect(() => {
    let active = true;
    if (!path) {
      setLoading(false);
      setRevalidating(false);
      return;
    }

    const key = `${club}:${path}`;
    const currentCached = getCachedResource(key, version);

    // 1. Render tức thì dữ liệu cache nếu có (tránh hiện tượng chớp màn hình / layout shift)
    if (currentCached) {
      setData(currentCached.data);
      setLoading(false);
    } else {
      setLoading(true);
    }

    // 2. LUÔN LUÔN kích hoạt làm mới ngầm (Always Revalidate)
    setRevalidating(true);
    setError("");

    let lastFetchTime = Date.now();

    const executeRevalidation = () => {
      // Request Deduplication: Nếu cùng 1 endpoint đang fetch dở thì dùng chung Promise
      let req = inFlightRequests.get(key);
      if (!req) {
        req = fetchApi(path, club);
        inFlightRequests.set(key, req);
        req.finally(() => inFlightRequests.delete(key));
      }

      req
        .then((d) => {
          if (active) {
            setCachedResource(key, d, version);
            setData(d);
            setError("");
          }
        })
        .catch((e) => {
          if (active) {
            // Nếu đã có cache thì giữ giao diện nguyên vẹn, không gián đoạn người dùng
            if (!currentCached) {
              setError(e.message);
            }
          }
        })
        .finally(() => {
          if (active) {
            setLoading(false);
            setRevalidating(false);
            lastFetchTime = Date.now();
          }
        });
    };

    executeRevalidation();

    // 3. Tự động kiểm tra làm mới khi người dùng quay lại tab trình duyệt (Focus Revalidation)
    const handleFocus = () => {
      if (document.visibilityState === "visible") {
        if (Date.now() - lastFetchTime > FOCUS_THROTTLE_MS) {
          executeRevalidation();
        }
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);

    return () => {
      active = false;
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
    };
  }, [path, club, version]);

  return { data, error, loading, revalidating };
}

// ----------------------------------------------------
// Context-Aware Skeleton Loaders
// ----------------------------------------------------
export function DashboardSkeleton() {
  return (
    <div className="skeleton-dashboard" aria-label="Đang tải dữ liệu tổng quan...">
      <div className="skeleton-banner skeleton-shimmer" />
      <div className="metrics-grid">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="metric skeleton-metric">
            <div className="metric-top">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-8 rounded-xl" />
            </div>
            <Skeleton className="h-9 w-20 my-2" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="dashboard-columns">
        <div className="dashboard-primary panel p-5">
          <div className="flex justify-between items-center mb-4">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        </div>
        <div className="dashboard-secondary space-y-4">
          <div className="panel p-5 space-y-3">
            <Skeleton className="h-5 w-32" />
            <div className="grid grid-cols-2 gap-2 pt-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          </div>
          <div className="panel p-5 space-y-3">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="panel skeleton-table-container" aria-label="Đang tải danh sách...">
      <div className="filterbar">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="h-10 w-36 rounded-xl" />
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: "48px" }}><Skeleton className="h-4 w-6" /></th>
              <th><Skeleton className="h-4 w-32" /></th>
              <th><Skeleton className="h-4 w-24" /></th>
              <th><Skeleton className="h-4 w-20" /></th>
              <th style={{ width: "90px" }}><Skeleton className="h-4 w-16" /></th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, i) => (
              <tr key={i}>
                <td>
                  <Skeleton className="h-9 w-9 rounded-full" />
                </td>
                <td>
                  <Skeleton className="h-4 w-40 mb-1.5" />
                  <Skeleton className="h-3 w-24" />
                </td>
                <td>
                  <Skeleton className="h-4 w-32" />
                </td>
                <td>
                  <Skeleton className="h-6 w-20 rounded-full" />
                </td>
                <td>
                  <Skeleton className="h-8 w-16 rounded-lg ml-auto" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function EventsGridSkeleton() {
  return (
    <div className="space-y-6" aria-label="Đang tải danh sách sự kiện...">
      <div className="filterbar panel">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="h-10 w-40 rounded-xl" />
      </div>
      <div className="events-grid">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="event-card skeleton-card">
            <Skeleton className="h-44 w-full rounded-none" />
            <div className="p-5 space-y-3">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-2 w-full rounded-full mt-4" />
              <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="space-y-6" aria-label="Đang tải chi tiết...">
      <Skeleton className="h-5 w-28" />
      <div className="event-detail-stats">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-11 w-11 rounded-xl flex-shrink-0" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        ))}
      </div>
      <div className="event-detail-grid">
        <div className="panel p-6 space-y-4">
          <Skeleton className="h-6 w-48" />
          <div className="space-y-3 pt-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex justify-between py-2.5 border-b border-slate-100">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-44" />
              </div>
            ))}
          </div>
        </div>
        <div className="panel p-6 space-y-4">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-2 w-full rounded-full" />
          <Skeleton className="h-11 w-full rounded-xl mt-4" />
        </div>
      </div>
    </div>
  );
}

export function FinanceSkeleton() {
  return (
    <div className="space-y-6" aria-label="Đang tải dữ liệu tài chính...">
      <div className="metrics-grid finance-metrics">
        {[1, 2, 3].map((i) => (
          <div key={i} className="metric skeleton-metric">
            <div className="metric-top">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-8 rounded-xl" />
            </div>
            <Skeleton className="h-9 w-28 my-2" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>
      <TableSkeleton rows={5} />
    </div>
  );
}

export function LoadState({
  loading,
  error,
  children,
  variant = "default",
}: {
  loading: boolean;
  error: string;
  children: React.ReactNode;
  variant?:
    | "dashboard"
    | "table"
    | "events"
    | "cards"
    | "detail"
    | "finance"
    | "default";
}) {
  const { refresh } = useApp();
  if (loading) {
    switch (variant) {
      case "dashboard":
        return <DashboardSkeleton />;
      case "events":
      case "cards":
        return <EventsGridSkeleton />;
      case "detail":
        return <DetailSkeleton />;
      case "finance":
        return <FinanceSkeleton />;
      case "table":
      default:
        return <TableSkeleton rows={5} />;
    }
  }
  if (error)
    return (
      <div className="error-state" role="alert">
        <AlertCircle />
        <p>{error}</p>
        <Button variant="outline" onClick={refresh}>
          <RefreshCw />
          Thử lại
        </Button>
      </div>
    );
  return <>{children}</>;
}
export function EmptyState({
  title = "Chưa có dữ liệu",
  description = "Dữ liệu sẽ xuất hiện tại đây khi được thêm.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <Empty className="empty-state">
      <EmptyHeader>
        <Inbox size={30} />
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
export function PageTitle({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      <div className="title-actions">{children}</div>
    </div>
  );
}
export function Filters({
  q,
  setQ,
  status,
  setStatus,
  statuses = [],
  children,
}: {
  q: string;
  setQ: any;
  status?: string;
  setStatus?: any;
  statuses?: string[];
  children?: React.ReactNode;
}) {
  return (
    <div className="filterbar">
      <div className="search-field">
        <Search size={18} />
        <Input
          aria-label="Tìm kiếm"
          placeholder="Tìm kiếm…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      {setStatus && (
        <SelectBox
          label="Lọc trạng thái"
          value={status}
          onChange={setStatus}
          options={[
            { value: "", label: "Tất cả trạng thái" },
            ...opts(statuses),
          ]}
        />
      )}
      <div className="filter-extra">{children}</div>
    </div>
  );
}
export function useFilters() {
  const [q, setQ] = useState(""),
    [debounced, setDebounced] = useState(""),
    [status, setStatus] = useState(""),
    [page, setPage] = useState(1);
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(q);
      setPage(1);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);
  return {
    q,
    setQ,
    status,
    setStatus: (v: string) => {
      setStatus(v);
      setPage(1);
    },
    page,
    setPage,
    query: `q=${encodeURIComponent(debounced)}&status=${status}&page=${page}`,
  };
}
export function DataTable({
  data,
  columns,
  page,
  setPage,
}: {
  data: any;
  columns: {
    key: string;
    title: string;
    render?: (r: any, i: number) => React.ReactNode;
  }[];
  page?: number;
  setPage?: any;
}) {
  if (!data?.rows?.length)
    return (
      <EmptyState
        title="Không có kết quả"
        description="Thử thay đổi bộ lọc hoặc thêm dữ liệu mới."
      />
    );
  return (
    <>
      <div className="table-wrap">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c) => (
                <TableHead key={c.key}>{c.title}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((r: Row, i: number) => (
              <TableRow
                key={
                  r.audit_id ??
                  r.user_role_id ??
                  r.registration_id ??
                  r.attendance_id ??
                  r.club_member_id ??
                  r.transaction_id ??
                  r.event_id ??
                  r.category_id ??
                  r.club_id ??
                  r.user_id ??
                  i
                }
              >
                {columns.map((c) => (
                  <TableCell key={c.key}>
                    {c.render ? c.render(r, i) : (r[c.key] ?? "—")}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {setPage && (
        <div className="table-footer">
          <span>
            {num(data.total)} kết quả · Trang {page}/
            {Math.max(1, Math.ceil(data.total / (data.size || 10)))}
          </span>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <Button
                  size="icon"
                  variant="outline"
                  aria-label="Trang trước"
                  disabled={page === 1}
                  onClick={() => setPage(page! - 1)}
                >
                  <ChevronLeft />
                </Button>
              </PaginationItem>
              <PaginationItem>
                <Button
                  size="icon"
                  variant="outline"
                  aria-label="Trang sau"
                  disabled={page! * (data.size || 10) >= data.total}
                  onClick={() => setPage(page! + 1)}
                >
                  <ChevronRight />
                </Button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </>
  );
}
export function ExportButton({
  path,
  label = "Xuất CSV",
}: {
  path: string;
  label?: string;
}) {
  const { club } = useApp();
  return (
    <Button variant="outline" asChild>
      <a
        href={apiUrl(
          path + (path.includes("?") ? "&" : "?") + "export=csv",
          club,
        )}
        download
      >
        <Download size={16} />
        {label}
      </a>
    </Button>
  );
}
export function ActionButton({
  onClick,
  children,
  variant = "outline",
  className = "",
  disabled = false,
}: any) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant={variant}
      className={className}
      disabled={busy || disabled}
      onClick={async () => {
        setBusy(true);
        try {
          await onClick();
        } catch (e: any) {
          toast.error(e.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 className="animate-spin" size={16} /> : null}
      {children}
    </Button>
  );
}
export type Field = {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  options?: { value: any; label: string }[];
  placeholder?: string;
  wide?: boolean;
  min?: any;
  max?: any;
  maxLength?: number;
  help?: string;
};
export function Editor({
  title,
  description,
  fields,
  initial = {},
  onSave,
  onClose,
  extra,
}: any) {
  const [values, setValues] = useState<Row>(initial),
    [error, setError] = useState(""),
    [errors, setErrors] = useState<Row>({}),
    [busy, setBusy] = useState(false);
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v && !busy) onClose();
      }}
    >
      <DialogContent className="editor-dialog">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description ||
              "Điền thông tin bên dưới. Các trường có dấu * là bắt buộc."}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            setErrors({});
            const missing = fields.filter(
              (f: Field) =>
                f.required &&
                (values[f.name] === undefined ||
                  values[f.name] === null ||
                  values[f.name] === ""),
            );
            if (missing.length) {
              setErrors(
                Object.fromEntries(
                  missing.map((f: Field) => [
                    f.name,
                    "Vui lòng nhập trường này.",
                  ]),
                ),
              );
              return;
            }
            setBusy(true);
            try {
              await onSave(values);
              toast.success("Đã lưu thay đổi.");
              onClose();
            } catch (err: any) {
              setError(err.message);
              setErrors(err.fields || {});
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="editor-fields">
            {fields.map((f: Field) => (
              <div
                className={"field " + (f.wide ? "field-wide" : "")}
                key={f.name}
              >
                <label htmlFor={"field-" + f.name}>
                  {f.label}
                  {f.required && <span> *</span>}
                </label>
                {f.type === "select" ? (
                  <SelectBox
                    label={f.label}
                    value={values[f.name]}
                    onChange={(v) => setValues({ ...values, [f.name]: v })}
                    options={f.options || []}
                  />
                ) : f.type === "textarea" ? (
                  <textarea
                    id={"field-" + f.name}
                    value={values[f.name] ?? ""}
                    required={f.required}
                    maxLength={f.maxLength || 3000}
                    onChange={(e) =>
                      setValues({ ...values, [f.name]: e.target.value })
                    }
                  />
                ) : (
                  <Input
                    id={"field-" + f.name}
                    type={f.type || "text"}
                    step={f.type === "number" ? "any" : undefined}
                    value={values[f.name] ?? ""}
                    required={f.required}
                    min={f.min}
                    max={f.max}
                    maxLength={f.maxLength || 500}
                    placeholder={f.placeholder}
                    autoComplete={
                      f.type === "password" ? "new-password" : "off"
                    }
                    onChange={(e) =>
                      setValues({ ...values, [f.name]: e.target.value })
                    }
                  />
                )}{" "}
                {f.help && <small>{f.help}</small>}
                {errors[f.name] && (
                  <small className="field-error">{errors[f.name]}</small>
                )}
              </div>
            ))}
          </div>
          {extra && extra(values, (v: Row) => setValues({ ...values, ...v }))}
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <div className="editor-footer">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={busy}
            >
              Để sau
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}Lưu thông tin
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
export function Confirm({
  title,
  description = "Thao tác này sẽ cập nhật dữ liệu. Bạn có muốn tiếp tục?",
  reason = false,
  onConfirm,
  onClose,
}: any) {
  const [note, setNote] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <AlertDialog
      open
      onOpenChange={(v) => {
        if (!v && !busy) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {reason && (
          <div className="field">
            <label htmlFor="confirm-reason">Lý do *</label>
            <textarea
              id="confirm-reason"
              value={note}
              maxLength={500}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Nhập lý do thực hiện…"
            />
          </div>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Quay lại</AlertDialogCancel>
          <Button
            disabled={busy || (reason && !note.trim())}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm(note);
                toast.success("Đã cập nhật.");
                onClose();
              } catch (e: any) {
                setError(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy && <Loader2 className="animate-spin" />}Xác nhận
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
export function Metric({
  label,
  value,
  caption,
  icon: Icon,
  tone = "green",
}: any) {
  return (
    <div className={"metric metric-" + tone}>
      <div className="metric-top">
        <span>{label}</span>
        <span className="metric-icon">
          <Icon size={20} />
        </span>
      </div>
      <strong>{value}</strong>
      <p>{caption}</p>
    </div>
  );
}
export function SectionHeader({ title, children }: any) {
  return (
    <div className="section-header">
      <h2>{title}</h2>
      {children}
    </div>
  );
}

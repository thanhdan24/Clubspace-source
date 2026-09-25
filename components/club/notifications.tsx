"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Bell,
  CalendarDays,
  DollarSign,
  UserPlus,
  Users,
  CheckCheck,
  Inbox,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from "@/components/ui/dropdown-menu";
import { useApp, fetchApi, dateText } from "./shared";

function getNotificationIcon(type: string) {
  switch (type) {
    case "EVENT":
      return (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
          <CalendarDays size={16} />
        </span>
      );
    case "FINANCE":
      return (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
          <DollarSign size={16} />
        </span>
      );
    case "JOIN_REQUEST":
      return (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
          <UserPlus size={16} />
        </span>
      );
    case "MEMBERSHIP":
      return (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
          <Users size={16} />
        </span>
      );
    default:
      return (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          <Bell size={16} />
        </span>
      );
  }
}

export default function Notifications() {
  const { club, navigate, version } = useApp();
  const [data, setData] = useState<{ rows: any[]; unread_count: number }>({
    rows: [],
    unread_count: 0,
  });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [open, setOpen] = useState(false);

  const seenIdsRef = useRef<Set<number>>(new Set());
  const isInitialLoadRef = useRef(true);

  const loadNotifications = useCallback(
    async (isPolling = false) => {
      try {
        const res = await fetchApi("notifications?limit=40", club);
        const rows: any[] = res.rows || [];
        const unreadCount = Number(res.unread_count || 0);

        if (!isInitialLoadRef.current) {
          // Detect brand-new unread notifications and pop in-app toast
          const newUnread = rows.filter(
            (r) => !r.is_read && !seenIdsRef.current.has(r.notification_id),
          );
          for (const item of newUnread) {
            toast(item.title, {
              description: item.content,
              action: item.link_url
                ? {
                    label: "Xem ngay",
                    onClick: () => {
                      if (item.link_url) navigate(item.link_url);
                    },
                  }
                : undefined,
            });
          }
        }

        // Update seen IDs
        rows.forEach((r) => seenIdsRef.current.add(r.notification_id));
        isInitialLoadRef.current = false;

        setData({ rows, unread_count: unreadCount });
      } catch (e) {
        // Silently catch errors on background poll
        if (!isPolling) console.error("Lỗi tải thông báo:", e);
      } finally {
        setLoading(false);
      }
    },
    [club, navigate],
  );

  // Initial fetch and on club / version change
  useEffect(() => {
    loadNotifications(false);
  }, [loadNotifications, version]);

  // Periodic polling every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      loadNotifications(true);
    }, 30000);
    return () => clearInterval(timer);
  }, [loadNotifications]);

  // Revalidate on browser window focus
  useEffect(() => {
    const handleFocus = () => {
      loadNotifications(true);
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [loadNotifications]);

  // Mark single item as read
  const handleItemClick = async (item: any) => {
    if (!item.is_read) {
      setData((prev) => ({
        rows: prev.rows.map((r) =>
          r.notification_id === item.notification_id
            ? { ...r, is_read: true }
            : r,
        ),
        unread_count: Math.max(0, prev.unread_count - 1),
      }));
      fetchApi(`notifications/${item.notification_id}/read`, club, {
        method: "PATCH",
      }).catch(() => {});
    }

    if (item.link_url) {
      setOpen(false);
      navigate(item.link_url);
    }
  };

  // Mark all as read
  const handleMarkAllRead = async () => {
    if (data.unread_count === 0) return;
    setData((prev) => ({
      rows: prev.rows.map((r) => ({ ...r, is_read: true })),
      unread_count: 0,
    }));
    try {
      await fetchApi("notifications/read-all", club, { method: "PATCH" });
      toast.success("Đã đánh dấu tất cả thông báo là đã đọc.");
    } catch {
      toast.error("Không thể cập nhật trạng thái đã đọc.");
      loadNotifications(true);
    }
  };

  const displayedRows =
    tab === "unread" ? data.rows.filter((r) => !r.is_read) : data.rows;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Thông báo hệ thống"
          className="relative"
        >
          <Bell size={19} />
          {data.unread_count > 0 && (
            <span className="notification-count">
              {data.unread_count > 99 ? "99+" : data.unread_count}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="notifications-menu w-[380px] p-0 overflow-hidden shadow-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-800">Thông báo</h3>
            {data.unread_count > 0 && (
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                {data.unread_count} mới
              </span>
            )}
          </div>
          {data.unread_count > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:underline transition-colors cursor-pointer"
              title="Đánh dấu tất cả đã đọc"
            >
              <CheckCheck size={14} />
              <span>Đã đọc tất cả</span>
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex border-b border-slate-100 px-3 pt-2 gap-1 bg-white">
          <button
            onClick={() => setTab("all")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-t-md transition-colors cursor-pointer ${
              tab === "all"
                ? "border-b-2 border-emerald-600 text-emerald-700 bg-emerald-50/50"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Tất cả ({data.rows.length})
          </button>
          <button
            onClick={() => setTab("unread")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-t-md transition-colors cursor-pointer ${
              tab === "unread"
                ? "border-b-2 border-emerald-600 text-emerald-700 bg-emerald-50/50"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Chưa đọc ({data.unread_count})
          </button>
        </div>

        {/* Notification List */}
        <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
          {displayedRows.length > 0 ? (
            displayedRows.map((row: any) => (
              <div
                key={row.notification_id}
                onClick={() => handleItemClick(row)}
                className={`flex items-start gap-3 p-3 transition-colors cursor-pointer hover:bg-slate-50 ${
                  !row.is_read ? "bg-emerald-50/30" : "bg-white"
                }`}
                role="button"
                tabIndex={0}
              >
                {getNotificationIcon(row.type)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span
                      className={`text-xs font-bold truncate ${
                        !row.is_read ? "text-slate-900" : "text-slate-700"
                      }`}
                    >
                      {row.title}
                    </span>
                    {!row.is_read && (
                      <span
                        className="h-2 w-2 shrink-0 rounded-full bg-emerald-500"
                        title="Chưa đọc"
                      />
                    )}
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {row.content}
                  </p>
                  <div className="flex items-center justify-between mt-1 text-[11px] text-slate-400">
                    <span>{dateText(row.created_at, true)}</span>
                    {row.link_url && (
                      <span className="inline-flex items-center gap-0.5 text-emerald-600 hover:underline">
                        <span>Chi tiết</span>
                        <ExternalLink size={10} />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-slate-400">
              <Inbox size={32} className="mx-auto mb-2 text-slate-300" />
              <p className="text-xs font-medium">
                {loading
                  ? "Đang tải thông báo..."
                  : tab === "unread"
                    ? "Không có thông báo chưa đọc."
                    : "Chưa có thông báo nào."}
              </p>
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

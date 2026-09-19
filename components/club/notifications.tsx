"use client";
import { Bell, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useResource, useApp, dateText } from "./shared";
import { actionLabel } from "./dashboard";
export default function Notifications() {
  const { navigate } = useApp(),
    r = useResource("notifications");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" aria-label="Cập nhật sự kiện">
          <Bell size={19} />
          {r.data?.rows?.length > 0 && (
            <span className="notification-count">{r.data.rows.length}</span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="notifications-menu">
        <DropdownMenuLabel>Cập nhật sự kiện đã đăng ký</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {r.data?.rows?.length ? (
          r.data.rows.map((row: any) => (
            <DropdownMenuItem
              key={row.audit_id}
              onSelect={() => navigate("events/" + row.event_id)}
            >
              <CalendarDays size={17} />
              <div>
                <strong>{row.event_name}</strong>
                <p>{actionLabel(row.action_code)}</p>
                <small>{dateText(row.created_at, true)}</small>
              </div>
            </DropdownMenuItem>
          ))
        ) : (
          <p className="notification-empty">
            {r.loading
              ? "Đang tải cập nhật…"
              : r.error ||
                "Chưa có thay đổi mới trong các sự kiện bạn đăng ký."}
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

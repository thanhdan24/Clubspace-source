"use client";
import { useEffect } from "react";
import { fetchApi, useApp } from "./shared";
export default function WebTools() {
  const { club, navigate } = useApp();
  useEffect(() => {
    const context = (document as any).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const tools = [
      {
        name: "read_club_events",
        title: "Đọc sự kiện câu lạc bộ",
        description:
          "Tìm sự kiện trong CLB đang chọn, theo đúng phiên đăng nhập và quyền hiện tại.",
        inputSchema: {
          type: "object",
          properties: { query: { type: "string", maxLength: 100 } },
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: async (input: any) => {
          if (
            !input ||
            typeof input !== "object" ||
            Object.keys(input).some((k) => k !== "query") ||
            (input.query !== undefined && typeof input.query !== "string") ||
            (input.query?.length || 0) > 100
          )
            throw new Error("Bộ lọc không hợp lệ.");
          const r = await fetchApi(
            "events?q=" + encodeURIComponent(input.query || ""),
            club,
          );
          return {
            total: r.total,
            events: r.rows.map((e: any) => ({
              event_id: e.event_id,
              event_name: e.event_name,
              start_at: e.start_at,
              event_status: e.event_status,
            })),
          };
        },
      },
      {
        name: "show_event_details",
        title: "Mở chi tiết sự kiện",
        description:
          "Chỉ chuyển màn hình đến chi tiết sự kiện có quyền xem; không tạo đăng ký.",
        inputSchema: {
          type: "object",
          properties: { event_id: { type: "integer", minimum: 1 } },
          required: ["event_id"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        execute: async (input: any) => {
          if (
            !Number.isSafeInteger(input?.event_id) ||
            input.event_id < 1 ||
            Object.keys(input).some((k) => k !== "event_id")
          )
            throw new Error("Mã sự kiện không hợp lệ.");
          const r = await fetchApi("events/" + input.event_id, club);
          navigate("events/" + input.event_id);
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          );
          return {
            event_id: r.event.event_id,
            event_name: r.event.event_name,
            opened: true,
          };
        },
      },
    ];
    for (const tool of tools)
      try {
        void Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => {});
      } catch {}
    return () => lifecycle.abort();
  }, [club]);
  return null;
}

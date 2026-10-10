import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { handleApi } from "./api";
import { prisma, PrismaDatabase } from "./prisma";
import { Prisma } from "@prisma/client";

const port = Number(process.env.PORT || 3001),
  host = process.env.HOST || "127.0.0.1";


const uploadRoot = path.resolve(process.env.UPLOAD_DIR || "private-uploads");
await fs.mkdir(uploadRoot, { recursive: true });

const bucket = {
  async put(key: string, bytes: Uint8Array, metadata: any) {
    const p = path.join(uploadRoot, key);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, bytes, { flag: "wx" });
    await fs.writeFile(p + ".json", JSON.stringify(metadata));
  },
  async get(key: string) {
    try {
      const data = await fs.readFile(path.join(uploadRoot, key)),
        meta = JSON.parse(
          await fs.readFile(path.join(uploadRoot, key) + ".json", "utf8"),
        );
      return { body: data, ...meta };
    } catch {
      return null;
    }
  },
};

const mime: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};


const server = http.createServer(async (req, res) => {
  try {
    if ((req.url || "").startsWith("/api/")) {
      const proto = (req.headers["x-forwarded-proto"] as string) || "http";
      const host = req.headers.host || "127.0.0.1:3001";
      const requestOrigin = `${proto}://${host}`;
      const url = new URL(req.url!, requestOrigin).toString();
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 11 * 1024 * 1024) {
          res.writeHead(413);
          res.end("Tệp quá lớn");
          return;
        }
        chunks.push(chunk);
      }
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers))
        if (v) headers.set(k, Array.isArray(v) ? v.join("; ") : v);

      const request = new Request(url, {
        method: req.method,
        headers,
        body: ["GET", "HEAD"].includes(req.method!)
          ? undefined
          : Buffer.concat(chunks),
      });

      const db = new PrismaDatabase(prisma);
      const response = await handleApi(request, db, {
        ...process.env,
        DEMO_MODE: "false",
        BUCKET: bucket,
      });

      res.writeHead(response.status, Object.fromEntries(response.headers));
      if (response.body) Readable.fromWeb(response.body as any).pipe(res);
      else res.end();
      return;
    }

    const root = path.resolve("web-dist");
    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    let file = path.resolve(root, "." + decodeURIComponent(url.pathname));
    if (!file.startsWith(root + path.sep) && file !== root) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (url.pathname === "/" || !path.extname(file))
      file = path.join(root, "index.html");
    try {
      const data = await fs.readFile(file);
      res.writeHead(200, {
        "Content-Type": mime[path.extname(file)] || "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "same-origin",
        "Cache-Control": file.endsWith("index.html")
          ? "no-store"
          : "public, max-age=3600",
      });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("Không tìm thấy trang. Chạy pnpm build trước.");
    }
  } catch (e: any) {
    console.error("[node-api]", e.message);
    if (!res.headersSent) {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error:
            "Không kết nối được database hoặc máy chủ đang bận. Vui lòng thử lại.",
        }),
      );
    } else res.end();
  }
});

server.listen(port, host, () => {
  console.log(
    `Clubspace server đang chạy trên ${host}:${port} (Supabase PostgreSQL / Prisma)`,
  );
  (async () => {
    try {
      const t0 = Date.now();
      await prisma.$queryRawUnsafe("SELECT 1 AS ok");
      console.log(
        `[Supabase/Prisma] Đã kết nối thành công tới Supabase (${Date.now() - t0}ms). Sẵn sàng phục vụ yêu cầu!`,
      );
      // Keep-alive heartbeat: ping DB every 25s so Supabase pooler stays warm and active
      setInterval(async () => {
        try {
          await prisma.$queryRawUnsafe("SELECT 1 AS heartbeat");
        } catch {
          // ignore background heartbeat transient errors
        }
      }, 25000).unref();
    } catch (err: any) {
      console.warn("[Supabase/Prisma] Đang đợi kết nối nền:", err?.message || err);
    }
  })();
});

for (const event of ["SIGINT", "SIGTERM"])
  process.on(event, async () => {
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  });

import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import sql from "mssql";
import { SqlServerDatabase, connectionConfig } from "./sqlserver";
import { handleApi } from "./api";
const port = Number(process.env.PORT || 3001),
  host = process.env.HOST || "127.0.0.1";
const pool = await new sql.ConnectionPool(connectionConfig()).connect();
await pool.request().query("SELECT 1 AS ok");
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
const mime: any = {
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
      const origin = process.env.APP_ORIGIN || `http://${req.headers.host}`;
      const url = new URL(req.url!, origin).toString();
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
      const tx = new sql.Transaction(pool);
      await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
      let response: Response;
      try {
        response = await handleApi(request, new SqlServerDatabase(pool, tx), {
          ...process.env,
          DEMO_MODE: "false",
          BUCKET: bucket,
        });
        if (response.status >= 400 && !url.includes("/auth/login"))
          await tx.rollback();
        else await tx.commit();
      } catch (e) {
        await tx.rollback().catch(() => {});
        throw e;
      }
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
      res.end("Không tìm thấy trang. Chạy pnpm build:standalone trước.");
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
server.listen(port, host, () =>
  console.log(`Clubspace SQL Server đang chạy trên ${host}:${port}`),
);
for (const event of ["SIGINT", "SIGTERM"])
  process.on(event, () =>
    server.close(() => {
      pool.close();
      process.exit(0);
    }),
  );

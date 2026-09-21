import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { handleApi } from "./api";
import { prisma, PrismaDatabase } from "./prisma";
import { Prisma } from "@prisma/client";

const port = Number(process.env.PORT || 3001),
  host = process.env.HOST || "127.0.0.1";

const isSupabase = Boolean(
  process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("[YOUR-PROJECT-REF]"),
);

let sqlPool: any = null;
let SqlServerDatabaseClass: any = null;

if (isSupabase) {
  try {
    await prisma.$connect();
    await prisma.$queryRawUnsafe("SELECT 1 AS ok");
    console.log("[Supabase/Prisma] Đã kết nối thành công tới Supabase (PostgreSQL).");
  } catch (err: any) {
    console.error("[Supabase/Prisma] Lỗi kết nối database:", err.message);
    throw err;
  }
} else if (process.env.DB_SERVER) {
  const mssql = await import("mssql");
  const { SqlServerDatabase, connectionConfig } = await import("./sqlserver");
  SqlServerDatabaseClass = SqlServerDatabase;
  sqlPool = await new mssql.default.ConnectionPool(connectionConfig()).connect();
  await sqlPool.request().query("SELECT 1 AS ok");
  console.log("[SQL Server] Đã kết nối thành công tới SQL Server.");
} else {
  console.warn(
    "[Database Warning] Chưa cấu hình DATABASE_URL (Supabase) hoặc DB_SERVER (SQL Server). Vui lòng cập nhật tệp .env.",
  );
}

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

class RollbackError extends Error {
  constructor(public response: Response) {
    super("Rollback");
  }
}

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

      let response: Response;

      if (isSupabase) {
        try {
          response = await prisma.$transaction(
            async (tx) => {
              const db = new PrismaDatabase(tx);
              const result = await handleApi(request, db, {
                ...process.env,
                DEMO_MODE: "false",
                BUCKET: bucket,
              });
              if (result.status >= 400 && !url.includes("/auth/login")) {
                throw new RollbackError(result);
              }
              return result;
            },
            {
              isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            },
          );
        } catch (e: any) {
          if (e instanceof RollbackError) {
            response = e.response;
          } else {
            throw e;
          }
        }
      } else if (sqlPool) {
        const mssql = await import("mssql");
        const tx = new mssql.default.Transaction(sqlPool);
        await tx.begin(mssql.default.ISOLATION_LEVEL.SERIALIZABLE);
        try {
          response = await handleApi(
            request,
            new SqlServerDatabaseClass(sqlPool, tx),
            {
              ...process.env,
              DEMO_MODE: "false",
              BUCKET: bucket,
            },
          );
          if (response.status >= 400 && !url.includes("/auth/login")) {
            await tx.rollback();
          } else {
            await tx.commit();
          }
        } catch (e) {
          await tx.rollback().catch(() => {});
          throw e;
        }
      } else {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "Chưa cấu hình kết nối database trong file .env.",
          }),
        );
        return;
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
  console.log(
    `Clubspace server đang chạy trên ${host}:${port} (${isSupabase ? "Supabase PostgreSQL / Prisma" : "SQL Server"})`,
  ),
);

for (const event of ["SIGINT", "SIGTERM"])
  process.on(event, async () => {
    server.close(async () => {
      if (isSupabase) await prisma.$disconnect();
      if (sqlPool) await sqlPool.close();
      process.exit(0);
    });
  });

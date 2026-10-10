import { PrismaClient, Prisma } from "@prisma/client";
import type { Database, Statement, Row } from "./core";

function resolveDatabaseUrl(): string | undefined {
  let url = process.env.DATABASE_URL || process.env.DIRECT_URL;
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    // Pin to the healthy Tokyo pooler IP to prevent 30-60s timeouts from dead ELB nodes
    if (parsed.hostname === "aws-1-ap-northeast-1.pooler.supabase.com") {
      parsed.hostname = "18.176.230.146";
    }
    if (parsed.port === "6543" || parsed.host.includes(":6543")) {
      parsed.searchParams.set("pgbouncer", "true");
    }
    parsed.searchParams.set("sslmode", "prefer");
    parsed.searchParams.set("connection_limit", "1");
    parsed.searchParams.set("pool_timeout", "60");
    parsed.searchParams.set("connect_timeout", "60");
    return parsed.toString();
  } catch {
    if (url.includes("aws-1-ap-northeast-1.pooler.supabase.com")) {
      url = url.replace("aws-1-ap-northeast-1.pooler.supabase.com", "18.176.230.146");
    }
    if (url.includes(":6543") && !url.includes("pgbouncer")) {
      url += (url.includes("?") ? "&" : "?") + "pgbouncer=true";
    }
    if (!url.includes("sslmode")) {
      url += (url.includes("?") ? "&" : "?") + "sslmode=prefer";
    }
    if (url.includes("connection_limit")) {
      url = url.replace(/connection_limit=\d+/, "connection_limit=1");
    } else {
      url += (url.includes("?") ? "&" : "?") + "connection_limit=1";
    }
    if (!url.includes("pool_timeout")) {
      url += "&pool_timeout=60";
    }
    if (!url.includes("connect_timeout")) {
      url += "&connect_timeout=60";
    }
    return url;
  }
}

const resolvedDbUrl = resolveDatabaseUrl();

export const prisma = new PrismaClient({
  datasources: resolvedDbUrl ? { db: { url: resolvedDbUrl } } : undefined,
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});

const TABLE_NAMES = [
  "CLUBS",
  "USERS",
  "ROLES",
  "USER_ROLES",
  "CLUB_MEMBERS",
  "MEMBER_STATUS_HISTORY",
  "EVENTS",
  "EVENT_REGISTRATIONS",
  "ATTENDANCE",
  "FINANCE_CATEGORIES",
  "FINANCIAL_TRANSACTIONS",
  "AUDIT_LOGS",
  "AUTH_SESSIONS",
  "AUTH_ATTEMPTS",
  "APP_SETUP",
  "CLUB_JOIN_REQUESTS",
  "NOTIFICATIONS",
  "CLUB_DEPARTMENTS",
  "vw_club_fund_summary",
  "vw_event_statistics",
];

const TABLE_REGEX = new RegExp(
  `(?<!["'\\w])(${TABLE_NAMES.join("|")})(?!["'\\w])`,
  "g",
);

export function convertSqlToPostgres(source: string, parameters: unknown[]) {
  let paramIdx = 1;
  let text = source.replace(/\?/g, () => `$${paramIdx++}`);
  text = text.replace(TABLE_REGEX, '"$1"');
  text = text.replace(/\bSUBSTR\(/gi, "SUBSTRING(");
  return { text, parameters };
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    const isConnErr =
      err?.message?.includes("Can't reach database") ||
      err?.message?.includes("connection pool") ||
      err?.code === "P1001" ||
      err?.code === "P2024";
    if (isConnErr) {
      await new Promise((r) => setTimeout(r, 600));
      return await fn();
    }
    throw err;
  }
}

function normalizeValue(v: unknown): unknown {
  if (
    typeof v === "string" &&
    /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?)?$/.test(v)
  ) {
    const raw = v.replace(" ", "T");
    const iso = raw.includes("T")
      ? raw.length === 16
        ? raw + ":00Z"
        : raw.endsWith("Z")
          ? raw
          : raw + "Z"
      : raw + "T00:00:00Z";
    const d = new Date(iso);
    if (!isNaN(d.getTime())) return d;
  }
  return v;
}

function serializeRow(row: Record<string, unknown>): Row {
  return Object.fromEntries(
    Object.entries(row).map(([k, v]) => {
      if (typeof v === "bigint") return [k, Number(v)];
      if (v instanceof Date) {
        return [k, v.toISOString().slice(0, /_date$/.test(k) ? 10 : 19)];
      }
      return [k, v];
    }),
  );
}

export class PrismaStatement implements Statement {
  constructor(
    private client: PrismaClient | Prisma.TransactionClient,
    public source: string,
    public values: unknown[] = [],
  ) {}

  bind(...values: unknown[]) {
    return new PrismaStatement(this.client, this.source, values);
  }

  async query() {
    const isInsert = /^\s*INSERT\s+/i.test(this.source);
    const isSelect = /^\s*(SELECT|WITH)\s+/i.test(this.source);
    let { text } = convertSqlToPostgres(this.source, this.values);

    if (isInsert && !/\bRETURNING\b/i.test(text)) {
      text += " RETURNING *";
    }

    const normalizedValues = this.values.map(normalizeValue);

    if (isSelect || isInsert) {
      const rawRows = (await withRetry(() =>
        this.client.$queryRawUnsafe(text, ...normalizedValues),
      )) as Record<string, unknown>[];
      const rows = rawRows.map(serializeRow);

      let lastRowId = 0;
      if (isInsert && rows.length > 0) {
        const first = rows[0];
        const idVal =
          first.club_id ??
          first.user_id ??
          first.event_id ??
          first.transaction_id ??
          first.registration_id ??
          first.attendance_id ??
          first.history_id ??
          first.role_id ??
          first.user_role_id ??
          first.category_id ??
          first.audit_id ??
          first.attempt_id ??
          first.setup_id ??
          first.department_id ??
          Object.values(first)[0];
        lastRowId = Number(idVal || 0);
      }

      return {
        results: rows,
        success: true,
        meta: {
          changes: rows.length,
          last_row_id: lastRowId,
        },
      };
    } else {
      const changes = await withRetry(() =>
        this.client.$executeRawUnsafe(text, ...normalizedValues),
      );
      return {
        results: [],
        success: true,
        meta: {
          changes: Number(changes),
          last_row_id: 0,
        },
      };
    }
  }

  all() {
    return this.query();
  }

  async first() {
    const res = await this.query();
    return res.results[0] || null;
  }

  run() {
    return this.query();
  }
}

export class PrismaDatabase implements Database {
  dialect = "postgres";

  constructor(
    public client: PrismaClient | Prisma.TransactionClient = prisma,
  ) {}

  prepare(source: string) {
    return new PrismaStatement(this.client, source);
  }

  async batch(statements: Statement[]) {
    if (
      "$transaction" in this.client &&
      typeof this.client.$transaction === "function"
    ) {
      return await this.client.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const results = [];
          for (const s of statements as PrismaStatement[]) {
            const stmt = new PrismaStatement(tx, s.source, s.values);
            results.push(await stmt.run());
          }
          return results;
        },
        {
          maxWait: 15000,
          timeout: 30000,
        },
      );
    } else {
      const results = [];
      for (const s of statements) {
        results.push(await s.run());
      }
      return results;
    }
  }
}

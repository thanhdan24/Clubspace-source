import { PrismaClient, Prisma } from "@prisma/client";
import type { Database, Statement, Row } from "./core";

export const prisma = new PrismaClient({
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

function normalizeValue(v: unknown): unknown {
  if (
    typeof v === "string" &&
    /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?)?$/.test(v)
  ) {
    const raw = v.replace(" ", "T");
    const iso = raw.includes("T")
      ? (raw.length === 16 ? raw + ":00Z" : raw.endsWith("Z") ? raw : raw + "Z")
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
        return [
          k,
          v.toISOString().slice(0, /_date$/.test(k) ? 10 : 19),
        ];
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
      const rawRows = (await this.client.$queryRawUnsafe(
        text,
        ...normalizedValues,
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
      const changes = await this.client.$executeRawUnsafe(
        text,
        ...normalizedValues,
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
    if ("$transaction" in this.client && typeof this.client.$transaction === "function") {
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
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
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

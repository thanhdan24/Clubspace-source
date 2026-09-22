import sql from "mssql";
import type { Database, Statement } from "./core";
export function connectionConfig(): sql.config {
  if (
    !process.env.DB_SERVER ||
    !process.env.DB_DATABASE ||
    !process.env.DB_USER ||
    !process.env.DB_PASSWORD
  )
    throw new Error("Thiếu DB_SERVER, DB_DATABASE, DB_USER hoặc DB_PASSWORD.");
  return {
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT || 1433),
    options: {
      encrypt: process.env.DB_ENCRYPT !== "false",
      trustServerCertificate:
        process.env.DB_TRUST_SERVER_CERTIFICATE === "true",
      useUTC: true,
      abortTransactionOnError: true,
    },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
    requestTimeout: 30000,
  };
}
export function convertSql(source: string, parameters: any[]) {
  let i = 0;
  let text = source.replace(/\?/g, () => `@p${i++}`);
  text = text.replace(/\bSUBSTR\(/gi, "SUBSTRING(");
  const limit = text.match(/ LIMIT (@p\d+|\d+)(?: OFFSET (@p\d+|\d+))?$/i);
  if (limit) {
    text = text.slice(0, limit.index);
    if (!/ORDER BY/i.test(text)) text += " ORDER BY (SELECT NULL)";
    text += ` OFFSET ${limit[2] || "0"} ROWS FETCH NEXT ${limit[1]} ROWS ONLY`;
  }
  return { text, parameters };
}
class SqlStatement implements Statement {
  constructor(
    private owner: SqlServerDatabase,
    public source: string,
    public values: any[] = [],
  ) {}
  bind(...values: any[]) {
    return new SqlStatement(this.owner, this.source, values);
  }
  async query() {
    const { text } = convertSql(this.source, this.values);
    const request = this.owner.transaction
      ? new sql.Request(this.owner.transaction)
      : new sql.Request(this.owner.pool);
    this.values.forEach((v, i) => {
      if (typeof v === "boolean")
        request.input("p" + i, sql.Bit, v);
      else if (typeof v === "number")
        request.input(
          "p" + i,
          Number.isInteger(v) ? sql.BigInt : sql.Decimal(15, 2),
          v,
        );
      else
        request.input(
          "p" + i,
          sql.NVarChar(sql.MAX),
          v === undefined ? null : v,
        );
    });
    const isInsert = /^INSERT\s/i.test(text);
    const result = await request.query(
      text +
        (isInsert
          ? "; SELECT CAST(SCOPE_IDENTITY() AS BIGINT) AS __insert_id;"
          : ""),
    );
    const rows = (result.recordset || []).map((r: any) =>
      Object.fromEntries(
        Object.entries(r).map(([k, v]) => [
          k,
          v instanceof Date
            ? v.toISOString().slice(0, /_date$/.test(k) ? 10 : 19)
            : v,
        ]),
      ),
    );
    return {
      results: rows,
      success: true,
      meta: {
        changes: result.rowsAffected[0] || 0,
        last_row_id: isInsert ? Number(rows[0]?.__insert_id || 0) : 0,
      },
    };
  }
  all() {
    return this.query();
  }
  async first() {
    return (await this.query()).results[0] || null;
  }
  run() {
    return this.query();
  }
}
export class SqlServerDatabase implements Database {
  dialect = "sqlserver";
  constructor(
    public pool: sql.ConnectionPool,
    public transaction?: sql.Transaction,
  ) {}
  prepare(source: string) {
    return new SqlStatement(this, source);
  }
  async batch(statements: Statement[]) {
    if (this.transaction) {
      const result = [];
      for (const s of statements) result.push(await s.run());
      return result;
    }
    const tx = new sql.Transaction(this.pool);
    await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try {
      const inner = new SqlServerDatabase(this.pool, tx),
        result = [];
      for (const s of statements as SqlStatement[])
        result.push(
          await inner
            .prepare(s.source)
            .bind(...s.values)
            .run(),
        );
      await tx.commit();
      return result;
    } catch (e) {
      await tx.rollback().catch(() => {});
      throw e;
    }
  }
}

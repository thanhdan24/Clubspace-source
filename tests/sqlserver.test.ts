import { test } from "node:test";
import assert from "node:assert/strict";
import sql from "mssql";
import { SqlServerDatabase } from "../server/sqlserver";

test("SQL Server binds boolean state guards as BIT parameters", async (t) => {
  const pool = new sql.ConnectionPool({ server: "unused" });
  const db = new SqlServerDatabase(pool);
  const captured: any[] = [];
  t.mock.method(sql.Request.prototype, "query", async function (this: any) {
    captured.push(this.parameters);
    return { recordset: [], rowsAffected: [1] };
  });

  // SQL Server returns attendance_locked as a boolean. Publishing includes
  // that original value in the UPDATE guard to prevent concurrent changes.
  for (const locked of [false, true]) {
    await db.prepare(
      "UPDATE EVENTS SET event_status=? WHERE event_id=? AND attendance_locked=?",
    ).bind("OPEN", 5, locked).run();
  }

  assert.equal(captured.length, 2);
  for (const [index, locked] of [false, true].entries()) {
    assert.equal(captured[index].p2.type, sql.Bit);
    assert.equal(captured[index].p2.value, locked);
    assert.equal(captured[index].p0.type, sql.NVarChar);
    assert.equal(captured[index].p1.type, sql.BigInt);
  }
});

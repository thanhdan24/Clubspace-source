import fs from "node:fs/promises";
import sql from "mssql";
import { connectionConfig } from "../server/sqlserver";
const pool = await new sql.ConnectionPool(connectionConfig()).connect();
const tx = new sql.Transaction(pool);
await tx.begin();
try {
  const migration = await fs.readFile(
    "database/sqlserver/001_auth_support.sql",
    "utf8",
  );
  for (const batch of migration.split(/^GO\s*$/m).filter((s) => s.trim()))
    await new sql.Request(tx).query(batch);
  await tx.commit();
  console.log(
    "Đã áp dụng migration bổ sung xác thực. Dữ liệu gốc được giữ nguyên.",
  );
} catch (e) {
  await tx.rollback();
  throw e;
} finally {
  await pool.close();
}

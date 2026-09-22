import fs from "node:fs/promises";
import sql from "mssql";
import { connectionConfig } from "../server/sqlserver";
const pool = await new sql.ConnectionPool(connectionConfig()).connect();
const tx = new sql.Transaction(pool);
await tx.begin();
try {
  const directory = "database/sqlserver";
  const files = (await fs.readdir(directory))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const migration = await fs.readFile(`${directory}/${file}`, "utf8");
    for (const batch of migration.split(/^GO\s*$/m).filter((s) => s.trim()))
      await new sql.Request(tx).query(batch);
  }
  await tx.commit();
  console.log("Đã áp dụng migration SQL Server. Dữ liệu gốc được giữ nguyên.");
} catch (e) {
  await tx.rollback();
  throw e;
} finally {
  await pool.close();
}

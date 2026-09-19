import sql from "mssql";
import bcrypt from "bcryptjs";
import { connectionConfig } from "../server/sqlserver";
const username = process.env.INITIAL_ADMIN_USERNAME,
  password = process.env.INITIAL_ADMIN_PASSWORD;
if (!username || !password || password.length < 10 || password.length > 72)
  throw new Error(
    "Đặt INITIAL_ADMIN_USERNAME và INITIAL_ADMIN_PASSWORD (10–72 ký tự) trong .env.",
  );
const pool = await new sql.ConnectionPool(connectionConfig()).connect(),
  tx = new sql.Transaction(pool);
await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
try {
  const exists = await new sql.Request(tx)
    .input("username", sql.NVarChar(50), username)
    .query("SELECT user_id FROM dbo.USERS WHERE username=@username");
  if (exists.recordset.length)
    throw new Error("Tên đăng nhập đã tồn tại; không ghi đè tài khoản.");
  const hash = await bcrypt.hash(password, 12);
  const created = await new sql.Request(tx)
    .input("username", sql.NVarChar(50), username)
    .input("hash", sql.NVarChar(255), hash)
    .query(
      "INSERT INTO dbo.USERS(username,password_hash,full_name,account_status,created_at) OUTPUT INSERTED.user_id VALUES(@username,@hash,N'Quản trị triển khai','ACTIVE',SYSDATETIME())",
    );
  const id = created.recordset[0].user_id;
  await new sql.Request(tx)
    .input("id", sql.BigInt, id)
    .query(
      "INSERT INTO dbo.USER_ROLES(user_id,role_id,club_id,assigned_by,assigned_at,active_flag) SELECT @id,role_id,NULL,@id,SYSDATETIME(),1 FROM dbo.ROLES WHERE role_code='ADMIN'; INSERT INTO dbo.AUDIT_LOGS(user_id,club_id,action_code,entity_name,entity_id,new_value,created_at) VALUES (@id,NULL,'BOOTSTRAP_ADMIN','USERS',CAST(@id AS varchar(80)),N'{\"bootstrap\":true}',SYSDATETIME());",
    );
  await tx.commit();
  console.log(
    "Đã tạo tài khoản quản trị mới; không thay đổi tài khoản cũ. Xóa INITIAL_ADMIN_PASSWORD khỏi .env sau bước này.",
  );
} catch (e) {
  await tx.rollback();
  throw e;
} finally {
  await pool.close();
}

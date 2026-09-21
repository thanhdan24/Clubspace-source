import fs from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";
import { prisma } from "../server/prisma";

const VIEW_FUND_SUMMARY = `
CREATE OR REPLACE VIEW "vw_club_fund_summary" AS
SELECT
    c.club_id,
    c.club_code,
    c.club_name,
    COALESCE(CAST(SUM(CASE
        WHEN ft.transaction_status = 'POSTED'
         AND ft.transaction_type = 'INCOME'
        THEN ft.amount ELSE 0 END) AS DECIMAL(18,2)), 0) AS total_income,
    COALESCE(CAST(SUM(CASE
        WHEN ft.transaction_status = 'POSTED'
         AND ft.transaction_type = 'EXPENSE'
        THEN ft.amount ELSE 0 END) AS DECIMAL(18,2)), 0) AS total_expense,
    COALESCE(CAST(
        SUM(CASE
            WHEN ft.transaction_status = 'POSTED'
             AND ft.transaction_type = 'INCOME'
            THEN ft.amount ELSE 0 END)
        -
        SUM(CASE
            WHEN ft.transaction_status = 'POSTED'
             AND ft.transaction_type = 'EXPENSE'
            THEN ft.amount ELSE 0 END)
        AS DECIMAL(18,2)
    ), 0) AS balance
FROM "CLUBS" c
LEFT JOIN "FINANCIAL_TRANSACTIONS" ft
    ON ft.club_id = c.club_id
GROUP BY
    c.club_id,
    c.club_code,
    c.club_name;
`;

const VIEW_EVENT_STATS = `
CREATE OR REPLACE VIEW "vw_event_statistics" AS
WITH RegAgg AS
(
    SELECT
        event_id,
        COUNT(*) AS total_registrations,
        SUM(CASE WHEN registration_status = 'PENDING'   THEN 1 ELSE 0 END) AS pending_count,
        SUM(CASE WHEN registration_status = 'CONFIRMED' THEN 1 ELSE 0 END) AS confirmed_count,
        SUM(CASE WHEN registration_status = 'REJECTED'  THEN 1 ELSE 0 END) AS rejected_count,
        SUM(CASE WHEN registration_status = 'CANCELLED' THEN 1 ELSE 0 END) AS cancelled_count
    FROM "EVENT_REGISTRATIONS"
    GROUP BY event_id
),
AttAgg AS
(
    SELECT
        event_id,
        COUNT(*) AS attendance_record_count,
        SUM(CASE WHEN attendance_status IN ('PRESENT', 'LATE') THEN 1 ELSE 0 END) AS attended_count,
        SUM(CASE WHEN attendance_status = 'ABSENT' THEN 1 ELSE 0 END) AS absent_count,
        SUM(CASE WHEN attendance_status = 'EXCUSED' THEN 1 ELSE 0 END) AS excused_count
    FROM "ATTENDANCE"
    GROUP BY event_id
)
SELECT
    e.event_id,
    e.club_id,
    e.event_name,
    e.start_at,
    e.end_at,
    e.event_status,
    e.capacity,
    COALESCE(r.total_registrations, 0) AS total_registrations,
    COALESCE(r.pending_count, 0) AS pending_count,
    COALESCE(r.confirmed_count, 0) AS confirmed_count,
    COALESCE(r.rejected_count, 0) AS rejected_count,
    COALESCE(r.cancelled_count, 0) AS cancelled_count,
    COALESCE(a.attendance_record_count, 0) AS attendance_record_count,
    COALESCE(a.attended_count, 0) AS attended_count,
    COALESCE(a.absent_count, 0) AS absent_count,
    COALESCE(a.excused_count, 0) AS excused_count,
    CAST(
        CASE
            WHEN COALESCE(r.confirmed_count, 0) = 0 THEN 0
            ELSE COALESCE(a.attended_count, 0) * 100.0 / r.confirmed_count
        END
        AS DECIMAL(6,2)
    ) AS attendance_rate_percent
FROM "EVENTS" e
LEFT JOIN RegAgg r ON r.event_id = e.event_id
LEFT JOIN AttAgg a ON a.event_id = e.event_id;
`;

const TABLE_SEQUENCES: [string, string][] = [
  ["CLUBS", "club_id"],
  ["USERS", "user_id"],
  ["ROLES", "role_id"],
  ["USER_ROLES", "user_role_id"],
  ["CLUB_MEMBERS", "club_member_id"],
  ["MEMBER_STATUS_HISTORY", "history_id"],
  ["EVENTS", "event_id"],
  ["EVENT_REGISTRATIONS", "registration_id"],
  ["ATTENDANCE", "attendance_id"],
  ["FINANCE_CATEGORIES", "category_id"],
  ["FINANCIAL_TRANSACTIONS", "transaction_id"],
  ["AUDIT_LOGS", "audit_id"],
  ["AUTH_ATTEMPTS", "attempt_id"],
];

async function main() {
  console.log("[Supabase Seed] Kết nối tới cơ sở dữ liệu...");
  await prisma.$connect();

  console.log("[Supabase Seed] Tạo các Views thống kê...");
  await prisma.$executeRawUnsafe(VIEW_FUND_SUMMARY);
  await prisma.$executeRawUnsafe(VIEW_EVENT_STATS);

  const userCount = await prisma.user.count();
  if (userCount > 0) {
    console.log(
      `[Supabase Seed] Cơ sở dữ liệu đã có ${userCount} người dùng. Bỏ qua bước nạp dữ liệu mẫu ban đầu.`,
    );
  } else {
    console.log("[Supabase Seed] Đang đọc file prisma/seed-data.json...");
    const rawData = await fs.readFile(
      path.resolve("prisma/seed-data.json"),
      "utf8",
    );
    const data = JSON.parse(rawData);

    // Thứ tự nạp dữ liệu theo ràng buộc khóa ngoại (Foreign Keys)
    const tablesInOrder = [
      "ROLES",
      "USERS",
      "CLUBS",
      "USER_ROLES",
      "CLUB_MEMBERS",
      "MEMBER_STATUS_HISTORY",
      "FINANCE_CATEGORIES",
      "EVENTS",
      "EVENT_REGISTRATIONS",
      "ATTENDANCE",
      "FINANCIAL_TRANSACTIONS",
      "AUDIT_LOGS",
    ];

    console.log("[Supabase Seed] Bắt đầu nạp dữ liệu mẫu vào Supabase...");

    for (const tableName of tablesInOrder) {
      const rows = data[tableName] || [];
      if (rows.length === 0) continue;

      for (const row of rows) {
        const keys = Object.keys(row);
        const columns = keys.map((k) => `"${k}"`).join(", ");
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
        const values = keys.map((k) => {
          const v = row[k];
          if (
            typeof v === "string" &&
            /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?)?$/.test(v)
          ) {
            const d = new Date(v.includes("T") ? v : v + "T00:00:00");
            if (!isNaN(d.getTime())) return d;
          }
          return v;
        });

        const sql = `INSERT INTO "${tableName}" (${columns}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;
        await prisma.$executeRawUnsafe(sql, ...values);
      }
      console.log(`[Supabase Seed] Đã nạp bảng "${tableName}": ${rows.length} bản ghi.`);
    }

    // Đánh dấu hoàn tất setup
    await prisma.$executeRawUnsafe(
      `INSERT INTO "APP_SETUP" ("setup_id", "completed_at") VALUES ($1, $2) ON CONFLICT ("setup_id") DO UPDATE SET "completed_at" = EXCLUDED."completed_at"`,
      1,
      new Date().toISOString(),
    );

    // Đồng bộ lại serial sequences trong PostgreSQL
    for (const [table, col] of TABLE_SEQUENCES) {
      try {
        await prisma.$executeRawUnsafe(
          `SELECT setval(pg_get_serial_sequence('"${table}"', '${col}'), coalesce(max("${col}"), 0) + 1, false) FROM "${table}"`,
        );
      } catch {
        // Một số bảng hoặc PK không dùng auto sequence
      }
    }
    console.log("[Supabase Seed] Đã đồng bộ tất cả Auto-increment Sequences.");
  }

  // Khởi tạo tài khoản Admin ban đầu nếu chưa có
  const adminUsername = process.env.INITIAL_ADMIN_USERNAME || "admin";
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || "Admin@123456";

  const existingAdmin = await prisma.user.findFirst({
    where: { username: adminUsername },
  });

  if (!existingAdmin) {
    console.log(`[Supabase Seed] Đang tạo tài khoản ADMIN ban đầu: "${adminUsername}"...`);
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    const newAdmin = await prisma.user.create({
      data: {
        username: adminUsername,
        password_hash: passwordHash,
        full_name: "Quản trị viên hệ thống",
        account_status: "ACTIVE",
      },
    });

    const adminRole = await prisma.role.findFirst({
      where: { role_code: "ADMIN" },
    });

    if (adminRole) {
      await prisma.userRole.create({
        data: {
          user_id: newAdmin.user_id,
          role_id: adminRole.role_id,
          club_id: null,
          active_flag: 1,
        },
      });
    }

    console.log(`[Supabase Seed] Tài khoản ADMIN đã được tạo thành công!`);
    console.log(` -> Username: ${adminUsername}`);
    console.log(` -> Password: ${adminPassword}`);
  } else {
    console.log(`[Supabase Seed] Tài khoản quản trị "${adminUsername}" đã tồn tại.`);
  }

  console.log("\n[Supabase Seed] Hoàn tất quá trình khởi tạo dữ liệu Supabase / PostgreSQL! 🚀");
}

main()
  .catch((e) => {
    console.error("[Supabase Seed Error]:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

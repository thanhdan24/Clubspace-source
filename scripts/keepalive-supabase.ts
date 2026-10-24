import { prisma } from "../server/prisma";

async function main() {
  const t0 = Date.now();
  const nowIso = new Date().toISOString().slice(0, 19) + "Z";

  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "APP_SETUP" (setup_id, completed_at)
       VALUES (999, $1)
       ON CONFLICT (setup_id) DO UPDATE SET completed_at = EXCLUDED.completed_at`,
      nowIso,
    );

    const stats = (await prisma.$queryRawUnsafe(`
      SELECT
        setup_id,
        completed_at AS last_keepalive_utc,
        (SELECT COUNT(*) FROM "CLUBS") AS total_clubs,
        (SELECT COUNT(*) FROM "USERS") AS total_users,
        (SELECT COUNT(*) FROM "CLUB_MEMBERS") AS total_members
      FROM "APP_SETUP"
      WHERE setup_id = 999
    `)) as any[];

    console.log("========================================================");
    console.log(`✅ [KEEPALIVE THÀNH CÔNG] Đã ping vào Supabase (${Date.now() - t0}ms)`);
    console.log("📌 Bản ghi đối chứng trong bảng APP_SETUP (setup_id = 999):");
    console.log(stats[0]);
    console.log("========================================================");
  } catch (err: any) {
    console.warn("⚠️ [KEEPALIVE WARNING] Không thể kết nối lúc này:", err?.message || err);
    // Luôn thoát với mã 0 để không gây báo lỗi CI/CD về máy
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

main();

import { prisma } from "../server/prisma";
import fs from "node:fs/promises";
import path from "node:path";

async function main() {
  console.log("Connecting to Supabase...");
  await prisma.$connect();

  console.log("Creating table CLUB_DEPARTMENTS if not exists...");
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CLUB_DEPARTMENTS" (
      "department_id" SERIAL PRIMARY KEY,
      "club_id" INTEGER NOT NULL REFERENCES "CLUBS"("club_id") ON DELETE CASCADE,
      "department_name" VARCHAR(100) NOT NULL,
      "description" TEXT,
      "active_flag" INTEGER NOT NULL DEFAULT 1,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log("Creating unique index on (club_id, department_name)...");
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "uq_club_department" 
    ON "CLUB_DEPARTMENTS"("club_id", "department_name");
  `);

  console.log("Checking existing departments...");
  const existingCount: any = await prisma.$queryRawUnsafe(
    'SELECT COUNT(*)::int AS count FROM "CLUB_DEPARTMENTS"'
  );
  console.log("Existing department count:", existingCount[0]?.count);

  if (Number(existingCount[0]?.count) === 0) {
    console.log("Seeding default departments from prisma/seed-data.json...");
    const rawData = await fs.readFile(
      path.resolve("prisma/seed-data.json"),
      "utf8"
    );
    const data = JSON.parse(rawData);
    const rows = data["CLUB_DEPARTMENTS"] || [];

    for (const row of rows) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "CLUB_DEPARTMENTS" 
         ("department_id", "club_id", "department_name", "description", "active_flag", "created_at") 
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT ("club_id", "department_name") DO NOTHING`,
        row.department_id,
        row.club_id,
        row.department_name,
        row.description,
        row.active_flag,
        new Date(row.created_at)
      );
    }

    try {
      await prisma.$executeRawUnsafe(
        `SELECT setval(pg_get_serial_sequence('"CLUB_DEPARTMENTS"', 'department_id'), coalesce(max("department_id"), 0) + 1, false) FROM "CLUB_DEPARTMENTS"`
      );
      console.log("Sequence synchronized.");
    } catch (e: any) {
      console.log("Sequence sync warning:", e.message);
    }
  }

  // Also check if any active members have a department_name not in CLUB_DEPARTMENTS, and add it
  const clubMembersDepts: any = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT club_id, department_name 
     FROM "CLUB_MEMBERS" 
     WHERE department_name IS NOT NULL AND TRIM(department_name) <> ''`
  );
  console.log("Distinct department names in CLUB_MEMBERS:", clubMembersDepts);

  for (const item of clubMembersDepts) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "CLUB_DEPARTMENTS" ("club_id", "department_name", "description", "active_flag", "created_at")
       VALUES ($1, $2, 'Ban / nhóm chuyên môn', 1, CURRENT_TIMESTAMP)
       ON CONFLICT ("club_id", "department_name") DO NOTHING`,
      item.club_id,
      item.department_name
    );
  }

  const allDepts: any = await prisma.$queryRawUnsafe(
    'SELECT * FROM "CLUB_DEPARTMENTS" ORDER BY club_id, department_id'
  );
  console.log("All departments in Supabase:", allDepts);
}

main()
  .catch((e) => {
    console.error("Migration error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

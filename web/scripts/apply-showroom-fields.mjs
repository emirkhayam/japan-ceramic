// Добавление полей шоурумов в site_settings (prisma db push виснет на pooler).
// Запуск: cd web && node --env-file=.env scripts/apply-showroom-fields.mjs
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL не задан.");
  process.exit(1);
}

const statements = [
  `ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "showroomName" TEXT`,
  `ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "showroomName2" TEXT`,
  `ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "address2" TEXT`,
  `ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "mapLink2" TEXT`,
];

const pool = new pg.Pool({ connectionString: url, max: 2, connectionTimeoutMillis: 15000 });
try {
  for (const [i, sql] of statements.entries()) {
    process.stdout.write(`[${i + 1}/${statements.length}] выполняю... `);
    await pool.query(sql);
    console.log("ok");
  }
  console.log("\nГотово.");
} catch (e) {
  console.error("\nОШИБКА:", e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}

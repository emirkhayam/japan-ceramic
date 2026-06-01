// Применение таблицы site_settings прямым SQL через pg (prisma db push виснет на pooler).
// Запуск: node --env-file=.env scripts/apply-site-settings.mjs
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL не задан. Запускайте через: node --env-file=.env scripts/apply-site-settings.mjs");
  process.exit(1);
}

const statements = [
  `CREATE TABLE IF NOT EXISTS "site_settings" (
    "id" TEXT PRIMARY KEY DEFAULT 'default',
    "phone" TEXT,
    "whatsapp" TEXT,
    "telegram" TEXT,
    "instagram" TEXT,
    "email" TEXT,
    "address" TEXT,
    "hours" TEXT,
    "mapEmbedUrl" TEXT,
    "mapLink" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now()
  )`,
  // Единственная строка настроек с фиксированным id.
  `INSERT INTO "site_settings" ("id","updatedAt") VALUES ('default', now())
   ON CONFLICT ("id") DO NOTHING`,
];

const checks = [[`SELECT count(*)::int AS n FROM "site_settings"`, "Строк настроек (должно быть 1)"]];

const pool = new pg.Pool({ connectionString: url, max: 2, connectionTimeoutMillis: 15000 });

try {
  for (const [i, sql] of statements.entries()) {
    process.stdout.write(`[${i + 1}/${statements.length}] выполняю... `);
    await pool.query(sql);
    console.log("ok");
  }
  console.log("\n--- Проверки ---");
  for (const [sql, label] of checks) {
    const { rows } = await pool.query(sql);
    console.log(`${label}: ${rows[0].n}`);
  }
  console.log("\nГотово.");
} catch (e) {
  console.error("\nОШИБКА:", e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}

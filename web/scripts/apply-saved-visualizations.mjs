// Таблица сохранённых визуализаций пользователя («Мои визуализации» в кабинете).
// Аддитивно и идемпотентно (IF NOT EXISTS). prisma db push виснет на pooler — DDL напрямую.
// Запуск: cd web && node --env-file=.env scripts/apply-saved-visualizations.mjs
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL не задан.");
  process.exit(1);
}

const statements = [
  `CREATE TABLE IF NOT EXISTS "saved_visualizations" (
     "id" TEXT PRIMARY KEY,
     "userId" TEXT NOT NULL,
     "imageUrl" TEXT NOT NULL,
     "tileSlug" TEXT,
     "tileName" TEXT,
     "surface" TEXT,
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE INDEX IF NOT EXISTS "saved_visualizations_userId_idx" ON "saved_visualizations" ("userId")`,
  `CREATE INDEX IF NOT EXISTS "saved_visualizations_createdAt_idx" ON "saved_visualizations" ("createdAt")`,
  `DO $$ BEGIN
     ALTER TABLE "saved_visualizations"
       ADD CONSTRAINT "saved_visualizations_userId_fkey"
       FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
   EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
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

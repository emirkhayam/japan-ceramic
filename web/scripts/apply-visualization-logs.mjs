// Лог AI-визуализаций + лимит токенов (prisma db push виснет на pooler — DDL напрямую).
// Аддитивно и идемпотентно: IF NOT EXISTS, старые данные не трогаются.
// Запуск: cd web && node --env-file=.env scripts/apply-visualization-logs.mjs
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL не задан.");
  process.exit(1);
}

const statements = [
  `CREATE TABLE IF NOT EXISTS "visualization_logs" (
     "id" TEXT PRIMARY KEY,
     "userId" TEXT NOT NULL,
     "tileSlug" TEXT,
     "tileName" TEXT,
     "surface" TEXT,
     "provider" TEXT NOT NULL DEFAULT 'fal',
     "promptTokens" INTEGER NOT NULL DEFAULT 0,
     "outputTokens" INTEGER NOT NULL DEFAULT 0,
     "totalTokens" INTEGER NOT NULL DEFAULT 0,
     "success" BOOLEAN NOT NULL DEFAULT true,
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE INDEX IF NOT EXISTS "visualization_logs_userId_idx" ON "visualization_logs" ("userId")`,
  `CREATE INDEX IF NOT EXISTS "visualization_logs_createdAt_idx" ON "visualization_logs" ("createdAt")`,
  // FK на users (с удалением логов при удалении пользователя). Оборачиваем — если уже есть, пропустим.
  `DO $$ BEGIN
     ALTER TABLE "visualization_logs"
       ADD CONSTRAINT "visualization_logs_userId_fkey"
       FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
   EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "aiTokenBudget" INTEGER`,
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

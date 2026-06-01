// Портфолио «Наши объекты» (страница О компании) + подпись блока.
// Аддитивно/идемпотентно. Запуск: cd web && node --env-file=.env scripts/apply-portfolio.mjs
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL не задан."); process.exit(1); }

const statements = [
  `CREATE TABLE IF NOT EXISTS "portfolio_items" (
     "id" TEXT PRIMARY KEY,
     "imageUrl" TEXT NOT NULL,
     "tag" TEXT,
     "title" TEXT,
     "meta" TEXT,
     "sortOrder" INTEGER NOT NULL DEFAULT 0,
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE INDEX IF NOT EXISTS "portfolio_items_sortOrder_idx" ON "portfolio_items" ("sortOrder")`,
  `ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "aboutPortfolioCaption" TEXT`,
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

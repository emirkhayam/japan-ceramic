// Откат оптимизации картинок: возвращает исходные (несжатые) URL из originalUrl.
// Оригиналы остались в бакете, поэтому ссылки снова рабочие.
// Запуск: cd web && node --env-file=.env scripts/rollback-image-compression.mjs
import pg from "pg";

const { DATABASE_URL } = process.env;
if (!DATABASE_URL) { console.error("Нет DATABASE_URL"); process.exit(1); }

const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 2, connectionTimeoutMillis: 15000 });
try {
  const { rowCount } = await pool.query(
    `UPDATE product_images SET "imageUrl" = "originalUrl", "originalUrl" = NULL WHERE "originalUrl" IS NOT NULL`
  );
  console.log(`Откат выполнен: восстановлено исходных ссылок — ${rowCount}`);
} catch (e) {
  console.error("ОШИБКА:", e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}

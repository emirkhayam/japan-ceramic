// Удаляет тестовый лид, созданный journey-tester в сценарии J017.
// Матчим по уникальному QA-маркеру (телефон + сообщение), чтобы не задеть боевые заявки.
// Запуск: cd web && node --env-file=.env scripts/cleanup-qa-lead.mjs
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL не задан. Запуск: node --env-file=.env scripts/cleanup-qa-lead.mjs");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url, max: 2, connectionTimeoutMillis: 15000 });

try {
  // Сначала покажем, что нашли
  const found = await pool.query(
    `SELECT id, name, phone, message, "createdAt" FROM contact_leads
     WHERE phone = $1 AND (message = $2 OR name LIKE 'QA TEST%')`,
    ["+7 000 000-00-00", "QA blind test — please delete"]
  );
  console.log(`Найдено QA-лидов: ${found.rowCount}`);
  for (const r of found.rows) {
    console.log(`  - ${r.id} | ${r.name} | ${r.phone} | ${r.message} | ${r.createdAt.toISOString?.() ?? r.createdAt}`);
  }

  const del = await pool.query(
    `DELETE FROM contact_leads
     WHERE phone = $1 AND (message = $2 OR name LIKE 'QA TEST%')`,
    ["+7 000 000-00-00", "QA blind test — please delete"]
  );
  console.log(`Удалено строк: ${del.rowCount}`);
} catch (e) {
  console.error("Ошибка очистки:", e.message);
  process.exit(1);
} finally {
  await pool.end();
}

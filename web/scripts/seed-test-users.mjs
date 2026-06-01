// Создание тестовых аккаунтов для QA-скилла journey-qa.
// Пароль берётся из TEST_PASSWORD (или дефолт ниже).
// Запуск: cd web && node --env-file=.env scripts/seed-test-users.mjs
import pg from "pg";
import bcryptjs from "bcryptjs";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL не задан. Запускайте через: node --env-file=.env scripts/seed-test-users.mjs");
  process.exit(1);
}

const PASSWORD = process.env.TEST_PASSWORD || "QaTest123!";

const users = [
  { email: "qa.admin@japanceramic.test", fullName: "QA Admin", role: "admin" },
  { email: "qa.designer@japanceramic.test", fullName: "QA Designer", role: "designer" },
];

const pool = new pg.Pool({ connectionString: url, max: 2, connectionTimeoutMillis: 15000 });

try {
  const hash = await bcryptjs.hash(PASSWORD, 12);
  for (const u of users) {
    await pool.query(
      `INSERT INTO "users" ("id","email","hashedPassword","fullName","role","isActive","createdAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, true, now())
       ON CONFLICT ("email") DO UPDATE SET "hashedPassword" = EXCLUDED."hashedPassword", "isActive" = true`,
      [u.email, hash, u.fullName, u.role]
    );
    console.log(`ok: ${u.email} (${u.role})`);
  }
  console.log(`\nГотово. Пароль для всех: ${PASSWORD}`);
} catch (e) {
  console.error("\nОШИБКА:", e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}

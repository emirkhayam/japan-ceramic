// Применение схемы коллекций прямым SQL через pg (prisma db push виснет на pooler).
// Запуск: node --env-file=.env scripts/apply-collections.mjs
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL не задан. Запускайте через: node --env-file=.env scripts/apply-collections.mjs");
  process.exit(1);
}

// Нормализация названия коллекции в slug (латиница + кириллица), с дедупликацией.
const SLUG = (col) =>
  `regexp_replace(regexp_replace(lower(trim(${col})), '[^a-z0-9а-яё]+', '-', 'g'), '^-+|-+$', '', 'g')`;

const statements = [
  // 1. Таблица collections
  `CREATE TABLE IF NOT EXISTS "collections" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "coverImageUrl" TEXT,
    "spaceTag" TEXT,
    "styleTag" TEXT,
    "isNew" BOOLEAN NOT NULL DEFAULT false,
    "isRecommended" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "collections_slug_key" ON "collections"("slug")`,
  `CREATE INDEX IF NOT EXISTS "collections_status_sortOrder_idx" ON "collections"("status","sortOrder")`,

  // 2. Поля в products
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "collectionId" TEXT`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "collectionOrder" INTEGER NOT NULL DEFAULT 0`,
  `DO $$ BEGIN
     ALTER TABLE "products" ADD CONSTRAINT "products_collectionId_fkey"
       FOREIGN KEY ("collectionId") REFERENCES "collections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
   EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `CREATE INDEX IF NOT EXISTS "products_collectionId_idx" ON "products"("collectionId")`,

  // 3. Бэкфилл: создаём коллекции из уникальных (нормализованных) legacy-строк
  `INSERT INTO "collections" ("id","name","slug","status","sortOrder","createdAt","updatedAt")
   SELECT gen_random_uuid()::text, MIN(trim("collection")), ${SLUG('"collection"')}, 'published', 0, now(), now()
   FROM "products"
   WHERE "collection" IS NOT NULL AND trim("collection") <> '' AND ${SLUG('"collection"')} <> ''
   GROUP BY ${SLUG('"collection"')}
   ON CONFLICT ("slug") DO NOTHING`,

  // 4. Бэкфилл: связываем товары с коллекциями по нормализованному slug
  `UPDATE "products" p
   SET "collectionId" = c."id"
   FROM "collections" c
   WHERE p."collection" IS NOT NULL AND trim(p."collection") <> ''
     AND c."slug" = ${SLUG('p."collection"')}
     AND p."collectionId" IS NULL`,
];

const checks = [
  [`SELECT count(*)::int AS n FROM "collections"`, "Коллекций в базе"],
  [`SELECT count(*)::int AS n FROM "products" WHERE "collectionId" IS NOT NULL`, "Товаров привязано к коллекции"],
  [
    `SELECT count(*)::int AS n FROM "products" WHERE "collection" IS NOT NULL AND trim("collection") <> '' AND "collectionId" IS NULL`,
    "ОСИРОТЕВШИХ товаров (должно быть 0)",
  ],
];

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

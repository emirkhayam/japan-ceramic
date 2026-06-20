// Создаёт пару ТЕСТОВЫХ коллекций и привязывает к каждой несколько свободных
// товаров (с фото), чтобы они отобразились в /collections (нужно status=published
// + хотя бы один товар). Идемпотентно: повторный запуск не дублирует и не «крадёт»
// товары у уже существующих коллекций (берём только collectionId IS NULL).
// Запуск: cd web && node --env-file=.env scripts/seed-test-collections.mjs
// Откат:  node --env-file=.env scripts/seed-test-collections.mjs --undo
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL не задан. Запуск: node --env-file=.env scripts/seed-test-collections.mjs");
  process.exit(1);
}

const UNDO = process.argv.includes("--undo");
const PER_COLLECTION = 4;

const collections = [
  {
    slug: "test-loft-fasad",
    name: "Тест · Лофт-фасад",
    description: "Тестовая коллекция: клинкер и керамогранит для фасада в лофт-настроении.",
    spaceTag: "Фасад",
    styleTag: "Лофт",
    isNew: true,
    isRecommended: false,
    sortOrder: 900,
  },
  {
    slug: "test-warm-minimal",
    name: "Тест · Тёплый минимализм",
    description: "Тестовая коллекция: спокойные тёплые тона для гостиной в минимализме.",
    spaceTag: "Гостиная",
    styleTag: "Минимализм",
    isNew: false,
    isRecommended: true,
    sortOrder: 901,
  },
];

const pool = new pg.Pool({ connectionString: url, max: 2, connectionTimeoutMillis: 15000 });

try {
  if (UNDO) {
    for (const c of collections) {
      // Отвязываем товары и удаляем тестовую коллекцию.
      await pool.query(`UPDATE "products" SET "collectionId" = NULL, "collectionOrder" = 0 WHERE "collectionId" = (SELECT id FROM "collections" WHERE slug = $1)`, [c.slug]);
      const { rowCount } = await pool.query(`DELETE FROM "collections" WHERE slug = $1`, [c.slug]);
      console.log(`undo: ${c.slug} — удалено ${rowCount}`);
    }
    console.log("\nОткат завершён.");
  } else {
    for (const c of collections) {
      // 1) upsert коллекции
      const { rows } = await pool.query(
        `INSERT INTO "collections"
           ("id","name","slug","description","spaceTag","styleTag","isNew","isRecommended","status","sortOrder","createdAt","updatedAt")
         VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5,$6,$7,'published',$8,now(),now())
         ON CONFLICT ("slug") DO UPDATE SET
           "name"=EXCLUDED."name","description"=EXCLUDED."description","spaceTag"=EXCLUDED."spaceTag",
           "styleTag"=EXCLUDED."styleTag","isNew"=EXCLUDED."isNew","isRecommended"=EXCLUDED."isRecommended",
           "status"='published',"sortOrder"=EXCLUDED."sortOrder","updatedAt"=now()
         RETURNING id`,
        [c.name, c.slug, c.description, c.spaceTag, c.styleTag, c.isNew, c.isRecommended, c.sortOrder]
      );
      const collectionId = rows[0].id;

      // 2) уже привязанные товары?
      const { rows: cnt } = await pool.query(`SELECT count(*)::int AS n FROM "products" WHERE "collectionId" = $1`, [collectionId]);
      if (cnt[0].n > 0) {
        console.log(`ok: ${c.slug} — уже есть ${cnt[0].n} товаров, привязку пропускаю`);
        continue;
      }

      // 3) берём свободные активные товары с фото
      const { rows: free } = await pool.query(
        `SELECT p.id,
                (SELECT pi."imageUrl" FROM "product_images" pi WHERE pi."productId"=p.id ORDER BY pi."sortOrder" ASC LIMIT 1) AS img
           FROM "products" p
          WHERE p."isActive"=true AND p."collectionId" IS NULL
            AND EXISTS (SELECT 1 FROM "product_images" pi WHERE pi."productId"=p.id)
          ORDER BY p."createdAt" DESC
          LIMIT $1`,
        [PER_COLLECTION]
      );

      if (free.length === 0) {
        console.warn(`warn: ${c.slug} — нет свободных товаров с фото для привязки`);
        continue;
      }

      // 4) привязываем + порядок
      let order = 0;
      for (const p of free) {
        await pool.query(`UPDATE "products" SET "collectionId"=$1, "collectionOrder"=$2 WHERE id=$3`, [collectionId, order++, p.id]);
      }

      // 5) обложка = фото первого товара
      const cover = free[0].img;
      if (cover) {
        await pool.query(`UPDATE "collections" SET "coverImageUrl"=$1, "updatedAt"=now() WHERE id=$2`, [cover, collectionId]);
      }

      console.log(`ok: ${c.slug} — создана, привязано ${free.length} товаров`);
    }
    console.log("\nГотово. Откройте /collections (коллекции с префиксом «Тест ·»).");
  }
} catch (e) {
  console.error("\nОШИБКА:", e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}

// Разовое пережатие уже загруженных товарных фото (10–20 МБ → ~0.3–0.6 МБ).
// Неразрушительно: сжатую версию заливаем под НОВЫМ ключом, оригинал остаётся в бакете,
// в БД (product_images.imageUrl) проставляем новую ссылку.
// Запуск: cd web && node --env-file=.env scripts/compress-existing-images.mjs
// Флаг --dry прогоняет без изменений (только отчёт).
import sharp from "sharp";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const DRY = process.argv.includes("--dry");
const MAX_DIM = 2000;
const WEBP_QUALITY = 82;
const BUCKET = "uploads";

const { DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!DATABASE_URL || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Нужны DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY в .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 2, connectionTimeoutMillis: 15000 });

const mb = (b) => (b / 1048576).toFixed(2);
const isSupabaseUpload = (u) => /\/storage\/v1\/object\/public\/uploads\//.test(u || "");
const alreadyOptimized = (u) => /\/products\/opt-[^/]+\.webp(\?|$)/.test(u || "");

let totalBefore = 0, totalAfter = 0, done = 0, skipped = 0, failed = 0;

try {
  // Колонка-бэкап для отката: храним исходный URL до сжатия.
  if (!DRY) await pool.query(`ALTER TABLE product_images ADD COLUMN IF NOT EXISTS "originalUrl" TEXT`);

  const { rows } = await pool.query(`SELECT id, "imageUrl" FROM product_images ORDER BY "sortOrder" ASC`);
  console.log(`Всего записей в product_images: ${rows.length}${DRY ? "  [DRY-RUN]" : ""}\n`);

  for (const [i, row] of rows.entries()) {
    const url = row.imageUrl;
    const tag = `[${i + 1}/${rows.length}]`;
    if (!isSupabaseUpload(url) || alreadyOptimized(url)) { skipped++; continue; }

    try {
      const res = await fetch(url);
      if (!res.ok) { console.log(`${tag} ⚠ ${res.status} ${url}`); failed++; continue; }
      const orig = Buffer.from(await res.arrayBuffer());

      const out = await sharp(orig)
        .rotate()
        .resize({ width: MAX_DIM, height: MAX_DIM, fit: "inside", withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer();

      // не «оптимизируем» то, что и так лёгкое — пропускаем, если выгода <10%
      if (out.length > orig.length * 0.9) {
        console.log(`${tag} = уже лёгкая (${mb(orig.length)}МБ), пропуск`);
        skipped++; continue;
      }

      totalBefore += orig.length;
      totalAfter += out.length;

      if (DRY) {
        console.log(`${tag} ${mb(orig.length)}МБ → ${mb(out.length)}МБ  (dry)`);
        done++; continue;
      }

      const key = `products/opt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(key, out, { contentType: "image/webp", upsert: false });
      if (upErr) { console.log(`${tag} ✗ upload: ${upErr.message}`); failed++; continue; }

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(key);
      // Сохраняем исходный URL в originalUrl (только если ещё не сохранён — чтобы re-run не затёр оригинал),
      // и проставляем новую сжатую ссылку в imageUrl.
      await pool.query(
        `UPDATE product_images SET "originalUrl" = COALESCE("originalUrl", "imageUrl"), "imageUrl" = $1 WHERE id = $2`,
        [data.publicUrl, row.id]
      );
      console.log(`${tag} ✓ ${mb(orig.length)}МБ → ${mb(out.length)}МБ`);
      done++;
    } catch (e) {
      console.log(`${tag} ✗ ${e.message}`);
      failed++;
    }
  }

  console.log(`\nГотово. Обработано: ${done}, пропущено: ${skipped}, ошибок: ${failed}`);
  if (totalBefore) console.log(`Суммарно: ${mb(totalBefore)}МБ → ${mb(totalAfter)}МБ  (×${(totalBefore / totalAfter).toFixed(0)} легче)`);
} catch (e) {
  console.error("ОШИБКА:", e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}

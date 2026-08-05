import { mkdir, writeFile } from "fs/promises";
import path from "path";

// Локальное файловое хранилище. На проде картинки лежат на диске
// (/opt/japanceramic/storage/uploads) и раздаются nginx по Supabase-совместимым
// URL (/storage/v1/object/public/uploads/...). Реального Supabase Storage API на
// этом деплое нет, поэтому пишем на диск напрямую, а не через supabase-js.
const UPLOAD_DIR = process.env.UPLOAD_DIR || "/app/storage/uploads";
const PUBLIC_BASE =
  process.env.PUBLIC_STORAGE_BASE ||
  `${(process.env.SUPABASE_URL || "").replace(/\/$/, "")}/storage/v1/object/public/uploads`;

// key — путь внутри бакета uploads, напр. "products/1780-x.webp"
// или "visualizations/<userId>/1780-y.webp". Возвращает публичный URL.
export async function saveUpload(key: string, buffer: Buffer): Promise<string> {
  const dest = path.join(UPLOAD_DIR, key);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, buffer);
  return `${PUBLIC_BASE}/${key}`;
}

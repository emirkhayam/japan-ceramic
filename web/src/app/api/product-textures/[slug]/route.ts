import { NextRequest } from "next/server";
import JSZip from "jszip";
import sharp from "sharp";
import { prisma } from "@/lib/db";

// ZIP с текстурами товара для дизайнеров, собирается на лету из фото товара.
// Берём оригиналы (originalUrl — несжатый исходник до WebP-оптимизации),
// для фото без оригинала — текущий imageUrl. Ручной zipUrl товара имеет
// приоритет и отдаётся прямо со страницы товара, сюда такие запросы не идут.

function extFromUrl(url: string): string {
  const m = new URL(url).pathname.match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toLowerCase() : "jpg";
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);

  const product = await prisma.product.findFirst({
    where: { slug, isActive: true },
    select: {
      name: true,
      slug: true,
      images: { orderBy: { sortOrder: "asc" }, select: { imageUrl: true, originalUrl: true } },
    },
  });

  if (!product || product.images.length === 0) return new Response("Not found", { status: 404 });

  const zip = new JSZip();
  const results = await Promise.all(
    product.images.map(async (img, i) => {
      const url = img.originalUrl || img.imageUrl;
      try {
        const res = await fetch(url);
        if (!res.ok) return null;
        let buf: Buffer = Buffer.from(await res.arrayBuffer());
        let ext = extFromUrl(url);
        // Дизайнерам нужна сама плитка: срезаем однотонный студийный фон вокруг
        // (цвет фона берётся по углу кадра). Заодно отдаём только JPG/PNG —
        // webp (сжатые веб-версии) конвертируем в JPG.
        try {
          const trimmed = sharp(buf).trim({ threshold: 25 });
          if (ext === "png") {
            buf = await trimmed.png().toBuffer();
          } else {
            buf = await trimmed.jpeg({ quality: 95 }).toBuffer();
            ext = "jpg";
          }
        } catch {
          // фон не однотонный или картинка целиком из него — кладём как есть
          if (ext !== "jpg" && ext !== "jpeg" && ext !== "png") {
            buf = await sharp(buf).jpeg({ quality: 95 }).toBuffer();
            ext = "jpg";
          }
        }
        return { name: `${product.name} — ${String(i + 1).padStart(2, "0")}.${ext}`, buf };
      } catch {
        return null;
      }
    })
  );

  const files = results.filter((f): f is NonNullable<typeof f> => f !== null);
  if (files.length === 0) return new Response("Images unavailable", { status: 502 });

  for (const f of files) zip.file(f.name, f.buf);

  // Фото уже сжаты кодеками изображений — повторное сжатие зипом бессмысленно, STORE быстрее.
  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "STORE" });

  // Имя файла с кириллицей — через filename* (RFC 5987) + ASCII-fallback (как у PDF-карты).
  const safe = `textures-${product.slug}`.replace(/[^a-z0-9-]/gi, "-");
  const utf8 = encodeURIComponent(`Текстуры — ${product.name}.zip`);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${safe}.zip"; filename*=UTF-8''${utf8}`,
      // Состав фото меняется редко — кэшируем так же, как PDF-карту.
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}

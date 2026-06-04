import { NextRequest } from "next/server";
import sharp from "sharp";

// Обрезанная версия товарного фото: однотонный студийный фон срезается
// (цвет берётся по углу кадра), результат — webp до 900px. Используется
// карточками каталога для клинкера, где фото сняты на студийном фоне.
// Принимаем только наши файлы из supabase-бакета uploads (анти-SSRF).

export async function GET(request: NextRequest) {
  const src = request.nextUrl.searchParams.get("src") || "";
  const allowedPrefix = `${process.env.SUPABASE_URL}/storage/v1/object/public/uploads/`;
  if (!process.env.SUPABASE_URL || !src.startsWith(allowedPrefix)) {
    return new Response("Bad src", { status: 400 });
  }

  try {
    const res = await fetch(src);
    if (!res.ok) return Response.redirect(src, 302);
    const buf = Buffer.from(await res.arrayBuffer());
    const out = await sharp(buf)
      .trim({ threshold: 25 })
      .resize({ width: 900, height: 900, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    return new Response(new Uint8Array(out), {
      headers: {
        "Content-Type": "image/webp",
        // Файлы в бакете неизменяемые (имя со штампом времени) — кэшируем намертво.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    // Фон не однотонный / битый файл — отдаём оригинал как есть.
    return Response.redirect(src, 302);
  }
}

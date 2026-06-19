import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { getSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

// Сжатие исходников: ресайз до 2000px + WebP. Тяжёлые фото (10–20 МБ) → ~0.3–0.6 МБ,
// чтобы next/image не давился оригиналами и каталог не лагал.
const MAX_DIM = 2000;
const WEBP_QUALITY = 82;

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "Файл не выбран" }, { status: 400 });
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf", "application/zip", "application/x-zip-compressed"];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: "Допустимые форматы: JPG, PNG, WebP, PDF, ZIP" }, { status: 400 });
  }

  const isDocument = file.type === "application/pdf" || file.type.includes("zip");
  const maxSize = 100 * 1024 * 1024;
  if (file.size > maxSize) {
    return NextResponse.json({ error: "Файл слишком большой (макс. 100MB)" }, { status: 400 });
  }

  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let buffer: Buffer = Buffer.from(await file.arrayBuffer());
  let contentType = file.type;
  let filename: string;

  if (isDocument) {
    const ext = file.name.split(".").pop() || "bin";
    filename = `documents/${stamp}.${ext}`;
  } else {
    // Изображения — всегда сжимаем в WebP с ресайзом до 2000px.
    try {
      buffer = await sharp(buffer)
        .rotate() // учесть EXIF-ориентацию
        .resize({ width: MAX_DIM, height: MAX_DIM, fit: "inside", withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer();
      contentType = "image/webp";
      filename = `products/${stamp}.webp`;
    } catch (e) {
      console.error("Image compression failed, uploading original:", e);
      const ext = file.name.split(".").pop() || "jpg";
      filename = `products/${stamp}.${ext}`;
    }
  }

  const { error } = await supabaseAdmin.storage
    .from("uploads")
    .upload(filename, buffer, {
      contentType,
      upsert: false,
    });

  if (error) {
    console.error("Supabase upload error:", error);
    return NextResponse.json({ error: `Ошибка загрузки: ${error.message}` }, { status: 500 });
  }

  const { data: urlData } = supabaseAdmin.storage
    .from("uploads")
    .getPublicUrl(filename);

  return NextResponse.json({ url: urlData.publicUrl });
}

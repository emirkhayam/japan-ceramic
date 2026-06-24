import { NextResponse } from "next/server";
import sharp from "sharp";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

// Превращаем результат (data URL или http-ссылку) в буфер.
async function toBuffer(src: string): Promise<Buffer> {
  if (src.startsWith("data:")) {
    const b64 = src.split(",")[1] ?? "";
    return Buffer.from(b64, "base64");
  }
  const res = await fetch(src);
  if (!res.ok) throw new Error(`fetch image ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// Авто-сохранение результата визуализации в «Мои визуализации» (личный кабинет).
export async function POST(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { imageUrl?: string; tileSlug?: string; tileName?: string; surface?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { imageUrl, tileSlug, tileName, surface } = body;
  if (!imageUrl) return NextResponse.json({ error: "imageUrl required" }, { status: 400 });

  try {
    const raw = await toBuffer(imageUrl);
    // Сохраняем БЕЗ обрезки: только ресайз по длинной стороне (fit: inside) — пропорции целы.
    const webp = await sharp(raw)
      .rotate()
      .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 86 })
      .toBuffer();

    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const filename = `visualizations/${user.id}/${stamp}.webp`;
    const { error } = await supabaseAdmin.storage
      .from("uploads")
      .upload(filename, webp, { contentType: "image/webp", upsert: false });
    if (error) throw new Error(error.message);

    const { data: pub } = supabaseAdmin.storage.from("uploads").getPublicUrl(filename);
    const saved = await prisma.savedVisualization.create({
      data: {
        userId: user.id,
        imageUrl: pub.publicUrl,
        tileSlug: tileSlug ?? null,
        tileName: tileName ?? null,
        surface: surface ?? null,
      },
    });
    return NextResponse.json({ ok: true, id: saved.id, url: pub.publicUrl });
  } catch (err) {
    console.error("[visualize:save]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "save failed" }, { status: 500 });
  }
}

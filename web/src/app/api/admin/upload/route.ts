import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

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
  const maxSize = 50 * 1024 * 1024;
  if (file.size > maxSize) {
    return NextResponse.json({ error: "Файл слишком большой (макс. 50MB)" }, { status: 400 });
  }

  const ext = file.name.split(".").pop() || "jpg";
  const folder = isDocument ? "documents" : "products";
  const filename = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error } = await supabaseAdmin.storage
    .from("uploads")
    .upload(filename, buffer, {
      contentType: file.type,
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

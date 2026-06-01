import { NextResponse } from "next/server";
import { getSiteSettings } from "@/lib/settings";

// Публичные контакты сайта (те же, что в футере) — для клиентских компонентов,
// которым нужны телефон/WhatsApp/адрес/ссылка 2ГИС. Только чтение, без секретов.
export async function GET() {
  const settings = await getSiteSettings();
  return NextResponse.json({ settings });
}

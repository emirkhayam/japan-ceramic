import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Публичный приём заявок с сайта (форма «Контакты»). Без авторизации.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });

  const { name, phone, email, message, source } = body;
  if (!name || !phone) {
    return NextResponse.json({ error: "Имя и телефон обязательны" }, { status: 400 });
  }

  await prisma.contactLead.create({
    data: {
      name: String(name).slice(0, 200),
      phone: String(phone).slice(0, 50),
      email: email ? String(email).slice(0, 200) : null,
      message: message ? String(message).slice(0, 2000) : null,
      source: source ? String(source).slice(0, 50) : "contacts",
    },
  });

  return NextResponse.json({ success: true });
}

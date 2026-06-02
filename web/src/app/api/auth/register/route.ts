import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email, password, fullName, company, phone } = body;

  const errors: string[] = [];
  if (!email || !email.includes("@")) errors.push("Введите корректный email");
  if (!password || password.length < 6) errors.push("Пароль минимум 6 символов");
  if (!fullName) errors.push("Введите имя");
  if (!phone || phone.trim().length < 6) errors.push("Введите номер телефона");

  if (errors.length > 0) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase();
  const hashedPassword = await hashPassword(password);
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (existing) {
    // Повторная подача разрешена только если предыдущая заявка была отклонена.
    if (existing.status === "rejected") {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          hashedPassword,
          fullName,
          company: company || null,
          phone: phone.trim(),
          status: "pending",
        },
      });
      return NextResponse.json({ success: true, pending: true });
    }
    if (existing.status === "pending") {
      return NextResponse.json(
        { errors: ["Заявка с этим email уже на рассмотрении"] },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { errors: ["Пользователь с таким email уже существует — войдите в аккаунт"] },
      { status: 400 },
    );
  }

  await prisma.user.create({
    data: {
      email: normalizedEmail,
      hashedPassword,
      fullName,
      company: company || null,
      phone: phone.trim(),
      role: "designer",
      status: "pending",
    },
  });

  // Заявка создана, но НЕ логиним — доступ откроется после одобрения менеджером.
  return NextResponse.json({ success: true, pending: true });
}

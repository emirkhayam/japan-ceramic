import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, createToken, setAuthCookie } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email, password, fullName, company, phone } = body;

  const errors: string[] = [];
  if (!email || !email.includes("@")) errors.push("Введите корректный email");
  if (!password || password.length < 6) errors.push("Пароль минимум 6 символов");
  if (!fullName) errors.push("Введите имя");

  if (errors.length > 0) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    return NextResponse.json({ errors: ["Пользователь с таким email уже существует"] }, { status: 400 });
  }

  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      hashedPassword: await hashPassword(password),
      fullName,
      company: company || null,
      phone: phone || null,
      role: "designer",
    },
  });

  const token = createToken(user.id, user.role);
  const response = NextResponse.json({ success: true });
  response.headers.set("Set-Cookie", setAuthCookie(token)["Set-Cookie"]);
  return response;
}

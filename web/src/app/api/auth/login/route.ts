import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword, createToken, setAuthCookie } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const { email, password } = await request.json();

  const user = await prisma.user.findUnique({
    where: { email: email?.toLowerCase(), isActive: true },
  });

  if (!user || !(await verifyPassword(password, user.hashedPassword))) {
    return NextResponse.json({ error: "Неверный email или пароль" }, { status: 401 });
  }

  const token = createToken(user.id, user.role);
  const response = NextResponse.json({ success: true });
  response.headers.set("Set-Cookie", setAuthCookie(token)["Set-Cookie"]);
  return response;
}

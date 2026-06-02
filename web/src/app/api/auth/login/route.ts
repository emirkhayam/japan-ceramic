import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword, createToken, setAuthCookie } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const { email, password } = await request.json();

  const user = await prisma.user.findUnique({
    where: { email: email?.toLowerCase() },
  });

  // Пароль проверяем первым — чтобы не раскрывать статус заявки тем, кто не знает пароль.
  if (!user || !(await verifyPassword(password, user.hashedPassword))) {
    return NextResponse.json({ error: "Неверный email или пароль" }, { status: 401 });
  }

  if (user.status === "pending") {
    return NextResponse.json(
      { error: "Ваша заявка на рассмотрении. Доступ откроется после одобрения менеджером." },
      { status: 403 },
    );
  }
  if (user.status === "rejected") {
    return NextResponse.json(
      { error: "Заявка отклонена. Свяжитесь с менеджером." },
      { status: 403 },
    );
  }
  if (!user.isActive) {
    return NextResponse.json(
      { error: "Аккаунт заблокирован. Обратитесь к менеджеру." },
      { status: 403 },
    );
  }

  const token = createToken(user.id, user.role);
  const response = NextResponse.json({ success: true, role: user.role });
  response.headers.set("Set-Cookie", setAuthCookie(token)["Set-Cookie"]);
  return response;
}

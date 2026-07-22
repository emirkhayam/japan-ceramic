import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

// Месячный лимит AI-генераций. Имя колонки оставлено прежним для совместимости с БД.
export async function PUT(request: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const raw = body?.budget;
  // null/пусто → лимит снят; иначе целое число генераций от 1 до 1000.
  let budget: number | null = null;
  if (raw !== null && raw !== "" && raw !== undefined) {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1 || n > 1000) {
      return NextResponse.json(
        { error: "Лимит должен быть целым числом от 1 до 1000" },
        { status: 400 },
      );
    }
    budget = n;
  }

  const settings = await prisma.siteSettings.upsert({
    where: { id: "default" },
    update: { aiTokenBudget: budget },
    create: { id: "default", aiTokenBudget: budget },
  });
  return NextResponse.json({ aiTokenBudget: settings.aiTokenBudget });
}

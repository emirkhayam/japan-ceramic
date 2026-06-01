import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

// Месячный лимит токенов AI-визуализации (для расчёта «осталось» в админке).
export async function PUT(request: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const raw = body?.budget;
  // null/пусто → лимит снят; иначе целое неотрицательное число.
  let budget: number | null = null;
  if (raw !== null && raw !== "" && raw !== undefined) {
    const n = Math.floor(Number(raw));
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json({ error: "Лимит должен быть неотрицательным числом" }, { status: 400 });
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

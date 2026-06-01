import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

async function requireAdmin() {
  const user = await getSession();
  return user && user.role === "admin" ? user : null;
}

// Список объектов портфолио (по порядку) + подпись блока.
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const [items, settings] = await Promise.all([
    prisma.portfolioItem.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    prisma.siteSettings.findUnique({ where: { id: "default" }, select: { aboutPortfolioCaption: true } }),
  ]);
  return NextResponse.json({ items, caption: settings?.aboutPortfolioCaption ?? "" });
}

// Создать объект. По умолчанию ставим в конец (sortOrder = max+1).
export async function POST(request: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  if (!body?.imageUrl) {
    return NextResponse.json({ error: "Нужно изображение" }, { status: 400 });
  }
  const last = await prisma.portfolioItem.findFirst({ orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  const item = await prisma.portfolioItem.create({
    data: {
      imageUrl: String(body.imageUrl),
      tag: body.tag ? String(body.tag).slice(0, 120) : null,
      title: body.title ? String(body.title).slice(0, 200) : null,
      meta: body.meta ? String(body.meta).slice(0, 200) : null,
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
  });
  return NextResponse.json({ item });
}

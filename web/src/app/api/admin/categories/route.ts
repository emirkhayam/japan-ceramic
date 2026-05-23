import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const user = await getSession();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { products: true } } },
  });
  return NextResponse.json({ categories });
}

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, slug, sortOrder } = await request.json();
  if (!name || !slug) {
    return NextResponse.json({ error: "Название и slug обязательны" }, { status: 400 });
  }

  const category = await prisma.category.create({
    data: { name, slug, sortOrder: sortOrder || 0 },
  });
  return NextResponse.json({ category });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

// Задаёт полный состав коллекции. Порядок = порядок в массиве productIds.
// FK «одна коллекция на товар»: если товар был в другой коллекции — он переедет сюда.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();
  const productIds: string[] = Array.isArray(body.productIds) ? body.productIds : [];

  const collection = await prisma.collection.findUnique({ where: { id } });
  if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.$transaction([
    // 1. Снять всех текущих участников коллекции
    prisma.product.updateMany({
      where: { collectionId: id },
      data: { collectionId: null, collectionOrder: 0 },
    }),
    // 2. Привязать выбранные в заданном порядке (переезд из других коллекций — норм)
    ...productIds.map((pid, i) =>
      prisma.product.update({
        where: { id: pid },
        data: { collectionId: id, collectionOrder: i },
      })
    ),
  ]);

  return NextResponse.json({ success: true, count: productIds.length });
}

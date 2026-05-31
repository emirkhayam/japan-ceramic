import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

// Поиск товаров для пикера коллекции. Показывает текущую коллекцию каждого товара,
// чтобы менеджер видел, откуда товар «переедет».
export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const q = request.nextUrl.searchParams.get("q")?.trim() || "";
  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit")) || 20, 50);

  const products = await prisma.product.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { collection: { contains: q, mode: "insensitive" } },
          ],
        }
      : {},
    select: {
      id: true,
      name: true,
      dimensions: true,
      collectionId: true,
      collectionRef: { select: { id: true, name: true } },
      images: { orderBy: { sortOrder: "asc" }, take: 1, select: { imageUrl: true } },
    },
    orderBy: { name: "asc" },
    take: limit,
  });

  return NextResponse.json({
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      dimensions: p.dimensions,
      imageUrl: p.images[0]?.imageUrl || null,
      collectionId: p.collectionId,
      collectionName: p.collectionRef?.name || null,
    })),
  });
}

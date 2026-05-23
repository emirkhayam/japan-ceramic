import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const user = await getSession();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const products = await prisma.product.findMany({
    include: { category: true, images: { orderBy: { sortOrder: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ products });
}

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const { name, slug, categoryId, description, price, dimensions, surface, weight, collection, color, images } = body;

  if (!name || !slug || !categoryId) {
    return NextResponse.json({ error: "Название, slug и категория обязательны" }, { status: 400 });
  }

  const existing = await prisma.product.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json({ error: "Товар с таким slug уже существует" }, { status: 400 });
  }

  const product = await prisma.product.create({
    data: {
      name,
      slug,
      categoryId,
      description: description || null,
      price: price ? parseFloat(price) : null,
      dimensions: dimensions || null,
      surface: surface || null,
      weight: weight || null,
      collection: collection || null,
      color: color || null,
      images: images?.length ? {
        create: images.map((url: string, i: number) => ({
          imageUrl: url,
          isPrimary: i === 0,
          sortOrder: i,
        })),
      } : undefined,
    },
    include: { category: true, images: true },
  });

  return NextResponse.json({ product });
}

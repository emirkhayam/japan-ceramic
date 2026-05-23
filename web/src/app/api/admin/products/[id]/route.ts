import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id },
    include: { category: true, images: { orderBy: { sortOrder: "asc" } } },
  });

  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ product });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();
  const { name, slug, categoryId, description, price, dimensions, surface, weight, collection, color, isActive, images } = body;

  const product = await prisma.product.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(slug !== undefined && { slug }),
      ...(categoryId !== undefined && { categoryId }),
      ...(description !== undefined && { description: description || null }),
      ...(price !== undefined && { price: price ? parseFloat(price) : null }),
      ...(dimensions !== undefined && { dimensions: dimensions || null }),
      ...(surface !== undefined && { surface: surface || null }),
      ...(weight !== undefined && { weight: weight || null }),
      ...(collection !== undefined && { collection: collection || null }),
      ...(color !== undefined && { color: color || null }),
      ...(isActive !== undefined && { isActive }),
    },
    include: { category: true, images: true },
  });

  // Update images if provided
  if (images !== undefined) {
    await prisma.productImage.deleteMany({ where: { productId: id } });
    if (images.length > 0) {
      await prisma.productImage.createMany({
        data: images.map((url: string, i: number) => ({
          productId: id,
          imageUrl: url,
          isPrimary: i === 0,
          sortOrder: i,
        })),
      });
    }
  }

  return NextResponse.json({ product });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await prisma.product.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

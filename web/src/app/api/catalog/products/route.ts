import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } },
    orderBy: { name: "asc" },
  });

  const items = products.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    collection: p.collection,
    dimensions: p.dimensions,
    imageUrl: p.images[0]?.imageUrl || null,
  }));

  return NextResponse.json({ products: items });
}

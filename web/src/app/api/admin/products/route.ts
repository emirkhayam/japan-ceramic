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

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-zа-яё0-9]+/gi, "-")
    .replace(/^-|-$/g, "");
}

// Build a slug that is guaranteed unique in the products table.
async function uniqueSlug(base: string) {
  let slug = base || `product-${Date.now()}`;
  let i = 1;
  while (await prisma.product.findUnique({ where: { slug } })) {
    i += 1;
    slug = `${base}-${i}`;
  }
  return slug;
}

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const { name, slug, categoryId, description, price, dimensions, surface, weight, collection, color, images } = body;

  // Only name + category are truly required — the slug is derived from the
  // name when the client doesn't send one, and always made unique.
  if (!name || !categoryId) {
    return NextResponse.json({ error: "Название и категория обязательны" }, { status: 400 });
  }

  const finalSlug = await uniqueSlug(slug ? slugify(slug) : slugify(name));

  const product = await prisma.product.create({
    data: {
      name,
      slug: finalSlug,
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

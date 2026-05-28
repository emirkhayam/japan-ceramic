import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const user = await getSession();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      _count: { select: { products: true, children: true } },
      parent: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json({ categories });
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-zа-яё0-9]+/gi, "-")
    .replace(/^-|-$/g, "");
}

// Build a slug that is guaranteed unique in the categories table.
async function uniqueSlug(base: string) {
  let slug = base || `cat-${Date.now()}`;
  let i = 1;
  while (await prisma.category.findUnique({ where: { slug } })) {
    i += 1;
    slug = `${base}-${i}`;
  }
  return slug;
}

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, slug, sortOrder, parentId } = await request.json();
  if (!name) {
    return NextResponse.json({ error: "Название обязательно" }, { status: 400 });
  }

  // Slug is optional from the client — derive it from the name when missing.
  const finalSlug = await uniqueSlug(slug ? slugify(slug) : slugify(name));

  const category = await prisma.category.create({
    data: { name, slug: finalSlug, sortOrder: sortOrder || 0, parentId: parentId || null },
  });
  return NextResponse.json({ category });
}

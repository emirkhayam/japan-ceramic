import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-zа-яё0-9]+/gi, "-")
    .replace(/^-|-$/g, "");
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { name, slug, sortOrder, parentId } = await request.json();

  if (parentId && parentId === id) {
    return NextResponse.json({ error: "Категория не может быть родителем самой себя" }, { status: 400 });
  }

  // Empty slug on edit means "keep the existing one" (changing slugs breaks URLs).
  const cleanSlug = typeof slug === "string" && slug.trim() ? slugify(slug) : null;

  const category = await prisma.category.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(cleanSlug && { slug: cleanSlug }),
      ...(sortOrder !== undefined && { sortOrder }),
      ...(parentId !== undefined && { parentId: parentId || null }),
    },
  });
  return NextResponse.json({ category });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const productCount = await prisma.product.count({ where: { categoryId: id } });
  if (productCount > 0) {
    return NextResponse.json({ error: `Нельзя удалить: ${productCount} товаров в этой категории` }, { status: 400 });
  }

  const childCount = await prisma.category.count({ where: { parentId: id } });
  if (childCount > 0) {
    return NextResponse.json({ error: `Нельзя удалить: ${childCount} подкатегорий внутри этой категории` }, { status: 400 });
  }

  await prisma.category.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

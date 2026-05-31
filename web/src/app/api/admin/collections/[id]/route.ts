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

async function uniqueSlug(base: string, exceptId: string) {
  let slug = base || `collection-${Date.now()}`;
  let i = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await prisma.collection.findUnique({ where: { slug } });
    if (!existing || existing.id === exceptId) return slug;
    i += 1;
    slug = `${base}-${i}`;
  }
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const collection = await prisma.collection.findUnique({
    where: { id },
    include: {
      products: {
        orderBy: [{ collectionOrder: "asc" }, { name: "asc" }],
        include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } },
      },
    },
  });
  if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ collection });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();
  const { name, slug, description, coverImageUrl, spaceTag, styleTag, isNew, isRecommended, status, sortOrder } = body;

  const collection = await prisma.collection.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(slug && slug.trim() && { slug: await uniqueSlug(slugify(slug), id) }),
      ...(description !== undefined && { description: description || null }),
      ...(coverImageUrl !== undefined && { coverImageUrl: coverImageUrl || null }),
      ...(spaceTag !== undefined && { spaceTag: spaceTag || null }),
      ...(styleTag !== undefined && { styleTag: styleTag || null }),
      ...(isNew !== undefined && { isNew: !!isNew }),
      ...(isRecommended !== undefined && { isRecommended: !!isRecommended }),
      ...(status !== undefined && { status: status === "published" ? "published" : "draft" }),
      ...(sortOrder !== undefined && { sortOrder: Number(sortOrder) || 0 }),
    },
  });

  return NextResponse.json({ collection });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  // Товары не удаляем — у них просто обнулится collectionId (ON DELETE SET NULL).
  await prisma.collection.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

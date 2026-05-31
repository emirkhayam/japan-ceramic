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

async function uniqueSlug(base: string, exceptId?: string) {
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

export async function GET() {
  const user = await getSession();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const collections = await prisma.collection.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: { _count: { select: { products: true } } },
  });
  return NextResponse.json({ collections });
}

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const { name, slug, description, coverImageUrl, spaceTag, styleTag, isNew, isRecommended, status, sortOrder } = body;

  if (!name || !name.trim()) {
    return NextResponse.json({ error: "Название обязательно" }, { status: 400 });
  }

  const finalSlug = await uniqueSlug(slug ? slugify(slug) : slugify(name));

  const collection = await prisma.collection.create({
    data: {
      name: name.trim(),
      slug: finalSlug,
      description: description || null,
      coverImageUrl: coverImageUrl || null,
      spaceTag: spaceTag || null,
      styleTag: styleTag || null,
      isNew: !!isNew,
      isRecommended: !!isRecommended,
      status: status === "published" ? "published" : "draft",
      sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
    },
  });

  return NextResponse.json({ collection });
}

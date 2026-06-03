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
  const { name, slug, categoryId, description, dimensions, surface, weight, collection, color, thickness, boxWeight, boxQuantity, boxArea, wearResistance, antiSlip, rectified, frostResistant, stainResistant, technology, application, pdfUrl, zipUrl, isActive, isNew, isPopular, isOnSale, isMadeToOrder, images } = body;

  const product = await prisma.product.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(slug && slug.trim() && { slug: slugify(slug) }),
      ...(categoryId !== undefined && { categoryId }),
      ...(description !== undefined && { description: description || null }),
      ...(dimensions !== undefined && { dimensions: dimensions || null }),
      ...(surface !== undefined && { surface: surface || null }),
      ...(weight !== undefined && { weight: weight || null }),
      ...(collection !== undefined && { collection: collection || null }),
      ...(color !== undefined && { color: color || null }),
      ...(thickness !== undefined && { thickness: thickness || null }),
      ...(boxWeight !== undefined && { boxWeight: boxWeight || null }),
      ...(boxQuantity !== undefined && { boxQuantity: boxQuantity || null }),
      ...(boxArea !== undefined && { boxArea: boxArea || null }),
      ...(wearResistance !== undefined && { wearResistance: wearResistance || null }),
      ...(antiSlip !== undefined && { antiSlip: antiSlip || null }),
      ...(rectified !== undefined && { rectified: rectified || null }),
      ...(frostResistant !== undefined && { frostResistant: frostResistant || null }),
      ...(stainResistant !== undefined && { stainResistant: stainResistant || null }),
      ...(technology !== undefined && { technology: technology || null }),
      ...(application !== undefined && { application: application || null }),
      ...(pdfUrl !== undefined && { pdfUrl: pdfUrl || null }),
      ...(zipUrl !== undefined && { zipUrl: zipUrl || null }),
      ...(isActive !== undefined && { isActive }),
      ...(isNew !== undefined && { isNew }),
      ...(isPopular !== undefined && { isPopular }),
      ...(isOnSale !== undefined && { isOnSale }),
      ...(isMadeToOrder !== undefined && { isMadeToOrder }),
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

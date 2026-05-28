import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, itemId } = await params;

  // Verify project ownership
  const project = await prisma.designerProject.findUnique({
    where: { id, userId: user.id },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.projectItem.delete({ where: { id: itemId } });
  return NextResponse.json({ success: true });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, itemId } = await params;

  const project = await prisma.designerProject.findUnique({
    where: { id, userId: user.id },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { note } = await request.json();
  await prisma.projectItem.update({
    where: { id: itemId },
    data: { note: note || null },
  });

  return NextResponse.json({ success: true });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { productId, quantity = 1 } = await request.json();

  // Verify project ownership
  const project = await prisma.designerProject.findUnique({
    where: { id, userId: user.id },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const item = await prisma.projectItem.create({
    data: { projectId: id, productId, quantity },
  });

  return NextResponse.json({ item });
}

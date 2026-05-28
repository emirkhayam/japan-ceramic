import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projects = await prisma.designerProject.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true },
  });

  return NextResponse.json({ projects });
}

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, description } = await request.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Введите название" }, { status: 400 });
  }

  const project = await prisma.designerProject.create({
    data: { userId: user.id, name: name.trim(), description: description || null },
  });

  return NextResponse.json({ project });
}

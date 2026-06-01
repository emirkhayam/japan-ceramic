import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

async function requireAdmin() {
  const user = await getSession();
  return user && user.role === "admin" ? user : null;
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const data: Record<string, string | number | null> = {};
  if ("imageUrl" in body && body.imageUrl) data.imageUrl = String(body.imageUrl);
  if ("tag" in body) data.tag = body.tag ? String(body.tag).slice(0, 120) : null;
  if ("title" in body) data.title = body.title ? String(body.title).slice(0, 200) : null;
  if ("meta" in body) data.meta = body.meta ? String(body.meta).slice(0, 200) : null;
  if ("sortOrder" in body && Number.isFinite(Number(body.sortOrder))) data.sortOrder = Math.floor(Number(body.sortOrder));

  const item = await prisma.portfolioItem.update({ where: { id }, data });
  return NextResponse.json({ item });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  await prisma.portfolioItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const user = await getSession();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true, email: true, fullName: true, company: true, phone: true,
      role: true, isActive: true, createdAt: true,
      _count: { select: { projects: true, favorites: true } },
    },
  });
  return NextResponse.json({ users });
}

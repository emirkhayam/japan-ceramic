import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const user = await getSession();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const leads = await prisma.contactLead.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ leads });
}

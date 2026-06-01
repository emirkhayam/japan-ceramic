import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSiteSettings } from "@/lib/settings";

const FIELDS = ["phone", "whatsapp", "telegram", "instagram", "email", "address", "hours", "mapEmbedUrl", "mapLink", "showroomName", "showroomName2", "address2", "mapLink2", "aboutPortfolioCaption"] as const;

export async function GET() {
  const user = await getSession();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Гарантируем наличие строки и отдаём ЭФФЕКТИВНЫЕ значения (строка БД, слитая с дефолтами),
  // чтобы форма показывала то, что реально видно на сайте, а не пустые поля.
  await prisma.siteSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });
  const settings = await getSiteSettings();
  return NextResponse.json({ settings });
}

export async function PUT(request: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const data: Record<string, string | null> = {};
  for (const f of FIELDS) {
    if (f in body) {
      const v = typeof body[f] === "string" ? body[f].trim() : "";
      data[f] = v || null;
    }
  }

  const settings = await prisma.siteSettings.upsert({
    where: { id: "default" },
    update: data,
    create: { id: "default", ...data },
  });
  return NextResponse.json({ settings });
}

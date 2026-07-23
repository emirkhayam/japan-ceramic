import AboutContent from "@/components/about/AboutContent";
import { prisma } from "@/lib/db";

export const metadata = {
  title: "О компании — Japan Ceramic",
  alternates: { canonical: "/about" },
  description: "Japan Ceramic — поставщик премиального керамогранита, клинкера и мозаики из Японии.",
};

export const dynamic = "force-dynamic";

export default async function AboutPage() {
  const [items, settings] = await Promise.all([
    prisma.portfolioItem.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    prisma.siteSettings.findUnique({ where: { id: "default" }, select: { aboutPortfolioCaption: true } }),
  ]);

  const portfolio = items.map((p) => ({
    img: p.imageUrl,
    tag: p.tag || "",
    title: p.title || "",
    meta: p.meta || "",
  }));

  return (
    <AboutContent
      portfolio={portfolio.length ? portfolio : undefined}
      portfolioCaption={settings?.aboutPortfolioCaption || undefined}
    />
  );
}

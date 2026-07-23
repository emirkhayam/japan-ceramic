import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";

const BASE = "https://japanceramic.kg";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/catalog`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE}/visualize`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/about`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/designers`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE}/terms`, changeFrequency: "yearly", priority: 0.2 },
  ];

  // При недоступной БД sitemap всё равно отдаёт статичные маршруты.
  let productRoutes: MetadataRoute.Sitemap = [];
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      select: { slug: true, createdAt: true },
    });
    productRoutes = products.map((p) => ({
      url: `${BASE}/catalog/${p.slug}`,
      lastModified: p.createdAt,
      changeFrequency: "monthly",
      priority: 0.7,
    }));
  } catch (err) {
    console.error("[sitemap] БД недоступна, отдаём только статичные маршруты:", err);
  }

  return [...staticRoutes, ...productRoutes];
}

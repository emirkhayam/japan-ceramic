import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import LandingContent from "@/components/landing/LandingContent";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

function pluralPos(n: number) {
  if (n === 1) return "позиция";
  if (n >= 2 && n <= 4) return "позиции";
  return "позиций";
}

export default async function LandingPage() {
  const user = await getSession();

  // Реальные коллекции для блока «Пространства» на главной (опубликованные и непустые).
  const featuredRaw = await prisma.collection.findMany({
    where: { status: "published", products: { some: {} } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    take: 12,
    include: {
      _count: { select: { products: true } },
      products: { orderBy: [{ collectionOrder: "asc" }], take: 1, include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } } },
    },
  });
  const collections = featuredRaw.map((c) => {
    const tags = [c.spaceTag, c.styleTag].filter(Boolean) as string[];
    const short = c.description ? c.description.split("\n")[0].slice(0, 80) : "";
    return {
      slug: c.slug,
      name: c.name,
      img: c.coverImageUrl || c.products[0]?.images[0]?.imageUrl || null,
      desc: short || (tags.length ? tags.join(" · ") : `${c._count.products} ${pluralPos(c._count.products)}`),
    };
  });

  return (
    <>
      <Header transparent />
      <main>
        <LandingContent
          user={user ? { fullName: user.fullName, role: user.role } : null}
          collections={collections}
        />
      </main>
      <Footer />
    </>
  );
}

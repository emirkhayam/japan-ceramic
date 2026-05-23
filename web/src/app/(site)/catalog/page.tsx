import Link from "next/link";
import { prisma } from "@/lib/db";

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;

  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
  });

  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      ...(category ? { category: { slug: category } } : {}),
    },
    include: {
      images: { orderBy: { sortOrder: "asc" }, take: 1 },
      category: true,
    },
    orderBy: { name: "asc" },
  });

  return (
    <section className="py-20">
      <div className="max-w-[1320px] mx-auto px-10">
        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center gap-3.5 text-[11px] font-semibold tracking-[.34em] uppercase text-[var(--ink-mute)] mb-5">
            <span className="w-[34px] h-px bg-[var(--line-2)]" />
            Каталог
          </div>
          <h2 className="text-[clamp(34px,4.3vw,58px)] font-extralight leading-tight">
            Коллекции<br />керамогранита
          </h2>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 flex-wrap mb-12">
          <Link
            href="/catalog"
            className={`px-[22px] py-2.5 text-[12.5px] font-medium tracking-[.06em] uppercase border rounded-sm transition-all duration-500 ${
              !category
                ? "bg-[var(--ink)] text-[#0a0d12] border-[var(--ink)]"
                : "bg-transparent text-[var(--ink-mute)] border-[var(--line-2)] hover:text-[var(--ink)] hover:border-[rgba(255,255,255,.32)]"
            }`}
          >
            Все
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/catalog?category=${cat.slug}`}
              className={`px-[22px] py-2.5 text-[12.5px] font-medium tracking-[.06em] uppercase border rounded-sm transition-all duration-500 ${
                category === cat.slug
                  ? "bg-[var(--ink)] text-[#0a0d12] border-[var(--ink)]"
                  : "bg-transparent text-[var(--ink-mute)] border-[var(--line-2)] hover:text-[var(--ink)] hover:border-[rgba(255,255,255,.32)]"
              }`}
            >
              {cat.name}
            </Link>
          ))}
        </div>

        {/* Product grid */}
        {products.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
            {products.map((product) => (
              <Link
                key={product.id}
                href={`/catalog/${product.slug}`}
                className="group relative aspect-[3/3.5] overflow-hidden border border-[var(--line)]"
              >
                <img
                  src={product.images[0]?.imageUrl || "https://images.unsplash.com/photo-1640357897497-599b4fc84f51?q=80&w=800&auto=format&fit=crop"}
                  alt={product.name}
                  className="w-full h-full object-cover grayscale-[.2] brightness-[.82] transition-all duration-[1.1s] ease-[var(--ease)] group-hover:scale-[1.06] group-hover:grayscale-0 group-hover:brightness-[.92]"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[rgba(8,10,15,.92)] via-[rgba(8,10,15,.05)] to-transparent" />
                <div className="absolute left-[22px] right-[22px] bottom-[22px] z-[2]">
                  <h3 className="text-[22px] font-light tracking-[.01em] font-[family-name:var(--font-cormorant)] mb-1">
                    {product.name}
                  </h3>
                  <div className="text-[11px] tracking-[.22em] uppercase text-[var(--ink-mute)]">
                    {product.collection || product.category.name}
                  </div>
                  <div className="w-6 h-px bg-[var(--line-2)] mt-3 transition-all duration-500 ease-[var(--ease)] group-hover:w-[54px] group-hover:bg-[var(--ink)]" />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-24 text-[var(--ink-mute)] text-base">
            Товары не найдены
          </div>
        )}
      </div>
    </section>
  );
}

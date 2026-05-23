import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import FavoriteButton from "@/components/FavoriteButton";
import AddToProjectButton from "@/components/AddToProjectButton";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await getSession();

  const product = await prisma.product.findUnique({
    where: { slug, isActive: true },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      category: true,
    },
  });

  if (!product) notFound();

  // Check if favorited
  let isFavorited = false;
  if (user) {
    const fav = await prisma.favorite.findUnique({
      where: { userId_productId: { userId: user.id, productId: product.id } },
    });
    isFavorited = !!fav;
  }

  // Adjacent products for navigation
  const [prev, next] = await Promise.all([
    prisma.product.findFirst({
      where: { name: { lt: product.name }, isActive: true },
      orderBy: { name: "desc" },
      select: { slug: true, name: true },
    }),
    prisma.product.findFirst({
      where: { name: { gt: product.name }, isActive: true },
      orderBy: { name: "asc" },
      select: { slug: true, name: true },
    }),
  ]);

  const heroImage =
    product.images[0]?.imageUrl ||
    "https://images.unsplash.com/photo-1640357897497-599b4fc84f51?q=80&w=1600&auto=format&fit=crop";

  const specs = [
    { label: "Размер", value: product.dimensions },
    { label: "Поверхность", value: product.surface },
    { label: "Вес", value: product.weight },
    { label: "Цвет", value: product.color },
    { label: "Коллекция", value: product.collection },
  ].filter((s) => s.value);

  return (
    <>
      {/* Hero image */}
      <div className="relative w-full h-[85vh] min-h-[500px] overflow-hidden">
        <img src={heroImage} alt={product.name} className="w-full h-full object-cover brightness-[.78]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[rgba(8,10,15,.95)] via-transparent to-[rgba(8,10,15,.4)]" />

        {/* Nav */}
        <div className="absolute top-5 left-10 right-10 z-[3] flex justify-between items-center max-md:left-5 max-md:right-5">
          <Link href="/catalog" className="text-[13px] text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M15 8H1M6 3L1 8l5 5" stroke="currentColor" strokeWidth="1.4" /></svg>
            Каталог
          </Link>
          <div className="flex gap-2.5">
            {prev && (
              <Link href={`/catalog/${prev.slug}`} title={prev.name} className="w-12 h-12 border border-[var(--line-2)] rounded-full flex items-center justify-center text-[var(--ink-soft)] hover:bg-[var(--ink)] hover:text-[#0a0d12] hover:border-[var(--ink)] transition-all duration-400">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M15 8H1M6 3L1 8l5 5" stroke="currentColor" strokeWidth="1.4" /></svg>
              </Link>
            )}
            {next && (
              <Link href={`/catalog/${next.slug}`} title={next.name} className="w-12 h-12 border border-[var(--line-2)] rounded-full flex items-center justify-center text-[var(--ink-soft)] hover:bg-[var(--ink)] hover:text-[#0a0d12] hover:border-[var(--ink)] transition-all duration-400">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1 8h14M10 3l5 5-5 5" stroke="currentColor" strokeWidth="1.4" /></svg>
              </Link>
            )}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="absolute left-0 right-0 bottom-0 z-[3] bg-[rgba(12,16,24,.82)] backdrop-blur-[16px] border-t border-[var(--line)] px-10 py-7 flex justify-between items-center gap-8 max-md:flex-col max-md:items-start max-md:px-5 max-md:py-5">
          <div>
            <h1 className="text-[clamp(28px,3vw,42px)] font-extralight font-[family-name:var(--font-cormorant)] mb-1">
              {product.name}
            </h1>
            <div className="text-[11px] tracking-[.22em] uppercase text-[var(--ink-mute)]">
              {product.collection || product.category.name}
            </div>
          </div>
          <div className="flex gap-3 items-center">
            {user && <FavoriteButton productId={product.id} isFavorited={isFavorited} />}
            {user && <AddToProjectButton productId={product.id} />}
            {product.price && (
              <span className="text-xl font-normal tracking-[.01em]">
                {Math.round(product.price)} ₽/м²
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Specs */}
      <section className="py-16">
        <div className="max-w-[1320px] mx-auto px-10">
          {product.description && (
            <p className="max-w-[640px] text-[15px] text-[var(--ink-soft)] leading-relaxed mb-12">
              {product.description}
            </p>
          )}
          {specs.length > 0 && (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-6">
              {specs.map((spec) => (
                <div key={spec.label} className="py-5 border-t border-[var(--line)]">
                  <div className="text-[11px] tracking-[.18em] uppercase text-[var(--ink-mute)] mb-1.5">
                    {spec.label}
                  </div>
                  <div className="text-base font-normal">{spec.value}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}

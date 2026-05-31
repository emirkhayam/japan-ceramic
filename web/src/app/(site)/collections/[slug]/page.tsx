import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import ProductTile from "@/components/ProductTile";
import ShareButton from "@/components/ShareButton";

export const dynamic = "force-dynamic";

async function getCollection(slug: string) {
  return prisma.collection.findUnique({
    where: { slug },
    include: {
      products: {
        orderBy: [{ collectionOrder: "asc" }, { name: "asc" }],
        include: { images: { orderBy: { sortOrder: "asc" }, take: 1 }, category: true },
      },
    },
  });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const c = await getCollection(slug);
  if (!c || c.status !== "published") return { title: "Коллекция — Japan Ceramic" };
  return {
    title: `${c.name} — Japan Ceramic`,
    description: c.description || `Коллекция ${c.name} — премиальный керамогранит Japan Ceramic.`,
  };
}

export default async function CollectionDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const collection = await getCollection(slug);

  // Черновик и несуществующая → 404 (Murat #2: черновики не утекают по прямому URL).
  if (!collection || collection.status !== "published") notFound();

  const cover = collection.coverImageUrl || collection.products[0]?.images[0]?.imageUrl || null;
  const tags = [collection.spaceTag, collection.styleTag].filter(Boolean) as string[];
  const closeup = collection.products[0]?.images[0]?.imageUrl || null;

  return (
    <article className="pb-24">
      {/* Hero */}
      <section className="relative min-h-[58vh] flex items-end overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[var(--bg-2)]">
          {cover && (
            <img src={cover} alt={collection.name} className="w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[rgba(8,10,15,.96)] via-[rgba(8,10,15,.45)] to-[rgba(8,10,15,.25)]" />
        </div>

        <div className="max-w-[1320px] mx-auto px-10 w-full pb-14 pt-40">
          <Link href="/collections" className="inline-flex items-center gap-2 text-[12px] text-[var(--ink-soft)] hover:text-white transition-colors mb-6">
            ← Все коллекции
          </Link>
          {(collection.isNew || collection.isRecommended) && (
            <div className="flex gap-2 mb-4">
              {collection.isNew && (
                <span className="px-2.5 py-1 rounded-sm text-[10px] font-medium tracking-[.16em] uppercase border border-[var(--color-gold-400)] text-[var(--color-gold-400)]">Новинка</span>
              )}
              {collection.isRecommended && (
                <span className="px-2.5 py-1 rounded-sm text-[10px] font-medium tracking-[.16em] uppercase border border-[var(--line-2)] text-[var(--ink-soft)]">Рекомендуем</span>
              )}
            </div>
          )}
          <h1 className="text-white text-[clamp(40px,6vw,84px)] leading-[1.02]" style={{ fontFamily: "var(--font-display)" }}>
            {collection.name}
          </h1>
          {tags.length > 0 && (
            <div className="flex items-center gap-3 mt-4 text-[13px] text-[var(--ink-soft)] tracking-wide">
              {tags.map((t, i) => (
                <span key={t} className="flex items-center gap-3">
                  {i > 0 && <span className="text-[var(--ink-faint)]">·</span>}
                  {t}
                </span>
              ))}
              <span className="text-[var(--ink-faint)]">·</span>
              <span className="text-[var(--ink-mute)]">{collection.products.length} {plural(collection.products.length)}</span>
            </div>
          )}
        </div>
      </section>

      {/* Philosophy + CTA */}
      {(collection.description || true) && (
        <section className="max-w-[1320px] mx-auto px-10 py-16">
          <div className="grid lg:grid-cols-[1.4fr_1fr] gap-12 items-start">
            <div>
              <div className="flex items-center gap-3.5 text-[11px] font-semibold tracking-[.34em] uppercase text-[var(--ink-mute)] mb-6">
                <span className="w-[34px] h-px bg-[var(--line-2)]" />
                О коллекции
              </div>
              {collection.description ? (
                <p className="text-[var(--ink-soft)] text-[17px] leading-[1.75] max-w-[640px] whitespace-pre-line">
                  {collection.description}
                </p>
              ) : (
                <p className="text-[var(--ink-mute)] text-[16px] leading-relaxed max-w-[640px]">
                  Коллекция {collection.name} — подобранное семейство керамогранита Japan Ceramic.
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3 mt-9">
                <ShareButton title={`${collection.name} — Japan Ceramic`} className="btn-ghost text-[13px]" />
                <a href="/#contacts" className="btn-gold text-[13px]">
                  Запросить подбор
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M1 7.5h12M8 2.5l5 5-5 5" stroke="currentColor" strokeWidth="1.4" /></svg>
                </a>
              </div>
            </div>

            {closeup && (
              <div className="relative aspect-[4/5] rounded-lg overflow-hidden border border-[var(--line)] hidden lg:block">
                <img src={closeup} alt="" className="w-full h-full object-cover" />
              </div>
            )}
          </div>
        </section>
      )}

      {/* Products */}
      <section className="max-w-[1320px] mx-auto px-10">
        <div className="flex items-center gap-3.5 text-[11px] font-semibold tracking-[.34em] uppercase text-[var(--ink-mute)] mb-8">
          <span className="w-[34px] h-px bg-[var(--line-2)]" />
          В коллекции
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-10">
          {collection.products.map((p) => (
            <ProductTile
              key={p.id}
              eyebrow={collection.name}
              product={{
                slug: p.slug,
                name: p.name,
                dimensions: p.dimensions,
                collection: p.collection,
                surface: p.surface,
                frostResistant: p.frostResistant,
                wearResistance: p.wearResistance,
                antiSlip: p.antiSlip,
                isNew: p.isNew,
                isPopular: p.isPopular,
                isOnSale: p.isOnSale,
                category: p.category,
                images: p.images.map((img) => ({ imageUrl: img.imageUrl })),
              }}
            />
          ))}
        </div>
      </section>
    </article>
  );
}

function plural(n: number) {
  if (n === 1) return "позиция";
  if (n >= 2 && n <= 4) return "позиции";
  return "позиций";
}

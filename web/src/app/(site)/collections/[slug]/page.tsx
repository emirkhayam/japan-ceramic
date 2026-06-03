import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import ProductTile from "@/components/ProductTile";
import ShareButton from "@/components/ShareButton";
import CollectionCard from "@/components/CollectionCard";
import { collectionCoverage, coverageLine, coverageSpecs } from "@/lib/collection-utils";
import { prettyFormat } from "@/lib/tile";

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

// Похожие коллекции — совпадение по spaceTag/styleTag, добор любыми published.
async function getSimilar(id: string, spaceTag: string | null, styleTag: string | null) {
  const tagOr = [spaceTag ? { spaceTag } : null, styleTag ? { styleTag } : null].filter(Boolean) as object[];
  const base = {
    include: {
      products: {
        orderBy: [{ collectionOrder: "asc" as const }],
        include: { images: { orderBy: { sortOrder: "asc" as const }, take: 1 }, category: { select: { name: true } } },
      },
    },
  };
  const matched = tagOr.length
    ? await prisma.collection.findMany({
        where: { status: "published", id: { not: id }, products: { some: {} }, OR: tagOr },
        orderBy: [{ isRecommended: "desc" }, { sortOrder: "asc" }],
        take: 3,
        ...base,
      })
    : [];
  if (matched.length >= 3) return matched.slice(0, 3);
  const fillers = await prisma.collection.findMany({
    where: { status: "published", id: { not: id }, products: { some: {} }, NOT: { id: { in: matched.map((m) => m.id) } } },
    orderBy: [{ isRecommended: "desc" }, { sortOrder: "asc" }],
    take: 3 - matched.length,
    ...base,
  });
  return [...matched, ...fillers].slice(0, 3);
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

// Маппинг товара коллекции в пропсы ProductTile.
type CollProduct = NonNullable<Awaited<ReturnType<typeof getCollection>>>["products"][number];
function toTile(p: CollProduct) {
  return {
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
    isMadeToOrder: p.isMadeToOrder,
    category: p.category,
    images: p.images.map((img) => ({ imageUrl: img.imageUrl })),
  };
}

export default async function CollectionDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const collection = await getCollection(slug);

  if (!collection || collection.status !== "published") notFound();

  const cover = collection.coverImageUrl || collection.products[0]?.images[0]?.imageUrl || null;
  const tags = [collection.spaceTag, collection.styleTag].filter(Boolean) as string[];
  const cov = collectionCoverage(collection.products);
  const specs = coverageSpecs(cov, collection.spaceTag, collection.styleTag);
  const metaLine = coverageLine(cov);
  const similar = await getSimilar(collection.id, collection.spaceTag, collection.styleTag);

  const hairline = { background: "linear-gradient(to right, transparent, rgba(206,173,120,.45), transparent)" };
  const count = collection.products.length;

  return (
    <article className="pb-28 lg:pb-24">
      {/* ===== HERO ===== */}
      <section className="relative min-h-[68vh] md:min-h-[78vh] flex items-end overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[var(--bg-2)]">
          {cover && <img src={cover} alt={collection.name} className="w-full h-full object-cover" />}
          {/* Снизу — для читаемости; слева — для текста */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#080a0f] via-[rgba(8,10,15,.4)] to-[rgba(8,10,15,.15)]" />
          <div className="absolute inset-0 bg-gradient-to-r from-[rgba(8,10,15,.7)] via-transparent to-transparent" />
        </div>

        <div className="max-w-[1400px] mx-auto px-6 md:px-10 w-full pb-14 pt-40">
          {/* Хлебные крошки */}
          <nav className="text-[12px] text-[var(--ink-soft)] mb-7" aria-label="Хлебные крошки">
            <Link href="/" className="hover:text-white transition-colors">Главная</Link>
            <span className="mx-2 text-[var(--ink-faint)]">/</span>
            <Link href="/collections" className="hover:text-white transition-colors">Коллекции</Link>
            <span className="mx-2 text-[var(--ink-faint)]">/</span>
            <span className="text-[var(--ink-mute)]">{collection.name}</span>
          </nav>

          <div className="flex items-center gap-3.5 text-[11px] font-semibold tracking-[.3em] uppercase text-[var(--color-gold-400)] mb-5">
            <span className="w-[40px] h-px bg-[var(--color-gold-400)]" />
            Коллекция
          </div>

          {(collection.isNew || collection.isRecommended) && (
            <div className="flex gap-2 mb-4">
              {collection.isNew && (
                <span className="px-3 py-1 rounded-full text-[10px] font-semibold tracking-[.14em] uppercase bg-[var(--color-gold-400)] text-[#0c1018]">Новинка</span>
              )}
              {collection.isRecommended && (
                <span className="px-3 py-1 rounded-full text-[10px] font-semibold tracking-[.14em] uppercase bg-[rgba(12,16,24,.55)] backdrop-blur-md border border-white/15 text-[var(--ink)]">Рекомендуем</span>
              )}
            </div>
          )}

          <h1 className="text-white text-[clamp(40px,8vw,108px)] leading-[0.92]" style={{ fontFamily: "var(--font-display)" }}>
            {collection.name}
          </h1>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-5 text-[13px] md:text-[14px] text-[var(--ink-soft)] tracking-wide">
            {tags.map((t, i) => (
              <span key={t} className="flex items-center gap-3">
                {i > 0 && <span className="text-[var(--ink-faint)]">·</span>}
                {t}
              </span>
            ))}
            {metaLine && (
              <>
                {tags.length > 0 && <span className="text-[var(--ink-faint)]">·</span>}
                <span className="text-[var(--ink-mute)]">{metaLine}</span>
              </>
            )}
          </div>

          <div className="hidden lg:flex flex-wrap items-center gap-3 mt-8">
            <a href="/#contacts" className="btn-gold text-[13px]">
              Запросить подбор
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M1 7.5h12M8 2.5l5 5-5 5" stroke="currentColor" strokeWidth="1.4" /></svg>
            </a>
            <a href="#products" className="btn-ghost text-[13px]">Смотреть товары</a>
          </div>
        </div>
      </section>

      {/* ===== ПАНЕЛЬ ХАРАКТЕРИСТИК (из охвата товаров) ===== */}
      {specs.length > 0 && (
        <section className="max-w-[1400px] mx-auto px-6 md:px-10 pt-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[var(--line)] border border-[var(--line)] rounded-xl overflow-hidden">
            {specs.slice(0, 4).map((s) => (
              <div key={s.label} className="bg-[var(--bg)] p-5 md:p-6">
                <div className="text-[10px] tracking-[.18em] uppercase text-[var(--ink-faint)] mb-2">{s.label}</div>
                <div className="text-[var(--ink)] text-[14px] md:text-[15px] leading-snug">{s.value}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ===== МАНИФЕСТ «О КОЛЛЕКЦИИ» (serif) ===== */}
      <section className="max-w-[820px] mx-auto px-6 md:px-10 py-20 md:py-24 text-center">
        <div className="flex items-center justify-center gap-3.5 text-[11px] font-semibold tracking-[.34em] uppercase text-[var(--ink-mute)] mb-7">
          <span className="w-[30px] h-px bg-[var(--color-gold-400)]" />
          О коллекции
          <span className="w-[30px] h-px bg-[var(--color-gold-400)]" />
        </div>
        <p
          className="text-[clamp(21px,2.6vw,33px)] leading-[1.5] text-[var(--ink-soft)] whitespace-pre-line"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          {collection.description?.trim()
            ? collection.description
            : `Коллекция «${collection.name}» — подобранное семейство ${
                cov.categories[0]?.toLowerCase() || "керамики"
              } Japan Ceramic: единый характер фактуры, формата и настроения для целостного пространства.`}
        </p>
        <div className="flex items-center justify-center gap-3 mt-9">
          <ShareButton title={`${collection.name} — Japan Ceramic`} className="btn-ghost text-[12.5px]" />
        </div>
      </section>

      {/* ===== ТОВАРЫ (адаптивно от количества) ===== */}
      <section id="products" className="max-w-[1400px] mx-auto px-6 md:px-10 scroll-mt-24">
        <div className="h-px w-full mb-10" style={hairline} />
        <div className="flex items-center gap-3.5 text-[11px] font-semibold tracking-[.34em] uppercase text-[var(--ink-mute)] mb-8">
          <span className="w-[34px] h-px bg-[var(--color-gold-400)]" />
          Товары коллекции
        </div>

        {count === 0 ? (
          <div className="text-center py-16 text-[var(--ink-mute)] text-[15px] border border-dashed border-[var(--line)] rounded-xl">
            Товары этой коллекции скоро появятся.
          </div>
        ) : count === 1 ? (
          // Один товар — featured-раскладка вместо сиротливой сетки.
          (() => {
            const p = collection.products[0];
            const img = p.images[0]?.imageUrl || "/placeholder-tile.svg";
            return (
              <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
                <Link href={`/catalog/${p.slug}`} className="group block relative aspect-square rounded-2xl overflow-hidden border border-white/[.08] bg-[rgba(255,255,255,.025)]">
                  <img src={img} alt={p.name} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-[var(--ease)] group-hover:scale-[1.04]" />
                </Link>
                <div>
                  <div className="text-[10px] tracking-[.18em] uppercase text-[var(--ink-faint)] mb-2">{collection.name}</div>
                  <h3 className="text-[clamp(24px,3vw,38px)] leading-tight" style={{ fontFamily: "var(--font-display)" }}>{p.name}</h3>
                  {p.dimensions && (
                    <div className="text-[14px] text-[var(--ink-mute)] mt-3 tabular-nums">{prettyFormat(p.dimensions)} мм</div>
                  )}
                  <div className="flex flex-wrap gap-2 mt-5">
                    {[p.surface, p.frostResistant ? "Морозостойкая" : null, p.antiSlip, p.wearResistance ? `PEI ${p.wearResistance}` : null]
                      .filter(Boolean)
                      .map((t, i) => (
                        <span key={i} className="px-2.5 py-1 rounded-[4px] border border-[var(--line)] text-[11px] text-[var(--ink-mute)]">{t as string}</span>
                      ))}
                  </div>
                  <Link href={`/catalog/${p.slug}`} className="btn-gold text-[13px] mt-8">
                    Смотреть товар
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M1 7.5h12M8 2.5l5 5-5 5" stroke="currentColor" strokeWidth="1.4" /></svg>
                  </Link>
                </div>
              </div>
            );
          })()
        ) : (
          <div
            className={
              count === 2
                ? "grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-[840px] mx-auto"
                : "grid grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-10"
            }
          >
            {collection.products.map((p) => (
              <ProductTile key={p.id} eyebrow={collection.name} product={toTile(p)} />
            ))}
          </div>
        )}

        {/* Расширение выбора — ведём в каталог по категории */}
        {cov.categories[0] && (
          <div className="text-center mt-12">
            <Link href="/catalog" className="inline-flex items-center gap-2 text-[13px] text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
              Смотреть весь каталог
              <svg width="14" height="14" viewBox="0 0 15 15" fill="none"><path d="M1 7.5h12M8 2.5l5 5-5 5" stroke="currentColor" strokeWidth="1.4" /></svg>
            </Link>
          </div>
        )}
      </section>

      {/* ===== ДРУГИЕ КОЛЛЕКЦИИ ===== */}
      {similar.length > 0 && (
        <section className="max-w-[1400px] mx-auto px-6 md:px-10 mt-24">
          <div className="h-px w-full mb-10" style={hairline} />
          <div className="flex items-center gap-3.5 text-[11px] font-semibold tracking-[.34em] uppercase text-[var(--ink-mute)] mb-8">
            <span className="w-[34px] h-px bg-[var(--color-gold-400)]" />
            Другие коллекции
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {similar.map((s) => (
              <CollectionCard
                key={s.id}
                aspectClass="aspect-[4/3]"
                c={{
                  slug: s.slug,
                  name: s.name,
                  cover: s.coverImageUrl || s.products[0]?.images[0]?.imageUrl || null,
                  tags: [s.spaceTag, s.styleTag].filter(Boolean) as string[],
                  metaLine: coverageLine(collectionCoverage(s.products)),
                  isNew: s.isNew,
                  isRecommended: s.isRecommended,
                }}
              />
            ))}
          </div>
        </section>
      )}

      {/* ===== ФИНАЛЬНЫЙ CTA ===== */}
      <section className="mt-24">
        <div className="max-w-[1400px] mx-auto px-6 md:px-10">
          <div className="h-px w-full" style={hairline} />
          <div className="text-center pt-14">
            <h2 className="text-[clamp(24px,3.4vw,46px)] leading-tight" style={{ fontFamily: "var(--font-display)" }}>
              Понравилась коллекция?
            </h2>
            <p className="text-[var(--ink-mute)] text-[15px] mt-4 max-w-[500px] mx-auto">
              Подберём плитку под ваш проект и подготовим спецификацию. Или приходите в шоурум — увидеть фактуру вживую.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
              <a href="/#contacts" className="btn-gold text-[13px]">
                Запросить подбор
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M1 7.5h12M8 2.5l5 5-5 5" stroke="currentColor" strokeWidth="1.4" /></svg>
              </a>
              <Link href="/visualize" className="btn-ghost text-[13px]">Примерить в интерьере (AI)</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ===== ЛИПКИЙ CTA (мобильный) ===== */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 px-4 py-3 bg-[rgba(8,10,15,.82)] backdrop-blur-md border-t border-[var(--line)]">
        <a href="/#contacts" className="btn-gold w-full justify-center text-[14px]">Запросить подбор</a>
      </div>
    </article>
  );
}

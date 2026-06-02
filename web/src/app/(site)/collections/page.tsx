import Link from "next/link";
import { prisma } from "@/lib/db";
import Pagination from "@/components/Pagination";
import CollectionCard from "@/components/CollectionCard";
import { collectionCoverage, coverageLine, collectionWord } from "@/lib/collection-utils";

export const dynamic = "force-dynamic";

const PER_PAGE = 12;

export const metadata = {
  title: "Коллекции — Japan Ceramic",
  description: "Готовые коллекции премиального керамогранита, клинкера и мозаики Japan Ceramic.",
};

export default async function CollectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ space?: string; style?: string; badge?: string; page?: string }>;
}) {
  const { space, style, badge, page } = await searchParams;

  // Все опубликованные непустые коллекции. Товары тянем целиком (для охвата),
  // изображения — по одному на товар (первое = обложка-фолбэк).
  const all = await prisma.collection.findMany({
    where: { status: "published", products: { some: {} } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: {
      products: {
        orderBy: [{ collectionOrder: "asc" }],
        include: { images: { orderBy: { sortOrder: "asc" }, take: 1 }, category: { select: { name: true } } },
      },
    },
  });

  // Опции фильтров — из реальных данных (не хардкод).
  const spaces = [...new Set(all.map((c) => c.spaceTag).filter(Boolean) as string[])].sort();
  const styles = [...new Set(all.map((c) => c.styleTag).filter(Boolean) as string[])].sort();

  const collections = all.filter(
    (c) =>
      (!space || c.spaceTag === space) &&
      (!style || c.styleTag === style) &&
      (badge === "new" ? c.isNew : badge === "recommended" ? c.isRecommended : true)
  );

  const totalItems = collections.length;
  const pageCount = Math.max(1, Math.ceil(totalItems / PER_PAGE));
  const pageNum = Math.min(Math.max(1, parseInt(page || "1", 10) || 1), pageCount);
  const pageItems = collections.slice((pageNum - 1) * PER_PAGE, pageNum * PER_PAGE);

  const hrefWith = (ov: { space?: string; style?: string; badge?: string }) => {
    const m = { space, style, badge, ...ov };
    const sp = new URLSearchParams();
    if (m.space) sp.set("space", m.space);
    if (m.style) sp.set("style", m.style);
    if (m.badge) sp.set("badge", m.badge);
    const s = sp.toString();
    return `/collections${s ? `?${s}` : ""}`;
  };
  const pageHref = (n: number) => {
    const sp = new URLSearchParams();
    if (space) sp.set("space", space);
    if (style) sp.set("style", style);
    if (badge) sp.set("badge", badge);
    if (n > 1) sp.set("page", String(n));
    const s = sp.toString();
    return `/collections${s ? `?${s}` : ""}`;
  };

  const chip = (active: boolean) =>
    `inline-flex items-center px-3.5 py-2 rounded-full text-[12.5px] whitespace-nowrap transition-colors ${
      active
        ? "bg-[var(--color-gold-400)] text-[#0c1018] font-medium"
        : "border border-[var(--line-2)] text-[var(--ink-mute)] hover:text-[var(--ink)] hover:border-white/30"
    }`;

  // Карточка-данные из коллекции (охват вместо счётчика товаров).
  const toCard = (c: (typeof pageItems)[number]) => ({
    slug: c.slug,
    name: c.name,
    cover: c.coverImageUrl || c.products[0]?.images[0]?.imageUrl || null,
    tags: [c.spaceTag, c.styleTag].filter(Boolean) as string[],
    metaLine: coverageLine(collectionCoverage(c.products)),
    isNew: c.isNew,
    isRecommended: c.isRecommended,
  });

  const featured = pageItems[0] ? toCard(pageItems[0]) : null;
  const rest = pageItems.slice(1);

  const hairline = { background: "linear-gradient(to right, transparent, rgba(206,173,120,.45), transparent)" };

  return (
    <section className="pt-10 pb-24">
      <div className="max-w-[1400px] mx-auto px-6 md:px-10">
        {/* Хлебные крошки */}
        <nav className="text-[12px] text-[var(--ink-mute)] mb-7" aria-label="Хлебные крошки">
          <Link href="/" className="hover:text-[var(--ink)] transition-colors">Главная</Link>
          <span className="mx-2 text-[var(--ink-faint)]">/</span>
          <span className="text-[var(--ink-soft)]">Коллекции</span>
        </nav>

        {/* Заголовок + счётчик */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5 mb-9">
          <div>
            <div className="flex items-center gap-3.5 text-[11px] font-semibold tracking-[.34em] uppercase text-[var(--ink-mute)] mb-5">
              <span className="w-[34px] h-px bg-[var(--color-gold-400)]" />
              Коллекции
            </div>
            <h1 className="text-[clamp(36px,5vw,68px)] leading-[1.02]" style={{ fontFamily: "var(--font-display)" }}>
              Готовые коллекции
            </h1>
            <p className="text-[var(--ink-mute)] text-[15px] mt-4 max-w-[540px]">
              Подобранные семейства керамогранита, клинкера и мозаики — гармония текстуры, формата и настроения для целостного пространства.
            </p>
          </div>
          <div className="text-[13px] text-[var(--ink-mute)] shrink-0">
            {totalItems} {collectionWord(totalItems)}
          </div>
        </div>

        {/* Фильтр-чипсы (горизонтально, без sidebar) */}
        <div className="space-y-3 mb-12">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] tracking-[.16em] uppercase text-[var(--ink-faint)] w-[104px] shrink-0">Подборка</span>
            <Link href={hrefWith({ badge: undefined })} className={chip(!badge)}>Все</Link>
            <Link href={hrefWith({ badge: "new" })} className={chip(badge === "new")}>Новинки</Link>
            <Link href={hrefWith({ badge: "recommended" })} className={chip(badge === "recommended")}>Рекомендуем</Link>
          </div>
          {spaces.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] tracking-[.16em] uppercase text-[var(--ink-faint)] w-[104px] shrink-0">Пространство</span>
              <Link href={hrefWith({ space: undefined })} className={chip(!space)}>Любое</Link>
              {spaces.map((s) => (
                <Link key={s} href={hrefWith({ space: s })} className={chip(space === s)}>{s}</Link>
              ))}
            </div>
          )}
          {styles.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] tracking-[.16em] uppercase text-[var(--ink-faint)] w-[104px] shrink-0">Стиль</span>
              <Link href={hrefWith({ style: undefined })} className={chip(!style)}>Любой</Link>
              {styles.map((s) => (
                <Link key={s} href={hrefWith({ style: s })} className={chip(style === s)}>{s}</Link>
              ))}
            </div>
          )}
        </div>

        {/* Сетка — бенто с героем */}
        {pageItems.length === 0 ? (
          <div className="text-center py-24 text-[var(--ink-mute)] text-base border border-dashed border-[var(--line)] rounded-xl">
            По выбранным фильтрам коллекций нет.
            <div className="mt-4">
              <Link href="/collections" className="btn-ghost text-[13px]">Сбросить фильтры</Link>
            </div>
          </div>
        ) : (
          <>
            {featured && <CollectionCard c={featured} featured className="mb-5 md:mb-7" />}

            {rest.length > 0 && (
              <div className="grid grid-cols-12 gap-5 md:gap-7">
                {rest.map((c, i) => {
                  const lonely = i === rest.length - 1 && i % 2 === 0; // одиночка в ряду → во всю ширину
                  const pairEven = Math.floor(i / 2) % 2 === 0;
                  const wide = pairEven ? i % 2 === 0 : i % 2 === 1;
                  const span = lonely ? "md:col-span-12" : wide ? "md:col-span-7" : "md:col-span-5";
                  const aspect = lonely
                    ? "aspect-[16/10] md:aspect-[21/9]"
                    : wide
                    ? "aspect-[4/3] md:aspect-[16/10]"
                    : "aspect-[4/5]";
                  return (
                    <CollectionCard
                      key={c.id}
                      c={toCard(c)}
                      featured={lonely}
                      aspectClass={aspect}
                      className={`col-span-12 ${span}`}
                    />
                  );
                })}
              </div>
            )}

            <Pagination page={pageNum} pageCount={pageCount} hrefFor={pageHref} ariaLabel="Страницы коллекций" />
          </>
        )}

        {/* Финальный CTA */}
        <div className="mt-24">
          <div className="h-px w-full" style={hairline} />
          <div className="text-center pt-14">
            <h2 className="text-[clamp(24px,3vw,40px)] leading-tight" style={{ fontFamily: "var(--font-display)" }}>
              Не нашли подходящую коллекцию?
            </h2>
            <p className="text-[var(--ink-mute)] text-[15px] mt-4 max-w-[480px] mx-auto">
              Подберём плитку под ваш проект или привезём под заказ. Покажем фактуру вживую в шоуруме.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
              <Link href="/#contacts" className="btn-gold text-[13px]">
                Запросить подбор
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M1 7.5h12M8 2.5l5 5-5 5" stroke="currentColor" strokeWidth="1.4" /></svg>
              </Link>
              <Link href="/catalog" className="btn-ghost text-[13px]">Весь каталог</Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

import Link from "next/link";
import { prisma } from "@/lib/db";
import { LogoMark } from "@/components/BrandLogo";
import Pagination from "@/components/Pagination";

export const dynamic = "force-dynamic";

const PER_PAGE = 12;

export const metadata = {
  title: "Коллекции — Japan Ceramic",
  description: "Готовые коллекции премиального керамогранита Japan Ceramic.",
};

function plural(n: number) {
  if (n % 10 === 1 && n % 100 !== 11) return "коллекция";
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return "коллекции";
  return "коллекций";
}
function pluralPos(n: number) {
  if (n === 1) return "позиция";
  if (n >= 2 && n <= 4) return "позиции";
  return "позиций";
}

export default async function CollectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ space?: string; style?: string; badge?: string; page?: string }>;
}) {
  const { space, style, badge, page } = await searchParams;

  // Все опубликованные непустые коллекции (Murat #5 — пустые не показываем).
  const all = await prisma.collection.findMany({
    where: { status: "published", products: { some: {} } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: {
      _count: { select: { products: true } },
      products: { orderBy: [{ collectionOrder: "asc" }], take: 1, include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } } },
    },
  });

  // Опции фильтров — из реальных данных.
  const spaces = [...new Set(all.map((c) => c.spaceTag).filter(Boolean) as string[])].sort();
  const styles = [...new Set(all.map((c) => c.styleTag).filter(Boolean) as string[])].sort();

  const collections = all.filter(
    (c) =>
      (!space || c.spaceTag === space) &&
      (!style || c.styleTag === style) &&
      (badge === "new" ? c.isNew : badge === "recommended" ? c.isRecommended : true)
  );

  // Пагинация по уже отфильтрованному списку. Смена фильтров (hrefWith без page) сбрасывает на 1-ю.
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
  const filterLink = (active: boolean) =>
    `block py-1.5 text-[13.5px] transition-colors ${active ? "text-[var(--ink)] font-medium" : "text-[var(--ink-mute)] hover:text-[var(--ink)]"}`;
  const groupHead = "text-[11px] font-semibold tracking-[.2em] uppercase text-[var(--ink-mute)] mb-3 pb-2 border-b border-[var(--line)]";

  const hasFilters = !!(space || style || badge);

  return (
    <section className="py-20">
      <div className="max-w-[1320px] mx-auto px-10">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3.5 text-[11px] font-semibold tracking-[.34em] uppercase text-[var(--ink-mute)] mb-5">
            <span className="w-[34px] h-px bg-[var(--line-2)]" />
            Коллекции
          </div>
          <h2 className="text-[clamp(34px,4.3vw,58px)] font-extralight leading-tight">Готовые коллекции</h2>
          <p className="text-[var(--ink-mute)] text-[15px] mt-4 max-w-[520px]">
            Подобранные семейства керамогранита — гармония текстуры, формата и настроения для целостного пространства.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-10">
          {/* ===== Filter sidebar ===== */}
          <aside className="lg:w-[220px] shrink-0">
            <div className="lg:sticky lg:top-24 space-y-8">
              {/* Подборка */}
              <div>
                <h3 className={groupHead}>Подборка</h3>
                <Link href={hrefWith({ badge: undefined })} className={filterLink(!badge)}>Все коллекции</Link>
                <Link href={hrefWith({ badge: "new" })} className={filterLink(badge === "new")}>Новинки</Link>
                <Link href={hrefWith({ badge: "recommended" })} className={filterLink(badge === "recommended")}>Рекомендуем</Link>
              </div>

              {/* Пространство */}
              {spaces.length > 0 && (
                <div>
                  <h3 className={groupHead}>Пространство</h3>
                  <Link href={hrefWith({ space: undefined })} className={filterLink(!space)}>Любое</Link>
                  {spaces.map((s) => (
                    <Link key={s} href={hrefWith({ space: s })} className={filterLink(space === s)}>{s}</Link>
                  ))}
                </div>
              )}

              {/* Стиль */}
              {styles.length > 0 && (
                <div>
                  <h3 className={groupHead}>Стиль</h3>
                  <Link href={hrefWith({ style: undefined })} className={filterLink(!style)}>Любой</Link>
                  {styles.map((s) => (
                    <Link key={s} href={hrefWith({ style: s })} className={filterLink(style === s)}>{s}</Link>
                  ))}
                </div>
              )}

              {hasFilters && (
                <Link href="/collections" className="inline-block text-[12px] text-[var(--ink-mute)] hover:text-[var(--ink)] underline underline-offset-4 transition-colors">
                  Сбросить фильтры
                </Link>
              )}
            </div>
          </aside>

          {/* ===== Grid ===== */}
          <div className="flex-1">
            <div className="text-[12.5px] text-[var(--ink-mute)] mb-6">
              {collections.length} {plural(collections.length)}
            </div>

            {collections.length === 0 ? (
              <div className="text-center py-24 text-[var(--ink-mute)] text-base border border-dashed border-[var(--line)] rounded-md">
                По выбранным фильтрам коллекций нет.
              </div>
            ) : (
              <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-10">
                {pageItems.map((c) => {
                  const cover = c.coverImageUrl || c.products[0]?.images[0]?.imageUrl || null;
                  const tags = [c.spaceTag, c.styleTag].filter(Boolean) as string[];
                  return (
                    <Link key={c.id} href={`/collections/${c.slug}`} className="group block">
                      {/* Cover */}
                      <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-[var(--bg-3)]">
                        {(c.isNew || c.isRecommended) && (
                          <div className="absolute top-3 right-3 z-20 flex flex-col items-end gap-1.5">
                            {c.isNew && (
                              <span className="px-2.5 py-1 rounded-sm text-[10px] font-medium tracking-[.16em] uppercase border border-[var(--color-gold-400)] text-[var(--color-gold-400)] bg-[rgba(8,10,15,.45)] backdrop-blur-sm">
                                Новинка
                              </span>
                            )}
                            {c.isRecommended && (
                              <span className="px-2.5 py-1 rounded-sm text-[10px] font-medium tracking-[.16em] uppercase border border-[var(--line-2)] text-[var(--ink-soft)] bg-[rgba(8,10,15,.45)] backdrop-blur-sm">
                                Рекомендуем
                              </span>
                            )}
                          </div>
                        )}
                        {cover ? (
                          <img
                            src={cover}
                            alt={c.name}
                            className="w-full h-full object-cover transition-transform duration-[1.2s] ease-[var(--ease)] group-hover:scale-[1.04]"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <LogoMark height={44} color="rgba(206,173,120,.32)" />
                          </div>
                        )}
                      </div>

                      {/* Name + tags BELOW image (как у tubadzin) */}
                      <div className="mt-4">
                        <h3 className="text-[var(--ink)] text-[22px] leading-tight group-hover:text-white transition-colors" style={{ fontFamily: "var(--font-display)" }}>
                          {c.name}
                        </h3>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2 text-[12px] text-[var(--ink-mute)]">
                          <span>{c._count.products} {pluralPos(c._count.products)}</span>
                          {tags.map((t) => (
                            <span key={t} className="before:content-['·'] before:mr-2 before:text-[var(--ink-faint)]">{t}</span>
                          ))}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
              <Pagination page={pageNum} pageCount={pageCount} hrefFor={pageHref} ariaLabel="Страницы коллекций" />
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

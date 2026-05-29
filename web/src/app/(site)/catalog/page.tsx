import type { CSSProperties } from "react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import CatalogSearch from "@/components/CatalogSearch";

// Реальные размеры плитки из строки вида "227*60*9,5", "600×1200×10mm", "598 x 598".
// Сохраняем реальную ориентацию: широкая плитка → широкой и низкой, узкая → узкой и высокой.
function parseTileSize(dimensions: string | null): { w: number; h: number } | null {
  if (!dimensions) return null;
  const nums = dimensions.match(/\d+(?:[.,]\d+)?/g)?.map((n) => parseFloat(n.replace(",", ".")));
  if (!nums || nums.length < 2 || !nums[0] || !nums[1]) return null;
  return { w: nums[0], h: nums[1] };
}

// "227*60*9,5" → "227 × 60"
function prettyFormat(dimensions: string): string {
  const s = parseTileSize(dimensions);
  if (!s) return dimensions;
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : String(n).replace(".", ","));
  return `${fmt(s.w)} × ${fmt(s.h)}`;
}

// Нормализация по длинной стороне с СОХРАНЕНИЕМ реальной ориентации плитки
// (= ориентации фото, иначе object-cover криво режет). Длинная сторона = NORM% ячейки,
// поэтому у всех плиток одинаковый габарит — никто не больше другого.
// Блок позиционируется absolute + m-auto (центр); проценты высоты корректно
// резолвятся для абсолютных элементов даже от aspect-square родителя.
const NORM = 86;
function normTileStyle(dimensions: string | null): CSSProperties {
  const s = parseTileSize(dimensions);
  if (!s) return { width: `${NORM}%`, height: `${NORM}%` };
  const longest = Math.max(s.w, s.h);
  return { width: `${(NORM * s.w) / longest}%`, height: `${(NORM * s.h) / longest}%` };
}

// Маленький глиф-прямоугольник той же пропорции и ориентации, что плитка (макс. сторона 13px).
function glyphStyle(dimensions: string | null): CSSProperties {
  const s = parseTileSize(dimensions);
  if (!s) return { width: 12, height: 12 };
  const longest = Math.max(s.w, s.h);
  return {
    width: Math.max(3, Math.round((13 * s.w) / longest)),
    height: Math.max(3, Math.round((13 * s.h) / longest)),
  };
}

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string; format?: string }>;
}) {
  const { category, q, format } = await searchParams;

  const allCategories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
  });
  const mainCategories = allCategories.filter((c) => !c.parentId);
  const selectedCategory = category ? allCategories.find((c) => c.slug === category) : null;
  const activeMain = selectedCategory
    ? selectedCategory.parentId
      ? allCategories.find((c) => c.id === selectedCategory.parentId)
      : selectedCategory
    : null;

  // When a main category is selected, include its subcategories' products too.
  const categoryFilter = selectedCategory
    ? selectedCategory.parentId
      ? { categoryId: selectedCategory.id }
      : {
          categoryId: {
            in: [
              selectedCategory.id,
              ...allCategories.filter((c) => c.parentId === selectedCategory.id).map((c) => c.id),
            ],
          },
        }
    : {};

  const searchFilter = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { collection: { contains: q, mode: "insensitive" as const } },
          { color: { contains: q, mode: "insensitive" as const } },
          { surface: { contains: q, mode: "insensitive" as const } },
          { dimensions: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const formatFilter = format ? { dimensions: format } : {};

  // Доступные форматы (для фильтра) — берём из активных товаров.
  const formatRows = await prisma.product.findMany({
    where: { isActive: true, dimensions: { not: null } },
    select: { dimensions: true },
    distinct: ["dimensions"],
  });
  const formats = formatRows
    .map((r) => r.dimensions!)
    .filter(Boolean)
    .sort((a, b) => (parseTileSize(a)?.w ?? 0) - (parseTileSize(b)?.w ?? 0));

  const productsRaw = await prisma.product.findMany({
    where: {
      isActive: true,
      ...categoryFilter,
      ...searchFilter,
      ...formatFilter,
    },
    include: {
      images: { orderBy: { sortOrder: "asc" }, take: 1 },
      category: true,
    },
    orderBy: { name: "asc" },
  });

  // Группируем по размеру: одинаковые форматы стоят рядом (крупные форматы выше).
  // Внутри группы — бейджи (хит/новинка) выше, затем по имени.
  const fmtKey = (d: string | null) => {
    const s = parseTileSize(d);
    if (!s) return { area: -1, key: "zzzz" };
    const mn = Math.min(s.w, s.h);
    const mx = Math.max(s.w, s.h);
    return { area: s.w * s.h, key: `${mn}x${mx}` };
  };
  const products = [...productsRaw].sort((a, b) => {
    const fa = fmtKey(a.dimensions);
    const fb = fmtKey(b.dimensions);
    if (fa.area !== fb.area) return fb.area - fa.area; // крупные форматы первыми
    if (fa.key !== fb.key) return fa.key.localeCompare(fb.key);
    if (a.isPopular !== b.isPopular) return Number(b.isPopular) - Number(a.isPopular);
    if (a.isNew !== b.isNew) return Number(b.isNew) - Number(a.isNew);
    return a.name.localeCompare(b.name);
  });

  // Построение ссылок с сохранением остальных фильтров.
  const hrefWith = (ov: { category?: string; q?: string; format?: string }) => {
    const merged = { category, q, format, ...ov };
    const sp = new URLSearchParams();
    if (merged.category) sp.set("category", merged.category);
    if (merged.q) sp.set("q", merged.q);
    if (merged.format) sp.set("format", merged.format);
    const s = sp.toString();
    return `/catalog${s ? `?${s}` : ""}`;
  };

  const filterLink = (active: boolean) =>
    `block py-1.5 text-[13.5px] transition-colors ${
      active ? "text-[var(--ink)] font-medium" : "text-[var(--ink-mute)] hover:text-[var(--ink)]"
    }`;

  const hasFilters = !!(category || format || q);

  return (
    <section className="py-20">
      <div className="max-w-[1320px] mx-auto px-10">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3.5 text-[11px] font-semibold tracking-[.34em] uppercase text-[var(--ink-mute)] mb-5">
            <span className="w-[34px] h-px bg-[var(--line-2)]" />
            Каталог
          </div>
          <h2 className="text-[clamp(34px,4.3vw,58px)] font-extralight leading-tight">
            Коллекции<br />керамогранита
          </h2>
        </div>

        {/* Search */}
        <CatalogSearch initialQuery={q || ""} category={category || ""} />

        <div className="flex flex-col lg:flex-row gap-10 mt-10">
          {/* ===== Filter sidebar ===== */}
          <aside className="lg:w-[220px] shrink-0">
            <div className="lg:sticky lg:top-24 space-y-8">
              {/* Тип */}
              <div>
                <h3 className="text-[11px] font-semibold tracking-[.2em] uppercase text-[var(--ink-mute)] mb-3 pb-2 border-b border-[var(--line)]">
                  Тип
                </h3>
                <Link href={hrefWith({ category: undefined })} className={filterLink(!category)}>
                  Все типы
                </Link>
                {mainCategories.map((cat) => {
                  const isActive = activeMain?.id === cat.id;
                  const subs = allCategories.filter((c) => c.parentId === cat.id);
                  return (
                    <div key={cat.id}>
                      <Link href={hrefWith({ category: cat.slug })} className={filterLink(selectedCategory?.id === cat.id)}>
                        {cat.name}
                      </Link>
                      {isActive && subs.length > 0 && (
                        <div className="pl-3.5 border-l border-[var(--line)] ml-0.5 mb-1">
                          {subs.map((sub) => (
                            <Link
                              key={sub.id}
                              href={hrefWith({ category: sub.slug })}
                              className={filterLink(selectedCategory?.id === sub.id)}
                            >
                              {sub.name}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Формат */}
              {formats.length > 0 && (
                <div>
                  <h3 className="text-[11px] font-semibold tracking-[.2em] uppercase text-[var(--ink-mute)] mb-3 pb-2 border-b border-[var(--line)]">
                    Формат
                  </h3>
                  <Link href={hrefWith({ format: undefined })} className={filterLink(!format)}>
                    Все форматы
                  </Link>
                  {formats.map((f) => (
                    <Link key={f} href={hrefWith({ format: f })} className={`${filterLink(format === f)} tabular-nums`}>
                      {prettyFormat(f)} <span className="text-[var(--ink-faint)]">мм</span>
                    </Link>
                  ))}
                </div>
              )}

              {hasFilters && (
                <Link
                  href="/catalog"
                  className="inline-block text-[12px] text-[var(--ink-mute)] hover:text-[var(--ink)] underline underline-offset-4 transition-colors"
                >
                  Сбросить фильтры
                </Link>
              )}
            </div>
          </aside>

          {/* ===== Product grid ===== */}
          <div className="flex-1">
            <div className="text-[12.5px] text-[var(--ink-mute)] mb-6">
              {products.length} {products.length === 1 ? "товар" : products.length >= 2 && products.length <= 4 ? "товара" : "товаров"}
            </div>

            {products.length > 0 ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-10">
                {products.map((product) => {
                  const badges = [
                    product.isPopular && { label: "Хит", cls: "bg-[rgba(0,0,0,.6)] text-white border border-white/15 backdrop-blur-sm" },
                    product.isNew && { label: "Новинка", cls: "bg-[var(--color-gold-500)] text-[#0a0d12]" },
                    product.isOnSale && { label: "Акция", cls: "bg-[#c0392b] text-white" },
                  ].filter(Boolean) as { label: string; cls: string }[];

                  // Компактный ряд характеристик под картинкой (как у Tubadzin)
                  const chips: { text?: string; icon?: "frost" }[] = [
                    product.surface ? { text: product.surface } : null,
                    product.frostResistant ? { icon: "frost" } : null,
                    product.wearResistance ? { text: `PEI ${product.wearResistance}` } : null,
                    product.antiSlip ? { text: product.antiSlip } : null,
                  ].filter(Boolean) as { text?: string; icon?: "frost" }[];

                  return (
                    <Link key={product.id} href={`/catalog/${product.slug}`} className="group block">
                      {/* Картинка — все плитки приведены к одной высоте */}
                      <div className="relative aspect-square overflow-hidden rounded-md bg-[rgba(255,255,255,.025)] flex items-center justify-center">
                        {badges.length > 0 && (
                          <div className="absolute top-2.5 left-2.5 z-10 flex flex-col items-start gap-1.5">
                            {badges.map((b) => (
                              <span
                                key={b.label}
                                className={`px-2 py-1 rounded-sm text-[10px] font-semibold tracking-[.1em] uppercase ${b.cls}`}
                              >
                                {b.label}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="absolute inset-0 m-auto overflow-hidden rounded-sm" style={normTileStyle(product.dimensions)}>
                          <img
                            src={product.images[0]?.imageUrl || "/placeholder-tile.svg"}
                            alt={product.name}
                            className="w-full h-full object-cover transition-transform duration-[1.1s] ease-[var(--ease)] group-hover:scale-[1.05]"
                            loading="lazy"
                          />
                        </div>
                      </div>

                      {/* Спец-иконки */}
                      {chips.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 mt-3">
                          {chips.map((c, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[3px] border border-[var(--line)] text-[10px] text-[var(--ink-mute)]"
                            >
                              {c.icon === "frost" ? (
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                                  <path d="M12 2v20M4 6l16 12M20 6L4 18" />
                                </svg>
                              ) : (
                                c.text
                              )}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Текст под картинкой */}
                      <div className="mt-2">
                        <div className="text-[10px] tracking-[.18em] uppercase text-[var(--ink-faint)] mb-1">
                          {product.collection || product.category.name}
                        </div>
                        <h3 className="text-[15px] font-medium leading-snug text-[var(--ink)] group-hover:text-white transition-colors">
                          {product.name}
                        </h3>
                        {product.dimensions && (
                          <div className="flex items-center gap-2 text-[12px] text-[var(--ink-mute)] mt-1.5 tabular-nums">
                            <span className="inline-block border border-[var(--ink-mute)] rounded-[1px]" style={glyphStyle(product.dimensions)} />
                            {prettyFormat(product.dimensions)} мм
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-24 text-[var(--ink-mute)] text-base">
                {q ? `По запросу «${q}» ничего не найдено` : "Товары не найдены"}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

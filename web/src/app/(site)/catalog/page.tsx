import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/db";
import CatalogSearch from "@/components/CatalogSearch";
import CatalogFiltersShell from "@/components/CatalogFiltersShell";
import CatalogCategoryFilter from "@/components/CatalogCategoryFilter";
import Pagination from "@/components/Pagination";
import { parseTileSize, prettyFormat, glyphStyle } from "@/lib/tile";
import { hasPrice, formatPrice, PRICE_UNIT } from "@/lib/price";
import FormatMiniPreview from "@/components/FormatMiniPreview";

export const dynamic = "force-dynamic";

type SP = { category?: string; q?: string; format?: string; surface?: string; color?: string; sort?: string; view?: string; page?: string };

const PER_PAGE = 24;

// Повторяющийся водяной знак «JAPAN CERAMIC» для белого фона прямоугольных плиток.
const WATERMARK =
  "data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A//www.w3.org/2000/svg%27%20width%3D%27260%27%20height%3D%2786%27%3E%3Ctext%20x%3D%2750%25%27%20y%3D%2750%25%27%20font-family%3D%27Arial%2CHelvetica%2Csans-serif%27%20font-size%3D%2715%27%20font-weight%3D%27600%27%20letter-spacing%3D%273%27%20fill%3D%27%252323204a%27%20fill-opacity%3D%270.08%27%20text-anchor%3D%27middle%27%20dominant-baseline%3D%27middle%27%3EJAPAN%20CERAMIC%3C/text%3E%3C/svg%3E";

const SORTS = [
  { key: "popular", label: "Популярные" },
  { key: "new", label: "Новинки" },
  { key: "size", label: "По размеру" },
  { key: "name", label: "По названию" },
];

function plural(n: number) {
  if (n % 10 === 1 && n % 100 !== 11) return "товар";
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return "товара";
  return "товаров";
}

// Группы тонов для фильтра «Цвет». Дробные названия цветов сводятся к 5 группам,
// чтобы фильтр не был перегружен. Порядок проверки важен (дерево и серые — раньше тёмных/светлых).
type ToneKey = "light" | "dark" | "neutral" | "wood" | "color";
const TONES: { key: ToneKey; label: string; swatch: string }[] = [
  { key: "light", label: "Светлые тона", swatch: "#e6dcc8" },
  { key: "dark", label: "Тёмные тона", swatch: "#2f3236" },
  { key: "neutral", label: "Нейтральные", swatch: "#8b8e92" },
  { key: "wood", label: "Дерево", swatch: "#9c6b3f" },
  { key: "color", label: "Цветные", swatch: "linear-gradient(135deg,#4a7a6a,#3a4a72)" },
];
const TONE_RULES: [ToneKey, string[]][] = [
  ["wood", ["дерев", "wood", "ёлоч", "елоч", "дуб", "орех", "венге", "тик", "сосн", "ясен"]],
  ["neutral", ["сер", "графит", "антрац", "бетон", "металл", "стальн", "пепельн", "облачн"]],
  ["dark", ["чёрн", "черн", "тёмн", "темн", "шокол", "корич", "мокко", "кофе", "эспрессо"]],
  ["light", ["бел", "беж", "крем", "слонов", "молочн", "песоч", "светл", "золот", "ваниль", "айвори"]],
  ["color", ["зел", "син", "голуб", "красн", "терракот", "олив", "охр", "жёлт", "желт", "роз", "бордо"]],
];
// Незнакомые названия камня по умолчанию относим к нейтральным.
function colorTone(name?: string | null): ToneKey | null {
  const n = name?.trim().toLowerCase();
  if (!n) return null;
  for (const [tone, keys] of TONE_RULES) if (keys.some((k) => n.includes(k))) return tone;
  return "neutral";
}

const parseList = (v?: string) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : []);
const toggle = (arr: string[], val: string) => (arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);

export default async function CatalogPage({ searchParams }: { searchParams: Promise<SP> }) {
  const { category, q, format, surface, color, sort = "popular", view = "grid", page } = await searchParams;
  const cats = parseList(category);
  const fmts = parseList(format);
  const surfs = parseList(surface);
  const cols = parseList(color);

  const allCategories = await prisma.category.findMany({ orderBy: { sortOrder: "asc" } });
  const mainCategories = allCategories.filter((c) => !c.parentId);

  // Лёгкая выборка скаляров — для фасетов, фильтрации и сортировки (без изображений и связей).
  // Изображения тяжёлые, поэтому грузим их ТОЛЬКО для товаров текущей страницы (см. ниже).
  const productsLite = await prisma.product.findMany({
    where: { isActive: true },
    select: { id: true, name: true, dimensions: true, surface: true, color: true, categoryId: true, collection: true, isNew: true, isPopular: true, createdAt: true },
  });

  // Поиск — базовый набор для счётчиков.
  const ql = q?.trim().toLowerCase();
  const base = ql
    ? productsLite.filter((p) => [p.name, p.collection, p.color, p.surface, p.dimensions].some((v) => v?.toLowerCase().includes(ql)))
    : productsLite;

  // Списки значений для фильтров.
  const countBy = (sel: (p: typeof base[number]) => string | null | undefined) => {
    const m = new Map<string, number>();
    for (const p of base) { const v = sel(p); if (v && v.trim()) m.set(v, (m.get(v) || 0) + 1); }
    return m;
  };
  const formatMap = countBy((p) => p.dimensions);
  const formats = [...formatMap.keys()].sort((a, b) => (parseTileSize(a)?.w ?? 0) - (parseTileSize(b)?.w ?? 0));
  // Поверхность — объединяем дубли без учёта регистра. key = lowercase (в URL), label = первое написание.
  const surfaceGroups = new Map<string, { label: string; count: number }>();
  for (const p of base) {
    const raw = p.surface?.trim();
    if (!raw) continue;
    const key = raw.toLowerCase();
    const g = surfaceGroups.get(key);
    if (g) g.count += 1;
    else surfaceGroups.set(key, { label: raw.charAt(0).toUpperCase() + raw.slice(1), count: 1 });
  }
  const surfaces = [...surfaceGroups.entries()].map(([key, g]) => ({ key, label: g.label, count: g.count })).sort((a, b) => a.label.localeCompare(b.label));
  // Цвет — сводим к группам тонов (см. TONES/colorTone). Показываем только непустые группы.
  const colors = TONES
    .map((t) => ({ ...t, count: base.filter((p) => colorTone(p.color) === t.key).length }))
    .filter((t) => t.count > 0);

  // Выбранные категории → множество допустимых categoryId (с подкатегориями).
  const allowedCatIds = cats.length
    ? new Set(
        cats.flatMap((slug) => {
          const c = allCategories.find((x) => x.slug === slug);
          if (!c) return [];
          return c.parentId ? [c.id] : [c.id, ...allCategories.filter((s) => s.parentId === c.id).map((s) => s.id)];
        })
      )
    : null;

  let products = base.filter(
    (p) =>
      (!allowedCatIds || allowedCatIds.has(p.categoryId)) &&
      (!fmts.length || (p.dimensions ? fmts.includes(p.dimensions) : false)) &&
      (!surfs.length || (p.surface ? surfs.includes(p.surface.trim().toLowerCase()) : false)) &&
      (!cols.length || cols.includes(colorTone(p.color) ?? ""))
  );

  const area = (d: string | null) => { const s = parseTileSize(d); return s ? s.w * s.h : -1; };
  products = [...products].sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name);
    if (sort === "new") { if (a.isNew !== b.isNew) return Number(b.isNew) - Number(a.isNew); return b.createdAt.getTime() - a.createdAt.getTime(); }
    if (sort === "size") return area(b.dimensions) - area(a.dimensions);
    if (a.isPopular !== b.isPopular) return Number(b.isPopular) - Number(a.isPopular);
    if (a.isNew !== b.isNew) return Number(b.isNew) - Number(a.isNew);
    return a.name.localeCompare(b.name);
  });

  // Пагинация по лёгкому списку; изображения подгружаем ТОЛЬКО для товаров текущей страницы.
  // Смена фильтров/сортировки/вида не несёт page (ссылки строятся из current без page) → сброс на 1-ю.
  const totalItems = products.length;
  const pageCount = Math.max(1, Math.ceil(totalItems / PER_PAGE));
  const pageNum = Math.min(Math.max(1, parseInt(page || "1", 10) || 1), pageCount);
  const pageIds = products.slice((pageNum - 1) * PER_PAGE, pageNum * PER_PAGE).map((p) => p.id);
  const hydrated = await prisma.product.findMany({
    where: { id: { in: pageIds } },
    include: { images: { orderBy: { sortOrder: "asc" }, take: 2 }, category: true },
  });
  const hydratedById = new Map(hydrated.map((p) => [p.id, p]));
  const pageItems = pageIds
    .map((id) => hydratedById.get(id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  // URL c полным набором параметров.
  const build = (m: SP) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(m)) if (v && !(k === "sort" && v === "popular") && !(k === "view" && v === "grid") && !(k === "page" && v === "1")) sp.set(k, v);
    const s = sp.toString();
    return `/catalog${s ? `?${s}` : ""}`;
  };
  const current: SP = { category: cats.join(","), q, format: fmts.join(","), surface: surfs.join(","), color: cols.join(","), sort, view };
  // Ссылка-переключатель значения в группе (мультивыбор).
  const tgl = (group: "category" | "format" | "surface" | "color", val: string, arr: string[]) =>
    build({ ...current, [group]: toggle(arr, val).join(",") || undefined });

  const pageHref = (n: number) => build({ ...current, page: n === 1 ? undefined : String(n) });

  const hasFilters = !!(cats.length || fmts.length || surfs.length || cols.length);
  const activeCount = cats.length + fmts.length + surfs.length + cols.length;

  const groupHead = "text-[11px] font-semibold tracking-[.2em] uppercase text-[var(--ink-mute)] mb-3 pb-2 border-b border-[var(--line)]";

  function Check({ on }: { on: boolean }) {
    return (
      <span className={`w-[17px] h-[17px] shrink-0 rounded-[4px] border flex items-center justify-center transition-colors ${on ? "bg-[var(--color-gold-500)] border-[var(--color-gold-500)]" : "border-[var(--line-2)] group-hover/opt:border-[var(--ink-faint)]"}`}>
        {on && <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2.5 6.2l2.3 2.3L9.5 3.5" stroke="#0a0d12" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      </span>
    );
  }
  const optRow = "group/opt flex items-center gap-2.5 py-1.5 cursor-pointer text-[13.5px]";
  const optText = (on: boolean) => `flex-1 transition-colors ${on ? "text-[var(--ink)]" : "text-[var(--ink-soft)] group-hover/opt:text-[var(--ink)]"}`;

  // Дерево категорий с готовыми href — подкатегории сворачиваются стрелкой в клиентском компоненте.
  const categoryTree = mainCategories.map((c) => ({
    slug: c.slug,
    name: c.name,
    href: tgl("category", c.slug, cats),
    on: cats.includes(c.slug),
    subs: allCategories
      .filter((s) => s.parentId === c.id)
      .map((s) => ({ slug: s.slug, name: s.name, href: tgl("category", s.slug, cats), on: cats.includes(s.slug) })),
  }));

  const filtersContent = (
    <div className="space-y-7">
      {/* Тип */}
      <div>
        <h3 className={groupHead}>Тип</h3>
        <CatalogCategoryFilter categories={categoryTree} />
      </div>

      {/* Формат */}
      {formats.length > 0 && (
        <div>
          <h3 className={groupHead}>Формат</h3>
          {formats.map((f) => {
            const on = fmts.includes(f);
            return (
              <Link key={f} href={tgl("format", f, fmts)} className={optRow}>
                <Check on={on} /><span className={`${optText(on)} tabular-nums`}>{prettyFormat(f)} <span className="text-[var(--ink-faint)]">мм</span></span>
              </Link>
            );
          })}
        </div>
      )}

      {/* Поверхность */}
      {surfaces.length > 0 && (
        <div>
          <h3 className={groupHead}>Поверхность</h3>
          {surfaces.map((s) => {
            const on = surfs.includes(s.key);
            return (
              <Link key={s.key} href={tgl("surface", s.key, surfs)} className={optRow}>
                <Check on={on} /><span className={optText(on)}>{s.label}</span>
              </Link>
            );
          })}
        </div>
      )}

      {/* Цвет — группы тонов со свотчами */}
      {colors.length > 0 && (
        <div>
          <h3 className={groupHead}>Цвет</h3>
          {colors.map((c) => {
            const on = cols.includes(c.key);
            return (
              <Link key={c.key} href={tgl("color", c.key, cols)} className={optRow}>
                <span
                  className={`w-[17px] h-[17px] shrink-0 rounded-[4px] border transition-all ${on ? "ring-2 ring-[var(--color-gold-500)] ring-offset-1 ring-offset-[var(--bg-2)] border-transparent" : "border-[var(--line-2)] group-hover/opt:border-[var(--ink-faint)]"}`}
                  style={{ background: c.swatch }}
                />
                <span className={optText(on)}>{c.label}</span>
              </Link>
            );
          })}
        </div>
      )}

      {hasFilters && (
        <Link href={build({ q, sort, view })} className="inline-flex items-center gap-2 text-[12px] text-[var(--ink-mute)] hover:text-[var(--ink)] transition-colors">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 3l8 8M11 3l-8 8" /></svg>
          Сбросить фильтры ({activeCount})
        </Link>
      )}
    </div>
  );

  const isList = view === "list";

  return (
    <section className="pt-[110px] pb-20">
      <div className="max-w-[1340px] mx-auto px-6 sm:px-10">
        {/* Компактная шапка */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5 mb-7">
          <div>
            <div className="flex items-center gap-3 text-[10px] font-semibold tracking-[.34em] uppercase text-[var(--ink-mute)] mb-3">
              <span className="w-[28px] h-px bg-[var(--line-2)]" />Каталог
            </div>
            <h1 className="text-[clamp(26px,3vw,40px)] font-extralight leading-tight" style={{ fontFamily: "var(--font-display)" }}>Коллекции керамогранита</h1>
            <p className="text-[var(--ink-mute)] text-[13.5px] mt-1.5">Премиальные коллекции из Японии · <span className="text-[var(--ink-soft)]">{base.length} {plural(base.length)}</span></p>
          </div>
          <div className="lg:w-[360px]"><CatalogSearch initialQuery={q || ""} category={cats[0] || ""} /></div>
        </div>

        <div className="flex flex-col lg:flex-row gap-9">
          <CatalogFiltersShell activeCount={activeCount}>{filtersContent}</CatalogFiltersShell>

          <div className="flex-1 min-w-0">
            {/* Сортировка + вид */}
            <div className="flex items-center justify-between gap-4 mb-6 pb-4 border-b border-[var(--line)]">
              <div className="flex flex-wrap items-center gap-1">
                {SORTS.map((s) => (
                  <Link key={s.key} href={build({ ...current, sort: s.key })} className={`px-3 py-1.5 rounded-sm text-[12.5px] transition-colors ${sort === s.key ? "bg-[rgba(255,255,255,.06)] text-[var(--ink)]" : "text-[var(--ink-mute)] hover:text-[var(--ink)]"}`}>{s.label}</Link>
                ))}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Link href={build({ ...current, view: "grid" })} aria-label="Сетка" className={`w-8 h-8 flex items-center justify-center rounded-sm transition-colors ${!isList ? "bg-[rgba(255,255,255,.06)] text-[var(--ink)]" : "text-[var(--ink-mute)] hover:text-[var(--ink)]"}`}>
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="1" width="6" height="6" rx="1" /><rect x="9" y="1" width="6" height="6" rx="1" /><rect x="1" y="9" width="6" height="6" rx="1" /><rect x="9" y="9" width="6" height="6" rx="1" /></svg>
                </Link>
                <Link href={build({ ...current, view: "list" })} aria-label="Список" className={`w-8 h-8 flex items-center justify-center rounded-sm transition-colors ${isList ? "bg-[rgba(255,255,255,.06)] text-[var(--ink)]" : "text-[var(--ink-mute)] hover:text-[var(--ink)]"}`}>
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M2 4h12M2 8h12M2 12h12" /></svg>
                </Link>
              </div>
            </div>

            {products.length > 0 ? (
              <>
              <div className={isList ? "flex flex-col gap-4" : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"}>
                {pageItems.map((p, i) => {
                  const main = p.images[0]?.imageUrl || "/placeholder-tile.svg";
                  const eager = pageNum === 1 && i < 4; // первый ряд — приоритетная загрузка (LCP)
                  const sz = parseTileSize(p.dimensions);
                  const isRect = sz ? Math.max(sz.w, sz.h) / Math.min(sz.w, sz.h) >= 1.25 : false;
                  // Клинкер/кирпич — штучные элементы, а не бесшовная текстура: всегда показываем
                  // как плитку на белом фоне с водяным знаком, даже если формат почти квадратный.
                  const framed = isRect || /клинкер/i.test(p.category.name);
                  // Для рамочных карточек фон фото срезается на сервере, плитка показывается
                  // в естественных пропорциях (поле «Размеры» бывает неточным — ему не верим).
                  const canTrim = main.includes("/storage/v1/object/public/uploads/");
                  const framedSrc = framed && canTrim ? `/api/trimmed-image?src=${encodeURIComponent(main)}` : main;
                  const badges = [
                    p.isNew && { t: "NEW", cls: "bg-[var(--color-gold-500)] text-[#0a0d12]" },
                    p.isPopular && { t: "TOP", cls: "bg-[rgba(8,10,15,.7)] text-white border border-white/20 backdrop-blur-sm" },
                    p.isOnSale && { t: "АКЦИЯ", cls: "bg-[var(--danger)] text-white" },
                    p.isMadeToOrder && { t: "ПОД ЗАКАЗ", cls: "bg-[rgba(8,10,15,.72)] text-[var(--color-gold-300)] border border-[rgba(206,173,120,.45)] backdrop-blur-sm" },
                  ].filter(Boolean) as { t: string; cls: string }[];

                  return (
                    <Link
                      key={p.id}
                      href={`/catalog/${p.slug}`}
                      className={`group relative rounded-xl overflow-hidden border border-white/[.08] bg-gradient-to-b from-[var(--bg-3)] to-[var(--bg-2)] transition-all duration-300 will-change-transform hover:-translate-y-1.5 hover:border-[rgba(206,173,120,.45)] hover:shadow-[0_24px_55px_-24px_rgba(0,0,0,.85)] ${isList ? "flex" : ""}`}
                    >
                      <div
                        className={`relative overflow-hidden aspect-square ${framed ? "bg-white" : ""} ${isList ? "w-[200px] shrink-0" : ""}`}
                        style={framed ? { backgroundImage: `url("${WATERMARK}")`, backgroundSize: "175px auto" } : undefined}
                      >
                        {framed ? (
                          /* Плитка целиком на белом фоне с водяным знаком, в обводке.
                             Пропорции — естественные, от самого (обрезанного) фото. */
                          <div className="absolute inset-0 flex items-center justify-center p-4">
                            <img
                              src={framedSrc}
                              alt={p.name}
                              loading={eager ? "eager" : "lazy"}
                              className="max-w-[84%] max-h-[84%] w-auto h-auto rounded-[3px] border-2 border-black/[.18] shadow-[0_16px_42px_rgba(0,0,0,.26)] transition-transform duration-[600ms] ease-[var(--ease)] group-hover:scale-[1.04]"
                            />
                          </div>
                        ) : (
                          /* Квадратная — крупный план текстуры с зумом, в тонкой обводке. */
                          <>
                            <div className="absolute inset-0 shimmer" />
                            <Image src={main} alt={p.name} fill sizes="(max-width:768px) 50vw, 300px" priority={eager} className="object-cover scale-[1.32] transition-transform duration-[600ms] ease-[var(--ease)] group-hover:scale-[1.4]" />
                            <div className="absolute inset-0 border border-white/10 pointer-events-none" />
                          </>
                        )}

                        {badges.length > 0 && (
                          <div className="absolute top-2.5 left-2.5 z-10 flex flex-col items-start gap-1.5">
                            {badges.map((b) => <span key={b.t} className={`px-2 py-0.5 rounded-sm text-[9.5px] font-semibold tracking-[.12em] ${b.cls}`}>{b.t}</span>)}
                          </div>
                        )}

                        {/* Квадратное мини-превью формата — для всех карточек.
                            Клинкер/прямоугольник «собран» кирпичной кладкой внутри квадрата. */}
                        <FormatMiniPreview
                          src={framedSrc}
                          dimensions={p.dimensions}
                          size={56}
                          title={p.dimensions ? `${prettyFormat(p.dimensions)} мм` : undefined}
                          className="absolute bottom-3 left-3 z-10"
                        />
                      </div>
                      <div className={`p-4 ${isList ? "flex-1 flex flex-col justify-center" : ""}`}>
                        <div className="text-[10px] tracking-[.18em] uppercase text-[var(--ink-faint)] mb-1">{p.collection || p.category.name}</div>
                        <h3 className="text-[15px] font-medium leading-snug text-[var(--ink)] group-hover:text-white transition-colors line-clamp-2">{p.name}</h3>
                        <div className="flex items-center gap-2.5 text-[12px] text-[var(--ink-mute)] mt-2 tabular-nums">
                          {p.surface && <span>{p.surface}</span>}
                          {p.surface && p.dimensions && <span className="text-[var(--ink-faint)]">·</span>}
                          {p.dimensions && (
                            <span className="inline-flex items-center gap-1.5">
                              <span className="inline-block border border-[var(--ink-mute)] rounded-[1px]" style={glyphStyle(p.dimensions)} />
                              {prettyFormat(p.dimensions)} мм
                            </span>
                          )}
                        </div>
                        <div className="mt-2.5 text-[13px] tabular-nums">
                          {hasPrice(p.price) ? (
                            <span className="text-[var(--color-gold-300)]">{formatPrice(p.price)} <span className="text-[11px] text-[var(--ink-mute)]">{PRICE_UNIT}</span></span>
                          ) : (
                            <span className="text-[12px] text-[var(--ink-faint)]">Цена по запросу</span>
                          )}
                        </div>
                        <span className="mt-2.5 inline-flex items-center gap-1.5 text-[12px] text-[var(--ink-soft)] group-hover:text-[var(--color-gold-400)] transition-colors">
                          Подробнее
                          <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M1 7h11M7.5 2l5 5-5 5" stroke="currentColor" strokeWidth="1.4" /></svg>
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>

              <Pagination page={pageNum} pageCount={pageCount} hrefFor={pageHref} ariaLabel="Страницы каталога" />
              </>
            ) : (
              <div className="text-center py-24 text-[var(--ink-mute)] text-base">{q ? `По запросу «${q}» ничего не найдено` : "Товары не найдены"}</div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

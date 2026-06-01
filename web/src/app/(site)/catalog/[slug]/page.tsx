import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import FavoriteButton from "@/components/FavoriteButton";
import AddToProjectButton from "@/components/AddToProjectButton";
import ProductGallery from "@/components/ProductGallery";
import ProductSpecs from "@/components/ProductSpecs";
import ProductFeatureStrip from "@/components/ProductFeatureStrip";
import TileCalculator from "@/components/TileCalculator";

const FALLBACK_IMG = "/placeholder-tile.svg";

// Pull the first two numbers out of free-form dimension strings like
// "598 x 598 x 8 mm", "1198×598×10mm", "298×78×10mm".
function parseFormat(raw?: string | null) {
  if (!raw) return null;
  const nums = raw.match(/\d+(?:[.,]\d+)?/g);
  if (!nums || nums.length < 2) return null;
  return { w: nums[0], h: nums[1], t: nums[2] ?? null };
}

// Нормализация мини-карточки по длинной стороне (реальная ориентация),
// как в каталоге — все плитки одного «габарита», никто не больше.
function miniTileStyle(raw?: string | null) {
  const f = parseFormat(raw);
  if (!f) return { width: "88%", height: "88%" };
  const w = parseFloat(f.w.replace(",", "."));
  const h = parseFloat(f.h.replace(",", "."));
  const longest = Math.max(w, h) || 1;
  return { width: `${(88 * w) / longest}%`, height: `${(88 * h) / longest}%` };
}

function miniFormat(raw?: string | null) {
  const f = parseFormat(raw);
  return f ? `${f.w} × ${f.h} мм` : null;
}

type Spec = { key: string; label: string; value: string };

function MiniProductCard({
  p,
}: {
  p: { slug: string; name: string; dimensions: string | null; images: { imageUrl: string }[]; category: { name: string } };
}) {
  const fmt = miniFormat(p.dimensions);
  return (
    <Link href={`/catalog/${p.slug}`} className="group block">
      <div className="relative aspect-square overflow-hidden rounded-md bg-[rgba(255,255,255,.025)] flex items-center justify-center mb-2.5">
        <div className="absolute inset-0 m-auto overflow-hidden rounded-sm" style={miniTileStyle(p.dimensions)}>
          <img
            src={p.images[0]?.imageUrl || FALLBACK_IMG}
            alt={p.name}
            className="w-full h-full object-cover transition-transform duration-700 ease-[var(--ease)] group-hover:scale-[1.05]"
            loading="lazy"
          />
        </div>
      </div>
      <div className="text-[10px] tracking-[.16em] uppercase text-[var(--ink-faint)] mb-1">{p.category.name}</div>
      <div className="text-[13.5px] text-[var(--ink-soft)] group-hover:text-[var(--ink)] transition-colors duration-200 leading-snug">
        {p.name}
      </div>
      {fmt && <div className="text-[11px] text-[var(--ink-mute)] mt-1 tabular-nums">{fmt}</div>}
    </Link>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);
  const product = await prisma.product.findFirst({
    where: { slug, isActive: true },
    select: { name: true, description: true, color: true, surface: true, category: { select: { name: true } } },
  });
  if (!product) return { title: "Товар не найден — Japan Ceramic" };
  const descParts = [product.category?.name, product.surface, product.color].filter(Boolean);
  return {
    title: `${product.name} — Japan Ceramic`,
    description:
      product.description ||
      `${product.name}${descParts.length ? ` — ${descParts.join(", ")}` : ""}. Премиальный керамогранит Japan Ceramic.`,
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);
  const user = await getSession();

  const product = await prisma.product.findFirst({
    where: { slug, isActive: true },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      category: true,
    },
  });

  if (!product) notFound();

  let isFavorited = false;
  if (user) {
    const fav = await prisma.favorite.findUnique({
      where: { userId_productId: { userId: user.id, productId: product.id } },
    });
    isFavorited = !!fav;
  }

  // Other products from the same collection
  const collectionProducts = product.collection
    ? await prisma.product.findMany({
        where: {
          collection: product.collection,
          id: { not: product.id },
          isActive: true,
        },
        take: 6,
        include: { images: { take: 1, orderBy: { sortOrder: "asc" } }, category: true },
      })
    : [];

  // Similar products from the same category, excluding collection siblings
  const similar = await prisma.product.findMany({
    where: {
      categoryId: product.categoryId,
      id: { not: product.id, notIn: collectionProducts.map((p) => p.id) },
      isActive: true,
    },
    take: 4,
    include: { images: { take: 1, orderBy: { sortOrder: "asc" } }, category: true },
  });

  const fmt = parseFormat(product.dimensions);
  const thicknessText =
    product.thickness || (fmt?.t ? `${fmt.t} мм` : null);

  // Мини-диаграмма пропорции плитки (реальная ориентация, макс. сторона 56px)
  const fw = fmt ? parseFloat(fmt.w.replace(",", ".")) : 0;
  const fh = fmt ? parseFloat(fmt.h.replace(",", ".")) : 0;
  const dgMax = Math.max(fw, fh) || 1;
  const dgW = Math.max(6, Math.round(56 * (fw / dgMax)));
  const dgH = Math.max(6, Math.round(56 * (fh / dgMax)));

  // Headline features shown as icon chips near the top
  const headline = (
    [
      { key: "surface", label: "Поверхность", value: product.surface },
      { key: "thickness", label: "Толщина", value: thicknessText },
      { key: "wearResistance", label: "Износостойкость", value: product.wearResistance },
      { key: "antiSlip", label: "Противоскольжение", value: product.antiSlip },
      { key: "frostResistant", label: "Морозостойкость", value: product.frostResistant },
      { key: "rectified", label: "Ректификация", value: product.rectified },
      { key: "stainResistant", label: "Устойчив к пятнам", value: product.stainResistant },
    ] as { key: string; label: string; value: string | null }[]
  ).filter((f) => f.value) as Spec[];

  const designTags = [product.color, product.surface].filter(Boolean) as string[];

  // Полная таблица характеристик на всю ширину (как у Tubadzin):
  // Тип/Коллекция + параметры + упаковка. Делим на две колонки.
  const characteristics = (
    [
      { key: "category", label: "Тип продукта", value: product.category.name },
      { key: "collection", label: "Коллекция", value: product.collection },
      { key: "dimensions", label: "Размер", value: product.dimensions },
      { key: "thickness", label: "Толщина", value: thicknessText },
      { key: "surface", label: "Поверхность", value: product.surface },
      { key: "color", label: "Цвет", value: product.color },
      { key: "application", label: "Применение", value: product.application },
      { key: "wearResistance", label: "Износостойкость", value: product.wearResistance },
      { key: "antiSlip", label: "Противоскольжение", value: product.antiSlip },
      { key: "rectified", label: "Ректификация", value: product.rectified },
      { key: "frostResistant", label: "Морозостойкость", value: product.frostResistant },
      { key: "stainResistant", label: "Устойчивость к пятнам", value: product.stainResistant },
      { key: "technology", label: "Технология", value: product.technology },
      { key: "weight", label: "Вес плитки", value: product.weight },
      { key: "boxQuantity", label: "Кол-во в коробке", value: product.boxQuantity },
      { key: "boxArea", label: "Площадь коробки", value: product.boxArea },
      { key: "boxWeight", label: "Вес коробки", value: product.boxWeight },
    ] as { key: string; label: string; value: string | null }[]
  ).filter((s) => s.value) as Spec[];
  return (
    <>
      {/* Breadcrumb */}
      <nav className="max-w-[1320px] mx-auto px-10 max-md:px-5 pt-6 pb-8">
        <ol className="flex items-center gap-2 text-[12px] text-[var(--ink-faint)]">
          <li><Link href="/catalog" className="hover:text-[var(--ink)] transition-colors">Каталог</Link></li>
          <li aria-hidden>/</li>
          <li><Link href={`/catalog?category=${product.category.slug}`} className="hover:text-[var(--ink)] transition-colors">{product.category.name}</Link></li>
          <li aria-hidden>/</li>
          <li className="text-[var(--ink-mute)] truncate">{product.name}</li>
        </ol>
      </nav>

      {/* Product section */}
      <div className="max-w-[1320px] mx-auto px-10 max-md:px-5 pb-16">
        {/* Герой: картинка слева + информация справа */}
        <div className="grid lg:grid-cols-[minmax(0,560px)_1fr] gap-12 xl:gap-16 items-start">

          {/* ---- Картинка + калькулятор (слева, липкая) ---- */}
          <div className="lg:sticky lg:top-24">
            <ProductGallery
              images={product.images.map((img) => ({ id: img.id, imageUrl: img.imageUrl }))}
              productName={product.name}
              dimensions={product.dimensions}
            />
            {/* Калькулятор — под картинкой */}
            <div className="mt-8">
              <TileCalculator dimensions={product.dimensions} boxQuantity={product.boxQuantity} />
            </div>
          </div>

          {/* ---- Информация (справа) ---- */}
          <div className="min-w-0">
            {/* Badges */}
            {(product.isNew || product.isPopular || product.isOnSale) && (
              <div className="flex flex-wrap items-center gap-2 mb-4">
                {product.isPopular && (
                  <span className="px-2.5 py-1 rounded-sm text-[10px] font-semibold tracking-[.12em] uppercase bg-[rgba(255,255,255,.08)] text-[var(--ink)] border border-white/15">Хит</span>
                )}
                {product.isNew && (
                  <span className="px-2.5 py-1 rounded-sm text-[10px] font-semibold tracking-[.12em] uppercase bg-[var(--color-gold-500)] text-[var(--on-gold)]">Новинка</span>
                )}
                {product.isOnSale && (
                  <span className="px-2.5 py-1 rounded-sm text-[10px] font-semibold tracking-[.12em] uppercase bg-[var(--danger)] text-white">Акция</span>
                )}
              </div>
            )}

            {/* Tags row */}
            <div className="flex flex-wrap items-center gap-2 mb-5">
              <Link
                href={`/catalog?category=${product.category.slug}`}
                className="px-3 py-1 text-[11px] tracking-[.18em] uppercase border border-[var(--line-2)] rounded-sm text-[var(--ink-mute)] hover:text-[var(--ink)] hover:border-[var(--ink-mute)] transition-colors"
              >
                {product.category.name}
              </Link>
              {designTags.map((t) => (
                <span
                  key={t}
                  className="px-3 py-1 text-[11px] tracking-[.06em] rounded-sm bg-[rgba(255,255,255,.03)] text-[var(--ink-mute)]"
                >
                  {t}
                </span>
              ))}
            </div>

            {/* Collection link */}
            {product.collection && (
              <Link
                href={`/catalog?q=${encodeURIComponent(product.collection)}`}
                className="group inline-flex items-center gap-2.5 text-[12px] tracking-[.14em] uppercase text-[var(--color-gold-400)] hover:text-[var(--color-gold-500)] transition-colors mb-5"
              >
                <span className="w-6 h-px bg-[var(--color-gold-500)]" />
                Коллекция {product.collection}
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" className="transition-transform group-hover:translate-x-0.5"><path d="M4 2l4 4-4 4"/></svg>
              </Link>
            )}

            {/* Name */}
            <h1 className="text-[clamp(28px,3vw,40px)] font-light leading-[1.12] tracking-tight mb-5">
              {product.name}
            </h1>

            {/* Big format */}
            {fmt && (
              <div className="flex items-end gap-5 mb-7 pb-7 border-b border-[var(--line)]">
                <div className="shrink-0 w-[56px] h-[56px] flex items-center justify-center mb-1">
                  <span
                    className="block border border-[var(--ink-mute)] rounded-[1px] bg-[rgba(255,255,255,.03)]"
                    style={{ width: dgW, height: dgH }}
                  />
                </div>
                <div className="flex items-baseline gap-2.5">
                  <span className="text-[clamp(40px,5vw,64px)] font-extralight leading-none tracking-tight tabular-nums">{fmt.w}</span>
                  <span className="text-[clamp(24px,3.4vw,40px)] font-extralight text-[var(--ink-faint)] leading-none">×</span>
                  <span className="text-[clamp(40px,5vw,64px)] font-extralight leading-none tracking-tight tabular-nums">{fmt.h}</span>
                  <span className="text-[13px] tracking-[.12em] uppercase text-[var(--color-gold-400)] ml-1.5 self-end mb-2">мм</span>
                </div>
                {thicknessText && (
                  <div className="text-[12px] text-[var(--ink-mute)] mb-2.5">
                    толщина <span className="text-[var(--ink-soft)]">{thicknessText}</span>
                  </div>
                )}
              </div>
            )}

            {/* Feature icon strip */}
            <ProductFeatureStrip features={headline} />

            {/* Description */}
            {product.description && (
              <p className="text-[15px] leading-[1.75] text-[var(--ink-soft)] mt-2 max-w-[640px]">
                {product.description}
              </p>
            )}

            {/* ---- Действия / материалы / калькулятор / салон ---- */}
            <div className="mt-9 pt-8 border-t border-[var(--line)] space-y-6 max-w-[560px]">
            {user && (
              <div className="space-y-3">
                <div className="flex gap-2.5">
                  <FavoriteButton productId={product.id} isFavorited={isFavorited} />
                  <AddToProjectButton productId={product.id} />
                </div>
                <Link
                  href={`/visualize?tile=${product.slug}`}
                  className="btn-gold w-full gap-2.5 text-[13px] tracking-[.06em] uppercase"
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1" y="1" width="16" height="12" rx="2" />
                    <path d="M5 16h8" />
                    <path d="M9 13v3" />
                    <path d="M6 5.5l3 2.5 3-2.5" />
                  </svg>
                  Визуализировать в комнате
                </Link>
              </div>
            )}

            {/* Materials */}
            <div>
              <h2 className="flex items-center gap-3 text-[11px] tracking-[.22em] uppercase text-[var(--color-gold-400)] mb-3">
                <span className="w-6 h-px bg-[var(--color-gold-500)]" />Материалы для проекта
              </h2>
              <div className="flex flex-col gap-2.5">
                <a
                  href={product.pdfUrl || `/api/product-card/${product.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-center gap-3 px-4 py-3 border border-[var(--line-2)] rounded-sm hover:border-[rgba(206,173,120,.5)] hover:bg-[rgba(255,255,255,.03)] transition-all duration-200 cursor-pointer"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-[var(--ink-faint)] group-hover:text-[var(--ink-soft)] transition-colors"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 19h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  <div>
                    <div className="text-[13px] font-medium text-[var(--ink-soft)] group-hover:text-[var(--ink)] transition-colors">Карта продукта</div>
                    <div className="text-[10px] text-[var(--ink-faint)] uppercase tracking-wider">PDF</div>
                  </div>
                </a>
                {product.zipUrl && (
                  <a
                    href={product.zipUrl}
                    download
                    className="group flex items-center gap-3 px-4 py-3 border border-[var(--line-2)] rounded-sm hover:border-[rgba(206,173,120,.5)] hover:bg-[rgba(255,255,255,.03)] transition-all duration-200 cursor-pointer"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-[var(--ink-faint)] group-hover:text-[var(--ink-soft)] transition-colors"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 19h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    <div>
                      <div className="text-[13px] font-medium text-[var(--ink-soft)] group-hover:text-[var(--ink)] transition-colors">Текстуры для 3D</div>
                      <div className="text-[10px] text-[var(--ink-faint)] uppercase tracking-wider">ZIP</div>
                    </div>
                  </a>
                )}
              </div>
            </div>

            {/* CTA салон */}
            <div className="p-6 rounded border border-[var(--line)] bg-[rgba(255,255,255,.02)]">
              <p className="text-[14px] text-[var(--ink-soft)] mb-4">
                Хотите увидеть и потрогать материал вживую?
              </p>
              <a
                href="/#contacts"
                className="inline-flex items-center gap-2.5 px-5 py-3 text-[13px] font-medium tracking-[.08em] uppercase border border-[var(--ink)] text-[var(--ink)] rounded-sm hover:bg-[var(--ink)] hover:text-[var(--on-gold)] transition-all duration-300 cursor-pointer"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z" fill="currentColor"/></svg>
                Найти наш салон
              </a>
            </div>
            </div>

            {/* Характеристики — в правой колонке, одноколоночный список */}
            {characteristics.length > 0 && (
              <div className="mt-9 pt-8 border-t border-[var(--line)]">
                <h2 className="flex items-center gap-3 text-[11px] tracking-[.22em] uppercase text-[var(--color-gold-400)] mb-5">
                  <span className="w-6 h-px bg-[var(--color-gold-500)]" />Характеристики
                </h2>
                <ProductSpecs specs={characteristics} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Other products in the collection */}
      {collectionProducts.length > 0 && (
        <section className="border-t border-[var(--line)] py-16">
          <div className="max-w-[1320px] mx-auto px-10 max-md:px-5">
            <h2 className="flex items-center gap-3 text-[11px] tracking-[.22em] uppercase text-[var(--color-gold-400)] mb-8">
              <span className="w-6 h-px bg-[var(--color-gold-500)]" />Другие продукты коллекции «{product.collection}»
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {collectionProducts.map((p) => (
                <MiniProductCard key={p.id} p={p} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Similar products */}
      {similar.length > 0 && (
        <section className="border-t border-[var(--line)] py-16">
          <div className="max-w-[1320px] mx-auto px-10 max-md:px-5">
            <h2 className="flex items-center gap-3 text-[11px] tracking-[.22em] uppercase text-[var(--color-gold-400)] mb-8">
              <span className="w-6 h-px bg-[var(--color-gold-500)]" />Похожие товары
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {similar.map((p) => (
                <MiniProductCard key={p.id} p={p} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}

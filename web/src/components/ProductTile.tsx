import Link from "next/link";
import { normTileStyle, glyphStyle, prettyFormat } from "@/lib/tile";

export interface TileProduct {
  slug: string;
  name: string;
  dimensions: string | null;
  collection: string | null;
  surface?: string | null;
  frostResistant?: string | null;
  wearResistance?: string | null;
  antiSlip?: string | null;
  isNew?: boolean;
  isPopular?: boolean;
  isOnSale?: boolean;
  category?: { name: string } | null;
  images: { imageUrl: string }[];
}

// Карточка плитки в стиле каталога: нормализованная высота, бейджи, спец-чипы.
export default function ProductTile({ product, eyebrow }: { product: TileProduct; eyebrow?: string }) {
  const badges = [
    product.isPopular && { label: "Хит", cls: "bg-[rgba(0,0,0,.6)] text-white border border-white/15 backdrop-blur-sm" },
    product.isNew && { label: "Новинка", cls: "bg-[var(--color-gold-500)] text-[#0a0d12]" },
    product.isOnSale && { label: "Акция", cls: "bg-[#c0392b] text-white" },
  ].filter(Boolean) as { label: string; cls: string }[];

  const chips: { text?: string; icon?: "frost" }[] = [
    product.surface ? { text: product.surface } : null,
    product.frostResistant ? { icon: "frost" } : null,
    product.wearResistance ? { text: `PEI ${product.wearResistance}` } : null,
    product.antiSlip ? { text: product.antiSlip } : null,
  ].filter(Boolean) as { text?: string; icon?: "frost" }[];

  return (
    <Link href={`/catalog/${product.slug}`} className="group block">
      <div className="relative aspect-square overflow-hidden rounded-md bg-[rgba(255,255,255,.025)] flex items-center justify-center">
        {badges.length > 0 && (
          <div className="absolute top-2.5 left-2.5 z-10 flex flex-col items-start gap-1.5">
            {badges.map((b) => (
              <span key={b.label} className={`px-2 py-1 rounded-sm text-[10px] font-semibold tracking-[.1em] uppercase ${b.cls}`}>
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

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mt-3">
          {chips.map((c, i) => (
            <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[3px] border border-[var(--line)] text-[10px] text-[var(--ink-mute)]">
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

      <div className="mt-2">
        <div className="text-[10px] tracking-[.18em] uppercase text-[var(--ink-faint)] mb-1">
          {eyebrow || product.collection || product.category?.name}
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
}

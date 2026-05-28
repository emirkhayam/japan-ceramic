"use client";

import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/cn";
import { Check } from "lucide-react";

export type CatalogTile = {
  id: string;
  slug: string;
  name: string;
  collection: string | null;
  dimensions: string | null;
  imageUrl: string | null;
};

type Props = {
  selectedSlug: string | null;
  onSelect: (tile: CatalogTile) => void;
  compact?: boolean;
};

export function CatalogTileSelector({ selectedSlug, onSelect, compact = false }: Props) {
  const [tiles, setTiles] = useState<CatalogTile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/catalog/products")
      .then((r) => r.json())
      .then((data) => {
        setTiles(data.products);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!search) return tiles;
    const q = search.toLowerCase();
    return tiles.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.collection && t.collection.toLowerCase().includes(q))
    );
  }, [tiles, search]);

  if (loading) {
    return <div className="text-[var(--ink-mute)] text-sm py-8 text-center">Загрузка товаров...</div>;
  }

  return (
    <div>
      {!compact && (
        <input
          type="text"
          placeholder="Поиск по названию..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full mb-4 px-4 py-2.5 bg-[rgba(255,255,255,.04)] border border-[rgba(255,255,255,.1)] rounded-xl text-[var(--ink)] text-sm outline-none focus:border-[rgba(255,255,255,.3)] transition-all placeholder:text-[var(--ink-faint)]"
        />
      )}
      <div
        className={cn(
          "grid gap-3",
          compact
            ? "grid-cols-3 sm:grid-cols-4 lg:grid-cols-6"
            : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
        )}
      >
        {filtered.map((tile) => {
          const isSelected = selectedSlug === tile.slug;
          return (
            <button
              key={tile.id}
              onClick={() => onSelect(tile)}
              className={cn(
                "group relative overflow-hidden rounded-xl border bg-[rgba(255,255,255,.02)] text-left transition cursor-pointer",
                isSelected
                  ? "border-[var(--color-gold-500)] ring-2 ring-[rgba(198,154,78,.4)]"
                  : "border-[rgba(255,255,255,.1)] hover:border-[rgba(255,255,255,.3)]"
              )}
            >
              <div className="relative aspect-square bg-[#111418]">
                {tile.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={tile.imageUrl}
                    alt={tile.name}
                    className="h-full w-full object-cover transition group-hover:scale-105"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-[var(--ink-faint)] text-xs">
                    Нет фото
                  </div>
                )}
                {isSelected && (
                  <div className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-gold-500)] text-[#0a0d12]">
                    <Check size={16} />
                  </div>
                )}
              </div>
              {!compact && (
                <div className="p-2.5">
                  <div className="truncate text-sm font-semibold">{tile.name}</div>
                  <div className="mt-0.5 text-[11px] text-[var(--ink-mute)]">
                    {tile.collection || ""}{tile.dimensions ? ` · ${tile.dimensions}` : ""}
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>
      {filtered.length === 0 && (
        <div className="text-center py-8 text-[var(--ink-mute)] text-sm">
          Товары не найдены
        </div>
      )}
    </div>
  );
}

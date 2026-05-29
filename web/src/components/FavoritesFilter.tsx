"use client";

import { useState } from "react";
import Link from "next/link";
import FavoriteButton from "@/components/FavoriteButton";

type FavoriteItem = {
  id: string;
  product: {
    id: string;
    name: string;
    slug: string;
    collection: string | null;
    images: { imageUrl: string }[];
  };
};

export default function FavoritesFilter({ favorites }: { favorites: FavoriteItem[] }) {
  const [search, setSearch] = useState("");

  const filtered = favorites.filter((fav) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      fav.product.name.toLowerCase().includes(q) ||
      (fav.product.collection && fav.product.collection.toLowerCase().includes(q))
    );
  });

  return (
    <>
      <input
        type="text"
        placeholder="Поиск по названию или коллекции..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-[400px] px-4 py-2.5 bg-[rgba(255,255,255,.04)] border border-[var(--line-2)] rounded-md text-[var(--ink)] text-[13px] outline-none focus:border-[rgba(255,255,255,.34)] transition-all placeholder:text-[var(--ink-faint)] mb-6"
      />

      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
          {filtered.map((fav) => (
            <div
              key={fav.id}
              className="group relative aspect-[3/3.5] overflow-hidden border border-[var(--line)]"
            >
              <Link href={`/catalog/${fav.product.slug}`}>
                <img
                  src={
                    fav.product.images[0]?.imageUrl ||
                    "/placeholder-tile.svg"
                  }
                  alt={fav.product.name}
                  className="w-full h-full object-cover grayscale-[.2] brightness-[.82] transition-all duration-[1.1s] ease-[var(--ease)] group-hover:scale-[1.06] group-hover:grayscale-0 group-hover:brightness-[.92]"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[rgba(8,10,15,.92)] via-[rgba(8,10,15,.05)] to-transparent" />
                <div className="absolute left-[22px] right-[22px] bottom-[22px] z-[2]">
                  <h3 className="text-xl font-medium font-[family-name:var(--font-serif)]">
                    {fav.product.name}
                  </h3>
                  <div className="text-[11px] tracking-[.22em] uppercase text-[var(--ink-mute)] mt-1">
                    {fav.product.collection || ""}
                  </div>
                </div>
              </Link>
              <div className="absolute top-3.5 right-3.5 z-[3]">
                <FavoriteButton productId={fav.product.id} isFavorited={true} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-[var(--ink-mute)]">
          Ничего не найдено
        </div>
      )}
    </>
  );
}

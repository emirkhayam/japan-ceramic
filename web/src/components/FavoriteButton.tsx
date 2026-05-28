"use client";

import { useState } from "react";

export default function FavoriteButton({
  productId,
  isFavorited: initial,
}: {
  productId: string;
  isFavorited: boolean;
}) {
  const [fav, setFav] = useState(initial);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    const res = await fetch("/api/cabinet/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId }),
    });
    if (res.ok) {
      const data = await res.json();
      setFav(data.favorited);
    }
    setLoading(false);
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`w-12 h-12 border rounded-full flex items-center justify-center text-xl transition-all duration-400 ease-[var(--ease)] ${
        fav
          ? "bg-[var(--ink)] text-[#0a0d12] border-[var(--ink)]"
          : "border-[var(--line-2)] text-[var(--ink-soft)] hover:bg-[var(--ink)] hover:text-[#0a0d12] hover:border-[var(--ink)]"
      }`}
      title={fav ? "Убрать из избранного" : "В избранное"}
    >
      {fav ? "★" : "☆"}
    </button>
  );
}

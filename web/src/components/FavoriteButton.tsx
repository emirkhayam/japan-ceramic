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
      aria-label={fav ? "Убрать из избранного" : "Добавить в избранное"}
      aria-pressed={fav}
      className={`w-12 h-12 border rounded-full flex items-center justify-center transition-all duration-400 ease-[var(--ease)] disabled:opacity-50 ${
        fav
          ? "bg-[var(--ink)] text-[#0a0d12] border-[var(--ink)]"
          : "border-[var(--line-2)] text-[var(--ink-soft)] hover:bg-[var(--ink)] hover:text-[#0a0d12] hover:border-[var(--ink)]"
      }`}
      title={fav ? "Убрать из избранного" : "В избранное"}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill={fav ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3.6l2.6 5.27 5.82.85-4.21 4.1.99 5.78L12 16.9l-5.2 2.73.99-5.78-4.21-4.1 5.82-.85L12 3.6z" />
      </svg>
    </button>
  );
}

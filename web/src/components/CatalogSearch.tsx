"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CatalogSearch({
  initialQuery,
  category,
}: {
  initialQuery: string;
  category: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (value.trim()) params.set("q", value.trim());
    const qs = params.toString();
    router.push(`/catalog${qs ? `?${qs}` : ""}`);
  }

  function handleClear() {
    setValue("");
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    const qs = params.toString();
    router.push(`/catalog${qs ? `?${qs}` : ""}`);
  }

  return (
    <form onSubmit={handleSubmit} className="mb-8" role="search">
      <div className="relative max-w-[480px]">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className="absolute left-[18px] top-1/2 -translate-y-1/2 text-[var(--ink-faint)]"
        >
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.5" />
          <path d="M16 16l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          inputMode="search"
          aria-label="Поиск по каталогу"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Название, цвет, размер, поверхность..."
          className="w-full pl-12 pr-20 py-3.5 bg-[rgba(255,255,255,.04)] border border-[var(--line-2)] rounded-sm text-[var(--ink)] text-sm outline-none focus:border-[rgba(255,255,255,.34)] focus:bg-[rgba(255,255,255,.07)] transition-all placeholder:text-[var(--ink-faint)]"
        />
        {value && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Очистить поиск"
            className="absolute right-14 top-1/2 -translate-y-1/2 text-[var(--ink-faint)] hover:text-[var(--ink)] transition-colors text-lg"
          >
            &times;
          </button>
        )}
        <button
          type="submit"
          className="absolute right-[4px] top-1/2 -translate-y-1/2 px-4 py-2 text-[12px] font-medium tracking-[.06em] uppercase text-[var(--ink-mute)] hover:text-[var(--ink)] transition-colors"
        >
          Найти
        </button>
      </div>
    </form>
  );
}

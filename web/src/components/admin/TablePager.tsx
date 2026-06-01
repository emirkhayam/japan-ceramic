"use client";

// Клиентская пагинация для админ-таблиц (данные уже на руках — режем на странице,
// чтобы не рендерить тысячи строк в DOM). Кнопочная, в отличие от ссылочной Pagination.
export default function TablePager({
  page,
  pageCount,
  onPage,
}: {
  page: number;
  pageCount: number;
  onPage: (n: number) => void;
}) {
  if (pageCount <= 1) return null;

  const list: (number | "…")[] = (() => {
    if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
    const keep = [...new Set([1, 2, page - 1, page, page + 1, pageCount - 1, pageCount])]
      .filter((n) => n >= 1 && n <= pageCount)
      .sort((a, b) => a - b);
    const out: (number | "…")[] = [];
    let prev = 0;
    for (const n of keep) {
      if (n - prev > 1) out.push("…");
      out.push(n);
      prev = n;
    }
    return out;
  })();

  const btn = "h-8 min-w-8 px-2 inline-flex items-center justify-center rounded-sm text-[12.5px] tabular-nums transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default";

  return (
    <nav aria-label="Страницы таблицы" className="mt-6 flex items-center justify-center gap-1.5">
      <button type="button" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Предыдущая страница" className={`${btn} text-[var(--ink-mute)] hover:text-[var(--ink)] hover:bg-[rgba(255,255,255,.05)]`}>←</button>
      {list.map((n, i) =>
        n === "…" ? (
          <span key={`gap-${i}`} className="h-8 w-5 inline-flex items-center justify-center text-[12.5px] text-[var(--ink-faint)]">…</span>
        ) : (
          <button
            key={n}
            type="button"
            onClick={() => onPage(n)}
            aria-label={`Страница ${n}`}
            aria-current={n === page ? "page" : undefined}
            className={`${btn} ${n === page ? "bg-[var(--ink)] text-[#0a0d12] font-medium" : "text-[var(--ink-mute)] hover:text-[var(--ink)] hover:bg-[rgba(255,255,255,.05)]"}`}
          >
            {n}
          </button>
        )
      )}
      <button type="button" onClick={() => onPage(page + 1)} disabled={page >= pageCount} aria-label="Следующая страница" className={`${btn} text-[var(--ink-mute)] hover:text-[var(--ink)] hover:bg-[rgba(255,255,255,.05)]`}>→</button>
    </nav>
  );
}

import Link from "next/link";

// Переиспользуемая пагинация (server component — только ссылки).
// hrefFor(n) строит URL для страницы n; родитель сам решает, какие параметры нести.
export default function Pagination({
  page,
  pageCount,
  hrefFor,
  ariaLabel = "Страницы",
}: {
  page: number;
  pageCount: number;
  hrefFor: (n: number) => string;
  ariaLabel?: string;
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

  const arrow =
    "h-9 px-3 inline-flex items-center rounded-sm text-[13px] text-[var(--ink-mute)] hover:text-[var(--ink)] hover:bg-[rgba(255,255,255,.05)] transition-colors";

  return (
    <nav aria-label={ariaLabel} className="mt-12 flex items-center justify-center gap-1.5">
      {page > 1 && (
        <Link href={hrefFor(page - 1)} rel="prev" aria-label="Предыдущая страница" className={arrow}>←</Link>
      )}
      {list.map((n, i) =>
        n === "…" ? (
          <span key={`gap-${i}`} className="h-9 w-6 inline-flex items-center justify-center text-[13px] text-[var(--ink-faint)]">…</span>
        ) : (
          <Link
            key={n}
            href={hrefFor(n)}
            aria-label={`Страница ${n}`}
            aria-current={n === page ? "page" : undefined}
            className={`h-9 min-w-9 px-2 inline-flex items-center justify-center rounded-sm text-[13px] tabular-nums transition-colors ${
              n === page
                ? "bg-[var(--ink)] text-[#0a0d12] font-medium"
                : "text-[var(--ink-mute)] hover:text-[var(--ink)] hover:bg-[rgba(255,255,255,.05)]"
            }`}
          >
            {n}
          </Link>
        )
      )}
      {page < pageCount && (
        <Link href={hrefFor(page + 1)} rel="next" aria-label="Следующая страница" className={arrow}>→</Link>
      )}
    </nav>
  );
}

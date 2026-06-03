"use client";

import Link from "next/link";
import { useState } from "react";

type Node = { slug: string; name: string; href: string; on: boolean };
type Cat = Node & { subs: Node[] };

const optRow = "group/opt flex items-center gap-2.5 py-1.5 cursor-pointer text-[13.5px]";
const optText = (on: boolean) =>
  `flex-1 transition-colors ${on ? "text-[var(--ink)]" : "text-[var(--ink-soft)] group-hover/opt:text-[var(--ink)]"}`;

function Check({ on }: { on: boolean }) {
  return (
    <span
      className={`w-[17px] h-[17px] shrink-0 rounded-[4px] border flex items-center justify-center transition-colors ${
        on ? "bg-[var(--color-gold-500)] border-[var(--color-gold-500)]" : "border-[var(--line-2)] group-hover/opt:border-[var(--ink-faint)]"
      }`}
    >
      {on && (
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
          <path d="M2.5 6.2l2.3 2.3L9.5 3.5" stroke="#0a0d12" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );
}

// Список категорий с подкатегориями, сворачиваемыми стрелкой.
// По умолчанию группа раскрыта, если выбран сам родитель или любая его подкатегория.
export default function CatalogCategoryFilter({ categories }: { categories: Cat[] }) {
  const [open, setOpen] = useState<Set<string>>(
    () => new Set(categories.filter((c) => c.on || c.subs.some((s) => s.on)).map((c) => c.slug))
  );

  const toggle = (slug: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(slug) ? next.delete(slug) : next.add(slug);
      return next;
    });

  return (
    <div>
      {categories.map((c) => {
        const hasSubs = c.subs.length > 0;
        const isOpen = open.has(c.slug);
        return (
          <div key={c.slug}>
            <div className="flex items-center">
              <Link href={c.href} className={`${optRow} flex-1`}>
                <Check on={c.on} />
                <span className={optText(c.on)}>{c.name}</span>
              </Link>
              {hasSubs && (
                <button
                  type="button"
                  onClick={() => toggle(c.slug)}
                  aria-label={isOpen ? "Свернуть подкатегории" : "Развернуть подкатегории"}
                  aria-expanded={isOpen}
                  className="w-7 h-7 shrink-0 flex items-center justify-center text-[var(--ink-mute)] hover:text-[var(--ink)] transition-colors"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                  >
                    <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )}
            </div>
            {hasSubs && isOpen && (
              <div className="pl-3.5 border-l border-[var(--line)] ml-1">
                {c.subs.map((s) => (
                  <Link key={s.slug} href={s.href} className={optRow}>
                    <Check on={s.on} />
                    <span className={optText(s.on)}>{s.name}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

// Десктоп: липкий сайдбар. Мобильные: кнопка «Фильтры» → drawer.
// Контент фильтров (серверные ссылки) приходит как children.
export default function CatalogFiltersShell({
  children,
  activeCount,
}: {
  children: React.ReactNode;
  activeCount: number;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      {/* Desktop sticky sidebar */}
      <aside className="hidden lg:block lg:w-[230px] shrink-0">
        <div className="lg:sticky lg:top-24">{children}</div>
      </aside>

      {/* Mobile trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="lg:hidden inline-flex items-center gap-2 px-4 py-2.5 mb-5 text-[13px] border border-[var(--line-2)] rounded-sm text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors"
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M2 4h12M4 8h8M6 12h4" /></svg>
        Фильтры{activeCount > 0 ? ` · ${activeCount}` : ""}
      </button>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-[1400]">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-[82%] max-w-[340px] bg-[#0c1018] border-r border-[var(--line)] overflow-y-auto p-6 animate-[drawer-in_.3s_ease]">
            <div className="flex items-center justify-between mb-6">
              <span className="text-[13px] font-semibold tracking-[.2em] uppercase text-[var(--ink-mute)]">Фильтры</span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Закрыть" className="w-8 h-8 flex items-center justify-center text-2xl font-extralight text-[var(--ink-soft)]">×</button>
            </div>
            <div onClick={() => setOpen(false)}>{children}</div>
          </div>
          <style>{`@keyframes drawer-in{from{transform:translateX(-100%)}to{transform:translateX(0)}}`}</style>
        </div>
      )}
    </>
  );
}

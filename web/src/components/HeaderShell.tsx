"use client";

import { useEffect, useRef, useState } from "react";

export default function HeaderShell({
  transparent,
  children,
}: {
  transparent?: boolean;
  children: React.ReactNode;
}) {
  const [scrolled, setScrolled] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

  // Слушаем скролл всегда (не только на прозрачной шапке): по нему навбар
  // сжимается — уменьшаются вертикальные отступы и размер пунктов меню.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Публикуем фактическую высоту шапки в CSS-переменную, чтобы sticky-элементы
  // (напр. шапка чата визуализатора) прижимались точно под неё в любом состоянии
  // и на любом брейкпоинте. ResizeObserver ловит и плавное сжатие при скролле.
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const apply = () =>
      document.documentElement.style.setProperty(
        "--site-header-h",
        `${el.offsetHeight}px`,
      );
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const showBg = !transparent || scrolled;

  return (
    <header
      ref={headerRef}
      data-scrolled={scrolled ? "true" : "false"}
      className="site-header fixed top-0 left-0 right-0 z-[var(--z-header)] transition-all duration-500"
      style={{
        background: showBg ? "rgba(8,10,15,.82)" : "transparent",
        backdropFilter: showBg ? "blur(18px)" : "none",
        borderBottom: showBg ? "1px solid var(--line)" : "1px solid transparent",
      }}
    >
      <div className="site-header-inner flex items-center justify-between max-w-[1320px] mx-auto px-10">
        {children}
      </div>
    </header>
  );
}

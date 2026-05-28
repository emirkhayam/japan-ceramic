"use client";

import { useEffect, useState } from "react";

export default function HeaderShell({
  transparent,
  children,
}: {
  transparent?: boolean;
  children: React.ReactNode;
}) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!transparent) return;
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [transparent]);

  const showBg = !transparent || scrolled;

  return (
    <header
      className="fixed top-0 left-0 right-0 z-[1000] transition-all duration-500"
      style={{
        background: showBg ? "rgba(8,10,15,.82)" : "transparent",
        backdropFilter: showBg ? "blur(18px)" : "none",
        borderBottom: showBg ? "1px solid var(--line)" : "1px solid transparent",
      }}
    >
      <div className="flex items-center justify-between max-w-[1320px] mx-auto px-10 py-4">
        {children}
      </div>
    </header>
  );
}

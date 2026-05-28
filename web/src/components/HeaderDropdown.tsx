"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";

export default function HeaderDropdown() {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  const close = useCallback(() => {
    setVisible(false);
    timeout.current = setTimeout(() => setOpen(false), 220);
  }, []);

  const toggle = useCallback(() => {
    if (open) {
      close();
    } else {
      clearTimeout(timeout.current);
      setOpen(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    }
  }, [open, close]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEsc);
      clearTimeout(timeout.current);
    };
  }, [close]);

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        onClick={toggle}
        className="group flex items-center gap-2 text-[12px] tracking-[.08em] uppercase font-medium
          px-4 py-2 rounded-sm cursor-pointer
          border border-[var(--line-2)]
          text-[var(--ink-soft)]
          hover:text-[var(--ink)] hover:border-[rgba(255,255,255,.28)]
          active:scale-[.97]
          transition-all duration-200"
      >
        <svg
          width="15" height="15" viewBox="0 0 15 15" fill="none"
          stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"
          className="opacity-50 group-hover:opacity-80 transition-opacity duration-200"
        >
          <circle cx="7.5" cy="7.5" r="6" />
          <path d="M4.5 6.2L7.5 9l3-2.8" />
        </svg>
        Связаться
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="absolute right-0 top-full mt-3 w-[220px] origin-top-right"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0) scale(1)" : "translateY(-6px) scale(.97)",
            transition: "opacity .22s cubic-bezier(.22,.61,.36,1), transform .22s cubic-bezier(.22,.61,.36,1)",
          }}
        >
          {/* Glass panel */}
          <div
            className="overflow-hidden rounded-lg"
            style={{
              background: "rgba(10,13,18,.88)",
              backdropFilter: "blur(24px) saturate(1.4)",
              border: "1px solid rgba(255,255,255,.1)",
              boxShadow: "0 16px 48px -8px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.04) inset",
            }}
          >
            {/* Subtle top shine */}
            <div
              className="h-px w-full"
              style={{
                background: "linear-gradient(90deg, transparent 10%, rgba(255,255,255,.12) 50%, transparent 90%)",
              }}
            />

            <div className="p-1.5">
              {/* CTA — primary */}
              <Link
                href="/#contacts"
                onClick={close}
                className="group/item flex items-center gap-3 px-3.5 py-3 rounded-md cursor-pointer
                  hover:bg-[rgba(198,154,78,.08)]
                  transition-all duration-200"
              >
                <div
                  className="flex items-center justify-center w-8 h-8 rounded-md shrink-0
                    bg-[rgba(198,154,78,.1)] text-[var(--color-gold-400)]
                    group-hover/item:bg-[rgba(198,154,78,.18)]
                    transition-colors duration-200"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1.5" y="3" width="13" height="10" rx="2" />
                    <path d="M1.5 5.5L8 9.5l6.5-4" />
                  </svg>
                </div>
                <div>
                  <div className="text-[13px] font-medium text-[var(--ink)] leading-tight">
                    Подать заявку
                  </div>
                  <div className="text-[10px] text-[var(--ink-faint)] tracking-[.02em] mt-0.5">
                    Получить консультацию
                  </div>
                </div>
              </Link>

              {/* Divider */}
              <div className="mx-3 my-0.5 h-px bg-[rgba(255,255,255,.06)]" />

              {/* Login — secondary */}
              <Link
                href="/auth/login"
                onClick={close}
                className="group/item flex items-center gap-3 px-3.5 py-3 rounded-md cursor-pointer
                  hover:bg-[rgba(255,255,255,.05)]
                  transition-all duration-200"
              >
                <div
                  className="flex items-center justify-center w-8 h-8 rounded-md shrink-0
                    bg-[rgba(255,255,255,.04)] text-[var(--ink-mute)]
                    group-hover/item:bg-[rgba(255,255,255,.07)] group-hover/item:text-[var(--ink-soft)]
                    transition-colors duration-200"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="8" cy="5.5" r="2.5" />
                    <path d="M3 14c0-2.8 2.2-4.5 5-4.5s5 1.7 5 4.5" />
                  </svg>
                </div>
                <div>
                  <div className="text-[13px] text-[var(--ink-soft)] group-hover/item:text-[var(--ink)] leading-tight transition-colors duration-200">
                    Войти
                  </div>
                  <div className="text-[10px] text-[var(--ink-faint)] tracking-[.02em] mt-0.5">
                    Для дизайнеров
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

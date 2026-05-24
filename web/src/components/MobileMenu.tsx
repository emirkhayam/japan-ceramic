"use client";

import { useState } from "react";
import Link from "next/link";

const navItems = [
  { label: "Каталог", href: "/catalog" },
  { label: "Коллекции", href: "/#atmospheres" },
  { label: "AI-визуализация", href: "/visualize" },
  { label: "О компании", href: "/#brand" },
  { label: "Шоурум", href: "/#brand" },
  { label: "Контакты", href: "/#contacts" },
];

export default function MobileMenu({
  isAuthed,
  userName,
  isAdmin,
}: {
  isAuthed: boolean;
  userName: string | null;
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <div className="md:hidden">
      <button
        aria-label="Меню"
        onClick={() => setOpen(true)}
        className="flex flex-col gap-[5px] w-10 h-10 items-center justify-center border border-[var(--line-2)] rounded-sm"
      >
        <span className="w-[18px] h-[1.5px] bg-[var(--ink)]" />
        <span className="w-[18px] h-[1.5px] bg-[var(--ink)]" />
        <span className="w-[18px] h-[1.5px] bg-[var(--ink)]" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[1500] bg-[rgba(8,10,15,.98)] backdrop-blur-xl flex flex-col p-8">
          <div className="flex justify-between items-center mb-6">
            <span className="font-light text-lg tracking-[.26em]">
              JAPAN <span className="text-[var(--ink-mute)]">CERAMIC</span>
            </span>
            <button
              aria-label="Закрыть"
              onClick={close}
              className="w-10 h-10 flex items-center justify-center text-3xl font-extralight text-[var(--ink-soft)]"
            >
              &times;
            </button>
          </div>

          <nav className="flex flex-col">
            {navItems.map((it) => (
              <Link
                key={it.label}
                href={it.href}
                onClick={close}
                className="text-2xl font-extralight py-3.5 border-b border-[var(--line)] text-[var(--ink)]"
              >
                {it.label}
              </Link>
            ))}
          </nav>

          <div className="mt-auto flex flex-col gap-3 pt-8">
            {isAuthed ? (
              <>
                {isAdmin && (
                  <Link href="/admin" onClick={close} className="btn-ghost w-full">
                    Админ-панель
                  </Link>
                )}
                <Link href="/cabinet" onClick={close} className="btn-ghost w-full">
                  Кабинет{userName ? ` · ${userName}` : ""}
                </Link>
                <a href="/api/auth/logout" className="text-center py-3 text-[var(--ink-faint)]">
                  Выйти
                </a>
              </>
            ) : (
              <Link href="/auth/login" onClick={close} className="btn-gold w-full">
                Войти
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

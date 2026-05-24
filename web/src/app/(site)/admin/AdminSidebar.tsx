"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/admin", label: "Дашборд", exact: true, icon: "▦" },
  { href: "/admin/products", label: "Товары", icon: "▤" },
  { href: "/admin/categories", label: "Категории", icon: "❑" },
  { href: "/admin/leads", label: "Заявки", icon: "✉" },
  { href: "/admin/users", label: "Пользователи", icon: "◍" },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  return (
    <aside className="md:w-[228px] shrink-0">
      <div className="md:sticky md:top-[92px]">
        <div className="text-[11px] font-semibold tracking-[.28em] uppercase text-[var(--ink-mute)] px-3 mb-4 hidden md:block">
          Админ-панель
        </div>
        <nav className="flex md:flex-col gap-1.5 overflow-x-auto pb-2 md:pb-0">
          {items.map((it) => {
            const active = isActive(it.href, it.exact);
            return (
              <Link
                key={it.href}
                href={it.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-md text-[14px] whitespace-nowrap transition-all ${
                  active
                    ? "bg-[var(--color-gold-500)] text-[#0a0d12] font-medium"
                    : "text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[rgba(255,255,255,.05)]"
                }`}
              >
                <span className="text-[15px] opacity-80">{it.icon}</span>
                {it.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden md:flex flex-col gap-1 mt-6 pt-5 border-t border-[var(--line)]">
          <Link
            href="/"
            className="px-3.5 py-2.5 rounded-md text-[13px] text-[var(--ink-mute)] hover:text-[var(--ink)] hover:bg-[rgba(255,255,255,.04)] transition-all"
          >
            ← На сайт
          </Link>
          <a
            href="/api/auth/logout"
            className="px-3.5 py-2.5 rounded-md text-[13px] text-[var(--ink-faint)] hover:text-[#e88] hover:bg-[rgba(255,255,255,.04)] transition-all"
          >
            Выйти
          </a>
        </div>
      </div>
    </aside>
  );
}

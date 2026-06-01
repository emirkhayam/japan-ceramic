"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";
import LogoutButton from "@/components/LogoutButton";

function IconDashboard({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="1" width="6.5" height="6.5" rx="1.5" />
      <rect x="10.5" y="1" width="6.5" height="3" rx="1" />
      <rect x="10.5" y="7" width="6.5" height="6.5" rx="1.5" />
      <rect x="1" y="10.5" width="6.5" height="3" rx="1" />
    </svg>
  );
}

function IconProducts({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 5.5L9 2l7 3.5L9 9 2 5.5z" />
      <path d="M2 9l7 3.5L16 9" />
      <path d="M2 12.5L9 16l7-3.5" />
    </svg>
  );
}

function IconCategories({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1" />
      <rect x="11" y="1.5" width="5.5" height="5.5" rx="1" />
      <rect x="1.5" y="11" width="5.5" height="5.5" rx="1" />
      <rect x="11" y="11" width="5.5" height="5.5" rx="1" />
    </svg>
  );
}

function IconLeads({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="3" width="15" height="12" rx="1.5" />
      <path d="M1.5 5.5L9 10l7.5-4.5" />
    </svg>
  );
}

function IconUsers({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="5.5" r="3" />
      <path d="M2.5 16c0-3.5 2.9-5.5 6.5-5.5s6.5 2 6.5 5.5" />
    </svg>
  );
}

function IconBack({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 8H3M7 4l-4 4 4 4" />
    </svg>
  );
}

function IconLogout({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3M11 11l3-3-3-3M14 8H6" />
    </svg>
  );
}

function IconCollections({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="14" height="10" rx="1.5" />
      <path d="M4.5 14.5h9M6 17h6" />
    </svg>
  );
}

function IconSettings({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="9" r="2.6" />
      <path d="M9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2M3.7 3.7l1.4 1.4M12.9 12.9l1.4 1.4M14.3 3.7l-1.4 1.4M5.1 12.9l-1.4 1.4" />
    </svg>
  );
}

function IconVisualize({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="14" height="11" rx="1.5" />
      <path d="M2 11l4-3.5 3 2.5 3-3 4 3.5" />
      <circle cx="6.5" cy="6.5" r="1.1" />
    </svg>
  );
}

function IconPortfolio({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="4.5" width="15" height="10" rx="1.5" />
      <path d="M6 4.5V3.2A1.2 1.2 0 017.2 2h3.6A1.2 1.2 0 0112 3.2v1.3" />
    </svg>
  );
}

const items = [
  { href: "/admin", label: "Дашборд", exact: true, Icon: IconDashboard },
  { href: "/admin/products", label: "Товары", Icon: IconProducts },
  { href: "/admin/collections", label: "Коллекции", Icon: IconCollections },
  { href: "/admin/categories", label: "Категории", Icon: IconCategories },
  { href: "/admin/leads", label: "Заявки", Icon: IconLeads },
  { href: "/admin/users", label: "Пользователи", Icon: IconUsers },
  { href: "/admin/visualizations", label: "AI-визуализации", Icon: IconVisualize },
  { href: "/admin/portfolio", label: "Объекты", Icon: IconPortfolio },
  { href: "/admin/settings", label: "Контакты сайта", Icon: IconSettings },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  return (
    <aside className="md:w-[220px] shrink-0">
      <div className="md:sticky md:top-[32px]">
        <Link href="/" className="hidden md:flex mb-8 px-3" aria-label="Japan Ceramic — на главную">
          <BrandLogo height={24} wordSize={12} />
        </Link>

        <div className="text-[10px] font-medium tracking-[.3em] uppercase text-[var(--ink-faint)] px-3 mb-3 hidden md:block">
          Управление
        </div>
        <nav className="flex md:flex-col gap-0.5 overflow-x-auto pb-2 md:pb-0">
          {items.map((it) => {
            const active = isActive(it.href, it.exact);
            return (
              <Link
                key={it.href}
                href={it.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] whitespace-nowrap transition-all duration-200 cursor-pointer ${
                  active
                    ? "bg-[rgba(255,255,255,.08)] text-[var(--ink)] font-medium border border-[var(--line-2)]"
                    : "text-[var(--ink-mute)] hover:text-[var(--ink-soft)] hover:bg-[rgba(255,255,255,.03)] border border-transparent"
                }`}
              >
                <it.Icon className={active ? "opacity-100" : "opacity-50"} />
                {it.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden md:flex flex-col gap-0.5 mt-8 pt-6 border-t border-[var(--line)]">
          <a
            href="/"
            className="flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] text-[var(--ink-mute)] hover:text-[var(--ink-soft)] hover:bg-[rgba(255,255,255,.03)] transition-all duration-200 cursor-pointer"
          >
            <IconBack className="opacity-50" />
            На сайт
          </a>
          <LogoutButton className="flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] text-[var(--ink-faint)] hover:text-red-400/80 hover:bg-[rgba(255,255,255,.03)] transition-all duration-200 cursor-pointer w-full text-left disabled:opacity-50">
            <IconLogout className="opacity-40" />
            Выйти
          </LogoutButton>
        </div>
      </div>
    </aside>
  );
}

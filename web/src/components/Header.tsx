import Link from "next/link";
import { getSession } from "@/lib/auth";
import MobileMenu from "./MobileMenu";
import HeaderShell from "./HeaderShell";
import HeaderDropdown from "./HeaderDropdown";

export default async function Header({ transparent }: { transparent?: boolean }) {
  const user = await getSession();

  return (
    <HeaderShell transparent={transparent}>
      <Link href="/" className="flex flex-col leading-[.92]">
        <b className="font-light text-xl tracking-[.26em]">JAPAN</b>
        <span className="font-semibold text-[8.5px] tracking-[.46em] text-[var(--ink-mute)] pl-[2px]">
          CERAMIC
        </span>
      </Link>

      <nav className="hidden md:flex gap-[38px]">
        {[
          { label: "Каталог", href: "/catalog" },
          { label: "AI-визуализация", href: "/visualize" },
          { label: "О компании", href: "/about" },
          { label: "Контакты", href: "/#contacts" },
        ].map((item) => (
          <Link key={item.label} href={item.href} className="text-[13px] font-normal text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors relative group py-1.5">
            {item.label}
            <span className="absolute left-0 bottom-0 w-0 h-px bg-[var(--ink)] transition-all duration-400 group-hover:w-full" />
          </Link>
        ))}
      </nav>

      <div className="hidden md:flex items-center gap-3">
        {user ? (
          <>
            {user.role === "admin" && (
              <Link href="/admin" className="text-[12px] px-3 py-1.5 border border-[var(--line-2)] rounded-sm text-[var(--ink-soft)] hover:text-[var(--ink)] hover:border-[var(--ink-faint)] transition-colors">
                Админка
              </Link>
            )}
            <Link href="/cabinet" className="text-[12px] px-3 py-1.5 border border-[var(--line-2)] rounded-sm text-[var(--ink-soft)] hover:text-[var(--ink)] hover:border-[var(--ink-faint)] transition-colors">
              Кабинет
            </Link>

          </>
        ) : (
          <HeaderDropdown />
        )}
      </div>

      <MobileMenu
        isAuthed={!!user}
        userName={user?.fullName ?? null}
        isAdmin={user?.role === "admin"}
      />
    </HeaderShell>
  );
}

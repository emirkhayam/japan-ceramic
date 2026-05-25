import Link from "next/link";
import { getSession } from "@/lib/auth";
import MobileMenu from "./MobileMenu";

export default async function Header() {
  const user = await getSession();

  return (
    <header className="fixed top-0 left-0 right-0 z-[1000] bg-[rgba(8,10,15,.82)] backdrop-blur-[18px] border-b border-[var(--line)]">
      <div className="flex items-center justify-between max-w-[1320px] mx-auto px-10 py-4">
        {/* Полный переход (<a>), не SPA: лендинг рендерится из статического HTML с инлайн-скриптом (reveal-анимации), который при мягкой навигации не выполняется и страница остаётся пустой */}
        <a href="/" className="flex flex-col leading-[.92]">
          <b className="font-light text-xl tracking-[.26em]">JAPAN</b>
          <span className="font-semibold text-[8.5px] tracking-[.46em] text-[var(--ink-mute)] pl-[2px]">
            CERAMIC
          </span>
        </a>

        <nav className="hidden md:flex gap-[38px]">
          {[
            { label: "Каталог", href: "/catalog" },
            { label: "Коллекции", href: "/#atmospheres" },
            { label: "AI-визуализация", href: "/visualize" },
            { label: "О компании", href: "/#brand" },
            { label: "Шоурум", href: "/#brand" },
            { label: "Контакты", href: "/#contacts" },
          ].map((item) => {
            const cls = "text-[13px] font-normal text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors relative group py-1.5";
            const underline = <span className="absolute left-0 bottom-0 w-0 h-px bg-[var(--ink)] transition-all duration-400 group-hover:w-full" />;
            // Якоря лендинга (/#...) — полный переход, иначе reveal-анимации не запускаются и блоки остаются невидимыми
            return item.href.startsWith("/#") ? (
              <a key={item.label} href={item.href} className={cls}>
                {item.label}
                {underline}
              </a>
            ) : (
              <Link key={item.label} href={item.href} className={cls}>
                {item.label}
                {underline}
              </Link>
            );
          })}
          {user && (
            <Link href="/cabinet" className="text-[13px] font-normal text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors relative group py-1.5">
              Кабинет
              <span className="absolute left-0 bottom-0 w-0 h-px bg-[var(--ink)] transition-all duration-400 group-hover:w-full" />
            </Link>
          )}
          {user?.role === "admin" && (
            <Link href="/admin" className="text-[13px] font-normal text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors relative group py-1.5">
              Админка
              <span className="absolute left-0 bottom-0 w-0 h-px bg-[var(--ink)] transition-all duration-400 group-hover:w-full" />
            </Link>
          )}
        </nav>

        <div className="hidden md:flex items-center gap-3.5">
          {user ? (
            <>
              <Link href="/cabinet" className="text-[13px] text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
                {user.fullName}
              </Link>
              <a href="/api/auth/logout" className="text-[13px] text-[var(--ink-faint)] hover:text-[var(--ink-soft)] transition-colors">
                Выйти
              </a>
            </>
          ) : (
            <Link href="/auth/login" className="text-[13px] text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
              Войти
            </Link>
          )}
        </div>

        <MobileMenu
          isAuthed={!!user}
          userName={user?.fullName ?? null}
          isAdmin={user?.role === "admin"}
        />
      </div>
    </header>
  );
}

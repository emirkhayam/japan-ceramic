import Link from "next/link";
import { getSession } from "@/lib/auth";

export default async function Header() {
  const user = await getSession();

  return (
    <header className="fixed top-0 left-0 right-0 z-[1000] bg-[rgba(8,10,15,.82)] backdrop-blur-[18px] border-b border-[var(--line)]">
      <div className="flex items-center justify-between max-w-[1320px] mx-auto px-10 py-4">
        <Link href="/" className="flex flex-col leading-[.92]">
          <b className="font-light text-xl tracking-[.26em]">JAPAN</b>
          <span className="font-semibold text-[8.5px] tracking-[.46em] text-[var(--ink-mute)] pl-[2px]">
            CERAMIC
          </span>
        </Link>

        <nav className="hidden md:flex gap-[38px]">
          <Link href="/" className="text-[13px] font-normal text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors relative group py-1.5">
            Главная
            <span className="absolute left-0 bottom-0 w-0 h-px bg-[var(--ink)] transition-all duration-400 group-hover:w-full" />
          </Link>
          <Link href="/catalog" className="text-[13px] font-normal text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors relative group py-1.5">
            Каталог
            <span className="absolute left-0 bottom-0 w-0 h-px bg-[var(--ink)] transition-all duration-400 group-hover:w-full" />
          </Link>
          <Link href="/visualize" className="text-[13px] font-normal text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors relative group py-1.5">
            AI-Визуализация
            <span className="absolute left-0 bottom-0 w-0 h-px bg-[var(--ink)] transition-all duration-400 group-hover:w-full" />
          </Link>
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

        <div className="flex items-center gap-3.5">
          {user ? (
            <>
              <Link href="/cabinet" className="text-[13px] text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
                {user.fullName}
              </Link>
              <Link href="/api/auth/logout" className="text-[13px] text-[var(--ink-faint)] hover:text-[var(--ink-soft)] transition-colors">
                Выйти
              </Link>
            </>
          ) : (
            <Link href="/auth/login" className="text-[13px] text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
              Войти
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

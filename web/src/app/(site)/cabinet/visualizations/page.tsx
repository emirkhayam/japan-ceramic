import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const SURFACE_LABEL: Record<string, string> = {
  mask: "Выделение",
  floor: "Пол",
  wall: "Стена",
};

export default async function MyVisualizationsPage() {
  const user = await getSession();
  if (!user) redirect("/auth/login");

  const items = await prisma.savedVisualization.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <section className="py-20">
      <div className="max-w-[1320px] mx-auto px-10">
        <Link
          href="/cabinet"
          className="text-[13px] text-[var(--ink-mute)] hover:text-[var(--ink)] transition-colors flex items-center gap-2 mb-5"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M15 8H1M6 3L1 8l5 5" stroke="currentColor" strokeWidth="1.4" /></svg>
          Кабинет
        </Link>

        <div className="mb-12">
          <div className="flex items-center gap-3.5 text-[11px] font-semibold tracking-[.34em] uppercase text-[var(--ink-mute)] mb-5">
            <span className="w-[34px] h-px bg-[var(--line-2)]" />
            Личный кабинет
          </div>
          <h2 className="text-[clamp(34px,4.3vw,58px)] font-extralight">Мои визуализации</h2>
          <p className="mt-3 text-[14px] text-[var(--ink-mute)]">Все ваши AI-визуализации сохраняются здесь автоматически.</p>
        </div>

        {items.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 items-start">
            {items.map((v) => (
              <a
                key={v.id}
                href={v.imageUrl}
                target="_blank"
                rel="noreferrer"
                className="group block overflow-hidden rounded-lg border border-[var(--line)] hover:border-[var(--line-2)] transition-colors"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={v.imageUrl}
                  alt={v.tileName || "Визуализация"}
                  loading="lazy"
                  className="block w-full h-auto"
                />
                <div className="p-3.5">
                  <div className="text-[13.5px] text-[var(--ink-soft)] line-clamp-1">{v.tileName || "Визуализация"}</div>
                  <div className="text-[11px] text-[var(--ink-faint)] mt-1 flex items-center gap-2">
                    {v.surface && <span>{SURFACE_LABEL[v.surface] || v.surface}</span>}
                    {v.surface && <span>·</span>}
                    <span>
                      {new Date(v.createdAt).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" })}
                    </span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div className="text-center py-24 text-[var(--ink-mute)]">
            <p>Здесь появятся ваши визуализации</p>
            <Link
              href="/visualize"
              className="inline-block mt-4 px-6 py-3 text-[12.5px] font-medium border border-[var(--line-2)] rounded-sm hover:bg-[rgba(255,255,255,.05)] transition-all"
            >
              Открыть визуализатор
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

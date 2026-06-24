import Link from "next/link";
import { redirect } from "next/navigation";
import { FolderOpen, Heart, FolderPlus, Sparkles } from "lucide-react";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import CreateProjectForm from "@/components/CreateProjectForm";
import LogoutButton from "@/components/LogoutButton";

export default async function CabinetPage() {
  const user = await getSession();
  if (!user) redirect("/auth/login");

  const projects = await prisma.designerProject.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { items: true } } },
  });

  const favCount = await prisma.favorite.count({ where: { userId: user.id } });
  const vizCount = await prisma.savedVisualization.count({ where: { userId: user.id } });

  return (
    <section className="py-20">
      <div className="max-w-[900px] mx-auto px-10">
        {/* Hero */}
        <div className="mb-10 flex items-start justify-between">
          <div>
            <div className="text-[10px] font-medium tracking-[.3em] uppercase text-[var(--ink-faint)] mb-3">
              Личный кабинет
            </div>
            <h2 className="text-[clamp(28px,3.2vw,40px)] font-extralight tracking-tight mb-1">
              {user.fullName}
            </h2>
            <p className="text-[14px] text-[var(--ink-mute)]">{user.company || "Дизайнер"}</p>
          </div>
          <LogoutButton className="text-[12px] px-4 py-2 border border-[var(--line)] rounded-md text-[var(--ink-faint)] hover:text-[var(--ink-soft)] hover:border-[var(--line-2)] transition-all duration-200 cursor-pointer mt-2 disabled:opacity-50">
            Выйти
          </LogoutButton>
        </div>

        {/* Stats */}
        <div className="flex gap-3 mb-10">
          <div className="px-5 py-5 bg-[rgba(255,255,255,.045)] border border-[var(--line-2)] rounded-xl flex-1 max-w-[190px]">
            <FolderOpen size={18} strokeWidth={1.6} className="text-[var(--color-gold-400)] mb-3" />
            <div className="tabular-nums text-[32px] font-medium leading-none tracking-tight">
              {projects.length}
            </div>
            <div className="text-[11px] text-[var(--ink-mute)] mt-2 tracking-[.06em] uppercase font-medium">
              Проектов
            </div>
          </div>
          <div className="px-5 py-5 bg-[rgba(255,255,255,.045)] border border-[var(--line-2)] rounded-xl flex-1 max-w-[190px]">
            <Heart size={18} strokeWidth={1.6} className="text-[var(--color-gold-400)] mb-3" />
            <div className="tabular-nums text-[32px] font-medium leading-none tracking-tight">
              {favCount}
            </div>
            <div className="text-[11px] text-[var(--ink-mute)] mt-2 tracking-[.06em] uppercase font-medium">
              В избранном
            </div>
          </div>
          <Link href="/cabinet/visualizations" className="px-5 py-5 bg-[rgba(255,255,255,.045)] border border-[var(--line-2)] rounded-xl flex-1 max-w-[190px] hover:border-[rgba(255,255,255,.32)] transition-colors">
            <Sparkles size={18} strokeWidth={1.6} className="text-[var(--color-gold-400)] mb-3" />
            <div className="tabular-nums text-[32px] font-medium leading-none tracking-tight">
              {vizCount}
            </div>
            <div className="text-[11px] text-[var(--ink-mute)] mt-2 tracking-[.06em] uppercase font-medium">
              Визуализаций
            </div>
          </Link>
        </div>

        {/* Projects */}
        <div className="mb-10">
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-[20px] font-light tracking-tight">Мои проекты</h3>
            <CreateProjectForm />
          </div>

          {projects.length > 0 ? (
            <div className="grid gap-2">
              {projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/cabinet/projects/${project.id}`}
                  className="group flex justify-between items-center px-5 py-4 border border-[var(--line)] rounded-lg hover:bg-[rgba(255,255,255,.03)] hover:border-[var(--line-2)] transition-all duration-200 cursor-pointer"
                >
                  <div>
                    <div className="text-[15px] font-normal">{project.name}</div>
                    <div className="text-[11px] tracking-[.08em] uppercase text-[var(--ink-faint)] mt-0.5">
                      {project.status} · {project._count.items} товаров
                    </div>
                  </div>
                  <svg className="text-[var(--ink-faint)] group-hover:translate-x-1 group-hover:text-[var(--ink-mute)] transition-all duration-200" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 4l4 4-4 4" />
                  </svg>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center text-center gap-3 py-12 border border-dashed border-[var(--line-2)] rounded-xl">
              <div className="w-11 h-11 rounded-full bg-[rgba(255,255,255,.04)] border border-[var(--line-2)] flex items-center justify-center text-[var(--ink-mute)]">
                <FolderPlus size={20} strokeWidth={1.5} />
              </div>
              <div className="text-[var(--ink-soft)] text-[13.5px]">У вас пока нет проектов</div>
              <div className="text-[var(--ink-faint)] text-[12.5px] max-w-[280px]">Создайте первый, чтобы собирать коллекции плитки под объект.</div>
            </div>
          )}
        </div>

        {/* Favorites link */}
        <div className="flex justify-between items-center pt-6 border-t border-[var(--line)]">
          <h3 className="text-[20px] font-light tracking-tight">Избранное</h3>
          <Link
            href="/cabinet/favorites"
            className="px-5 py-2.5 text-[12px] font-medium border border-[var(--line)] rounded-md text-[var(--ink-soft)] hover:bg-[rgba(255,255,255,.04)] hover:border-[var(--line-2)] transition-all duration-200 cursor-pointer"
          >
            Смотреть всё
          </Link>
        </div>

        {/* My visualizations link */}
        <div className="flex justify-between items-center pt-6 mt-6 border-t border-[var(--line)]">
          <h3 className="text-[20px] font-light tracking-tight">Мои визуализации</h3>
          <Link
            href="/cabinet/visualizations"
            className="px-5 py-2.5 text-[12px] font-medium border border-[var(--line)] rounded-md text-[var(--ink-soft)] hover:bg-[rgba(255,255,255,.04)] hover:border-[var(--line-2)] transition-all duration-200 cursor-pointer"
          >
            Смотреть всё
          </Link>
        </div>
      </div>
    </section>
  );
}

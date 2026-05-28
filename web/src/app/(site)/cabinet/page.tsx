import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import CreateProjectForm from "@/components/CreateProjectForm";

export default async function CabinetPage() {
  const user = await getSession();
  if (!user) redirect("/auth/login");

  const projects = await prisma.designerProject.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { items: true } } },
  });

  const favCount = await prisma.favorite.count({ where: { userId: user.id } });

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
          <a href="/api/auth/logout" className="text-[12px] px-4 py-2 border border-[var(--line)] rounded-md text-[var(--ink-faint)] hover:text-[var(--ink-soft)] hover:border-[var(--line-2)] transition-all duration-200 cursor-pointer mt-2">
            Выйти
          </a>
        </div>

        {/* Stats */}
        <div className="flex gap-3 mb-10">
          <div className="px-5 py-5 bg-[rgba(255,255,255,.02)] border border-[var(--line)] rounded-lg flex-1 max-w-[180px]">
            <div className="tabular-nums text-[32px] font-medium leading-none tracking-tight">
              {projects.length}
            </div>
            <div className="text-[11px] text-[var(--ink-mute)] mt-2 tracking-[.06em] uppercase font-medium">
              Проектов
            </div>
          </div>
          <div className="px-5 py-5 bg-[rgba(255,255,255,.02)] border border-[var(--line)] rounded-lg flex-1 max-w-[180px]">
            <div className="tabular-nums text-[32px] font-medium leading-none tracking-tight">
              {favCount}
            </div>
            <div className="text-[11px] text-[var(--ink-mute)] mt-2 tracking-[.06em] uppercase font-medium">
              В избранном
            </div>
          </div>
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
            <div className="text-[var(--ink-faint)] text-[13px] py-8 text-center border border-dashed border-[var(--line)] rounded-lg">
              У вас пока нет проектов. Создайте первый, чтобы собирать коллекции.
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
      </div>
    </section>
  );
}

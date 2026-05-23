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
      <div className="max-w-[1320px] mx-auto px-10">
        {/* Hero */}
        <div className="mb-12">
          <div className="flex items-center gap-3.5 text-[11px] font-semibold tracking-[.34em] uppercase text-[var(--ink-mute)] mb-5">
            <span className="w-[34px] h-px bg-[var(--line-2)]" />
            Личный кабинет
          </div>
          <h2 className="text-[clamp(32px,3.6vw,48px)] font-extralight mb-2">
            {user.fullName}
          </h2>
          <p className="text-[15px] text-[var(--ink-mute)]">{user.company || "Дизайнер"}</p>
        </div>

        {/* Stats */}
        <div className="flex gap-6 mb-12">
          <div className="px-7 py-6 border border-[var(--line)] rounded-sm flex-1 max-w-[200px]">
            <div className="font-[family-name:var(--font-cormorant)] text-4xl font-medium leading-none">
              {projects.length}
            </div>
            <div className="text-[11px] text-[var(--ink-mute)] mt-1.5 tracking-[.08em] uppercase">
              Проектов
            </div>
          </div>
          <div className="px-7 py-6 border border-[var(--line)] rounded-sm flex-1 max-w-[200px]">
            <div className="font-[family-name:var(--font-cormorant)] text-4xl font-medium leading-none">
              {favCount}
            </div>
            <div className="text-[11px] text-[var(--ink-mute)] mt-1.5 tracking-[.08em] uppercase">
              В избранном
            </div>
          </div>
        </div>

        {/* Projects */}
        <div className="mb-12">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-[22px] font-light">Мои проекты</h3>
            <CreateProjectForm />
          </div>

          {projects.length > 0 ? (
            <div className="grid gap-3">
              {projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/cabinet/projects/${project.id}`}
                  className="group flex justify-between items-center px-[26px] py-[22px] border border-[var(--line)] rounded-sm hover:bg-[rgba(255,255,255,.03)] hover:border-[var(--line-2)] transition-all duration-400"
                >
                  <div>
                    <div className="text-base font-normal">{project.name}</div>
                    <div className="text-[11px] tracking-[.14em] uppercase text-[var(--ink-mute)]">
                      {project.status} · {project._count.items} товаров
                    </div>
                  </div>
                  <span className="text-[var(--ink-faint)] group-hover:translate-x-1 group-hover:text-[var(--ink)] transition-all duration-300">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M1 8h14M10 3l5 5-5 5" stroke="currentColor" strokeWidth="1.4" />
                    </svg>
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-[var(--ink-mute)] text-sm py-8">
              У вас пока нет проектов. Создайте первый, чтобы собирать коллекции керамогранита.
            </div>
          )}
        </div>

        {/* Favorites link */}
        <div className="flex justify-between items-center">
          <h3 className="text-[22px] font-light">Избранное</h3>
          <Link
            href="/cabinet/favorites"
            className="px-6 py-3 text-[12.5px] font-medium border border-[var(--line-2)] rounded-sm text-[var(--ink)] hover:bg-[rgba(255,255,255,.05)] hover:border-[rgba(255,255,255,.34)] transition-all duration-400"
          >
            Смотреть всё
          </Link>
        </div>
      </div>
    </section>
  );
}

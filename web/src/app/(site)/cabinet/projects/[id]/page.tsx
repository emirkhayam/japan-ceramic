import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import RemoveItemButton from "@/components/RemoveItemButton";
import NoteEditor from "@/components/NoteEditor";
import ExportProjectButton from "@/components/ExportProjectButton";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSession();
  if (!user) redirect("/auth/login");

  const project = await prisma.designerProject.findUnique({
    where: { id, userId: user.id },
    include: {
      items: {
        include: {
          product: {
            include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } },
          },
        },
      },
    },
  });

  if (!project) notFound();

  return (
    <section className="py-20">
      <div className="max-w-[1320px] mx-auto px-10">
        {/* Header */}
        <Link href="/cabinet" className="text-[13px] text-[var(--ink-mute)] hover:text-[var(--ink)] transition-colors flex items-center gap-2 mb-5">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M15 8H1M6 3L1 8l5 5" stroke="currentColor" strokeWidth="1.4" /></svg>
          Мои проекты
        </Link>
        <h2 className="text-[clamp(28px,3vw,42px)] font-extralight mb-2">{project.name}</h2>
        {project.description && (
          <p className="text-sm text-[var(--ink-soft)] mb-3">{project.description}</p>
        )}
        <div className="flex items-center gap-4">
          <span className="inline-block px-3 py-1 text-[11px] tracking-[.14em] uppercase text-[var(--ink-mute)] border border-[var(--line-2)] rounded-sm">
            {project.status}
          </span>
          <ExportProjectButton projectName={project.name} />
        </div>

        {/* Items */}
        <div className="mt-10">
          {project.items.length > 0 ? (
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-left text-[11px] tracking-[.14em] uppercase text-[var(--ink-mute)] font-medium border-b border-[var(--line-2)]">
                  <th className="py-3 w-20"></th>
                  <th className="py-3">Товар</th>
                  <th className="py-3 w-24">Кол-во</th>
                  <th className="py-3">Заметка</th>
                  <th className="py-3 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {project.items.map((item) => (
                  <tr key={item.id} className="border-b border-[var(--line)]">
                    <td className="py-4">
                      {item.product.images[0] && (
                        <img
                          src={item.product.images[0].imageUrl}
                          alt=""
                          className="w-[60px] h-[60px] rounded-sm object-cover border border-[var(--line)] brightness-[.85]"
                        />
                      )}
                    </td>
                    <td className="py-4">
                      <Link href={`/catalog/${item.product.slug}`} className="text-[15px] font-normal hover:text-[var(--accent)] transition-colors">
                        {item.product.name}
                      </Link>
                    </td>
                    <td className="py-4">{item.quantity}</td>
                    <td className="py-4">
                      <NoteEditor projectId={project.id} itemId={item.id} initialNote={item.note} />
                    </td>
                    <td className="py-4 no-print">
                      <RemoveItemButton projectId={project.id} itemId={item.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-16 text-[var(--ink-mute)]">
              В проекте пока нет товаров
            </div>
          )}

          <div className="text-[13px] text-[var(--ink-mute)] mt-8 pt-6 border-t border-[var(--line)]">
            Добавляйте товары из{" "}
            <Link href="/catalog" className="text-[var(--ink-soft)] border-b border-[var(--line-2)] hover:text-[var(--ink)] transition-colors">
              каталога
            </Link>{" "}
            — на странице товара нажмите «+ В проект».
          </div>
        </div>
      </div>
    </section>
  );
}

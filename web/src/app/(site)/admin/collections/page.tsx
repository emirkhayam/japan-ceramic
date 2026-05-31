import Link from "next/link";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/db";
import DeleteCollectionButton from "@/components/admin/DeleteCollectionButton";

export default async function AdminCollectionsPage() {
  await requireAdmin();

  const collections = await prisma.collection.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: { _count: { select: { products: true } } },
  });

  return (
    <div className="pb-12">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-[clamp(22px,2.5vw,30px)] font-extralight tracking-tight">
          Коллекции
          <span className="text-[var(--ink-faint)] text-lg ml-2 font-light">{collections.length}</span>
        </h2>
        <Link
          href="/admin/collections/new"
          className="px-5 py-2.5 text-[12px] font-medium bg-[var(--ink)] text-[#0a0d12] rounded-md hover:bg-white transition-all duration-200 cursor-pointer"
        >
          + Создать коллекцию
        </Link>
      </div>

      {collections.length === 0 ? (
        <div className="text-center py-24 text-[var(--ink-mute)] text-sm border border-dashed border-[var(--line)] rounded-md">
          Коллекций пока нет. Нажмите «Создать коллекцию».
        </div>
      ) : (
        <div className="border border-[var(--line)] rounded-md divide-y divide-[var(--line)] overflow-hidden">
          {collections.map((c) => (
            <div key={c.id} className="flex items-center gap-4 px-4 py-3 hover:bg-[rgba(255,255,255,.02)] transition-colors">
              <div className="w-16 h-12 shrink-0 rounded-sm overflow-hidden bg-[rgba(255,255,255,.04)] flex items-center justify-center">
                {c.coverImageUrl ? (
                  <img src={c.coverImageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[10px] text-[var(--ink-faint)]">нет фото</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Link href={`/admin/collections/${c.id}`} className="text-[14px] text-[var(--ink)] hover:text-white transition-colors truncate">
                    {c.name}
                  </Link>
                  {c.status === "published" ? (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-[rgba(80,200,120,.15)] text-[#a0e8b0] tracking-wide uppercase">Опубл.</span>
                  ) : (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-[rgba(255,255,255,.06)] text-[var(--ink-mute)] tracking-wide uppercase">Черновик</span>
                  )}
                  {c.isNew && <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-[var(--color-gold-500)] text-[#0a0d12] tracking-wide uppercase">Новинка</span>}
                </div>
                <div className="text-[11px] text-[var(--ink-faint)] truncate">/{c.slug} · {c._count.products} товаров</div>
              </div>
              <Link href={`/admin/collections/${c.id}`} className="text-[12px] text-[var(--ink-mute)] hover:text-[var(--ink)] transition-colors shrink-0">
                Редактировать
              </Link>
              <DeleteCollectionButton id={c.id} name={c.name} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

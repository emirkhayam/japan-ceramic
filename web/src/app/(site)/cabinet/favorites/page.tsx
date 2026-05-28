import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import FavoritesFilter from "@/components/FavoritesFilter";

export default async function FavoritesPage() {
  const user = await getSession();
  if (!user) redirect("/auth/login");

  const favorites = await prisma.favorite.findMany({
    where: { userId: user.id },
    include: {
      product: {
        include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const serialized = favorites.map((fav) => ({
    id: fav.id,
    product: {
      id: fav.product.id,
      name: fav.product.name,
      slug: fav.product.slug,
      collection: fav.product.collection ?? null,
      images: fav.product.images.map((img) => ({ imageUrl: img.imageUrl })),
    },
  }));

  return (
    <section className="py-20">
      <div className="max-w-[1320px] mx-auto px-10">
        <div className="mb-12">
          <div className="flex items-center gap-3.5 text-[11px] font-semibold tracking-[.34em] uppercase text-[var(--ink-mute)] mb-5">
            <span className="w-[34px] h-px bg-[var(--line-2)]" />
            Личный кабинет
          </div>
          <h2 className="text-[clamp(34px,4.3vw,58px)] font-extralight">Избранное</h2>
        </div>

        {favorites.length > 0 ? (
          <FavoritesFilter favorites={serialized} />
        ) : (
          <div className="text-center py-24 text-[var(--ink-mute)]">
            <p>Пока ничего не добавлено</p>
            <Link href="/catalog" className="inline-block mt-4 px-6 py-3 text-[12.5px] font-medium border border-[var(--line-2)] rounded-sm hover:bg-[rgba(255,255,255,.05)] transition-all">
              Перейти в каталог
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import FavoriteButton from "@/components/FavoriteButton";

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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
            {favorites.map((fav) => (
              <div key={fav.id} className="group relative aspect-[3/3.5] overflow-hidden border border-[var(--line)]">
                <Link href={`/catalog/${fav.product.slug}`}>
                  <img
                    src={fav.product.images[0]?.imageUrl || "https://images.unsplash.com/photo-1640357897497-599b4fc84f51?q=80&w=800&auto=format&fit=crop"}
                    alt={fav.product.name}
                    className="w-full h-full object-cover grayscale-[.2] brightness-[.82] transition-all duration-[1.1s] ease-[var(--ease)] group-hover:scale-[1.06] group-hover:grayscale-0 group-hover:brightness-[.92]"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[rgba(8,10,15,.92)] via-[rgba(8,10,15,.05)] to-transparent" />
                  <div className="absolute left-[22px] right-[22px] bottom-[22px] z-[2]">
                    <h3 className="text-xl font-light font-[family-name:var(--font-cormorant)]">
                      {fav.product.name}
                    </h3>
                    <div className="text-[11px] tracking-[.22em] uppercase text-[var(--ink-mute)] mt-1">
                      {fav.product.collection || ""}
                    </div>
                  </div>
                </Link>
                <div className="absolute top-3.5 right-3.5 z-[3]">
                  <FavoriteButton productId={fav.product.id} isFavorited={true} />
                </div>
              </div>
            ))}
          </div>
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

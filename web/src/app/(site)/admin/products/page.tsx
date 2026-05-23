import Link from "next/link";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/db";
import DeleteProductButton from "@/components/admin/DeleteProductButton";

export default async function AdminProductsPage() {
  await requireAdmin();

  const products = await prisma.product.findMany({
    include: { category: true, images: { orderBy: { sortOrder: "asc" }, take: 1 } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <section className="py-20">
      <div className="max-w-[1320px] mx-auto px-10">
        <div className="flex justify-between items-center mb-10">
          <div>
            <Link href="/admin" className="text-[13px] text-[var(--ink-mute)] hover:text-[var(--ink)] transition-colors mb-3 inline-block">
              ← Админ-панель
            </Link>
            <h2 className="text-3xl font-extralight">Товары ({products.length})</h2>
          </div>
          <Link
            href="/admin/products/new"
            className="px-6 py-3 text-[13px] font-medium bg-[var(--ink)] text-[#0a0d12] rounded-sm hover:bg-white transition-all"
          >
            + Добавить товар
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[800px]">
            <thead>
              <tr className="text-left text-[11px] tracking-[.14em] uppercase text-[var(--ink-mute)] font-medium border-b border-[var(--line-2)]">
                <th className="py-3 w-16"></th>
                <th className="py-3">Название</th>
                <th className="py-3">Коллекция</th>
                <th className="py-3">Категория</th>
                <th className="py-3">Цена</th>
                <th className="py-3 w-20">Статус</th>
                <th className="py-3 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className="border-b border-[var(--line)] hover:bg-[rgba(255,255,255,.02)] transition-colors">
                  <td className="py-3">
                    {product.images[0] ? (
                      <img src={product.images[0].imageUrl} alt="" className="w-12 h-12 rounded-sm object-cover border border-[var(--line)]" />
                    ) : (
                      <div className="w-12 h-12 rounded-sm bg-[var(--panel)] border border-[var(--line)]" />
                    )}
                  </td>
                  <td className="py-3">
                    <div className="text-sm font-normal">{product.name}</div>
                    <div className="text-[11px] text-[var(--ink-faint)]">{product.slug}</div>
                  </td>
                  <td className="py-3 text-sm text-[var(--ink-soft)]">{product.collection || "—"}</td>
                  <td className="py-3 text-sm text-[var(--ink-soft)]">{product.category.name}</td>
                  <td className="py-3 text-sm">{product.price ? `${Math.round(product.price)} ₽` : "—"}</td>
                  <td className="py-3">
                    <span className={`text-[11px] px-2 py-1 rounded-sm ${product.isActive ? "bg-green-900/30 text-green-400" : "bg-red-900/30 text-red-400"}`}>
                      {product.isActive ? "Активен" : "Скрыт"}
                    </span>
                  </td>
                  <td className="py-3">
                    <div className="flex gap-2">
                      <Link href={`/admin/products/${product.id}`} className="text-[12px] text-[var(--ink-mute)] hover:text-[var(--ink)] transition-colors">
                        Ред.
                      </Link>
                      <DeleteProductButton productId={product.id} productName={product.name} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

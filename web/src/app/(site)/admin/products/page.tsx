import Link from "next/link";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/db";
import ProductsTable from "./ProductsTable";

export default async function AdminProductsPage() {
  await requireAdmin();

  const [productsRaw, categories] = await Promise.all([
    prisma.product.findMany({
      include: { category: true, images: { orderBy: { sortOrder: "asc" }, take: 1 } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  const products = productsRaw.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    collection: p.collection,
    isActive: p.isActive,
    category: { id: p.category.id, name: p.category.name },
    images: p.images.map((img) => ({ imageUrl: img.imageUrl })),
  }));

  const serializedCategories = categories.map((c) => ({
    id: c.id,
    name: c.name,
  }));

  return (
    <div className="pb-12">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-[clamp(22px,2.5vw,30px)] font-extralight tracking-tight">
              Товары
              <span className="text-[var(--ink-faint)] text-lg ml-2 font-light">{products.length}</span>
            </h2>
          </div>
          <Link
            href="/admin/products/new"
            className="px-5 py-2.5 text-[12px] font-medium bg-[var(--ink)] text-[#0a0d12] rounded-md hover:bg-white transition-all duration-200 cursor-pointer"
          >
            + Добавить товар
          </Link>
        </div>

        <ProductsTable products={products} categories={serializedCategories} />
    </div>
  );
}

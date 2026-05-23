import Link from "next/link";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/db";
import ProductForm from "@/components/admin/ProductForm";

export default async function NewProductPage() {
  await requireAdmin();
  const categories = await prisma.category.findMany({ orderBy: { sortOrder: "asc" } });

  return (
    <section className="py-20">
      <div className="max-w-[1320px] mx-auto px-10">
        <Link href="/admin/products" className="text-[13px] text-[var(--ink-mute)] hover:text-[var(--ink)] transition-colors mb-5 inline-block">
          ← Товары
        </Link>
        <h2 className="text-3xl font-extralight mb-10">Новый товар</h2>
        <ProductForm categories={categories} />
      </div>
    </section>
  );
}

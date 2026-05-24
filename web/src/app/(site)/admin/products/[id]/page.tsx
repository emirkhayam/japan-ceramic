import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/db";
import ProductForm from "@/components/admin/ProductForm";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const product = await prisma.product.findUnique({
    where: { id },
    include: { images: { orderBy: { sortOrder: "asc" } } },
  });
  if (!product) notFound();

  const categories = await prisma.category.findMany({ orderBy: { sortOrder: "asc" } });

  return (
    <div className="pb-12">
        <Link href="/admin/products" className="text-[13px] text-[var(--ink-mute)] hover:text-[var(--ink)] transition-colors mb-5 inline-block">
          ← Товары
        </Link>
        <h2 className="text-3xl font-extralight mb-10">Редактировать: {product.name}</h2>
        <ProductForm
          categories={categories}
          initial={{
            id: product.id,
            name: product.name,
            slug: product.slug,
            categoryId: product.categoryId,
            description: product.description || "",
            price: product.price?.toString() || "",
            dimensions: product.dimensions || "",
            surface: product.surface || "",
            weight: product.weight || "",
            collection: product.collection || "",
            color: product.color || "",
            isActive: product.isActive,
            images: product.images.map((img) => img.imageUrl),
          }}
        />
    </div>
  );
}

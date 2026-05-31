import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/db";
import CollectionForm from "@/components/admin/CollectionForm";
import CollectionProductPicker from "@/components/admin/CollectionProductPicker";

export default async function EditCollectionPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const collection = await prisma.collection.findUnique({
    where: { id },
    include: {
      products: {
        orderBy: [{ collectionOrder: "asc" }, { name: "asc" }],
        include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } },
      },
    },
  });
  if (!collection) notFound();

  const members = collection.products.map((p) => ({
    id: p.id,
    name: p.name,
    dimensions: p.dimensions,
    imageUrl: p.images[0]?.imageUrl || null,
    collectionId: collection.id,
    collectionName: collection.name,
  }));

  return (
    <div className="pb-12">
      <Link href="/admin/collections" className="text-[13px] text-[var(--ink-mute)] hover:text-[var(--ink)] transition-colors mb-5 inline-block">
        ← Коллекции
      </Link>
      <h2 className="text-3xl font-extralight mb-1">Редактировать: {collection.name}</h2>
      <Link href={`/collections/${collection.slug}`} target="_blank" className="text-[12px] text-[var(--ink-mute)] hover:text-[var(--ink)] underline underline-offset-4">
        Открыть на сайте ↗
      </Link>

      <div className="mt-10">
        <h3 className="text-[11px] font-semibold tracking-[.2em] uppercase text-[var(--ink-mute)] mb-5 pb-2 border-b border-[var(--line)]">Данные коллекции</h3>
        <CollectionForm
          initial={{
            id: collection.id,
            name: collection.name,
            slug: collection.slug,
            description: collection.description || "",
            coverImageUrl: collection.coverImageUrl || "",
            spaceTag: collection.spaceTag || "",
            styleTag: collection.styleTag || "",
            isNew: collection.isNew,
            isRecommended: collection.isRecommended,
            status: collection.status,
            sortOrder: collection.sortOrder,
          }}
        />
      </div>

      <div className="mt-14">
        <h3 className="text-[11px] font-semibold tracking-[.2em] uppercase text-[var(--ink-mute)] mb-5 pb-2 border-b border-[var(--line)]">Состав коллекции</h3>
        <CollectionProductPicker collectionId={collection.id} initialMembers={members} />
      </div>
    </div>
  );
}

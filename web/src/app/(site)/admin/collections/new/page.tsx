import Link from "next/link";
import { requireAdmin } from "@/lib/admin-guard";
import CollectionForm from "@/components/admin/CollectionForm";

export default async function NewCollectionPage() {
  await requireAdmin();

  return (
    <div className="pb-12">
      <Link href="/admin/collections" className="text-[13px] text-[var(--ink-mute)] hover:text-[var(--ink)] transition-colors mb-5 inline-block">
        ← Коллекции
      </Link>
      <h2 className="text-3xl font-extralight mb-3">Новая коллекция</h2>
      <p className="text-[13px] text-[var(--ink-mute)] mb-10">Сначала заполните данные коллекции — затем добавите в неё товары.</p>
      <CollectionForm />
    </div>
  );
}

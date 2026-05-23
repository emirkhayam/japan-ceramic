"use client";

import { useRouter } from "next/navigation";

export default function DeleteProductButton({ productId, productName }: { productId: string; productName: string }) {
  const router = useRouter();

  async function handleDelete() {
    if (!confirm(`Удалить товар "${productName}"?`)) return;
    const res = await fetch(`/api/admin/products/${productId}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  return (
    <button onClick={handleDelete} className="text-[12px] text-red-400/60 hover:text-red-400 transition-colors">
      Удл.
    </button>
  );
}

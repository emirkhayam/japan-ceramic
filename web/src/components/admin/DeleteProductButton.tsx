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
    <button onClick={handleDelete} className="text-[12px] px-3 py-1.5 border border-[rgba(220,80,80,.35)] rounded-sm text-[#e88] hover:bg-red-500 hover:text-white hover:border-red-500 transition-all">
      Удалить
    </button>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DeleteCollectionButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    if (!window.confirm(`Удалить коллекцию «${name}»? Товары не удалятся — они просто останутся без коллекции.`)) return;
    setBusy(true);
    const res = await fetch(`/api/admin/collections/${id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
    else setBusy(false);
  }

  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={busy}
      className="text-[12px] text-[var(--ink-mute)] hover:text-red-400 transition-colors disabled:opacity-40 cursor-pointer"
    >
      {busy ? "…" : "Удалить"}
    </button>
  );
}

"use client";

import { useRouter } from "next/navigation";

export default function RemoveItemButton({
  projectId,
  itemId,
}: {
  projectId: string;
  itemId: string;
}) {
  const router = useRouter();

  async function remove() {
    await fetch(`/api/cabinet/projects/${projectId}/items/${itemId}`, {
      method: "DELETE",
    });
    router.refresh();
  }

  return (
    <button
      onClick={remove}
      className="text-[var(--ink-faint)] hover:text-red-400 transition-colors text-lg"
      title="Удалить"
    >
      ×
    </button>
  );
}

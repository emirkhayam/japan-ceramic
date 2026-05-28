"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface NoteEditorProps {
  projectId: string;
  itemId: string;
  initialNote: string | null;
}

export default function NoteEditor({ projectId, itemId, initialNote }: NoteEditorProps) {
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(initialNote || "");
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`/api/cabinet/projects/${projectId}/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      setEditing(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setNote(initialNote || "");
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          autoFocus
          className="bg-[rgba(255,255,255,.04)] border border-[var(--line-2)] rounded-md text-[var(--ink)] text-[12px] px-2 py-1 outline-none focus:border-[rgba(255,255,255,.34)]"
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-[11px] text-[var(--ink-soft)] hover:text-[var(--ink)] cursor-pointer"
        >
          {saving ? "..." : "OK"}
        </button>
        <button
          onClick={handleCancel}
          className="text-[11px] text-[var(--ink-mute)] hover:text-[var(--ink-soft)] cursor-pointer"
        >
          Отмена
        </button>
      </div>
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className="text-[12px] text-[var(--ink-mute)] cursor-pointer hover:text-[var(--ink-soft)] transition-colors"
    >
      {initialNote || "Добавить заметку"}
    </span>
  );
}

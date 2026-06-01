"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AiBudgetEditor({ initial }: { initial: number | null }) {
  const router = useRouter();
  const [value, setValue] = useState(initial != null ? String(initial) : "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/admin/ai-budget", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ budget: value.trim() === "" ? null : value.trim() }),
    });
    setSaving(false);
    if (res.ok) {
      setMsg({ ok: true, text: "Сохранено" });
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setMsg({ ok: false, text: d.error || "Не удалось сохранить" });
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <label htmlFor="ai-budget" className="block text-[11px] tracking-[.08em] uppercase text-[var(--ink-mute)] mb-2">
          Месячный лимит токенов
        </label>
        <input
          id="ai-budget"
          type="number"
          min={0}
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="напр. 1000000 (пусто = без лимита)"
          className="w-[260px] px-4 py-2.5 bg-[var(--surface-1)] border border-[var(--line-2)] rounded-sm text-[var(--ink)] text-sm outline-none focus:border-[rgba(255,255,255,.34)] transition-all placeholder:text-[var(--ink-faint)]"
        />
      </div>
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="px-5 py-2.5 text-[13px] font-medium bg-[var(--ink)] text-[var(--on-gold)] rounded-sm hover:bg-white transition-all disabled:opacity-50"
      >
        {saving ? "Сохраняю..." : "Сохранить лимит"}
      </button>
      {msg && <span className={`text-[13px] ${msg.ok ? "text-emerald-400/80" : "text-red-400/80"}`}>{msg.text}</span>}
    </div>
  );
}

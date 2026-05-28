"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Lead = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  message: string | null;
  source: string;
  isRead: boolean;
  createdAt: string;
};

type StatusFilter = "all" | "new" | "read";

const statusLabels: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "new", label: "Новые" },
  { key: "read", label: "Прочитанные" },
];

export function LeadsTable({ leads }: { leads: Lead[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  async function markRead(id: string, isRead: boolean) {
    setBusy(id);
    await fetch(`/api/admin/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isRead }),
    });
    setBusy(null);
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Удалить заявку?")) return;
    setBusy(id);
    await fetch(`/api/admin/leads/${id}`, { method: "DELETE" });
    setBusy(null);
    router.refresh();
  }

  const filtered = leads.filter((l) => {
    if (status === "new" && l.isRead) return false;
    if (status === "read" && !l.isRead) return false;
    if (search) {
      const q = search.toLowerCase();
      const haystack = [l.name, l.phone, l.email, l.message]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  if (leads.length === 0) {
    return (
      <div className="border border-[var(--line)] rounded-sm px-8 py-16 text-center text-[var(--ink-mute)]">
        Заявок пока нет. Они появятся здесь, когда клиент заполнит форму на сайте.
      </div>
    );
  }

  function fmt(iso: string) {
    return new Date(iso).toLocaleString("ru-RU", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <input
          type="text"
          placeholder="Поиск по имени, телефону, email, сообщению..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-[400px] px-4 py-2.5 bg-[rgba(255,255,255,.04)] border border-[var(--line-2)] rounded-md text-[var(--ink)] text-[13px] outline-none focus:border-[rgba(255,255,255,.34)] transition-all placeholder:text-[var(--ink-faint)]"
        />
        <div className="flex items-center gap-1">
          {statusLabels.map((s) => (
            <button
              key={s.key}
              onClick={() => setStatus(s.key)}
              className={`text-[12px] px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                status === s.key
                  ? "bg-[rgba(255,255,255,.08)] text-[var(--ink)]"
                  : "text-[var(--ink-mute)] hover:text-[var(--ink-soft)]"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <span className="text-[12px] text-[var(--ink-faint)] ml-auto">
          {filtered.length} из {leads.length}
        </span>
      </div>

      <div className="space-y-3">
      {filtered.map((l) => (
        <div
          key={l.id}
          className={`grid md:grid-cols-[1fr_auto] gap-4 px-6 py-5 border rounded-sm transition-all ${
            l.isRead
              ? "border-[var(--line)] opacity-70"
              : "border-[var(--line-2)] bg-[rgba(255,255,255,.02)]"
          }`}
        >
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              {!l.isRead && (
                <span className="inline-block w-2 h-2 rounded-full bg-[var(--accent,#c8d2e0)]" />
              )}
              <span className="text-lg font-light">{l.name}</span>
              <a href={`tel:${l.phone}`} className="text-[var(--ink-soft)] hover:text-[var(--ink)]">
                {l.phone}
              </a>
              {l.email && (
                <a href={`mailto:${l.email}`} className="text-[13px] text-[var(--ink-mute)] hover:text-[var(--ink)]">
                  {l.email}
                </a>
              )}
            </div>
            {l.message && (
              <p className="text-[14px] text-[var(--ink-soft)] mt-2 max-w-[700px]">{l.message}</p>
            )}
            <div className="text-[11px] text-[var(--ink-faint)] mt-2 tracking-[.04em] uppercase">
              {fmt(l.createdAt)} · источник: {l.source}
            </div>
          </div>

          <div className="flex md:flex-col items-end gap-2 shrink-0">
            <button
              onClick={() => markRead(l.id, !l.isRead)}
              disabled={busy === l.id}
              className="text-[12px] px-3 py-1.5 border border-[var(--line-2)] rounded-sm text-[var(--ink-soft)] hover:bg-[rgba(255,255,255,.05)] hover:text-[var(--ink)] transition-all disabled:opacity-40"
            >
              {l.isRead ? "Вернуть в новые" : "Прочитано"}
            </button>
            <button
              onClick={() => remove(l.id)}
              disabled={busy === l.id}
              className="text-[12px] px-3 py-1.5 text-[var(--ink-faint)] hover:text-red-400 transition-all disabled:opacity-40"
            >
              Удалить
            </button>
          </div>
        </div>
      ))}
      </div>
    </div>
  );
}

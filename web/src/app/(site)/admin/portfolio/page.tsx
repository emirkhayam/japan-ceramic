"use client";

import { useEffect, useRef, useState } from "react";

type Item = {
  id: string;
  imageUrl: string;
  tag: string | null;
  title: string | null;
  meta: string | null;
  sortOrder: number;
};

const inputClass =
  "w-full px-3 py-2 bg-[var(--surface-1)] border border-[var(--line-2)] rounded-sm text-[var(--ink)] text-[13px] outline-none focus:border-[rgba(255,255,255,.34)] transition-all placeholder:text-[var(--ink-faint)]";

export default function AdminPortfolioPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [caption, setCaption] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const res = await fetch("/api/admin/portfolio");
    if (res.ok) {
      const d = await res.json();
      setItems(d.items);
      setCaption(d.caption ?? "");
    }
    setLoading(false);
  }

  function flash(ok: boolean, text: string) {
    setMsg({ ok, text });
    setTimeout(() => setMsg(null), 2500);
  }

  async function uploadFile(file: File): Promise<string | null> {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
    if (!res.ok) { flash(false, "Не удалось загрузить файл"); return null; }
    return (await res.json()).url as string;
  }

  async function saveCaption() {
    setBusy(true);
    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aboutPortfolioCaption: caption }),
    });
    setBusy(false);
    flash(res.ok, res.ok ? "Подпись сохранена" : "Ошибка сохранения подписи");
  }

  async function addItem(file: File) {
    setBusy(true);
    const url = await uploadFile(file);
    if (url) {
      const res = await fetch("/api/admin/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: url, tag: "", title: "Новый объект", meta: "" }),
      });
      if (res.ok) { await load(); flash(true, "Объект добавлен"); }
      else flash(false, "Не удалось добавить");
    }
    setBusy(false);
    if (addInputRef.current) addInputRef.current.value = "";
  }

  function patchLocal(id: string, patch: Partial<Item>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  async function saveItem(it: Item) {
    setBusy(true);
    const res = await fetch(`/api/admin/portfolio/${it.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tag: it.tag, title: it.title, meta: it.meta, imageUrl: it.imageUrl }),
    });
    setBusy(false);
    flash(res.ok, res.ok ? "Сохранено" : "Ошибка сохранения");
  }

  async function changeImage(it: Item, file: File) {
    setBusy(true);
    const url = await uploadFile(file);
    if (url) {
      await fetch(`/api/admin/portfolio/${it.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: url }),
      });
      patchLocal(it.id, { imageUrl: url });
      flash(true, "Фото обновлено");
    }
    setBusy(false);
  }

  async function removeItem(it: Item) {
    if (!confirm("Удалить объект из портфолио?")) return;
    setBusy(true);
    const res = await fetch(`/api/admin/portfolio/${it.id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) { setItems((prev) => prev.filter((x) => x.id !== it.id)); flash(true, "Удалено"); }
    else flash(false, "Не удалось удалить");
  }

  // Перестановка: меняем sortOrder с соседом и сохраняем оба.
  async function move(idx: number, dir: -1 | 1) {
    const j = idx + dir;
    if (j < 0 || j >= items.length) return;
    const a = items[idx], b = items[j];
    setBusy(true);
    const next = [...items];
    [next[idx], next[j]] = [next[j], next[idx]];
    setItems(next);
    await Promise.all([
      fetch(`/api/admin/portfolio/${a.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sortOrder: b.sortOrder }) }),
      fetch(`/api/admin/portfolio/${b.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sortOrder: a.sortOrder }) }),
    ]);
    setBusy(false);
  }

  return (
    <div className="pb-12 max-w-[900px]">
      <div className="mb-8">
        <h2 className="text-[clamp(22px,2.5vw,30px)] font-extralight tracking-tight">Портфолио «Наши объекты»</h2>
        <p className="text-[13px] text-[var(--ink-mute)] mt-1.5">
          Картинки и тексты блока «Наши объекты» на странице <span className="text-[var(--ink-soft)]">О компании</span>.
        </p>
      </div>

      {msg && (
        <div className={`mb-5 text-[13px] ${msg.ok ? "text-emerald-400/80" : "text-red-400/80"}`}>{msg.text}</div>
      )}

      {/* Подпись блока */}
      <div className="border border-[var(--line)] rounded-lg p-5 mb-8">
        <label htmlFor="pf-caption" className="block text-[11px] tracking-[.08em] uppercase text-[var(--ink-mute)] mb-2">
          Подпись блока (под заголовком «Наши объекты»)
        </label>
        <textarea
          id="pf-caption"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={2}
          placeholder="Где керамогранит, клинкер и мозаика Japan Ceramic уже работают…"
          className={`${inputClass} resize-y`}
        />
        <button onClick={saveCaption} disabled={busy} className="mt-3 px-5 py-2 text-[13px] font-medium bg-[var(--ink)] text-[var(--on-gold)] rounded-sm hover:bg-white transition-all disabled:opacity-50">
          Сохранить подпись
        </button>
      </div>

      {/* Объекты */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[15px] font-medium">Объекты {items.length > 0 && <span className="text-[var(--ink-faint)] font-light">({items.length})</span>}</h3>
        <label className="px-4 py-2 text-[13px] font-medium border border-[var(--line-2)] rounded-sm text-[var(--ink-soft)] hover:bg-[var(--surface-1)] hover:text-[var(--ink)] transition-all cursor-pointer">
          + Добавить объект
          <input ref={addInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) addItem(f); }} />
        </label>
      </div>

      {loading ? (
        <div className="text-[var(--ink-mute)] py-10">Загрузка…</div>
      ) : items.length === 0 ? (
        <div className="border border-dashed border-[var(--line)] rounded-lg py-12 text-center text-[var(--ink-mute)] text-[13px]">
          Объектов пока нет — на сайте показываются демо-объекты. Добавьте свой, чтобы заменить их.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((it, idx) => (
            <div key={it.id} className="flex gap-4 border border-[var(--line)] rounded-lg p-4">
              {/* Фото */}
              <div className="shrink-0">
                <div className="w-[120px] h-[90px] rounded-sm overflow-hidden border border-[var(--line)] bg-[var(--panel)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={it.imageUrl} alt={it.title || ""} className="w-full h-full object-cover" />
                </div>
                <label className="mt-2 block text-center text-[11px] text-[var(--ink-mute)] hover:text-[var(--ink)] cursor-pointer">
                  Сменить фото
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) changeImage(it, f); }} />
                </label>
              </div>

              {/* Поля */}
              <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input className={inputClass} placeholder="Тег (напр. «Фасад · Керамогранит»)" value={it.tag ?? ""} onChange={(e) => patchLocal(it.id, { tag: e.target.value })} />
                <input className={inputClass} placeholder="Локация / год (напр. «Бишкек · 2023»)" value={it.meta ?? ""} onChange={(e) => patchLocal(it.id, { meta: e.target.value })} />
                <input className={`${inputClass} sm:col-span-2`} placeholder="Название объекта" value={it.title ?? ""} onChange={(e) => patchLocal(it.id, { title: e.target.value })} />
                <div className="sm:col-span-2 flex items-center gap-2">
                  <button onClick={() => saveItem(it)} disabled={busy} className="px-4 py-1.5 text-[12px] font-medium bg-[var(--ink)] text-[var(--on-gold)] rounded-sm hover:bg-white transition-all disabled:opacity-50">Сохранить</button>
                  <button onClick={() => move(idx, -1)} disabled={busy || idx === 0} aria-label="Выше" className="w-8 h-8 inline-flex items-center justify-center border border-[var(--line-2)] rounded-sm text-[var(--ink-mute)] hover:text-[var(--ink)] disabled:opacity-30">↑</button>
                  <button onClick={() => move(idx, 1)} disabled={busy || idx === items.length - 1} aria-label="Ниже" className="w-8 h-8 inline-flex items-center justify-center border border-[var(--line-2)] rounded-sm text-[var(--ink-mute)] hover:text-[var(--ink)] disabled:opacity-30">↓</button>
                  <button onClick={() => removeItem(it)} disabled={busy} className="ml-auto px-3 py-1.5 text-[12px] border border-red-800/60 rounded-sm text-red-400 hover:bg-red-900/30 transition-all disabled:opacity-50">Удалить</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

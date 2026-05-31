"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export interface PickerProduct {
  id: string;
  name: string;
  dimensions: string | null;
  imageUrl: string | null;
  collectionId: string | null;
  collectionName: string | null;
}

export default function CollectionProductPicker({
  collectionId,
  initialMembers,
}: {
  collectionId: string;
  initialMembers: PickerProduct[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<PickerProduct[]>(initialMembers);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PickerProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/admin/products/search?q=${encodeURIComponent(query.trim())}&limit=30`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.products);
        }
      } catch { /* ignore */ }
      setSearching(false);
    }, 280);
    return () => { if (debRef.current) clearTimeout(debRef.current); };
  }, [query]);

  useEffect(() => {
    if (saved) { const t = setTimeout(() => setSaved(false), 3500); return () => clearTimeout(t); }
  }, [saved]);

  const selectedIds = new Set(selected.map((p) => p.id));

  function add(p: PickerProduct) {
    if (selectedIds.has(p.id)) return;
    setSelected((prev) => [...prev, p]);
  }
  function remove(id: string) {
    setSelected((prev) => prev.filter((p) => p.id !== id));
  }
  function move(i: number, dir: -1 | 1) {
    setSelected((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  // Сколько товаров переедут из ДРУГОЙ коллекции
  const reassigned = selected.filter((p) => p.collectionId && p.collectionId !== collectionId);

  async function save() {
    if (reassigned.length > 0) {
      const names = reassigned.slice(0, 4).map((p) => `«${p.collectionName}»`).join(", ");
      const ok = window.confirm(
        `${reassigned.length} товар(ов) будут перемещены из других коллекций (${names}${reassigned.length > 4 ? "…" : ""}) в эту. Продолжить?`
      );
      if (!ok) return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/collections/${collectionId}/products`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds: selected.map((p) => p.id) }),
      });
      if (res.ok) {
        // Обновим у выбранных «текущую коллекцию» = эта, чтобы предупреждение исчезло.
        setSelected((prev) => prev.map((p) => ({ ...p, collectionId, collectionName: null })));
        setSaved(true);
        router.refresh();
      }
    } catch { /* ignore */ }
    setSaving(false);
  }

  const thumb = (p: PickerProduct) => (
    <div className="w-11 h-11 shrink-0 rounded-sm overflow-hidden bg-[rgba(255,255,255,.04)] flex items-center justify-center">
      <img src={p.imageUrl || "/placeholder-tile.svg"} alt="" className="w-full h-full object-cover" />
    </div>
  );

  const inputClass =
    "w-full px-4 py-3 bg-[rgba(255,255,255,.04)] border border-[var(--line-2)] rounded-sm text-[var(--ink)] text-sm outline-none focus:border-[rgba(255,255,255,.34)] transition-all placeholder:text-[var(--ink-faint)]";

  return (
    <div className="max-w-[760px]">
      <div className="grid md:grid-cols-2 gap-6">
        {/* Поиск */}
        <div>
          <label className="block text-xs font-medium tracking-[.08em] uppercase text-[var(--ink-mute)] mb-2">Найти товары</label>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Название или коллекция…"
            className={inputClass}
          />
          <div className="mt-3 border border-[var(--line)] rounded-sm divide-y divide-[var(--line)] max-h-[420px] overflow-y-auto">
            {searching && <div className="px-3 py-4 text-[12px] text-[var(--ink-mute)]">Поиск…</div>}
            {!searching && query.trim().length >= 2 && results.length === 0 && (
              <div className="px-3 py-4 text-[12px] text-[var(--ink-mute)]">Ничего не найдено</div>
            )}
            {!searching && query.trim().length < 2 && (
              <div className="px-3 py-4 text-[12px] text-[var(--ink-faint)]">Введите минимум 2 символа</div>
            )}
            {results.map((p) => {
              const inThis = p.collectionId === collectionId;
              const inOther = p.collectionId && p.collectionId !== collectionId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => add(p)}
                  disabled={selectedIds.has(p.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[rgba(255,255,255,.03)] transition-colors disabled:opacity-40 disabled:cursor-default cursor-pointer"
                >
                  {thumb(p)}
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] text-[var(--ink)] truncate">{p.name}</div>
                    {inOther ? (
                      <div className="text-[11px] text-[var(--color-gold-400)] truncate">⚠ Сейчас в: {p.collectionName}</div>
                    ) : inThis ? (
                      <div className="text-[11px] text-[var(--ink-faint)]">Уже в этой коллекции</div>
                    ) : (
                      <div className="text-[11px] text-[var(--ink-faint)]">Без коллекции</div>
                    )}
                  </div>
                  {selectedIds.has(p.id) ? (
                    <span className="text-[11px] text-[var(--ink-faint)]">✓</span>
                  ) : (
                    <span className="text-[16px] text-[var(--ink-mute)]">+</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Состав */}
        <div>
          <label className="block text-xs font-medium tracking-[.08em] uppercase text-[var(--ink-mute)] mb-2">
            Состав коллекции <span className="text-[var(--ink-faint)]">({selected.length})</span>
          </label>
          <div className="border border-[var(--line)] rounded-sm divide-y divide-[var(--line)] max-h-[420px] overflow-y-auto">
            {selected.length === 0 && (
              <div className="px-3 py-6 text-[12px] text-[var(--ink-mute)] text-center">
                Пока пусто. Добавьте товары из поиска слева.
              </div>
            )}
            {selected.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3 px-3 py-2.5">
                {thumb(p)}
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] text-[var(--ink)] truncate">{p.name}</div>
                  {p.collectionId && p.collectionId !== collectionId && (
                    <div className="text-[11px] text-[var(--color-gold-400)] truncate">⚠ переедет из: {p.collectionName}</div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="w-6 h-6 text-[var(--ink-mute)] hover:text-[var(--ink)] disabled:opacity-25 cursor-pointer" aria-label="Выше">↑</button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === selected.length - 1} className="w-6 h-6 text-[var(--ink-mute)] hover:text-[var(--ink)] disabled:opacity-25 cursor-pointer" aria-label="Ниже">↓</button>
                  <button type="button" onClick={() => remove(p.id)} className="w-6 h-6 text-[var(--ink-mute)] hover:text-red-400 cursor-pointer" aria-label="Убрать">×</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 mt-6">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="px-7 py-3.5 text-[13px] font-medium bg-[var(--ink)] text-[#0a0d12] rounded-sm hover:bg-white transition-all disabled:opacity-50 cursor-pointer"
        >
          {saving ? "Сохранение…" : "Сохранить состав"}
        </button>
        {reassigned.length > 0 && (
          <span className="text-[12px] text-[var(--color-gold-400)]">{reassigned.length} товар(ов) переедут из других коллекций</span>
        )}
        {saved && <span className="animate-toast-in text-[12px] text-[#a0e8b0]">✓ Состав сохранён</span>}
      </div>
    </div>
  );
}

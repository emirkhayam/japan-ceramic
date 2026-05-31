"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export interface CollectionData {
  id?: string;
  name: string;
  slug: string;
  description: string;
  coverImageUrl: string;
  spaceTag: string;
  styleTag: string;
  isNew: boolean;
  isRecommended: boolean;
  status: string;
  sortOrder: number;
}

const SPACE_OPTIONS = ["Ванная", "Кухня", "Гостиная", "Фасад", "Бассейн", "Терраса"];
const STYLE_OPTIONS = ["Минимализм", "Природный", "Камень", "Бетон", "Геометрия", "Металл", "Мрамор"];

export default function CollectionForm({ initial }: { initial?: CollectionData }) {
  const router = useRouter();
  const isEdit = !!initial?.id;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [cover, setCover] = useState(initial?.coverImageUrl || "");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (saved) {
      const t = setTimeout(() => setSaved(false), 3500);
      return () => clearTimeout(t);
    }
  }, [saved]);

  function slugify(text: string) {
    return text.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, "-").replace(/^-|-$/g, "");
  }

  async function uploadCover(file: File) {
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      if (res.ok) {
        const data = await res.json();
        setCover(data.url);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Не удалось загрузить обложку");
      }
    } catch {
      setError("Ошибка сети при загрузке");
    }
    setUploading(false);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const body = {
      name: form.get("name"),
      slug: form.get("slug"),
      description: form.get("description") || "",
      coverImageUrl: cover,
      spaceTag: form.get("spaceTag") || "",
      styleTag: form.get("styleTag") || "",
      isNew: form.get("isNew") === "on",
      isRecommended: form.get("isRecommended") === "on",
      status: form.get("status") === "on" ? "published" : "draft",
      sortOrder: Number(form.get("sortOrder")) || 0,
    };

    const url = isEdit ? `/api/admin/collections/${initial!.id}` : "/api/admin/collections";
    const method = isEdit ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

    if (res.ok) {
      const { collection } = await res.json();
      if (isEdit) {
        setSaved(true);
        router.refresh();
      } else {
        // Создали — переходим на страницу редактирования, чтобы добавить товары.
        router.push(`/admin/collections/${collection.id}`);
        router.refresh();
      }
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Ошибка сохранения");
    }
    setLoading(false);
  }

  const inputClass =
    "w-full px-4 py-3 bg-[rgba(255,255,255,.04)] border border-[var(--line-2)] rounded-sm text-[var(--ink)] text-sm outline-none focus:border-[rgba(255,255,255,.34)] focus:bg-[rgba(255,255,255,.07)] transition-all placeholder:text-[var(--ink-faint)]";
  const selectClass = `${inputClass} [color-scheme:dark] cursor-pointer`;
  const optionClass = "bg-[#15181d] text-[var(--ink)]";
  const labelClass = "block text-xs font-medium tracking-[.08em] uppercase text-[var(--ink-mute)] mb-2";

  return (
    <form onSubmit={handleSubmit} className="max-w-[700px]">
      {error && (
        <div className="bg-[rgba(220,80,80,.12)] border border-[rgba(220,80,80,.3)] rounded-sm px-4 py-3 mb-6 text-[13px] text-[#e8a0a0]">
          {error}
        </div>
      )}
      {saved && (
        <div className="animate-toast-in bg-[rgba(80,200,120,.12)] border border-[rgba(80,200,120,.3)] rounded-sm px-4 py-3 mb-6 text-[13px] text-[#a0e8b0]">
          ✓ Сохранено
        </div>
      )}

      <div className="mb-5">
        <label className={labelClass}>Название коллекции *</label>
        <input
          type="text"
          name="name"
          required
          defaultValue={initial?.name || ""}
          placeholder="Echo Celio"
          className={inputClass}
          onChange={(e) => {
            const s = e.currentTarget.form?.querySelector<HTMLInputElement>('[name="slug"]');
            if (s && !isEdit) s.value = slugify(e.target.value);
          }}
        />
      </div>

      <div className="mb-5">
        <label className={labelClass}>Slug (адрес страницы)</label>
        <input type="text" name="slug" defaultValue={initial?.slug || ""} placeholder="echo-celio" className={inputClass} />
        <p className="text-[11px] text-[var(--ink-faint)] mt-1.5">
          Адрес: /collections/<span className="text-[var(--ink-mute)]">slug</span>. После публикации менять не рекомендуется.
        </p>
      </div>

      <div className="mb-5">
        <label className={labelClass}>Описание (философия коллекции)</label>
        <textarea name="description" rows={4} defaultValue={initial?.description || ""} placeholder="Несколько предложений о характере коллекции — настроение, вдохновение, материалы." className={inputClass} />
      </div>

      {/* Cover */}
      <div className="mb-6">
        <label className={labelClass}>Обложка (атмосферное фото)</label>
        {cover ? (
          <div className="relative w-full max-w-[360px] aspect-[16/10] rounded-md overflow-hidden border border-[var(--line)]">
            <img src={cover} alt="" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => setCover("")}
              className="absolute top-2 right-2 w-6 h-6 bg-black/60 rounded-full text-white text-sm flex items-center justify-center hover:bg-red-600 transition-colors"
            >
              ×
            </button>
          </div>
        ) : (
          <label
            className={`flex flex-col items-center justify-center gap-2 w-full max-w-[360px] aspect-[16/10] border border-dashed border-[var(--line-2)] rounded-md transition-all ${
              uploading ? "cursor-wait" : "cursor-pointer hover:border-[rgba(255,255,255,.32)]"
            }`}
          >
            {uploading ? (
              <span className="h-5 w-5 rounded-full border-2 border-[var(--line-2)] border-t-[var(--color-gold-400)] animate-spin" />
            ) : (
              <span className="text-[13px] text-[var(--ink-mute)]">+ Загрузить обложку</span>
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={uploading}
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCover(f); e.target.value = ""; }}
            />
          </label>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-5 mb-5">
        <div>
          <label className={labelClass}>Пространство</label>
          <select name="spaceTag" defaultValue={initial?.spaceTag || ""} className={selectClass}>
            <option value="" className={optionClass}>— не указано —</option>
            {SPACE_OPTIONS.map((o) => <option key={o} value={o} className={optionClass}>{o}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Стиль</label>
          <select name="styleTag" defaultValue={initial?.styleTag || ""} className={selectClass}>
            <option value="" className={optionClass}>— не указано —</option>
            {STYLE_OPTIONS.map((o) => <option key={o} value={o} className={optionClass}>{o}</option>)}
          </select>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-5 mb-6">
        <div>
          <label className={labelClass}>Порядок в списке</label>
          <input type="number" name="sortOrder" defaultValue={initial?.sortOrder ?? 0} className={inputClass} />
          <p className="text-[11px] text-[var(--ink-faint)] mt-1.5">Меньше = выше в витрине.</p>
        </div>
      </div>

      {/* Badges */}
      <div className="mb-6">
        <label className="block text-xs font-medium tracking-[.08em] uppercase text-[var(--ink-mute)] mb-3">Бейджи</label>
        <div className="flex flex-wrap gap-2.5">
          {([
            { name: "isNew", label: "Новинка", checked: initial?.isNew, color: "var(--color-gold-400)" },
            { name: "isRecommended", label: "Рекомендуем", checked: initial?.isRecommended, color: "var(--color-gold-500)" },
          ] as const).map((b) => (
            <label key={b.name} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-sm border border-[var(--line-2)] bg-[rgba(255,255,255,.02)] cursor-pointer hover:border-[rgba(255,255,255,.32)] transition-colors has-[:checked]:bg-[rgba(255,255,255,.06)] has-[:checked]:border-[rgba(255,255,255,.4)]">
              <input type="checkbox" name={b.name} defaultChecked={b.checked ?? false} className="w-4 h-4" style={{ accentColor: b.color }} />
              <span className="text-[13px] text-[var(--ink-soft)]">{b.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Status */}
      <label className="flex items-center gap-3 mb-8 cursor-pointer">
        <input type="checkbox" name="status" defaultChecked={initial?.status === "published"} className="w-4 h-4 accent-[var(--ink)]" />
        <span className="text-sm text-[var(--ink-soft)]">Опубликована (видна на сайте). Иначе — черновик.</span>
      </label>

      <button
        type="submit"
        disabled={loading}
        className="px-8 py-4 text-[13.5px] font-medium bg-[var(--ink)] text-[#0a0d12] rounded-sm hover:bg-white transition-all disabled:opacity-50"
      >
        {loading ? "Сохранение..." : isEdit ? "Сохранить изменения" : "Создать и перейти к составу"}
      </button>
    </form>
  );
}

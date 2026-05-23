"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Category {
  id: string;
  name: string;
}

interface ProductData {
  id?: string;
  name: string;
  slug: string;
  categoryId: string;
  description: string;
  price: string;
  dimensions: string;
  surface: string;
  weight: string;
  collection: string;
  color: string;
  isActive: boolean;
  images: string[];
}

export default function ProductForm({
  categories,
  initial,
}: {
  categories: Category[];
  initial?: ProductData;
}) {
  const router = useRouter();
  const isEdit = !!initial?.id;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [images, setImages] = useState<string[]>(initial?.images || []);
  const [uploading, setUploading] = useState(false);

  function slugify(text: string) {
    return text.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, "-").replace(/^-|-$/g, "");
  }

  async function uploadFile(file: File) {
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/admin/upload", { method: "POST", body: formData });
    if (res.ok) {
      const data = await res.json();
      setImages((prev) => [...prev, data.url]);
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
      categoryId: form.get("categoryId"),
      description: form.get("description") || "",
      price: form.get("price") || "",
      dimensions: form.get("dimensions") || "",
      surface: form.get("surface") || "",
      weight: form.get("weight") || "",
      collection: form.get("collection") || "",
      color: form.get("color") || "",
      isActive: form.get("isActive") === "on",
      images,
    };

    const url = isEdit ? `/api/admin/products/${initial!.id}` : "/api/admin/products";
    const method = isEdit ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      router.push("/admin/products");
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error || "Ошибка сохранения");
    }
    setLoading(false);
  }

  const inputClass =
    "w-full px-4 py-3 bg-[rgba(255,255,255,.04)] border border-[var(--line-2)] rounded-sm text-[var(--ink)] text-sm outline-none focus:border-[rgba(255,255,255,.34)] focus:bg-[rgba(255,255,255,.07)] transition-all placeholder:text-[var(--ink-faint)]";

  return (
    <form onSubmit={handleSubmit} className="max-w-[700px]">
      {error && (
        <div className="bg-[rgba(220,80,80,.12)] border border-[rgba(220,80,80,.3)] rounded-sm px-4 py-3 mb-6 text-[13px] text-[#e8a0a0]">
          {error}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-5 mb-5">
        <div>
          <label className="block text-xs font-medium tracking-[.08em] uppercase text-[var(--ink-mute)] mb-2">Название *</label>
          <input
            type="text"
            name="name"
            required
            defaultValue={initial?.name || ""}
            className={inputClass}
            onChange={(e) => {
              if (!isEdit) {
                const slugInput = e.currentTarget.form?.querySelector<HTMLInputElement>('[name="slug"]');
                if (slugInput) slugInput.value = slugify(e.target.value);
              }
            }}
          />
        </div>
        <div>
          <label className="block text-xs font-medium tracking-[.08em] uppercase text-[var(--ink-mute)] mb-2">Slug *</label>
          <input type="text" name="slug" required defaultValue={initial?.slug || ""} className={inputClass} />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-5 mb-5">
        <div>
          <label className="block text-xs font-medium tracking-[.08em] uppercase text-[var(--ink-mute)] mb-2">Категория *</label>
          <select name="categoryId" required defaultValue={initial?.categoryId || ""} className={inputClass}>
            <option value="">Выберите</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium tracking-[.08em] uppercase text-[var(--ink-mute)] mb-2">Коллекция</label>
          <input type="text" name="collection" defaultValue={initial?.collection || ""} placeholder="Alchemy, Kumo..." className={inputClass} />
        </div>
      </div>

      <div className="mb-5">
        <label className="block text-xs font-medium tracking-[.08em] uppercase text-[var(--ink-mute)] mb-2">Описание</label>
        <textarea name="description" rows={3} defaultValue={initial?.description || ""} className={inputClass} />
      </div>

      <div className="grid md:grid-cols-3 gap-5 mb-5">
        <div>
          <label className="block text-xs font-medium tracking-[.08em] uppercase text-[var(--ink-mute)] mb-2">Цена (₽/м²)</label>
          <input type="number" step="0.01" name="price" defaultValue={initial?.price || ""} className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium tracking-[.08em] uppercase text-[var(--ink-mute)] mb-2">Размеры</label>
          <input type="text" name="dimensions" defaultValue={initial?.dimensions || ""} placeholder="600×1200×10mm" className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium tracking-[.08em] uppercase text-[var(--ink-mute)] mb-2">Цвет</label>
          <input type="text" name="color" defaultValue={initial?.color || ""} className={inputClass} />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-5 mb-5">
        <div>
          <label className="block text-xs font-medium tracking-[.08em] uppercase text-[var(--ink-mute)] mb-2">Поверхность</label>
          <input type="text" name="surface" defaultValue={initial?.surface || ""} placeholder="Матовая, полированная..." className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium tracking-[.08em] uppercase text-[var(--ink-mute)] mb-2">Вес</label>
          <input type="text" name="weight" defaultValue={initial?.weight || ""} className={inputClass} />
        </div>
      </div>

      {/* Active toggle */}
      <label className="flex items-center gap-3 mb-8 cursor-pointer">
        <input type="checkbox" name="isActive" defaultChecked={initial?.isActive ?? true} className="w-4 h-4 accent-[var(--ink)]" />
        <span className="text-sm text-[var(--ink-soft)]">Активен (виден в каталоге)</span>
      </label>

      {/* Images */}
      <div className="mb-8">
        <label className="block text-xs font-medium tracking-[.08em] uppercase text-[var(--ink-mute)] mb-3">Изображения</label>
        <div className="flex gap-3 flex-wrap mb-3">
          {images.map((url, i) => (
            <div key={i} className="relative w-24 h-24 rounded-sm overflow-hidden border border-[var(--line)]">
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full text-white text-xs flex items-center justify-center hover:bg-red-600 transition-colors"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <label className="inline-block px-5 py-2.5 text-[12px] font-medium border border-dashed border-[var(--line-2)] rounded-sm text-[var(--ink-mute)] hover:text-[var(--ink)] hover:border-[rgba(255,255,255,.32)] cursor-pointer transition-all">
          {uploading ? "Загрузка..." : "+ Загрузить изображение"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadFile(file);
              e.target.value = "";
            }}
          />
        </label>
        <p className="text-[11px] text-[var(--ink-faint)] mt-2">Или вставьте URL:</p>
        <div className="flex gap-2 mt-1">
          <input
            type="text"
            placeholder="https://..."
            className={`${inputClass} flex-1`}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const val = e.currentTarget.value.trim();
                if (val) { setImages((prev) => [...prev, val]); e.currentTarget.value = ""; }
              }
            }}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="px-8 py-4 text-[13.5px] font-medium bg-[var(--ink)] text-[#0a0d12] rounded-sm hover:bg-white transition-all disabled:opacity-50"
      >
        {loading ? "Сохранение..." : isEdit ? "Сохранить изменения" : "Создать товар"}
      </button>
    </form>
  );
}

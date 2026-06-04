"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Category {
  id: string;
  name: string;
  parentId?: string | null;
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
  thickness: string;
  boxWeight: string;
  boxQuantity: string;
  boxArea: string;
  wearResistance: string;
  antiSlip: string;
  rectified: string;
  frostResistant: string;
  stainResistant: string;
  technology: string;
  application: string;
  pdfUrl: string;
  zipUrl: string;
  isActive: boolean;
  isNew: boolean;
  isPopular: boolean;
  isOnSale: boolean;
  isMadeToOrder: boolean;
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
  const [pdfUrl, setPdfUrl] = useState(initial?.pdfUrl || "");
  const [zipUrl, setZipUrl] = useState(initial?.zipUrl || "");
  const [uploading, setUploading] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [uploadingZip, setUploadingZip] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Уведомление об успешной загрузке само исчезает через 4с
  useEffect(() => {
    if (uploadStatus?.type === "success") {
      const t = setTimeout(() => setUploadStatus(null), 4000);
      return () => clearTimeout(t);
    }
  }, [uploadStatus]);

  // Two-level category selection: main category + optional subcategory.
  const [cats, setCats] = useState<Category[]>(categories);
  const mains = cats.filter((c) => !c.parentId);
  const initialCat = cats.find((c) => c.id === initial?.categoryId);
  const [mainId, setMainId] = useState(initialCat ? initialCat.parentId || initialCat.id : "");
  const [subId, setSubId] = useState(initialCat?.parentId ? initialCat.id : "");
  const subs = cats.filter((c) => c.parentId === mainId);
  const effectiveCategoryId = subId || mainId;

  // Inline subcategory creation, right inside the product form.
  const [showNewSub, setShowNewSub] = useState(false);
  const [newSubName, setNewSubName] = useState("");
  const [creatingSub, setCreatingSub] = useState(false);
  const [subError, setSubError] = useState("");

  async function createSubcategory() {
    const name = newSubName.trim();
    if (!name || !mainId) return;
    setCreatingSub(true);
    setSubError("");
    try {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, parentId: mainId }),
      });
      if (res.ok) {
        const { category } = await res.json();
        setCats((prev) => [...prev, { id: category.id, name: category.name, parentId: category.parentId }]);
        setSubId(category.id);
        setNewSubName("");
        setShowNewSub(false);
      } else {
        const data = await res.json().catch(() => ({}));
        setSubError(data.error || "Не удалось создать подкатегорию");
      }
    } catch {
      setSubError("Ошибка сети");
    }
    setCreatingSub(false);
  }

  function slugify(text: string) {
    return text.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, "-").replace(/^-|-$/g, "");
  }

  async function uploadFile(file: File) {
    setUploading(true);
    setUploadStatus(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        setImages((prev) => [...prev, data.url]);
        setUploadStatus({ type: "success", message: `Изображение "${file.name}" загружено` });
      } else {
        const data = await res.json().catch(() => ({ error: "Ошибка сервера" }));
        setUploadStatus({ type: "error", message: data.error || "Не удалось загрузить изображение" });
      }
    } catch {
      setUploadStatus({ type: "error", message: "Ошибка сети при загрузке изображения" });
    }
    setUploading(false);
  }

  async function uploadDocument(file: File, type: "pdf" | "zip") {
    const setter = type === "pdf" ? setUploadingPdf : setUploadingZip;
    const urlSetter = type === "pdf" ? setPdfUrl : setZipUrl;
    setter(true);
    setUploadStatus(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        urlSetter(data.url);
        setUploadStatus({ type: "success", message: `Файл "${file.name}" загружен` });
      } else {
        const data = await res.json().catch(() => ({ error: "Ошибка сервера" }));
        setUploadStatus({ type: "error", message: data.error || `Не удалось загрузить ${type.toUpperCase()}` });
      }
    } catch {
      setUploadStatus({ type: "error", message: `Ошибка сети при загрузке ${type.toUpperCase()}` });
    }
    setter(false);
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
      price: ((form.get("price") as string) || "").trim().replace(",", "."),
      dimensions: form.get("dimensions") || "",
      surface: form.get("surface") || "",
      weight: form.get("weight") || "",
      collection: form.get("collection") || "",
      color: form.get("color") || "",
      thickness: form.get("thickness") || "",
      boxWeight: form.get("boxWeight") || "",
      boxQuantity: form.get("boxQuantity") || "",
      boxArea: form.get("boxArea") || "",
      wearResistance: form.get("wearResistance") || "",
      antiSlip: form.get("antiSlip") || "",
      rectified: form.get("rectified") || "",
      frostResistant: form.get("frostResistant") || "",
      stainResistant: form.get("stainResistant") || "",
      technology: form.get("technology") || "",
      application: form.get("application") || "",
      isActive: form.get("isActive") === "on",
      isNew: form.get("isNew") === "on",
      isPopular: form.get("isPopular") === "on",
      isOnSale: form.get("isOnSale") === "on",
      isMadeToOrder: form.get("isMadeToOrder") === "on",
      pdfUrl,
      zipUrl,
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
  // color-scheme:dark makes the native dropdown popup render dark instead of
  // white-on-light, so the options stay readable on the dark theme.
  const selectClass = `${inputClass} [color-scheme:dark] cursor-pointer`;
  const optionClass = "bg-[#15181d] text-[var(--ink)]";

  return (
    <form onSubmit={handleSubmit} className="max-w-[700px]">
      {error && (
        <div className="bg-[rgba(220,80,80,.12)] border border-[rgba(220,80,80,.3)] rounded-sm px-4 py-3 mb-6 text-[13px] text-[#e8a0a0]">
          {error}
        </div>
      )}

      {uploadStatus && (
        <div
          className={`animate-toast-in flex items-center gap-2.5 rounded-sm px-4 py-3 mb-6 text-[13px] ${
            uploadStatus.type === "success"
              ? "bg-[rgba(80,200,120,.12)] border border-[rgba(80,200,120,.3)] text-[#a0e8b0]"
              : "bg-[rgba(220,80,80,.12)] border border-[rgba(220,80,80,.3)] text-[#e8a0a0]"
          }`}
        >
          <span
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
              uploadStatus.type === "success" ? "bg-[rgba(80,200,120,.25)]" : "bg-[rgba(220,80,80,.25)]"
            }`}
          >
            {uploadStatus.type === "success" ? "✓" : "✗"}
          </span>
          {uploadStatus.message}
        </div>
      )}

      <div className="mb-5">
        <label className="block text-xs font-medium tracking-[.08em] uppercase text-[var(--ink-mute)] mb-2">Название *</label>
        <input
          type="text"
          name="name"
          required
          defaultValue={initial?.name || ""}
          className={inputClass}
          onChange={(e) => {
            const slugInput = e.currentTarget.form?.querySelector<HTMLInputElement>('[name="slug"]');
            if (slugInput) slugInput.value = slugify(e.target.value);
          }}
        />
        <input type="hidden" name="slug" defaultValue={initial?.slug || ""} />
      </div>

      <div className="grid md:grid-cols-3 gap-5 mb-5">
        <div>
          <label className="block text-xs font-medium tracking-[.08em] uppercase text-[var(--ink-mute)] mb-2">Категория *</label>
          <select
            value={mainId}
            onChange={(e) => { setMainId(e.target.value); setSubId(""); }}
            required
            className={selectClass}
          >
            <option value="" className={optionClass}>Выберите</option>
            {mains.map((c) => (
              <option key={c.id} value={c.id} className={optionClass}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium tracking-[.08em] uppercase text-[var(--ink-mute)] mb-2">Подкатегория</label>
          <select
            value={subId}
            onChange={(e) => setSubId(e.target.value)}
            disabled={subs.length === 0}
            className={`${selectClass} disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <option value="" className={optionClass}>{subs.length === 0 ? "— нет подкатегорий —" : "— без подкатегории —"}</option>
            {subs.map((c) => (
              <option key={c.id} value={c.id} className={optionClass}>{c.name}</option>
            ))}
          </select>

          {/* Inline create subcategory */}
          {mainId && !showNewSub && (
            <button
              type="button"
              onClick={() => { setShowNewSub(true); setSubError(""); }}
              className="mt-2 text-[11px] text-[var(--ink-mute)] hover:text-[var(--ink)] transition-colors cursor-pointer"
            >
              + Новая подкатегория
            </button>
          )}
          {!mainId && (
            <p className="mt-2 text-[11px] text-[var(--ink-faint)]">Сначала выберите категорию</p>
          )}
          {mainId && showNewSub && (
            <div className="mt-2 flex gap-1.5">
              <input
                type="text"
                autoFocus
                value={newSubName}
                onChange={(e) => setNewSubName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); createSubcategory(); }
                  if (e.key === "Escape") { setShowNewSub(false); setNewSubName(""); }
                }}
                placeholder="Название подкатегории"
                className={`${inputClass} py-2 text-[13px]`}
              />
              <button
                type="button"
                onClick={createSubcategory}
                disabled={creatingSub || !newSubName.trim()}
                className="shrink-0 px-3 py-2 text-[12px] font-medium bg-[var(--ink)] text-[#0a0d12] rounded-sm hover:bg-white transition-all disabled:opacity-40 cursor-pointer"
              >
                {creatingSub ? "..." : "Создать"}
              </button>
              <button
                type="button"
                onClick={() => { setShowNewSub(false); setNewSubName(""); setSubError(""); }}
                className="shrink-0 px-2.5 py-2 text-[14px] text-[var(--ink-mute)] hover:text-[var(--ink)] transition-colors cursor-pointer"
                aria-label="Отмена"
              >
                ×
              </button>
            </div>
          )}
          {subError && <p className="mt-1.5 text-[11px] text-red-400">{subError}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium tracking-[.08em] uppercase text-[var(--ink-mute)] mb-2">Коллекция</label>
          <input type="text" name="collection" defaultValue={initial?.collection || ""} placeholder="Alchemy, Kumo..." className={inputClass} />
        </div>
      </div>
      <input type="hidden" name="categoryId" value={effectiveCategoryId} />

      <div className="mb-5">
        <label className="block text-xs font-medium tracking-[.08em] uppercase text-[var(--ink-mute)] mb-2">Описание</label>
        <textarea name="description" rows={3} defaultValue={initial?.description || ""} className={inputClass} />
      </div>

      <div className="grid md:grid-cols-3 gap-5 mb-5">
        <div>
          <label className="block text-xs font-medium tracking-[.08em] uppercase text-[var(--ink-mute)] mb-2">Размеры</label>
          <input type="text" name="dimensions" defaultValue={initial?.dimensions || ""} placeholder="600×1200×10mm" className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium tracking-[.08em] uppercase text-[var(--ink-mute)] mb-2">Цвет</label>
          <input type="text" name="color" defaultValue={initial?.color || ""} className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium tracking-[.08em] uppercase text-[var(--ink-mute)] mb-2">Цена за м² (сом)</label>
          <input type="text" inputMode="decimal" name="price" defaultValue={initial?.price || ""} placeholder="2400" className={inputClass} />
          <p className="mt-1.5 text-[11px] text-[var(--ink-faint)]">Пусто — «Цена по запросу»</p>
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

      <div className="grid md:grid-cols-3 gap-5 mb-5">
        <div>
          <label className="block text-xs font-medium tracking-[.08em] uppercase text-[var(--ink-mute)] mb-2">Толщина</label>
          <input type="text" name="thickness" defaultValue={initial?.thickness || ""} placeholder="8 mm" className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium tracking-[.08em] uppercase text-[var(--ink-mute)] mb-2">Вес коробки</label>
          <input type="text" name="boxWeight" defaultValue={initial?.boxWeight || ""} placeholder="32.95 kg" className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium tracking-[.08em] uppercase text-[var(--ink-mute)] mb-2">Кол-во в коробке</label>
          <input type="text" name="boxQuantity" defaultValue={initial?.boxQuantity || ""} placeholder="5 шт" className={inputClass} />
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-5 mb-5">
        <div>
          <label className="block text-xs font-medium tracking-[.08em] uppercase text-[var(--ink-mute)] mb-2">Износостойкость</label>
          <input type="text" name="wearResistance" defaultValue={initial?.wearResistance || ""} placeholder="IV" className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium tracking-[.08em] uppercase text-[var(--ink-mute)] mb-2">Противоскольжение</label>
          <input type="text" name="antiSlip" defaultValue={initial?.antiSlip || ""} placeholder="R9" className={inputClass} />
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-5 mb-5">
        <div>
          <label className="block text-xs font-medium tracking-[.08em] uppercase text-[var(--ink-mute)] mb-2">Ректификация</label>
          <input type="text" name="rectified" defaultValue={initial?.rectified || ""} placeholder="Да / Нет" className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium tracking-[.08em] uppercase text-[var(--ink-mute)] mb-2">Морозостойкость</label>
          <input type="text" name="frostResistant" defaultValue={initial?.frostResistant || ""} placeholder="Да / Нет" className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium tracking-[.08em] uppercase text-[var(--ink-mute)] mb-2">Устойчивость к пятнам</label>
          <input type="text" name="stainResistant" defaultValue={initial?.stainResistant || ""} placeholder="Соответствует" className={inputClass} />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-5 mb-5">
        <div>
          <label className="block text-xs font-medium tracking-[.08em] uppercase text-[var(--ink-mute)] mb-2">Технология</label>
          <input type="text" name="technology" defaultValue={initial?.technology || ""} placeholder="Глазурованный керамогранит" className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium tracking-[.08em] uppercase text-[var(--ink-mute)] mb-2">Применение</label>
          <input type="text" name="application" defaultValue={initial?.application || ""} placeholder="Ванная, кухня, гостиная" className={inputClass} />
        </div>
      </div>

      {/* Active toggle */}
      <label className="flex items-center gap-3 mb-6 cursor-pointer">
        <input type="checkbox" name="isActive" defaultChecked={initial?.isActive ?? true} className="w-4 h-4 accent-[var(--ink)]" />
        <span className="text-sm text-[var(--ink-soft)]">Активен (виден в каталоге)</span>
      </label>

      {/* Badges */}
      <div className="mb-8">
        <label className="block text-xs font-medium tracking-[.08em] uppercase text-[var(--ink-mute)] mb-3">Метки на карточке</label>
        <div className="flex flex-wrap gap-2.5">
          {([
            { name: "isNew", label: "Новинка", checked: initial?.isNew, color: "var(--color-gold-400)" },
            { name: "isPopular", label: "Популярное / Хит", checked: initial?.isPopular, color: "#6fb0ff" },
            { name: "isOnSale", label: "Акция / Скидка", checked: initial?.isOnSale, color: "#ff7a7a" },
            { name: "isMadeToOrder", label: "Под заказ", checked: initial?.isMadeToOrder, color: "#d8a657" },
          ] as const).map((b) => (
            <label
              key={b.name}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-sm border border-[var(--line-2)] bg-[rgba(255,255,255,.02)] cursor-pointer hover:border-[rgba(255,255,255,.32)] transition-colors has-[:checked]:bg-[rgba(255,255,255,.06)] has-[:checked]:border-[rgba(255,255,255,.4)]"
            >
              <input type="checkbox" name={b.name} defaultChecked={b.checked ?? false} className="w-4 h-4" style={{ accentColor: b.color }} />
              <span className="text-[13px] text-[var(--ink-soft)]">{b.label}</span>
            </label>
          ))}
        </div>
        <p className="text-[11px] text-[var(--ink-faint)] mt-2">Метки показываются на карточке товара в каталоге.</p>
      </div>

      {/* Images */}
      <div className="mb-8">
        <label className="block text-xs font-medium tracking-[.08em] uppercase text-[var(--ink-mute)] mb-3">Изображения</label>
        <div className="flex gap-3 flex-wrap mb-3">
          {images.map((url, i) => (
            <div key={i} className="animate-thumb-in relative w-24 h-24 rounded-sm overflow-hidden border border-[var(--line)]">
              {/* шиммер-подложка видна, пока миниатюра грузится; фото перекрывает её */}
              <div className="absolute inset-0 shimmer" />
              <img
                src={url}
                alt=""
                className="relative w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                className="absolute top-1 right-1 z-10 w-5 h-5 bg-black/60 rounded-full text-white text-xs flex items-center justify-center hover:bg-red-600 transition-colors"
              >
                ×
              </button>
            </div>
          ))}
          {/* плитка-индикатор пока фото загружается на сервер */}
          {uploading && (
            <div className="animate-thumb-in relative w-24 h-24 rounded-sm overflow-hidden border border-[var(--line)] flex flex-col items-center justify-center gap-2 bg-[rgba(255,255,255,.03)]">
              <div className="h-6 w-6 rounded-full border-2 border-[var(--line-2)] border-t-[var(--color-gold-400)] animate-spin" />
              <span className="text-[10px] text-[var(--ink-mute)]">Загрузка…</span>
            </div>
          )}
        </div>
        <label
          className={`inline-flex items-center gap-2 px-5 py-2.5 text-[12px] font-medium border border-dashed border-[var(--line-2)] rounded-sm transition-all ${
            uploading
              ? "text-[var(--ink-faint)] cursor-wait pointer-events-none"
              : "text-[var(--ink-mute)] hover:text-[var(--ink)] hover:border-[rgba(255,255,255,.32)] cursor-pointer"
          }`}
        >
          {uploading ? (
            <>
              <span className="h-3.5 w-3.5 rounded-full border-2 border-[var(--line-2)] border-t-[var(--color-gold-400)] animate-spin" />
              Загрузка…
            </>
          ) : (
            "+ Загрузить изображение"
          )}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={uploading}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadFile(file);
              e.target.value = "";
            }}
          />
        </label>
        {/* Ошибка загрузки — прямо у кнопки, чтобы было видно */}
        {uploadStatus?.type === "error" && (
          <p className="animate-toast-in mt-2 text-[12px] text-[#e8a0a0]">✗ {uploadStatus.message}</p>
        )}
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

      {/* Documents */}
      <div className="mb-8">
        <label className="block text-xs font-medium tracking-[.08em] uppercase text-[var(--ink-mute)] mb-3">Файлы для дизайнеров</label>

        {/* PDF */}
        <div className="mb-4 p-4 border border-[var(--line)] rounded-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-[var(--ink-soft)]">📄 Карта продукта (PDF)</span>
            {pdfUrl && (
              <button type="button" onClick={() => setPdfUrl("")} className="text-[11px] text-red-400 hover:text-red-300">
                Удалить
              </button>
            )}
          </div>
          {pdfUrl ? (
            <a href={pdfUrl} target="_blank" rel="noreferrer" className="text-[12px] text-blue-400 hover:underline break-all">{pdfUrl}</a>
          ) : (
            <label className="inline-block px-4 py-2 text-[12px] font-medium border border-dashed border-[var(--line-2)] rounded-sm text-[var(--ink-mute)] hover:text-[var(--ink)] hover:border-[rgba(255,255,255,.32)] cursor-pointer transition-all">
              {uploadingPdf ? "Загрузка..." : "+ Загрузить PDF"}
              <input type="file" accept=".pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadDocument(f, "pdf"); e.target.value = ""; }} />
            </label>
          )}
        </div>

        {/* ZIP */}
        <div className="p-4 border border-[var(--line)] rounded-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-[var(--ink-soft)]">📦 Текстуры (ZIP)</span>
            {zipUrl && (
              <button type="button" onClick={() => setZipUrl("")} className="text-[11px] text-red-400 hover:text-red-300">
                Удалить
              </button>
            )}
          </div>
          {zipUrl ? (
            <a href={zipUrl} target="_blank" rel="noreferrer" className="text-[12px] text-blue-400 hover:underline break-all">{zipUrl}</a>
          ) : (
            <label className="inline-block px-4 py-2 text-[12px] font-medium border border-dashed border-[var(--line-2)] rounded-sm text-[var(--ink-mute)] hover:text-[var(--ink)] hover:border-[rgba(255,255,255,.32)] cursor-pointer transition-all">
              {uploadingZip ? "Загрузка..." : "+ Загрузить ZIP"}
              <input type="file" accept=".zip" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadDocument(f, "zip"); e.target.value = ""; }} />
            </label>
          )}
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

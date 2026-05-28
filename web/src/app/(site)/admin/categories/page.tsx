"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Category {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  parentId: string | null;
  parent: { id: string; name: string } | null;
  _count: { products: number; children: number };
}

export default function AdminCategoriesPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadCategories(); }, []);

  async function loadCategories() {
    const res = await fetch("/api/admin/categories");
    if (res.ok) {
      const data = await res.json();
      setCategories(data.categories);
    }
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const form = new FormData(e.currentTarget);
    const body = {
      name: form.get("name"),
      slug: form.get("slug"),
      sortOrder: parseInt(form.get("sortOrder") as string) || 0,
      parentId: (form.get("parentId") as string) || null,
    };

    const url = editId ? `/api/admin/categories/${editId}` : "/api/admin/categories";
    const method = editId ? "PUT" : "POST";
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

    setShowForm(false);
    setEditId(null);
    setSaving(false);
    loadCategories();
  }

  async function handleDelete(id: string, name: string, productCount: number, childCount: number) {
    if (productCount > 0) {
      alert(`Нельзя удалить: ${productCount} товаров в категории "${name}"`);
      return;
    }
    if (childCount > 0) {
      alert(`Нельзя удалить: ${childCount} подкатегорий внутри "${name}"`);
      return;
    }
    if (!confirm(`Удалить категорию "${name}"?`)) return;
    await fetch(`/api/admin/categories/${id}`, { method: "DELETE" });
    loadCategories();
  }

  const inputClass =
    "w-full px-4 py-3 bg-[rgba(255,255,255,.04)] border border-[var(--line-2)] rounded-sm text-[var(--ink)] text-sm outline-none focus:border-[rgba(255,255,255,.34)] focus:bg-[rgba(255,255,255,.07)] transition-all placeholder:text-[var(--ink-faint)]";

  // Order rows so each main category is followed by its indented children
  const ordered: { cat: Category; depth: number }[] = [];
  for (const t of categories.filter((c) => !c.parentId)) {
    ordered.push({ cat: t, depth: 0 });
    for (const ch of categories.filter((c) => c.parentId === t.id)) {
      ordered.push({ cat: ch, depth: 1 });
    }
  }
  // Orphans (parent missing) shown at top level
  for (const c of categories) {
    if (c.parentId && !categories.some((p) => p.id === c.parentId)) {
      ordered.push({ cat: c, depth: 0 });
    }
  }

  return (
    <div className="pb-12">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-[clamp(22px,2.5vw,30px)] font-extralight tracking-tight">Категории</h2>
          <button
            onClick={() => { setShowForm(true); setEditId(null); }}
            className="px-5 py-2.5 text-[12px] font-medium bg-[var(--ink)] text-[#0a0d12] rounded-md hover:bg-white transition-all duration-200 cursor-pointer"
          >
            + Добавить
          </button>
        </div>

        {showForm && (
          <div className="mb-8 p-6 border border-[var(--line-2)] rounded-sm bg-[var(--panel)]">
            <h3 className="text-lg font-light mb-4">{editId ? "Редактировать" : "Новая категория"}</h3>
            <form onSubmit={handleSubmit}>
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-medium tracking-[.08em] uppercase text-[var(--ink-mute)] mb-2">Название</label>
                  <input type="text" name="name" required defaultValue={editId ? categories.find((c) => c.id === editId)?.name : ""} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium tracking-[.08em] uppercase text-[var(--ink-mute)] mb-2">Slug <span className="text-[var(--ink-faint)] normal-case tracking-normal">(необязательно)</span></label>
                  <input type="text" name="slug" placeholder="авто из названия" defaultValue={editId ? categories.find((c) => c.id === editId)?.slug : ""} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium tracking-[.08em] uppercase text-[var(--ink-mute)] mb-2">Родительская категория</label>
                  <select name="parentId" defaultValue={editId ? categories.find((c) => c.id === editId)?.parentId ?? "" : ""} className={`${inputClass} [color-scheme:dark] cursor-pointer`}>
                    <option value="" className="bg-[#15181d] text-[var(--ink)]">— Главная категория —</option>
                    {categories
                      .filter((c) => !c.parentId && c.id !== editId)
                      .map((c) => (
                        <option key={c.id} value={c.id} className="bg-[#15181d] text-[var(--ink)]">{c.name}</option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium tracking-[.08em] uppercase text-[var(--ink-mute)] mb-2">Порядок</label>
                  <input type="number" name="sortOrder" defaultValue={editId ? categories.find((c) => c.id === editId)?.sortOrder : 0} className={inputClass} />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={saving} className="px-5 py-3 text-[13px] font-medium bg-[var(--ink)] text-[#0a0d12] rounded-sm hover:bg-white transition-all disabled:opacity-50">
                  {saving ? "..." : "Сохранить"}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setEditId(null); }} className="px-4 py-3 text-[13px] text-[var(--ink-mute)] hover:text-[var(--ink)] transition-colors">
                  Отмена
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="text-[var(--ink-mute)] py-10">Загрузка...</div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left text-[11px] tracking-[.14em] uppercase text-[var(--ink-mute)] font-medium border-b border-[var(--line-2)]">
                <th className="py-3">Название</th>
                <th className="py-3">Slug</th>
                <th className="py-3">Порядок</th>
                <th className="py-3">Подкат.</th>
                <th className="py-3">Товаров</th>
                <th className="py-3 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {ordered.map(({ cat, depth }) => (
                <tr key={cat.id} className="border-b border-[var(--line)] hover:bg-[rgba(255,255,255,.02)] transition-colors">
                  <td className="py-3 text-sm">
                    {depth === 1 ? (
                      <span className="text-[var(--ink-soft)]">
                        <span className="text-[var(--ink-faint)] mr-2 pl-4">└</span>
                        {cat.name}
                      </span>
                    ) : (
                      <span className="font-medium">{cat.name}</span>
                    )}
                  </td>
                  <td className="py-3 text-sm text-[var(--ink-mute)]">{cat.slug}</td>
                  <td className="py-3 text-sm text-[var(--ink-mute)]">{cat.sortOrder}</td>
                  <td className="py-3 text-sm text-[var(--ink-mute)]">{cat._count.children || "—"}</td>
                  <td className="py-3 text-sm">{cat._count.products}</td>
                  <td className="py-3">
                    <div className="flex gap-3">
                      <button
                        onClick={() => { setEditId(cat.id); setShowForm(true); }}
                        className="text-[12px] text-[var(--ink-mute)] hover:text-[var(--ink)] transition-colors"
                      >
                        Ред.
                      </button>
                      <button
                        onClick={() => handleDelete(cat.id, cat.name, cat._count.products, cat._count.children)}
                        className="text-[12px] text-red-400/60 hover:text-red-400 transition-colors"
                      >
                        Удл.
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
    </div>
  );
}

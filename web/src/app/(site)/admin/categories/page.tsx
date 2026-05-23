"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Category {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  _count: { products: number };
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
    };

    const url = editId ? `/api/admin/categories/${editId}` : "/api/admin/categories";
    const method = editId ? "PUT" : "POST";
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

    setShowForm(false);
    setEditId(null);
    setSaving(false);
    loadCategories();
  }

  async function handleDelete(id: string, name: string, productCount: number) {
    if (productCount > 0) {
      alert(`Нельзя удалить: ${productCount} товаров в категории "${name}"`);
      return;
    }
    if (!confirm(`Удалить категорию "${name}"?`)) return;
    await fetch(`/api/admin/categories/${id}`, { method: "DELETE" });
    loadCategories();
  }

  const inputClass =
    "w-full px-4 py-3 bg-[rgba(255,255,255,.04)] border border-[var(--line-2)] rounded-sm text-[var(--ink)] text-sm outline-none focus:border-[rgba(255,255,255,.34)] focus:bg-[rgba(255,255,255,.07)] transition-all placeholder:text-[var(--ink-faint)]";

  return (
    <section className="py-20">
      <div className="max-w-[1320px] mx-auto px-10">
        <div className="flex justify-between items-center mb-10">
          <div>
            <Link href="/admin" className="text-[13px] text-[var(--ink-mute)] hover:text-[var(--ink)] transition-colors mb-3 inline-block">
              ← Админ-панель
            </Link>
            <h2 className="text-3xl font-extralight">Категории</h2>
          </div>
          <button
            onClick={() => { setShowForm(true); setEditId(null); }}
            className="px-6 py-3 text-[13px] font-medium bg-[var(--ink)] text-[#0a0d12] rounded-sm hover:bg-white transition-all"
          >
            + Добавить
          </button>
        </div>

        {showForm && (
          <div className="mb-8 p-6 border border-[var(--line-2)] rounded-sm bg-[var(--panel)]">
            <h3 className="text-lg font-light mb-4">{editId ? "Редактировать" : "Новая категория"}</h3>
            <form onSubmit={handleSubmit} className="grid md:grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-xs font-medium tracking-[.08em] uppercase text-[var(--ink-mute)] mb-2">Название</label>
                <input type="text" name="name" required defaultValue={editId ? categories.find((c) => c.id === editId)?.name : ""} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium tracking-[.08em] uppercase text-[var(--ink-mute)] mb-2">Slug</label>
                <input type="text" name="slug" required defaultValue={editId ? categories.find((c) => c.id === editId)?.slug : ""} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium tracking-[.08em] uppercase text-[var(--ink-mute)] mb-2">Порядок</label>
                <input type="number" name="sortOrder" defaultValue={editId ? categories.find((c) => c.id === editId)?.sortOrder : 0} className={inputClass} />
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
                <th className="py-3">Товаров</th>
                <th className="py-3 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <tr key={cat.id} className="border-b border-[var(--line)] hover:bg-[rgba(255,255,255,.02)] transition-colors">
                  <td className="py-3 text-sm">{cat.name}</td>
                  <td className="py-3 text-sm text-[var(--ink-mute)]">{cat.slug}</td>
                  <td className="py-3 text-sm text-[var(--ink-mute)]">{cat.sortOrder}</td>
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
                        onClick={() => handleDelete(cat.id, cat.name, cat._count.products)}
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
    </section>
  );
}

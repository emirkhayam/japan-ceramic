"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import TablePager from "@/components/admin/TablePager";

const PER_PAGE = 20;

type Product = {
  id: string;
  name: string;
  slug: string;
  collection: string | null;
  isActive: boolean;
  category: { id: string; name: string };
  images: { imageUrl: string }[];
};

type Category = { id: string; name: string };

interface ProductsTableProps {
  products: Product[];
  categories: Category[];
}

export default function ProductsTable({ products, categories }: ProductsTableProps) {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "hidden">("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (categoryFilter && p.category.id !== categoryFilter) return false;
      if (statusFilter === "active" && !p.isActive) return false;
      if (statusFilter === "hidden" && p.isActive) return false;
      return true;
    });
  }, [products, search, categoryFilter, statusFilter]);

  // Клиентская пагинация. Сброс на 1-ю страницу при смене фильтров.
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [search, categoryFilter, statusFilter]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const pageNum = Math.min(page, pageCount);
  const pageItems = filtered.slice((pageNum - 1) * PER_PAGE, pageNum * PER_PAGE);

  const allSelected = filtered.length > 0 && filtered.every((p) => selectedIds.has(p.id));

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((p) => p.id)));
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulkDelete() {
    if (!confirm(`Удалить ${selectedIds.size} товар(ов)?`)) return;
    setLoading(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          fetch(`/api/admin/products/${id}`, { method: "DELETE" })
        )
      );
      setSelectedIds(new Set());
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function bulkToggleStatus() {
    setLoading(true);
    try {
      const selected = products.filter((p) => selectedIds.has(p.id));
      await Promise.all(
        selected.map((p) =>
          fetch(`/api/admin/products/${p.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isActive: !p.isActive }),
          })
        )
      );
      setSelectedIds(new Set());
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "bg-[rgba(255,255,255,.04)] border border-[var(--line-2)] rounded-md text-[var(--ink)] text-[13px] outline-none focus:border-[rgba(255,255,255,.34)] transition-all duration-200 placeholder:text-[var(--ink-faint)]";

  return (
    <div>
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <input
          type="text"
          placeholder="Поиск по названию..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${inputClass} px-3 py-2 w-64`}
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className={`${inputClass} px-3 py-2 cursor-pointer [color-scheme:dark]`}
        >
          <option value="" className="bg-[#15181d] text-[var(--ink)]">Все категории</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id} className="bg-[#15181d] text-[var(--ink)]">
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "" | "active" | "hidden")}
          className={`${inputClass} px-3 py-2 cursor-pointer [color-scheme:dark]`}
        >
          <option value="" className="bg-[#15181d] text-[var(--ink)]">Все статусы</option>
          <option value="active" className="bg-[#15181d] text-[var(--ink)]">Активен</option>
          <option value="hidden" className="bg-[#15181d] text-[var(--ink)]">Скрыт</option>
        </select>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-[12px] text-[var(--ink-mute)]">
              Выбрано: {selectedIds.size}
            </span>
            <button
              onClick={bulkToggleStatus}
              disabled={loading}
              className="text-[12px] px-3 py-1.5 border border-[var(--line-2)] rounded-md text-[var(--ink-soft)] hover:bg-[rgba(255,255,255,.06)] transition-all duration-200 cursor-pointer disabled:opacity-50"
            >
              Переключить статус
            </button>
            <button
              onClick={bulkDelete}
              disabled={loading}
              className="text-[12px] px-3 py-1.5 border border-red-800/60 rounded-md text-red-400 hover:bg-red-900/30 transition-all duration-200 cursor-pointer disabled:opacity-50"
            >
              Удалить
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse min-w-[800px]">
          <thead>
            <tr className="text-left text-[11px] tracking-[.14em] uppercase text-[var(--ink-mute)] font-medium border-b border-[var(--line-2)]">
              <th className="py-3 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="cursor-pointer accent-[var(--ink)]"
                />
              </th>
              <th className="py-3 w-16"></th>
              <th className="py-3">Название</th>
              <th className="py-3">Коллекция</th>
              <th className="py-3">Категория</th>
              <th className="py-3 w-20">Статус</th>
              <th className="py-3 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((product) => (
              <tr
                key={product.id}
                className="border-b border-[var(--line)] hover:bg-[rgba(255,255,255,.02)] transition-colors duration-200"
              >
                <td className="py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(product.id)}
                    onChange={() => toggleSelect(product.id)}
                    className="cursor-pointer accent-[var(--ink)]"
                  />
                </td>
                <td className="py-3">
                  {product.images[0] ? (
                    <img
                      src={product.images[0].imageUrl}
                      alt=""
                      className="w-12 h-12 rounded-sm object-cover border border-[var(--line)]"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-sm bg-[var(--panel)] border border-[var(--line)]" />
                  )}
                </td>
                <td className="py-3">
                  <div className="text-sm font-normal">{product.name}</div>
                  <div className="text-[11px] text-[var(--ink-faint)]">{product.slug}</div>
                </td>
                <td className="py-3 text-sm text-[var(--ink-soft)]">
                  {product.collection || "\u2014"}
                </td>
                <td className="py-3 text-sm text-[var(--ink-soft)]">{product.category.name}</td>
                <td className="py-3">
                  <span
                    className={`text-[11px] px-2 py-1 rounded-sm ${
                      product.isActive
                        ? "bg-green-900/30 text-green-400"
                        : "bg-red-900/30 text-red-400"
                    }`}
                  >
                    {product.isActive ? "Активен" : "Скрыт"}
                  </span>
                </td>
                <td className="py-3">
                  <Link
                    href={`/admin/products/${product.id}`}
                    className="text-[12px] px-3 py-1.5 border border-[var(--line-2)] rounded-sm text-[var(--ink-soft)] hover:bg-[var(--ink)] hover:text-[#0a0d12] hover:border-[var(--ink)] transition-all duration-200 cursor-pointer"
                  >
                    Ред.
                  </Link>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-[var(--ink-mute)] text-sm">
                  Товары не найдены
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <TablePager page={pageNum} pageCount={pageCount} onPage={setPage} />
      {filtered.length > PER_PAGE && (
        <p className="mt-3 text-center text-[12px] text-[var(--ink-faint)] tabular-nums">
          {(pageNum - 1) * PER_PAGE + 1}–{Math.min(pageNum * PER_PAGE, filtered.length)} из {filtered.length}
        </p>
      )}
    </div>
  );
}

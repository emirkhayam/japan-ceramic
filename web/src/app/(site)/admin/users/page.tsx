"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface UserData {
  id: string;
  email: string;
  fullName: string;
  company: string | null;
  phone: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
  _count: { projects: number; favorites: number };
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadUsers(); }, []);

  async function loadUsers() {
    const res = await fetch("/api/admin/users");
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users);
    }
    setLoading(false);
  }

  async function toggleActive(id: string, currentActive: boolean) {
    await fetch(`/api/admin/users/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !currentActive }),
    });
    loadUsers();
  }

  async function toggleRole(id: string, currentRole: string) {
    const newRole = currentRole === "admin" ? "designer" : "admin";
    if (!confirm(`Изменить роль на "${newRole}"?`)) return;
    await fetch(`/api/admin/users/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    loadUsers();
  }

  return (
    <section className="py-20">
      <div className="max-w-[1320px] mx-auto px-10">
        <Link href="/admin" className="text-[13px] text-[var(--ink-mute)] hover:text-[var(--ink)] transition-colors mb-3 inline-block">
          ← Админ-панель
        </Link>
        <h2 className="text-3xl font-extralight mb-10">Пользователи ({users.length})</h2>

        {loading ? (
          <div className="text-[var(--ink-mute)] py-10">Загрузка...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[800px]">
              <thead>
                <tr className="text-left text-[11px] tracking-[.14em] uppercase text-[var(--ink-mute)] font-medium border-b border-[var(--line-2)]">
                  <th className="py-3">Имя</th>
                  <th className="py-3">Email</th>
                  <th className="py-3">Компания</th>
                  <th className="py-3">Роль</th>
                  <th className="py-3">Проекты</th>
                  <th className="py-3">Избр.</th>
                  <th className="py-3">Статус</th>
                  <th className="py-3">Дата</th>
                  <th className="py-3 w-20"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-[var(--line)] hover:bg-[rgba(255,255,255,.02)] transition-colors">
                    <td className="py-3 text-sm">{u.fullName}</td>
                    <td className="py-3 text-sm text-[var(--ink-soft)]">{u.email}</td>
                    <td className="py-3 text-sm text-[var(--ink-mute)]">{u.company || "—"}</td>
                    <td className="py-3">
                      <button
                        onClick={() => toggleRole(u.id, u.role)}
                        className={`text-[11px] px-2 py-1 rounded-sm cursor-pointer ${
                          u.role === "admin" ? "bg-purple-900/30 text-purple-400" : "bg-blue-900/30 text-blue-400"
                        }`}
                      >
                        {u.role}
                      </button>
                    </td>
                    <td className="py-3 text-sm text-[var(--ink-mute)]">{u._count.projects}</td>
                    <td className="py-3 text-sm text-[var(--ink-mute)]">{u._count.favorites}</td>
                    <td className="py-3">
                      <span className={`text-[11px] px-2 py-1 rounded-sm ${u.isActive ? "bg-green-900/30 text-green-400" : "bg-red-900/30 text-red-400"}`}>
                        {u.isActive ? "Активен" : "Заблок."}
                      </span>
                    </td>
                    <td className="py-3 text-[12px] text-[var(--ink-faint)]">
                      {new Date(u.createdAt).toLocaleDateString("ru")}
                    </td>
                    <td className="py-3">
                      <button
                        onClick={() => toggleActive(u.id, u.isActive)}
                        className="text-[12px] text-[var(--ink-mute)] hover:text-[var(--ink)] transition-colors"
                      >
                        {u.isActive ? "Заблок." : "Разблок."}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

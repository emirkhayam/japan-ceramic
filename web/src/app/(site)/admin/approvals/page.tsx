"use client";

import { useEffect, useState } from "react";
import { Check, X, MessageCircle, Clock } from "lucide-react";

interface PendingUser {
  id: string;
  email: string;
  fullName: string;
  company: string | null;
  phone: string | null;
  createdAt: string;
}

function waLink(u: PendingUser) {
  if (!u.phone) return null;
  const digits = u.phone.replace(/[^\d]/g, "");
  if (digits.length < 6) return null;
  const text = `Здравствуйте, ${u.fullName}! Это Japan Ceramic — мы получили вашу заявку на доступ дизайнера.`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export default function AdminApprovalsPage() {
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => { loadUsers(); }, []);

  async function loadUsers() {
    const res = await fetch("/api/admin/approvals");
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users);
    }
    setLoading(false);
  }

  async function setStatus(id: string, status: "approved" | "rejected") {
    if (status === "rejected" && !confirm("Отклонить заявку? Дизайнер не сможет войти.")) return;
    setBusyId(id);
    await fetch(`/api/admin/users/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    // Заявка ушла из списка pending — убираем строку локально и перечитываем.
    setUsers((prev) => prev.filter((u) => u.id !== id));
    setBusyId(null);
  }

  return (
    <div className="pb-12">
      <h2 className="text-[clamp(22px,2.5vw,30px)] font-extralight tracking-tight mb-2">
        Заявки на регистрацию
        <span className="text-[var(--ink-faint)] text-lg ml-2 font-light">{users.length}</span>
      </h2>
      <p className="text-[13px] text-[var(--ink-mute)] mb-8">
        Новые дизайнеры. Одобрите доступ или свяжитесь по WhatsApp перед решением.
      </p>

      {loading ? (
        <div className="text-[var(--ink-mute)] py-10">Загрузка...</div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center text-center gap-3 border border-dashed border-[var(--line-2)] rounded-lg py-16 px-6">
          <div className="w-11 h-11 rounded-full bg-[rgba(255,255,255,.04)] border border-[var(--line-2)] flex items-center justify-center text-[var(--ink-faint)]">
            <Clock size={20} strokeWidth={1.5} />
          </div>
          <div className="text-[var(--ink-soft)] text-sm">Новых заявок нет</div>
          <div className="text-[var(--ink-faint)] text-[12.5px]">Здесь появятся дизайнеры, ожидающие одобрения.</div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[760px]">
            <thead>
              <tr className="text-left text-[11px] tracking-[.14em] uppercase text-[var(--ink-mute)] font-medium border-b border-[var(--line-2)]">
                <th className="py-3">Имя</th>
                <th className="py-3">Email</th>
                <th className="py-3">Компания</th>
                <th className="py-3">Телефон</th>
                <th className="py-3">Дата</th>
                <th className="py-3 w-[260px]">Действия</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const wa = waLink(u);
                const busy = busyId === u.id;
                return (
                  <tr key={u.id} className="border-b border-[var(--line)] hover:bg-[rgba(255,255,255,.02)] transition-colors">
                    <td className="py-3 text-sm">{u.fullName}</td>
                    <td className="py-3 text-sm text-[var(--ink-soft)]">{u.email}</td>
                    <td className="py-3 text-sm text-[var(--ink-mute)]">{u.company || "—"}</td>
                    <td className="py-3 text-sm text-[var(--ink-mute)]">{u.phone || "—"}</td>
                    <td className="py-3 text-[12px] text-[var(--ink-faint)]">
                      {new Date(u.createdAt).toLocaleDateString("ru")}
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setStatus(u.id, "approved")}
                          disabled={busy}
                          className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-sm bg-[var(--color-gold-500)] text-[var(--on-gold)] hover:bg-[var(--color-gold-400)] transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          <Check size={14} strokeWidth={2.2} /> Одобрить
                        </button>
                        <button
                          onClick={() => setStatus(u.id, "rejected")}
                          disabled={busy}
                          className="inline-flex items-center gap-1.5 text-[12px] px-2.5 py-1.5 rounded-sm border border-[var(--line-2)] text-[var(--ink-mute)] hover:text-red-400/90 hover:border-red-400/40 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          <X size={14} strokeWidth={2.2} /> Отклонить
                        </button>
                        {wa && (
                          <a
                            href={wa}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Написать в WhatsApp"
                            className="inline-flex items-center gap-1.5 text-[12px] px-2.5 py-1.5 rounded-sm border border-[rgba(37,211,102,.4)] text-[#3ddc84] hover:bg-[rgba(37,211,102,.1)] transition-colors cursor-pointer"
                          >
                            <MessageCircle size={14} strokeWidth={2} /> WhatsApp
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

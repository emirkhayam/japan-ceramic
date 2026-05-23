"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CreateProjectForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);

    const res = await fetch("/api/cabinet/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        description: form.get("description") || undefined,
      }),
    });

    if (res.ok) {
      setOpen(false);
      router.refresh();
    }
    setLoading(false);
  }

  const inputClass =
    "w-full px-[18px] py-3.5 bg-[rgba(255,255,255,.04)] border border-[var(--line-2)] rounded-sm text-[var(--ink)] text-sm outline-none focus:border-[rgba(255,255,255,.34)] focus:bg-[rgba(255,255,255,.07)] transition-all placeholder:text-[var(--ink-faint)]";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-6 py-3 text-[12.5px] font-medium border border-[var(--line-2)] rounded-sm text-[var(--ink)] hover:bg-[rgba(255,255,255,.05)] hover:border-[rgba(255,255,255,.34)] transition-all duration-400"
      >
        + Новый проект
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[2000] bg-[rgba(8,10,15,.85)] backdrop-blur-[10px] flex items-center justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="bg-[var(--panel)] border border-[var(--line-2)] rounded-sm p-10 w-full max-w-[440px]">
            <h3 className="text-2xl font-extralight mb-6">Новый проект</h3>
            <form onSubmit={handleSubmit}>
              <div className="mb-5">
                <label className="block text-xs font-medium tracking-[.08em] uppercase text-[var(--ink-mute)] mb-2">
                  Название проекта
                </label>
                <input type="text" name="name" required placeholder="Например: Ванная Петровых" className={inputClass} />
              </div>
              <div className="mb-5">
                <label className="block text-xs font-medium tracking-[.08em] uppercase text-[var(--ink-mute)] mb-2">
                  Описание
                </label>
                <textarea name="description" rows={3} placeholder="Необязательно" className={inputClass} />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-[17px] text-[13.5px] font-medium bg-[var(--ink)] text-[#0a0d12] rounded-sm hover:bg-white transition-all duration-500 disabled:opacity-50"
              >
                {loading ? "Создание..." : "Создать"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

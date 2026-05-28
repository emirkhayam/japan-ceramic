"use client";

import Link from "next/link";
import { useState } from "react";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password"),
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const from = new URLSearchParams(window.location.search).get("from");
      const dest = from || (data.role === "admin" ? "/admin" : "/cabinet");
      window.location.href = dest;
      return;
    } else {
      const data = await res.json();
      setError(data.error || "Ошибка входа");
    }
    setLoading(false);
  }

  return (
    <div className="max-w-[420px] mx-auto px-10 py-20">
      <h2 className="text-4xl font-extralight mb-2.5">Вход</h2>
      <p className="text-sm text-[var(--ink-mute)] mb-10">
        Войдите в личный кабинет дизайнера
      </p>

      {error && (
        <div className="bg-[rgba(220,80,80,.12)] border border-[rgba(220,80,80,.3)] rounded-sm px-[18px] py-3.5 mb-6 text-[13px] text-[#e8a0a0]">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mb-5">
          <label className="block text-xs font-medium tracking-[.08em] uppercase text-[var(--ink-mute)] mb-2">
            Email
          </label>
          <input
            type="email"
            name="email"
            required
            placeholder="your@email.com"
            className="w-full px-[18px] py-3.5 bg-[rgba(255,255,255,.04)] border border-[var(--line-2)] rounded-sm text-[var(--ink)] text-sm outline-none focus:border-[rgba(255,255,255,.34)] focus:bg-[rgba(255,255,255,.07)] transition-all placeholder:text-[var(--ink-faint)]"
          />
        </div>
        <div className="mb-5">
          <label className="block text-xs font-medium tracking-[.08em] uppercase text-[var(--ink-mute)] mb-2">
            Пароль
          </label>
          <input
            type="password"
            name="password"
            required
            placeholder="Ваш пароль"
            className="w-full px-[18px] py-3.5 bg-[rgba(255,255,255,.04)] border border-[var(--line-2)] rounded-sm text-[var(--ink)] text-sm outline-none focus:border-[rgba(255,255,255,.34)] focus:bg-[rgba(255,255,255,.07)] transition-all placeholder:text-[var(--ink-faint)]"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-[17px] text-[13.5px] font-medium bg-[var(--ink)] text-[#0a0d12] rounded-sm hover:bg-white transition-all duration-500 disabled:opacity-50"
        >
          {loading ? "Вход..." : "Войти"}
        </button>
      </form>

      <p className="mt-8 text-[13px] text-[var(--ink-mute)]">
        Нет аккаунта?{" "}
        <Link href="/auth/register" className="text-[var(--ink-soft)] border-b border-[var(--line-2)] hover:text-[var(--ink)] transition-colors">
          Зарегистрируйтесь
        </Link>
      </p>
    </div>
  );
}

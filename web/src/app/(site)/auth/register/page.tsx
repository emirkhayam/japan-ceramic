"use client";

import Link from "next/link";
import { useState } from "react";

export default function RegisterPage() {
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErrors([]);

    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password"),
        fullName: form.get("fullName"),
        company: form.get("company") || undefined,
        phone: form.get("phone") || undefined,
      }),
    });

    if (res.ok) {
      window.location.href = "/cabinet";
      return;
    } else {
      const data = await res.json();
      setErrors(data.errors || [data.error || "Ошибка регистрации"]);
    }
    setLoading(false);
  }

  const inputClass =
    "w-full px-[18px] py-3.5 bg-[rgba(255,255,255,.04)] border border-[var(--line-2)] rounded-sm text-[var(--ink)] text-sm outline-none focus:border-[rgba(255,255,255,.34)] focus:bg-[rgba(255,255,255,.07)] transition-all placeholder:text-[var(--ink-faint)]";

  return (
    <div className="max-w-[420px] mx-auto px-10 py-20">
      <h2 className="text-4xl font-extralight mb-2.5">Регистрация</h2>
      <p className="text-sm text-[var(--ink-mute)] mb-10">
        Создайте аккаунт дизайнера
      </p>

      {errors.length > 0 && (
        <div className="bg-[rgba(220,80,80,.12)] border border-[rgba(220,80,80,.3)] rounded-sm px-[18px] py-3.5 mb-6 text-[13px] text-[#e8a0a0]">
          {errors.map((e, i) => (
            <div key={i}>{e}</div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mb-5">
          <label className="block text-xs font-medium tracking-[.08em] uppercase text-[var(--ink-mute)] mb-2">
            Имя
          </label>
          <input type="text" name="fullName" required placeholder="Ваше имя" className={inputClass} />
        </div>
        <div className="mb-5">
          <label className="block text-xs font-medium tracking-[.08em] uppercase text-[var(--ink-mute)] mb-2">
            Email
          </label>
          <input type="email" name="email" required placeholder="your@email.com" className={inputClass} />
        </div>
        <div className="grid grid-cols-2 gap-4 max-[500px]:grid-cols-1">
          <div className="mb-5">
            <label className="block text-xs font-medium tracking-[.08em] uppercase text-[var(--ink-mute)] mb-2">
              Компания
            </label>
            <input type="text" name="company" placeholder="Название студии" className={inputClass} />
          </div>
          <div className="mb-5">
            <label className="block text-xs font-medium tracking-[.08em] uppercase text-[var(--ink-mute)] mb-2">
              Телефон
            </label>
            <input type="tel" name="phone" placeholder="+7 ..." className={inputClass} />
          </div>
        </div>
        <div className="mb-5">
          <label className="block text-xs font-medium tracking-[.08em] uppercase text-[var(--ink-mute)] mb-2">
            Пароль
          </label>
          <input type="password" name="password" required placeholder="Минимум 6 символов" className={inputClass} />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-[17px] text-[13.5px] font-medium bg-[var(--ink)] text-[#0a0d12] rounded-sm hover:bg-white transition-all duration-500 disabled:opacity-50"
        >
          {loading ? "Регистрация..." : "Создать аккаунт"}
        </button>
      </form>

      <p className="mt-8 text-[13px] text-[var(--ink-mute)]">
        Уже есть аккаунт?{" "}
        <Link href="/auth/login" className="text-[var(--ink-soft)] border-b border-[var(--line-2)] hover:text-[var(--ink)] transition-colors">
          Войти
        </Link>
      </p>
    </div>
  );
}

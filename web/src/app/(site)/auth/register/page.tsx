"use client";

import Link from "next/link";
import { useState } from "react";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

export default function RegisterPage() {
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors([]);

    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");
    const passwordConfirm = String(form.get("passwordConfirm") || "");

    // Клиентская валидация — до сетевого запроса.
    const clientErrors: string[] = [];
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) clientErrors.push("Введите корректный email.");
    if (password.length < 6) clientErrors.push("Пароль должен быть не короче 6 символов.");
    if (password !== passwordConfirm) clientErrors.push("Пароли не совпадают.");
    if (clientErrors.length > 0) {
      setErrors(clientErrors);
      return;
    }

    setLoading(true);
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
          <label htmlFor="reg-fullname" className="block text-xs font-medium tracking-[.08em] uppercase text-[var(--ink-mute)] mb-2">
            Имя
          </label>
          <Input id="reg-fullname" type="text" name="fullName" required placeholder="Ваше имя" />
        </div>
        <div className="mb-5">
          <label htmlFor="reg-email" className="block text-xs font-medium tracking-[.08em] uppercase text-[var(--ink-mute)] mb-2">
            Email
          </label>
          <Input id="reg-email" type="email" name="email" required placeholder="your@email.com" />
        </div>
        <div className="grid grid-cols-2 gap-4 max-[500px]:grid-cols-1">
          <div className="mb-5">
            <label htmlFor="reg-company" className="block text-xs font-medium tracking-[.08em] uppercase text-[var(--ink-mute)] mb-2">
              Компания
            </label>
            <Input id="reg-company" type="text" name="company" placeholder="Название студии" />
          </div>
          <div className="mb-5">
            <label htmlFor="reg-phone" className="block text-xs font-medium tracking-[.08em] uppercase text-[var(--ink-mute)] mb-2">
              Телефон
            </label>
            <Input id="reg-phone" type="tel" name="phone" inputMode="tel" placeholder="+7 ..." />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 max-[500px]:grid-cols-1">
          <div className="mb-5">
            <label htmlFor="reg-password" className="block text-xs font-medium tracking-[.08em] uppercase text-[var(--ink-mute)] mb-2">
              Пароль
            </label>
            <Input id="reg-password" type="password" name="password" required minLength={6} placeholder="Минимум 6 символов" />
          </div>
          <div className="mb-5">
            <label htmlFor="reg-password-confirm" className="block text-xs font-medium tracking-[.08em] uppercase text-[var(--ink-mute)] mb-2">
              Повторите пароль
            </label>
            <Input id="reg-password-confirm" type="password" name="passwordConfirm" required minLength={6} placeholder="Ещё раз" />
          </div>
        </div>
        <label className="flex items-start gap-2.5 mb-6 text-[13px] text-[var(--ink-mute)] leading-snug cursor-pointer">
          <input type="checkbox" name="consent" required className="mt-0.5 accent-[var(--color-gold-500)] w-4 h-4 shrink-0" />
          <span>
            Я принимаю{" "}
            <Link href="/terms" className="text-[var(--ink-soft)] border-b border-[var(--line-2)] hover:text-[var(--ink)] transition-colors">условия использования</Link>
            {" "}и{" "}
            <Link href="/privacy" className="text-[var(--ink-soft)] border-b border-[var(--line-2)] hover:text-[var(--ink)] transition-colors">политику конфиденциальности</Link>.
          </span>
        </label>
        <Button variant="ink" type="submit" disabled={loading} className="w-full py-[17px] text-[13.5px]">
          {loading ? "Регистрация..." : "Создать аккаунт"}
        </Button>
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

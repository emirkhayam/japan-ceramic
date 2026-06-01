"use client";

import { useState } from "react";

// Выход через POST (а не GET-ссылку) — чтобы logout нельзя было вызвать
// сторонним <img>/ссылкой (CSRF). После успеха уводим на главную.
export default function LogoutButton({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);

  async function handleLogout() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* даже при ошибке сети пробуем увести со страницы */
    }
    window.location.href = "/";
  }

  return (
    <button type="button" onClick={handleLogout} disabled={busy} className={className}>
      {children ?? "Выйти"}
    </button>
  );
}

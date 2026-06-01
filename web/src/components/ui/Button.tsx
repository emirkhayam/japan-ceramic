import type { ButtonHTMLAttributes } from "react";

// Кнопка-примитив. gold/ghost мапятся на существующие классы из globals.css,
// ink — тёмный текст на светлом (частый инлайн-паттерн в формах).
type Variant = "gold" | "ghost" | "ink";

const VARIANT: Record<Variant, string> = {
  gold: "btn-gold",
  ghost: "btn-ghost",
  ink: "inline-flex items-center justify-center gap-2 bg-[var(--ink)] text-[var(--on-gold)] font-medium rounded-sm hover:bg-white transition-all duration-500 disabled:opacity-50",
};

export default function Button({
  variant = "gold",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={`${VARIANT[variant]} ${className}`} {...props} />;
}

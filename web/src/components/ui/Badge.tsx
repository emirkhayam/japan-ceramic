import type { ReactNode } from "react";

// Бейдж карточки товара/коллекции. Варианты вместо хардкода цветов по файлам.
export type BadgeVariant = "new" | "top" | "sale" | "recommended";

const VARIANT: Record<BadgeVariant, string> = {
  new: "bg-[var(--color-gold-500)] text-[var(--on-gold)]",
  top: "bg-[rgba(8,10,15,.7)] text-white border border-white/20 backdrop-blur-sm",
  sale: "bg-[var(--danger)] text-white",
  recommended: "border border-[var(--line-2)] text-[var(--ink-soft)] bg-[rgba(8,10,15,.45)] backdrop-blur-sm",
};

export default function Badge({
  variant,
  children,
  className = "",
}: {
  variant: BadgeVariant;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center rounded-sm font-semibold tracking-[.12em] ${VARIANT[variant]} ${className}`}>
      {children}
    </span>
  );
}

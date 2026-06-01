import { forwardRef, type InputHTMLAttributes } from "react";

// Единый стиль текстовых полей (раньше дублировался строкой ~200 символов в формах).
const BASE =
  "w-full bg-[var(--surface-1)] border border-[var(--line-2)] rounded-sm text-[var(--ink)] outline-none focus:border-[rgba(255,255,255,.34)] focus:bg-[var(--surface-2)] transition-all placeholder:text-[var(--ink-faint)]";

const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = "", ...props }, ref) {
    return <input ref={ref} className={`${BASE} px-[18px] py-3.5 text-sm ${className}`} {...props} />;
  }
);

export default Input;

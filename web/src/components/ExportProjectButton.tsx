"use client";

interface ExportProjectButtonProps {
  projectName: string;
}

export default function ExportProjectButton({ projectName }: ExportProjectButtonProps) {
  return (
    <button
      onClick={() => window.print()}
      className="text-[12px] px-4 py-2 border border-[var(--line)] rounded-md text-[var(--ink-soft)] hover:text-[var(--ink)] hover:border-[var(--line-2)] transition-all duration-200 cursor-pointer no-print"
    >
      Экспорт PDF
    </button>
  );
}

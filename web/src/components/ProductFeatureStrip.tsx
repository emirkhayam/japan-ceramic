import { getSpecIcon } from "./ProductSpecs";

interface Feature {
  key: string;
  label: string;
  value: string;
}

export default function ProductFeatureStrip({ features }: { features: Feature[] }) {
  if (features.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2.5 mb-8">
      {features.map((f) => (
        <div
          key={f.key}
          className="flex items-center gap-2.5 pl-3 pr-4 py-2.5 rounded-md border border-[var(--line)] bg-[rgba(255,255,255,.02)]"
        >
          <span className="w-7 h-7 flex items-center justify-center rounded bg-[rgba(255,255,255,.04)] text-[var(--color-gold-400)] shrink-0">
            {getSpecIcon(f.key)}
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-[10px] tracking-[.14em] uppercase text-[var(--ink-faint)]">
              {f.label}
            </span>
            <span className="text-[13px] text-[var(--ink)] font-normal">{f.value}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

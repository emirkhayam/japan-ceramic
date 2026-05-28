interface ProductSpecsProps {
  specs: { label: string; value: string; key: string }[];
}

const iconProps = {
  width: "18",
  height: "18",
  viewBox: "0 0 18 18",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "1.3",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function getSpecIcon(key: string) {
  switch (key) {
    case "dimensions":
    case "Размер":
      // Ruler / grid icon
      return (
        <svg {...iconProps}>
          <rect x="2" y="2" width="14" height="14" rx="1" />
          <line x1="2" y1="6.5" x2="16" y2="6.5" />
          <line x1="2" y1="11" x2="16" y2="11" />
          <line x1="6.5" y1="2" x2="6.5" y2="16" />
          <line x1="11" y1="2" x2="11" y2="16" />
        </svg>
      );

    case "thickness":
    case "Толщина":
      // Layers icon
      return (
        <svg {...iconProps}>
          <path d="M9 2L2 5.5L9 9L16 5.5L9 2Z" />
          <path d="M2 9L9 12.5L16 9" />
          <path d="M2 12.5L9 16L16 12.5" />
        </svg>
      );

    case "surface":
    case "Поверхность":
      // Wavy lines / texture icon
      return (
        <svg {...iconProps}>
          <path d="M2 5C4 3.5 6 6.5 9 5C12 3.5 14 6.5 16 5" />
          <path d="M2 9C4 7.5 6 10.5 9 9C12 7.5 14 10.5 16 9" />
          <path d="M2 13C4 11.5 6 14.5 9 13C12 11.5 14 14.5 16 13" />
        </svg>
      );

    case "color":
    case "Цвет":
      // Palette / circle icon
      return (
        <svg {...iconProps}>
          <circle cx="9" cy="9" r="7" />
          <circle cx="9" cy="6" r="1.2" />
          <circle cx="6.2" cy="10" r="1.2" />
          <circle cx="11.8" cy="10" r="1.2" />
        </svg>
      );

    case "boxWeight":
    case "Вес коробки":
      // Weight / scale icon
      return (
        <svg {...iconProps}>
          <path d="M3 15V7L9 3L15 7V15H3Z" />
          <path d="M7 9L9 11L11 9" />
          <line x1="9" y1="7" x2="9" y2="11" />
        </svg>
      );

    case "boxQuantity":
    case "Кол-во в коробке":
      // Stack / boxes icon
      return (
        <svg {...iconProps}>
          <rect x="4" y="10" width="10" height="5" rx="0.5" />
          <rect x="3" y="6.5" width="12" height="4" rx="0.5" />
          <rect x="2" y="3" width="14" height="4" rx="0.5" />
        </svg>
      );

    case "boxArea":
    case "Площадь коробки":
      // Area / square icon
      return (
        <svg {...iconProps}>
          <rect x="3" y="3" width="12" height="12" rx="1" />
          <line x1="3" y1="7" x2="5" y2="7" />
          <line x1="3" y1="11" x2="5" y2="11" />
          <line x1="7" y1="3" x2="7" y2="5" />
          <line x1="11" y1="3" x2="11" y2="5" />
        </svg>
      );

    case "weight":
    case "Вес плитки":
      // Single weight icon
      return (
        <svg {...iconProps}>
          <path d="M5 15L3 9H15L13 15H5Z" />
          <path d="M7 9C7 7 7.5 4 9 4C10.5 4 11 7 11 9" />
          <circle cx="9" cy="4" r="1.2" />
        </svg>
      );

    case "wearResistance":
    case "Износостойкость":
      return (
        <svg {...iconProps}>
          <circle cx="9" cy="9" r="7" />
          <path d="M6 12L9 6L12 12" />
          <line x1="7" y1="10.5" x2="11" y2="10.5" />
        </svg>
      );

    case "antiSlip":
    case "Противоскольжение":
      return (
        <svg {...iconProps}>
          <path d="M3 14L8 4" />
          <path d="M7 14L12 4" />
          <path d="M11 14L16 4" />
        </svg>
      );

    case "rectified":
    case "Ректификация":
      return (
        <svg {...iconProps}>
          <rect x="3" y="3" width="12" height="12" rx="1" />
          <path d="M6 9L8 11L12 7" />
        </svg>
      );

    case "frostResistant":
    case "Морозостойкость":
      return (
        <svg {...iconProps}>
          <line x1="9" y1="2" x2="9" y2="16" />
          <line x1="2" y1="9" x2="16" y2="9" />
          <line x1="4" y1="4" x2="14" y2="14" />
          <line x1="14" y1="4" x2="4" y2="14" />
        </svg>
      );

    case "stainResistant":
    case "Устойчивость к пятнам":
      return (
        <svg {...iconProps}>
          <path d="M9 2C9 2 4 8 4 11a5 5 0 0010 0C14 8 9 2 9 2z" />
        </svg>
      );

    case "technology":
    case "Технология":
      return (
        <svg {...iconProps}>
          <circle cx="9" cy="9" r="3" />
          <path d="M9 2v2M9 14v2M2 9h2M14 9h2M4.2 4.2l1.4 1.4M12.4 12.4l1.4 1.4M4.2 13.8l1.4-1.4M12.4 5.6l1.4-1.4" />
        </svg>
      );

    case "application":
    case "Применение":
      return (
        <svg {...iconProps}>
          <path d="M2 7L9 2L16 7V15a1 1 0 01-1 1H3a1 1 0 01-1-1V7z" />
          <path d="M7 16V10h4v6" />
        </svg>
      );

    default:
      return (
        <svg {...iconProps}>
          <circle cx="9" cy="9" r="7" />
          <line x1="9" y1="8.5" x2="9" y2="13" />
          <circle cx="9" cy="5.8" r="0.6" fill="currentColor" stroke="none" />
        </svg>
      );
  }
}

export default function ProductSpecs({ specs }: ProductSpecsProps) {
  return (
    <div>
      {specs.map((spec, i) => (
        <div
          key={spec.key}
          className={`flex items-center gap-3 py-3.5${
            i < specs.length - 1 ? " border-b border-[var(--line)]" : ""
          }`}
        >
          <div className="w-8 h-8 flex items-center justify-center rounded-md bg-[rgba(255,255,255,.04)] text-[var(--ink-mute)] shrink-0">
            {getSpecIcon(spec.key)}
          </div>
          <span className="text-[13px] text-[var(--ink-mute)]">
            {spec.label}
          </span>
          <span className="text-[14px] text-[var(--ink)] ml-auto text-right font-normal">
            {spec.value}
          </span>
        </div>
      ))}
    </div>
  );
}

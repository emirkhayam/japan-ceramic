"use client";

import { useState } from "react";

type CoverType = "floor" | "walls" | "both";

interface Props {
  dimensions: string | null;
  boxQuantity: string | null;
}

function parseTileArea(dimensions: string | null): number {
  if (!dimensions) return 0;
  // Parse formats like "598 x 598", "600×1200×10mm", "298x78x10mm"
  const nums = dimensions.match(/(\d+)[.,]?(\d*)/g);
  if (!nums || nums.length < 2) return 0;
  const w = parseFloat(nums[0]) / 1000; // mm → m
  const h = parseFloat(nums[1]) / 1000;
  return w * h;
}

export default function TileCalculator({ dimensions, boxQuantity }: Props) {
  const [coverType, setCoverType] = useState<CoverType>("floor");
  const [length, setLength] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [reserve, setReserve] = useState("10");

  const tileM2 = parseTileArea(dimensions);
  const boxQty = boxQuantity ? parseInt(boxQuantity.replace(/[^\d]/g, ""), 10) : 0;
  const boxM2 = tileM2 * boxQty;

  const l = parseFloat(length) || 0;
  const w = parseFloat(width) || 0;
  const h = parseFloat(height) || 0;
  const reservePct = (parseFloat(reserve) || 0) / 100;

  let area = 0;
  if (coverType === "floor") {
    area = l * w;
  } else if (coverType === "walls") {
    area = 2 * (l + w) * h;
  } else {
    area = l * w + 2 * (l + w) * h;
  }

  const totalArea = area * (1 + reservePct);
  const totalTiles = tileM2 > 0 ? Math.ceil(totalArea / tileM2) : 0;
  const boxes = boxM2 > 0 ? Math.ceil(totalArea / boxM2) : 0;

  const hasInput = l > 0 && w > 0 && (coverType === "floor" || h > 0);

  const btnClass = (active: boolean) =>
    `px-3 py-2 text-[12px] rounded-md border transition-all duration-200 cursor-pointer ${
      active
        ? "border-[var(--ink)] bg-[rgba(255,255,255,.08)] text-[var(--ink)]"
        : "border-[var(--line)] text-[var(--ink-mute)] hover:text-[var(--ink-soft)] hover:border-[var(--line-2)]"
    }`;

  const inputClass =
    "w-full px-3 py-2.5 bg-[rgba(255,255,255,.04)] border border-[var(--line-2)] rounded-md text-[var(--ink)] text-[13px] outline-none focus:border-[rgba(255,255,255,.3)] transition-all placeholder:text-[var(--ink-faint)]";

  if (!tileM2) return null;

  return (
    <div className="mb-10">
      <h2 className="text-[14px] font-medium text-[var(--ink-soft)] mb-4">
        Калькулятор плитки
      </h2>
      <div className="border border-[var(--line)] rounded-lg p-5">
        {/* Cover type */}
        <div className="flex gap-2 mb-4">
          {([
            { key: "floor", label: "Пол" },
            { key: "walls", label: "Стены" },
            { key: "both", label: "Пол + стены" },
          ] as const).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setCoverType(t.key)}
              className={btnClass(coverType === t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-[11px] text-[var(--ink-mute)] mb-1.5">Длина, м</label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={length}
              onChange={(e) => setLength(e.target.value)}
              placeholder="5.0"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-[11px] text-[var(--ink-mute)] mb-1.5">Ширина, м</label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={width}
              onChange={(e) => setWidth(e.target.value)}
              placeholder="4.0"
              className={inputClass}
            />
          </div>
          {coverType !== "floor" && (
            <div>
              <label className="block text-[11px] text-[var(--ink-mute)] mb-1.5">Высота стен, м</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                placeholder="2.7"
                className={inputClass}
              />
            </div>
          )}
          <div>
            <label className="block text-[11px] text-[var(--ink-mute)] mb-1.5">Запас, %</label>
            <input
              type="number"
              step="1"
              min="0"
              max="30"
              value={reserve}
              onChange={(e) => setReserve(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        {/* Result */}
        {hasInput && totalArea > 0 && (
          <div className="border-t border-[var(--line)] pt-4 grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-[20px] font-light tabular-nums">{totalArea.toFixed(1)}</div>
              <div className="text-[10px] text-[var(--ink-mute)] uppercase tracking-wider mt-0.5">м²</div>
            </div>
            <div>
              <div className="text-[20px] font-light tabular-nums">{totalTiles}</div>
              <div className="text-[10px] text-[var(--ink-mute)] uppercase tracking-wider mt-0.5">плиток</div>
            </div>
            {boxes > 0 && (
              <div>
                <div className="text-[20px] font-light tabular-nums">{boxes}</div>
                <div className="text-[10px] text-[var(--ink-mute)] uppercase tracking-wider mt-0.5">коробок</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

import type { CSSProperties } from "react";

// Реальные размеры плитки из строки вида "227*60*9,5", "600×1200×10mm", "598 x 598".
export function parseTileSize(dimensions: string | null): { w: number; h: number } | null {
  if (!dimensions) return null;
  const nums = dimensions.match(/\d+(?:[.,]\d+)?/g)?.map((n) => parseFloat(n.replace(",", ".")));
  if (!nums || nums.length < 2 || !nums[0] || !nums[1]) return null;
  return { w: nums[0], h: nums[1] };
}

// "227*60*9,5" → "227 × 60"
export function prettyFormat(dimensions: string): string {
  const s = parseTileSize(dimensions);
  if (!s) return dimensions;
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : String(n).replace(".", ","));
  return `${fmt(s.w)} × ${fmt(s.h)}`;
}

// Нормализация по длинной стороне с сохранением реальной ориентации плитки.
const NORM = 86;
export function normTileStyle(dimensions: string | null): CSSProperties {
  const s = parseTileSize(dimensions);
  if (!s) return { width: `${NORM}%`, height: `${NORM}%` };
  const longest = Math.max(s.w, s.h);
  return { width: `${(NORM * s.w) / longest}%`, height: `${(NORM * s.h) / longest}%` };
}

// Маленький глиф-прямоугольник той же пропорции, что плитка (макс. сторона 13px).
export function glyphStyle(dimensions: string | null): CSSProperties {
  const s = parseTileSize(dimensions);
  if (!s) return { width: 12, height: 12 };
  const longest = Math.max(s.w, s.h);
  return {
    width: Math.max(3, Math.round((13 * s.w) / longest)),
    height: Math.max(3, Math.round((13 * s.h) / longest)),
  };
}

// Бокс в реальной пропорции плитки: бОльшая сторона = maxPx, меньшая — по w:h.
export function proportionStyle(dimensions: string | null, maxPx = 52): CSSProperties {
  const s = parseTileSize(dimensions);
  if (!s) return { width: maxPx, height: maxPx };
  const longest = Math.max(s.w, s.h);
  return {
    width: Math.max(8, Math.round((maxPx * s.w) / longest)),
    height: Math.max(8, Math.round((maxPx * s.h) / longest)),
  };
}

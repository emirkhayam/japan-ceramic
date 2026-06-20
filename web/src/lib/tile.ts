import type { CSSProperties } from "react";

// Представительное число из части размера: одиночное → как есть, диапазон "55-65" → среднее.
// Нужно, чтобы диапазоны ("189-204") не ломали разбор на ширину/высоту.
function dimValue(part: string): number | null {
  const nums = part.match(/\d+(?:[.,]\d+)?/g)?.map((n) => parseFloat(n.replace(",", ".")));
  if (!nums || nums.length === 0) return null;
  // Диапазон "a-b" → среднее, округлённое до целого мм (суб-мм точность для плитки не нужна).
  const v = nums.length >= 2 ? (nums[0] + nums[1]) / 2 : nums[0];
  return v > 0 ? Math.round(v) : null;
}

// Реальные размеры плитки из строки вида "227*60*9,5", "600×1200×10mm", "598 x 598",
// "189-204*55-65*15-25" (диапазоны). Первая часть — ширина, вторая — высота.
export function parseTileSize(dimensions: string | null): { w: number; h: number } | null {
  if (!dimensions) return null;
  // Делим по разделителю размеров (*, ×, x, х, X), затем в каждой части берём
  // представительное число. Так "189-204*55-65" → ширина 196, высота 60, а не 189×204.
  const parts = dimensions.split(/[*×xXхХ]/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const w = dimValue(parts[0]);
    const h = dimValue(parts[1]);
    if (w && h) return { w, h };
  }
  // Фолбэк (нет разделителя): первые два числа подряд, как раньше.
  const nums = dimensions.match(/\d+(?:[.,]\d+)?/g)?.map((n) => parseFloat(n.replace(",", ".")));
  if (!nums || nums.length < 2 || !nums[0] || !nums[1]) return null;
  return { w: nums[0], h: nums[1] };
}

// Размеры плитки С ФОЛБЭКОМ: если в каталоге размер не задан (dimensions=null,
// напр. «YS 290-OR»), оцениваем форму по названию/материалу — чтобы у визуализатора
// всегда был сигнал размера/пропорции (для «раскладки» и масштаба).
export function resolveTileSize(dimensions: string | null, name?: string): { w: number; h: number } {
  const parsed = parseTileSize(dimensions);
  if (parsed) return parsed;
  const nm = (name ?? "").toLowerCase();
  if (nm.includes("клинкер") || nm.includes("clinker")) {
    // У клинкера длина часто зашита в названии (напр. «YS 290-OR» → 290 мм).
    const m = (name ?? "").match(/\b(\d{3})\b/);
    const len = m ? parseInt(m[1], 10) : 0;
    return { w: len >= 150 && len <= 400 ? len : 240, h: 65 };
  }
  if (nm.includes("мозаик") || nm.includes("mosaic")) return { w: 300, h: 300 };
  if (nm.includes("керамогранит") || nm.includes("porcelain") || nm.includes("gres"))
    return { w: 600, h: 600 };
  return { w: 300, h: 300 };
}

// Шов между плитками по умолчанию (мм). Для клинкера типично ~10 мм.
export const DEFAULT_GROUT_MM = 10;

// Сколько плиток укладывается по ширине участка.
// regionWidthM — реальная ширина выделенного участка стены (в метрах, вводит пользователь).
// tileWmm — горизонтальный размер плитки (мм). groutMm — шов (мм).
// Так мы сами считаем масштаб, вместо того чтобы модель его угадывала.
export function tilesAcross(regionWidthM: number, tileWmm: number, groutMm = DEFAULT_GROUT_MM): number {
  if (!(regionWidthM > 0) || !(tileWmm > 0)) return 0;
  return Math.max(1, Math.round((regionWidthM * 1000) / (tileWmm + groutMm)));
}

// Сколько рядов плиток укладывается по высоте участка.
// regionHeightM — реальная высота выделенного участка (м), tileHmm — высота плитки (мм).
// Зеркало tilesAcross: даём модели точное число рядов, а не догадку.
export function tilesDown(regionHeightM: number, tileHmm: number, groutMm = DEFAULT_GROUT_MM): number {
  if (!(regionHeightM > 0) || !(tileHmm > 0)) return 0;
  return Math.max(1, Math.round((regionHeightM * 1000) / (tileHmm + groutMm)));
}

// Пропорция плитки (ширина к высоте), напр. 227×60 → ~3.78.
// Нужна, чтобы зафиксировать форму в промпте и не дать модели делать квадраты.
// Возвращает null при некорректной высоте (защита от деления на 0).
export function tileAspect(dims: { w: number; h: number } | null): number | null {
  if (!dims || !(dims.h > 0) || !(dims.w > 0)) return null;
  return dims.w / dims.h;
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

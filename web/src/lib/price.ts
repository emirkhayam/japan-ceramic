// Цена за м² хранится в Product.price (Float, сомы). Здесь — единые
// функции парсинга (админ-API) и форматирования (каталог + страница товара).

export const PRICE_UNIT = "сом/м²";

// "2400" / "2400,50" / "2400.5" → число; пусто или мусор → null (= «Цена по запросу»).
export function parsePriceInput(raw: unknown): number | null {
  const s = String(raw ?? "").trim().replace(",", ".");
  if (!s) return null;
  const n = parseFloat(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function hasPrice(price: number | null | undefined): price is number {
  return typeof price === "number" && Number.isFinite(price) && price > 0;
}

// 2400 → "2 400" (неразрывные пробелы между разрядами, копейки только если есть)
export function formatPrice(n: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(n);
}

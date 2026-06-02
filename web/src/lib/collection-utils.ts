import { parseTileSize, prettyFormat } from "./tile";

// Товар в объёме, нужном для агрегатов коллекции (без изображений).
export type CoverageProduct = {
  dimensions: string | null;
  surface?: string | null;
  frostResistant?: string | null;
  antiSlip?: string | null;
  wearResistance?: string | null;
  category?: { name: string } | null;
};

export type Coverage = {
  count: number;
  categories: string[];
  formats: string[];
  surfaces: string[];
  frost: boolean;
  antiSlip: boolean;
  pei: string[];
};

const uniq = (arr: (string | null | undefined)[]) =>
  [...new Set(arr.filter((v): v is string => !!v && v.trim() !== ""))];

// Считаем «охват» коллекции из её товаров — без новых полей в БД.
export function collectionCoverage(products: CoverageProduct[]): Coverage {
  return {
    count: products.length,
    categories: uniq(products.map((p) => p.category?.name)),
    formats: uniq(products.map((p) => (p.dimensions && parseTileSize(p.dimensions) ? prettyFormat(p.dimensions) : null))),
    surfaces: uniq(products.map((p) => p.surface)),
    frost: products.some((p) => p.frostResistant),
    antiSlip: products.some((p) => p.antiSlip),
    pei: uniq(products.map((p) => p.wearResistance)),
  };
}

// Русские склонения.
function plural(n: number, one: string, few: string, many: string) {
  if (n % 10 === 1 && n % 100 !== 11) return one;
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return few;
  return many;
}
export const formatWord = (n: number) => plural(n, "формат", "формата", "форматов");
export const surfaceWord = (n: number) => plural(n, "поверхность", "поверхности", "поверхностей");
export const collectionWord = (n: number) => plural(n, "коллекция", "коллекции", "коллекций");
export const itemWord = (n: number) => plural(n, "товар", "товара", "товаров");

// Короткая мета-строка для карточки коллекции: «Клинкер · 4 формата · Матовая».
// Показывает ОХВАТ, а не счётчик товаров (по решению: не выглядеть бедно при 1–3 товарах).
export function coverageLine(cov: Coverage): string {
  const parts: string[] = [];
  if (cov.categories.length === 1) parts.push(cov.categories[0]);
  else if (cov.categories.length > 1) parts.push(`${cov.categories.length} категории`);
  if (cov.formats.length) parts.push(`${cov.formats.length} ${formatWord(cov.formats.length)}`);
  if (cov.surfaces.length === 1) parts.push(cov.surfaces[0]);
  else if (cov.surfaces.length > 1) parts.push(`${cov.surfaces.length} ${surfaceWord(cov.surfaces.length)}`);
  return parts.join(" · ");
}

// Пары «лейбл → значение» для панели характеристик коллекции на детальной.
export function coverageSpecs(cov: Coverage, spaceTag?: string | null, styleTag?: string | null): { label: string; value: string }[] {
  const specs: { label: string; value: string }[] = [];
  if (styleTag) specs.push({ label: "Стиль", value: styleTag });
  if (spaceTag) specs.push({ label: "Пространство", value: spaceTag });
  if (cov.categories.length) specs.push({ label: cov.categories.length > 1 ? "Материалы" : "Материал", value: cov.categories.join(", ") });
  if (cov.formats.length) specs.push({ label: cov.formats.length > 1 ? "Форматы, мм" : "Формат, мм", value: cov.formats.slice(0, 4).join(", ") + (cov.formats.length > 4 ? "…" : "") });
  if (cov.surfaces.length) specs.push({ label: cov.surfaces.length > 1 ? "Поверхности" : "Поверхность", value: cov.surfaces.join(", ") });
  const props: string[] = [];
  if (cov.frost) props.push("Морозостойкая");
  if (cov.antiSlip) props.push("Противоскользящая");
  if (cov.pei.length) props.push(`PEI ${cov.pei.join("/")}`);
  if (props.length) specs.push({ label: "Свойства", value: props.join(" · ") });
  return specs;
}

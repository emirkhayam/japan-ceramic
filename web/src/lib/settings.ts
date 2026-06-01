import { prisma } from "./db";

export type SiteSettings = {
  phone: string | null;
  whatsapp: string | null;
  telegram: string | null;
  instagram: string | null;
  email: string | null;
  address: string | null;
  hours: string | null;
  mapEmbedUrl: string | null;
  mapLink: string | null;
  showroomName: string | null;
  showroomName2: string | null;
  address2: string | null;
  mapLink2: string | null;
};

// Дефолты — то, что было захардкожено на сайте до появления редактируемых настроек.
export const DEFAULT_SETTINGS: SiteSettings = {
  phone: "+996 503 33 77 33",
  whatsapp: "996503337733",
  telegram: "https://t.me/japanceramic",
  instagram: "https://instagram.com/japanceramic",
  email: "info@japanceramic.ru",
  address: "г. Бишкек, ул. Юнусалиева, 28",
  hours: "Ежедневно · 10:00–18:00",
  mapEmbedUrl: null,
  mapLink: "https://2gis.kg/bishkek/firm/70000001100637803",
  showroomName: "Japan Ceramic Бишкек",
  showroomName2: null,
  address2: null,
  mapLink2: null,
};

// Читаем единственную строку настроек. Пустые поля подменяются дефолтами,
// чтобы футер/контакты никогда не оставались без данных. Любая ошибка БД
// (например, таблицы ещё нет) → возвращаем дефолты, сайт не падает.
export async function getSiteSettings(): Promise<SiteSettings> {
  try {
    const row = await prisma.siteSettings.findUnique({ where: { id: "default" } });
    if (!row) return DEFAULT_SETTINGS;
    const pick = (v: string | null, d: string | null) => (v && v.trim() ? v.trim() : d);
    return {
      phone: pick(row.phone, DEFAULT_SETTINGS.phone),
      whatsapp: pick(row.whatsapp, DEFAULT_SETTINGS.whatsapp),
      telegram: pick(row.telegram, DEFAULT_SETTINGS.telegram),
      instagram: pick(row.instagram, DEFAULT_SETTINGS.instagram),
      email: pick(row.email, DEFAULT_SETTINGS.email),
      address: pick(row.address, DEFAULT_SETTINGS.address),
      hours: pick(row.hours, DEFAULT_SETTINGS.hours),
      // карта — без дефолта-заглушки: показываем, только если задано
      mapEmbedUrl: pick(row.mapEmbedUrl, null),
      mapLink: pick(row.mapLink, DEFAULT_SETTINGS.mapLink),
      showroomName: pick(row.showroomName, DEFAULT_SETTINGS.showroomName),
      showroomName2: pick(row.showroomName2, null),
      address2: pick(row.address2, null),
      mapLink2: pick(row.mapLink2, null),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

// 2ГИС-ссылка → встраиваемая карта. Координаты берём из параметра `m=lon,lat/zoom`
// (есть в ссылке из адресной строки 2ГИС) и рендерим интерактивную карту OpenStreetMap
// с маркером (без API-ключа, всегда отрисовывается). Если координат нет — null.
export function mapEmbedFromLink(link: string | null): string | null {
  if (!link) return null;
  let lon = NaN, lat = NaN;
  try {
    const u = new URL(link);
    const m = u.searchParams.get("m"); // "lon,lat/zoom"
    if (m) {
      const [a, b] = m.split("/")[0].split(",");
      lon = parseFloat(a);
      lat = parseFloat(b);
    }
  } catch {
    /* не-URL — пробуем регэксп ниже */
  }
  if (!isFinite(lon) || !isFinite(lat)) {
    const m = decodeURIComponent(link).match(/(-?\d{1,3}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})/);
    if (m) { lon = parseFloat(m[1]); lat = parseFloat(m[2]); }
  }
  if (!isFinite(lon) || !isFinite(lat)) return null;
  const d = 0.0045;
  const bbox = [lon - d, lat - d, lon + d, lat + d].join(",");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lon}`;
}

// Итоговый src карты для шоурума: ручной виджет (mapEmbedUrl) важнее авто-карты по ссылке.
export const resolveMapEmbed = (mapEmbedUrl: string | null, mapLink: string | null) =>
  (mapEmbedUrl && mapEmbedUrl.trim()) || mapEmbedFromLink(mapLink) || null;

// Нормализация телефона в формат для tel: (только + и цифры).
export const telHref = (phone: string | null) => (phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : undefined);
// Ссылка WhatsApp из номера (или готовой ссылки).
export const waHref = (wa: string | null) =>
  !wa ? undefined : wa.startsWith("http") ? wa : `https://wa.me/${wa.replace(/[^\d]/g, "")}`;
// Telegram: принимаем и @handle, и t.me/..., и полную ссылку.
export const tgHref = (tg: string | null) =>
  !tg ? undefined : tg.startsWith("http") ? tg : `https://t.me/${tg.replace(/^@/, "")}`;

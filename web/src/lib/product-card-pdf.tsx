import fs from "fs";
import path from "path";
import { Document, Page, View, Text, Image, StyleSheet, Font } from "@react-pdf/renderer";

// Шрифт с кириллицей (стандартные шрифты react-pdf её не содержат).
Font.register({
  family: "DejaVu",
  fonts: [
    { src: path.join(process.cwd(), "public/fonts/DejaVuSans.ttf"), fontWeight: 400 },
    { src: path.join(process.cwd(), "public/fonts/DejaVuSans-Bold.ttf"), fontWeight: 700 },
  ],
});

// Фирменный шрифт логотипа (латиница) из брендбука Japan Ceramic.
Font.register({
  family: "Krona One",
  fonts: [{ src: path.join(process.cwd(), "public/fonts/KronaOne-Regular.ttf"), fontWeight: 400 }],
});

// Золотой знак-монограмма для шапки карты. Читаем в Buffer:
// react-pdf на Windows иначе принимает локальный путь за URL и не грузит файл.
const LOGO_MARK = { data: fs.readFileSync(path.join(process.cwd(), "public/logo-mark-gold.png")), format: "png" as const };

export type CardProduct = {
  name: string;
  collection: string | null;
  dimensions: string | null;
  thickness: string | null;
  surface: string | null;
  color: string | null;
  wearResistance: string | null;
  antiSlip: string | null;
  rectified: string | null;
  frostResistant: string | null;
  stainResistant: string | null;
  boxQuantity: string | null;
  boxArea: string | null;
  boxWeight: string | null;
  technology: string | null;
  category: { name: string };
  images: { imageUrl: string }[];
};

function prettyFormat(dimensions: string | null): string | null {
  if (!dimensions) return null;
  const nums = dimensions.match(/\d+(?:[.,]\d+)?/g);
  if (!nums || nums.length < 2) return dimensions;
  return `${nums[0]} x ${nums[1]} mm`;
}

// Уменьшаем картинку через Supabase image transform, чтобы PDF не весил десятки МБ.
// ВАЖНО: нужен resize=contain + обе стороны (width и height) — иначе при одном
// width Supabase не сохраняет пропорции (сжимает только ширину, высоту оставляет
// исходной) и картинка превращается в кривую вытянутую полоску.
function pdfImageUrl(url: string | undefined): string | undefined {
  if (url && url.includes("/storage/v1/object/public/")) {
    return url.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/") + "?width=900&height=900&resize=contain&quality=72";
  }
  return url;
}

const GOLD = "#cead78";
const INK = "#23204a";
const MUTE = "#6b7178";
const LINE = "#e2e4e8";

const s = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 56, paddingHorizontal: 46, fontFamily: "DejaVu", fontSize: 10, color: INK },
  runHead: { position: "absolute", top: 18, left: 46, right: 46, textAlign: "center", fontSize: 8, color: MUTE },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  brandMark: { width: 40, height: 21 },
  logo: { fontFamily: "Krona One", fontSize: 15, letterSpacing: 1.2, color: INK },
  rule: { height: 2, backgroundColor: GOLD, marginTop: 9, marginBottom: 22 },
  title: { fontSize: 24, fontWeight: 700, lineHeight: 1.15, marginBottom: 18 },
  top: { flexDirection: "row", gap: 22, marginBottom: 26, alignItems: "flex-start" },
  imgStage: { width: 250, height: 250, border: `1pt solid ${LINE}`, borderRadius: 3, padding: 6, alignItems: "center", justifyContent: "center" },
  img: { width: "100%", height: "100%", objectFit: "contain" },
  metaBox: { flex: 1, border: `1pt solid ${LINE}`, borderRadius: 3, padding: 16 },
  metaLabel: { fontSize: 12, fontWeight: 700, marginBottom: 2 },
  metaValue: { fontSize: 11, color: MUTE, marginBottom: 14 },
  secTitle: { fontSize: 14, fontWeight: 700, marginBottom: 12 },
  row: { flexDirection: "row", borderBottom: `1pt solid ${LINE}`, minHeight: 26, alignItems: "center" },
  cellLabel: { width: "55%", paddingVertical: 7, paddingHorizontal: 4, fontSize: 10, color: INK },
  cellValue: { width: "45%", paddingVertical: 7, paddingHorizontal: 8, fontSize: 10, color: "#3b4047", borderLeft: `1pt solid ${LINE}` },
  footer: { position: "absolute", bottom: 24, left: 46, right: 46, flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: MUTE, borderTop: `1pt solid ${LINE}`, paddingTop: 8 },
});

export function ProductCardPdf({ product }: { product: CardProduct }) {
  const fmt = prettyFormat(product.dimensions);
  const footer = `${product.name}${fmt ? ` · ${fmt}` : ""}`;
  const img = pdfImageUrl(product.images[0]?.imageUrl);

  const rows: [string, string | null][] = [
    ["Размеры", fmt],
    ["Толщина", product.thickness],
    ["Поверхность", product.surface],
    ["Цвет", product.color],
    ["Износостойкость", product.wearResistance],
    ["Противоскольжение", product.antiSlip],
    ["Ректификация", product.rectified],
    ["Морозостойкость", product.frostResistant],
    ["Устойчивость к пятнам", product.stainResistant],
    ["Количество штук в коробке", product.boxQuantity],
    ["Количество м² в коробке", product.boxArea],
    ["Вес коробки", product.boxWeight],
    ["Технология", product.technology],
  ];
  const filled = rows.filter(([, v]) => v && String(v).trim());

  return (
    <Document title={`Карта продукта — ${product.name}`}>
      <Page size="A4" style={s.page}>
        <Text style={s.runHead} fixed>{footer}</Text>

        <View style={s.brandRow}>
          <Image src={LOGO_MARK} style={s.brandMark} />
          <Text style={s.logo}>JAPAN CERAMIC</Text>
        </View>
        <View style={s.rule} />

        <Text style={s.title}>{product.name}</Text>

        <View style={s.top}>
          <View style={s.imgStage}>
            {img ? <Image style={s.img} src={img} /> : null}
          </View>
          <View style={s.metaBox}>
            <Text style={s.metaLabel}>Тип продукта:</Text>
            <Text style={s.metaValue}>{product.category.name}</Text>
            {product.collection ? (
              <>
                <Text style={s.metaLabel}>Коллекция:</Text>
                <Text style={s.metaValue}>{product.collection}</Text>
              </>
            ) : null}
          </View>
        </View>

        <Text style={s.secTitle}>Характеристики:</Text>
        <View>
          {filled.map(([label, value]) => (
            <View style={s.row} key={label} wrap={false}>
              <Text style={s.cellLabel}>{label}</Text>
              <Text style={s.cellValue}>{value}</Text>
            </View>
          ))}
        </View>

        <View style={s.footer} fixed>
          <Text>{footer}</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber}/${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

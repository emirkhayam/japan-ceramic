import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display, Krona_One, Prosto_One } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-sans",
  weight: ["300", "400", "500", "600", "700"],
});

const playfair = Playfair_Display({
  subsets: ["latin", "cyrillic"],
  variable: "--font-serif",
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

// Фирменные шрифты из брендбука Japan Ceramic.
// Krona One — латинское начертание логотипа (без кириллицы),
// Prosto One — кириллический компаньон. В заголовках используются стеком:
// латиница берётся из Krona One, кириллица автоматически из Prosto One.
const krona = Krona_One({
  subsets: ["latin"],
  variable: "--font-krona",
  weight: "400",
});

const prosto = Prosto_One({
  subsets: ["latin", "cyrillic"],
  variable: "--font-prosto",
  weight: "400",
});

const SITE_DESCRIPTION =
  "Керамогранит и клинкерная плитка из Японии и Европы в Бишкеке. AI-примерка плитки в вашем интерьере и на фасаде, шоурум, образцы и доставка по Бишкеку.";

export const metadata: Metadata = {
  metadataBase: new URL("https://japanceramic.kg"),
  title: {
    default: "Japan Ceramic — премиальный керамогранит и клинкер в Бишкеке",
    template: "%s — Japan Ceramic",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "керамогранит Бишкек",
    "клинкерная плитка Бишкек",
    "плитка Кыргызстан",
    "керамогранит купить",
    "фасадный клинкер",
    "плитка для фасада",
    "плитка для ванной",
    "напольная плитка",
    "AI визуализация плитки",
    "Japan Ceramic",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    url: "https://japanceramic.kg",
    siteName: "Japan Ceramic",
    title: "Japan Ceramic — премиальный керамогранит и клинкер в Бишкеке",
    description: SITE_DESCRIPTION,
    images: [{ url: "/og-cover.jpg", width: 1200, height: 630, alt: "Japan Ceramic" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Japan Ceramic — премиальный керамогранит и клинкер в Бишкеке",
    description: SITE_DESCRIPTION,
    images: ["/og-cover.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#0c0c12",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body className={`${inter.variable} ${playfair.variable} ${krona.variable} ${prosto.variable} font-[family-name:var(--font-sans)]`}>
        {children}
      </body>
    </html>
  );
}

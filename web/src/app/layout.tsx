import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "Japan Ceramic — премиальный керамогранит",
  description: "Премиальный керамогранит для современной архитектуры",
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

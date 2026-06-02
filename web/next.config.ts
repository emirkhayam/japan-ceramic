import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  turbopack: {
    root: __dirname,
  },
  outputFileTracingIncludes: {
    "/": ["./japan-ceramic.html"],
  },
  images: {
    // Оптимизация удалённых изображений (next/image): Supabase Storage, Vercel Blob, Unsplash (сиды).
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "*.supabase.in" },
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
    formats: ["image/avif", "image/webp"],
    // Локальный placeholder-tile.svg как fallback — разрешаем SVG (только наш ассет).
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
  },
};

export default nextConfig;

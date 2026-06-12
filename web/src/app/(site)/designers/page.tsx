import Link from "next/link";
import type { Metadata } from "next";
import {
  Sparkles, Image as ImageIcon, Box, FileText, Layers, Clock,
  Package, FolderHeart, Building2, ArrowRight, Phone, MessageCircle, Brush,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { getSiteSettings, waHref, telHref } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Дизайнерам и архитекторам — Japan Ceramic",
  description:
    "Весь ассортимент керамогранита, клинкера и мозаики Japan Ceramic для ваших проектов: студийные фото, бесшовные 3D-текстуры, спецификации и AI-визуализация материала на фото объекта.",
};

// Лендинг под рекламу для дизайнеров/архитекторов. Намеренно НЕ в основном меню
// (PUBLIC_NAV) — отдельная посадочная страница для рекламных кампаний.
export default async function DesignersPage() {
  const [productCount, categories, formats, heroProducts, settings] = await Promise.all([
    prisma.product.count({ where: { isActive: true } }),
    prisma.category.findMany({
      where: { products: { some: { isActive: true } }, parentId: null },
      select: { name: true, slug: true, _count: { select: { products: true } } },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.product.findMany({
      where: { isActive: true, dimensions: { not: null } },
      select: { dimensions: true },
      distinct: ["dimensions"],
    }),
    prisma.product.findMany({
      where: { isActive: true, images: { some: {} } },
      select: {
        name: true,
        slug: true,
        images: { orderBy: { sortOrder: "asc" }, take: 1, select: { imageUrl: true } },
      },
      orderBy: [{ isPopular: "desc" }, { createdAt: "desc" }],
      take: 8,
    }),
    getSiteSettings(),
  ]);

  const formatCount = formats.length;
  const wa = waHref(settings.whatsapp);
  const tel = telHref(settings.phone);
  const heroTiles = heroProducts.filter((p) => p.images[0]?.imageUrl);

  const files = [
    {
      icon: ImageIcon,
      title: "Студийные фото",
      text: "Каждая позиция отснята на нейтральном фоне в высоком разрешении — готово для мудбордов и презентаций клиенту.",
    },
    {
      icon: Box,
      title: "Бесшовные 3D-текстуры",
      text: "ZIP-архив текстур для 3ds Max, V-Ray, Corona и SketchUp — фон автоматически срезается, остаётся чистая плитка.",
    },
    {
      icon: FileText,
      title: "Спецификации",
      text: "Размеры, поверхность, износостойкость и характеристики каждой коллекции — всё под рукой при подборе.",
    },
  ];

  const advantages = [
    { icon: Layers, title: "Единая библиотека материалов", text: "Керамогранит, клинкер и мозаика в одном месте — не нужно собирать образцы по десяткам поставщиков." },
    { icon: Clock, title: "Экономия времени", text: "Готовые файлы и визуализация ускоряют подбор: от идеи до согласования материала — за один вечер." },
    { icon: Package, title: "Один поставщик", text: "От подбора до поставки на объект работаете с нами — без посредников и рассинхрона по срокам." },
    { icon: FolderHeart, title: "Подборки в кабинете", text: "Сохраняйте материалы по проектам в личном кабинете и возвращайтесь к ним в любой момент." },
  ];

  return (
    <div className="overflow-hidden">
      {/* ======================= HERO ======================= */}
      <section className="relative mx-auto max-w-7xl px-4 pt-12 pb-16 sm:px-8 sm:pt-16 sm:pb-24">
        <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <span className="label-pill">Для дизайнеров и архитекторов</span>
            <h1 className="mt-5 font-display text-4xl leading-tight sm:text-5xl lg:text-[3.4rem]">
              Весь наш ассортимент — в вашем проекте
            </h1>
            <p className="mt-5 max-w-xl text-lg text-mist-300">
              Японская керамика, клинкер и мозаика с готовыми файлами для работы:
              студийные фото, бесшовные 3D-текстуры, спецификации и AI-визуализация
              материала прямо на фото вашего объекта.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/catalog" className="btn-gold !px-7 !py-4 text-base">
                Смотреть каталог <ArrowRight size={18} />
              </Link>
              <Link href="/visualize" className="btn-ghost !px-7 !py-4 text-base">
                <Sparkles size={18} /> AI-визуализация
              </Link>
            </div>
            <p className="mt-4 text-sm text-mist-400">
              Доступ к файлам и визуализации — бесплатно для профессионалов.
            </p>
          </div>

          {/* Коллаж из реальных фото каталога */}
          <div className="grid grid-cols-3 gap-3">
            {heroTiles.slice(0, 6).map((p, i) => (
              <Link
                key={p.slug}
                href={`/catalog/${p.slug}`}
                className={`group relative overflow-hidden rounded-xl border border-white/10 bg-ink-800 ${
                  i === 0 ? "col-span-2 row-span-2 aspect-square" : "aspect-square"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.images[0]!.imageUrl}
                  alt={p.name}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ======================= ГОТОВЫЕ ФАЙЛЫ ======================= */}
      <section className="border-t border-white/5 bg-ink-800/30">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-8 sm:py-24">
          <div className="max-w-2xl">
            <span className="label-pill">Готовые файлы</span>
            <h2 className="mt-4 font-display text-3xl sm:text-4xl">
              Всё, что нужно для проекта — уже подготовлено
            </h2>
            <p className="mt-3 text-mist-400">
              Не ищите текстуры по всему интернету. Каждая позиция в каталоге идёт
              с файлами, готовыми к работе в ваших сценах и презентациях.
            </p>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {files.map((f) => (
              <div key={f.title} className="card p-7">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gold-500/10 text-gold-400">
                  <f.icon size={22} />
                </div>
                <h3 className="mt-5 text-xl font-semibold text-mist-100">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-mist-400">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ======================= AI-ВИЗУАЛИЗАЦИЯ ======================= */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-8 sm:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <span className="label-pill">AI-визуализация</span>
            <h2 className="mt-4 font-display text-3xl sm:text-4xl">
              Примерьте материал прямо на фото объекта
            </h2>
            <p className="mt-4 text-mist-300">
              Загрузите фото интерьера или фасада, выделите кистью нужный участок —
              и наш ИИ подставит выбранный материал фотореалистично, с сохранением
              перспективы и света.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-mist-300">
              {[
                "Выделение участка кистью — меняйте только нужную стену или пол",
                "Комбинируйте несколько клинкеров на одном фасаде",
                "Результат за 15–30 секунд, можно скачать и показать клиенту",
              ].map((t) => (
                <li key={t} className="flex items-start gap-3">
                  <Brush size={16} className="mt-0.5 shrink-0 text-gold-400" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            <Link href="/visualize" className="btn-gold mt-8 !px-7 !py-4 text-base">
              <Sparkles size={18} /> Открыть визуализацию
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {heroTiles.slice(2, 6).map((p) => (
              <div key={p.slug} className="overflow-hidden rounded-xl border border-white/10 bg-ink-800 aspect-[4/5]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.images[0]!.imageUrl} alt={p.name} className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ======================= ПРЕИМУЩЕСТВА ======================= */}
      <section className="border-y border-white/5 bg-ink-800/30">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-8 sm:py-24">
          <div className="max-w-2xl">
            <span className="label-pill">Почему с нами удобно</span>
            <h2 className="mt-4 font-display text-3xl sm:text-4xl">Меньше рутины — больше проектов</h2>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {advantages.map((a) => (
              <div key={a.title} className="card p-6">
                <a.icon size={22} className="text-gold-400" />
                <h3 className="mt-4 text-base font-semibold text-mist-100">{a.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-mist-400">{a.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ======================= ЦИФРЫ + КАТЕГОРИИ ======================= */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-8 sm:py-24">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          {[
            { num: `${productCount}+`, label: "позиций в каталоге" },
            { num: `${categories.length}`, label: "категории материалов" },
            { num: `${formatCount}`, label: "форматов" },
            { num: "600×1200", label: "макс. формат, мм" },
          ].map((st) => (
            <div key={st.label} className="text-center sm:text-left">
              <div className="font-display text-3xl text-gold-400 sm:text-4xl">{st.num}</div>
              <div className="mt-1 text-sm text-mist-400">{st.label}</div>
            </div>
          ))}
        </div>

        {categories.length > 0 && (
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.slice(0, 3).map((c) => (
              <Link
                key={c.slug}
                href={`/catalog?category=${c.slug}`}
                className="card group flex items-center justify-between p-6 transition hover:border-gold-500/40"
              >
                <div>
                  <div className="text-lg font-semibold text-mist-100">{c.name}</div>
                  <div className="mt-1 text-sm text-mist-400">{c._count.products} позиций</div>
                </div>
                <ArrowRight size={20} className="text-mist-400 transition group-hover:translate-x-1 group-hover:text-gold-400" />
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ======================= CTA / КОНТАКТЫ ======================= */}
      <section className="border-t border-white/5">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-8 sm:py-24">
          <div className="card relative overflow-hidden p-8 sm:p-14">
            <div className="relative z-10 max-w-2xl">
              <Building2 size={26} className="text-gold-400" />
              <h2 className="mt-4 font-display text-3xl sm:text-4xl">
                Начните проект с Japan Ceramic
              </h2>
              <p className="mt-3 text-mist-300">
                Подберём материал под задачу, пришлём образцы и просчитаем объём.
                Напишите нам — ответим быстро.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                {wa && (
                  <a href={wa} target="_blank" rel="noopener" className="btn-gold !px-7 !py-4 text-base">
                    <MessageCircle size={18} /> Написать в WhatsApp
                  </a>
                )}
                {tel && (
                  <a href={tel} className="btn-ghost !px-7 !py-4 text-base">
                    <Phone size={18} /> {settings.phone}
                  </a>
                )}
                <Link href="/catalog" className="btn-ghost !px-7 !py-4 text-base">
                  Смотреть каталог
                </Link>
              </div>
            </div>
            <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-gold-500/10 blur-3xl" />
          </div>
        </div>
      </section>
    </div>
  );
}

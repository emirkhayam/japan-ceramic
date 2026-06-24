import Link from "next/link";
import type { Metadata } from "next";
import {
  Sparkles, Image as ImageIcon, Box, FileText, Layers, Clock,
  Package, FolderHeart, Building2, ArrowRight, Phone, MessageCircle, Brush,
  UserPlus, Download, Truck,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { getSiteSettings, waHref, telHref } from "@/lib/settings";
import { DesignerLeadForm } from "@/components/designers/DesignerLeadForm";
import { TileCalculator } from "@/components/designers/TileCalculator";

export const metadata: Metadata = {
  title: "Дизайнерам и архитекторам — Japan Ceramic",
  description:
    "Зарегистрируйтесь и получите доступ к библиотеке Japan Ceramic: студийные фото, бесшовные 3D-текстуры, спецификации и AI-визуализация материала на фото вашего объекта.",
};

// Лендинг под рекламу для дизайнеров/архитекторов. Намеренно НЕ в основном меню
// (PUBLIC_NAV) — отдельная посадочная страница для рекламных кампаний.
// Главный смысл (как на референсе Tilda): регистрация дизайнера → доступ к библиотеке.
export default async function DesignersPage() {
  const [productCount, categories, formats, settings] = await Promise.all([
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
    getSiteSettings(),
  ]);

  const formatCount = formats.length;
  const wa = waHref(settings.whatsapp);
  const tel = telHref(settings.phone);

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

  const steps = [
    { icon: UserPlus, title: "Регистрация", text: "Оставьте заявку — подтвердим, что вы профессионал, и откроем доступ." },
    { icon: Download, title: "Доступ к файлам", text: "Скачивайте фото, 3D-текстуры и спецификации по каждой позиции каталога." },
    { icon: Brush, title: "AI-визуализация", text: "Примеряйте материал на фото объекта: выделяйте участок кистью, комбинируйте." },
    { icon: Truck, title: "Заявка и поставка", text: "Согласуем объём, пришлём образцы и доставим материал на объект." },
  ];

  const advantages = [
    { icon: Layers, title: "Единая библиотека материалов", text: "Керамогранит, клинкер и мозаика в одном месте — не нужно собирать образцы по десяткам поставщиков." },
    { icon: Clock, title: "Экономия времени", text: "Готовые файлы и визуализация ускоряют подбор: от идеи до согласования материала — за один вечер." },
    { icon: Package, title: "Один поставщик", text: "От подбора до поставки на объект работаете с нами — без посредников и рассинхрона по срокам." },
    { icon: FolderHeart, title: "Подборки в кабинете", text: "Сохраняйте материалы по проектам в личном кабинете и возвращайтесь к ним в любой момент." },
  ];

  return (
    <div className="relative overflow-hidden">
      {/* ======================= ПРЕМИАЛЬНЫЙ ФОН ======================= */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        {/* тёплое золотое свечение сверху */}
        <div
          className="absolute left-1/2 top-[-14rem] h-[44rem] w-[64rem] -translate-x-1/2 rounded-full blur-3xl"
          style={{ background: "radial-gradient(ellipse at center, rgba(198,154,78,.13), transparent 70%)" }}
        />
        {/* холодный акцент справа — для глубины */}
        <div
          className="absolute right-[-16rem] top-[36%] h-[36rem] w-[36rem] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(120,150,200,.10), transparent 70%)" }}
        />
        {/* мягкое золото слева внизу */}
        <div
          className="absolute bottom-[-12rem] left-[-12rem] h-[34rem] w-[34rem] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(198,154,78,.07), transparent 70%)" }}
        />
        {/* тонкая сетка, гаснущая к краям */}
        <div className="bg-grid-faint absolute inset-0" />
      </div>

      {/* ======================= HERO ======================= */}
      <section className="relative mx-auto max-w-7xl px-4 pt-12 pb-16 sm:px-8 sm:pt-16 sm:pb-24">
        <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <span className="label-pill">Для дизайнеров и архитекторов</span>
            <h1 className="mt-5 font-display text-4xl leading-tight sm:text-5xl lg:text-[3.4rem]">
              Весь наш ассортимент — в вашем проекте
            </h1>
            <p className="mt-5 max-w-xl text-lg text-mist-300">
              Зарегистрируйтесь и получите доступ к библиотеке Japan Ceramic:
              студийные фото, бесшовные 3D-текстуры, спецификации по каждой позиции
              и AI-визуализация — любую плитку из каталога можно сразу примерить
              на фото вашего объекта.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="#register" className="btn-gold !px-7 !py-4 text-base">
                Получить доступ бесплатно <ArrowRight size={18} />
              </Link>
              <Link href="/catalog" className="btn-ghost !px-7 !py-4 text-base">
                Смотреть каталог
              </Link>
            </div>
            <p className="mt-4 text-sm text-mist-400">
              Бесплатно для профессионалов · доступ открываем после короткой проверки.
            </p>
          </div>

          {/* Фото из шоурума Japan Ceramic */}
          <div className="relative overflow-hidden rounded-2xl ring-1 ring-white/10 shadow-[0_28px_70px_-30px_rgba(198,154,78,.4)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/designers-mosaic.webp"
              alt="Шоурум Japan Ceramic — стена мозаики"
              className="aspect-[4/3] h-full w-full object-cover"
            />
            <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/[.06]" />
          </div>
        </div>
      </section>

      {/* ======================= ЧТО ОТКРЫВАЕТСЯ ПОСЛЕ РЕГИСТРАЦИИ ======================= */}
      <section className="border-t border-white/5 bg-ink-800/30">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-8 sm:py-24">
          <div className="max-w-2xl">
            <span className="label-pill">Что открывается после регистрации</span>
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

      {/* ======================= КАК ЭТО РАБОТАЕТ ======================= */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-8 sm:py-24">
        <div className="max-w-2xl">
          <span className="label-pill">Как это работает</span>
          <h2 className="mt-4 font-display text-3xl sm:text-4xl">Четыре шага до материала на объекте</h2>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((st, i) => (
            <div key={st.title} className="card relative p-6">
              <div className="absolute right-5 top-5 font-display text-2xl text-white/10">0{i + 1}</div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gold-500/10 text-gold-400">
                <st.icon size={22} />
              </div>
              <h3 className="mt-5 text-base font-semibold text-mist-100">{st.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-mist-400">{st.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ======================= AI-ВИЗУАЛИЗАЦИЯ ======================= */}
      <section className="border-y border-white/5 bg-ink-800/30">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-8 sm:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <span className="label-pill">AI-визуализация</span>
              <h2 className="mt-4 font-display text-3xl sm:text-4xl">
                Примерьте материал прямо на фото объекта
              </h2>
              <p className="mt-4 text-mist-300">
                Загрузите фото интерьера или фасада, выделите кистью нужный участок —
                и наш ИИ подставит выбранный материал фотореалистично, с сохранением
                перспективы и света. Ничего скачивать или готовить не нужно.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-mist-300">
                {[
                  "Доступны все плитки каталога — выбирайте любую позицию прямо в визуализаторе",
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

            <div className="relative overflow-hidden rounded-2xl ring-1 ring-white/10 shadow-[0_28px_70px_-30px_rgba(198,154,78,.4)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/designers-slabs.webp"
                alt="Шоурум Japan Ceramic — крупноформатный керамогранит"
                className="aspect-[4/3] h-full w-full object-cover"
              />
              <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/[.06]" />
            </div>
          </div>
        </div>
      </section>

      {/* ======================= ПРЕИМУЩЕСТВА ======================= */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-8 sm:py-24">
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
      </section>

      {/* ======================= ИНСТРУМЕНТЫ: КАЛЬКУЛЯТОР ======================= */}
      <section className="border-t border-white/5 bg-ink-800/30">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-8 sm:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <span className="label-pill">Инструменты дизайнера</span>
              <h2 className="mt-4 font-display text-3xl sm:text-4xl">
                Посчитайте расход прямо здесь
              </h2>
              <p className="mt-4 text-mist-300">
                Быстрая прикидка объёма закупки с запасом на подрез — чтобы не
                держать цифры в голове на встрече с клиентом. А все подобранные
                материалы сохраняйте в личном кабинете по проектам.
              </p>
              <Link href="#register" className="btn-ghost mt-8 !px-7 !py-4 text-base">
                Получить полный доступ <ArrowRight size={18} />
              </Link>
            </div>
            <TileCalculator />
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

      {/* ======================= РЕГИСТРАЦИЯ / ЗАЯВКА ======================= */}
      <section id="register" className="scroll-mt-24 border-t border-white/5">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-8 sm:py-24">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <Building2 size={26} className="text-gold-400" />
              <h2 className="mt-4 font-display text-3xl sm:text-4xl">
                Зарегистрируйтесь и получите доступ
              </h2>
              <p className="mt-3 text-mist-300">
                Оставьте заявку — мы свяжемся с вами и откроем доступ к библиотеке
                Japan Ceramic: фото, 3D-текстуры, спецификации и AI-визуализация.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-mist-300">
                {[
                  "Доступ бесплатный для дизайнеров и архитекторов",
                  "Файлы готовы к работе в ваших сценах и презентациях",
                  "Подборки материалов сохраняются в личном кабинете",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-3">
                    <ArrowRight size={16} className="mt-0.5 shrink-0 text-gold-400" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                {wa && (
                  <a href={wa} target="_blank" rel="noopener" className="btn-ghost !px-6 !py-3 text-sm">
                    <MessageCircle size={16} /> WhatsApp
                  </a>
                )}
                {tel && (
                  <a href={tel} className="btn-ghost !px-6 !py-3 text-sm">
                    <Phone size={16} /> {settings.phone}
                  </a>
                )}
              </div>
              <p className="mt-5 text-sm text-mist-400">
                Предпочитаете зарегистрироваться сами?{" "}
                <Link href="/auth/register" className="text-gold-400 hover:underline">
                  Создать аккаунт →
                </Link>
              </p>
            </div>

            <DesignerLeadForm />
          </div>
        </div>
      </section>
    </div>
  );
}

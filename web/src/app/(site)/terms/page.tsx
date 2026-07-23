import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Пользовательское соглашение — Japan Ceramic",
  alternates: { canonical: "/terms" },
  description: "Условия использования сайта Japan Ceramic.",
};

export default function TermsPage() {
  return (
    <article className="max-w-[760px] mx-auto px-10 max-md:px-5 py-20">
      <h1 className="text-[clamp(26px,3vw,38px)] font-extralight tracking-tight mb-3">
        Пользовательское соглашение
      </h1>
      <p className="text-[13px] text-[var(--ink-mute)] mb-10">Обновлено: 2026</p>

      <div className="space-y-6 text-[15px] leading-[1.75] text-[var(--ink-soft)]">
        <p>
          Сайт Japan Ceramic предоставляет информацию о продукции (керамограните, плитке,
          коллекциях) и инструменты подбора. Используя сайт, вы соглашаетесь с условиями ниже.
        </p>
        <section>
          <h2 className="text-[18px] font-light text-[var(--ink)] mb-2">Информация о товарах</h2>
          <p>Характеристики, изображения и наличие приведены справочно и могут отличаться от фактических. Точные условия и цены уточняйте у менеджера.</p>
        </section>
        <section>
          <h2 className="text-[18px] font-light text-[var(--ink)] mb-2">Аккаунт дизайнера</h2>
          <p>Вы отвечаете за сохранность данных входа и за действия, совершённые под вашей учётной записью.</p>
        </section>
        <section>
          <h2 className="text-[18px] font-light text-[var(--ink)] mb-2">Интеллектуальная собственность</h2>
          <p>Материалы сайта принадлежат Japan Ceramic и используются только в личных некоммерческих целях.</p>
        </section>
        <p className="pt-2">
          Вопросы по условиям —{" "}
          <Link href="/#contacts" className="text-[var(--color-gold-400)] border-b border-[var(--line-2)] hover:text-[var(--ink)] transition-colors">
            свяжитесь с нами
          </Link>
          .
        </p>
      </div>
    </article>
  );
}

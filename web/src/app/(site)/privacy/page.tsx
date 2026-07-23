import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Политика конфиденциальности — Japan Ceramic",
  alternates: { canonical: "/privacy" },
  description: "Как Japan Ceramic обрабатывает персональные данные посетителей сайта.",
};

export default function PrivacyPage() {
  return (
    <article className="max-w-[760px] mx-auto px-10 max-md:px-5 py-20">
      <h1 className="text-[clamp(26px,3vw,38px)] font-extralight tracking-tight mb-3">
        Политика конфиденциальности
      </h1>
      <p className="text-[13px] text-[var(--ink-mute)] mb-10">Обновлено: 2026</p>

      <div className="space-y-6 text-[15px] leading-[1.75] text-[var(--ink-soft)]">
        <p>
          Мы уважаем вашу приватность. Персональные данные, которые вы оставляете на сайте
          (имя, телефон, e-mail, текст заявки), используются исключительно для обработки
          обращения и связи с вами по вашему запросу.
        </p>
        <section>
          <h2 className="text-[18px] font-light text-[var(--ink)] mb-2">Какие данные мы собираем</h2>
          <p>Имя, контактный телефон, адрес электронной почты и комментарий — только то, что вы указываете в форме заявки.</p>
        </section>
        <section>
          <h2 className="text-[18px] font-light text-[var(--ink)] mb-2">Как мы их используем</h2>
          <p>Для ответа на заявку, подбора материалов и информирования о статусе обращения. Мы не передаём данные третьим лицам и не используем их для рассылок без вашего согласия.</p>
        </section>
        <section>
          <h2 className="text-[18px] font-light text-[var(--ink)] mb-2">Ваши права</h2>
          <p>Вы можете запросить удаление своих данных или полный текст политики — напишите нам.</p>
        </section>
        <p className="pt-2">
          По любым вопросам обработки данных{" "}
          <Link href="/#contacts" className="text-[var(--color-gold-400)] border-b border-[var(--line-2)] hover:text-[var(--ink)] transition-colors">
            свяжитесь с нами
          </Link>
          .
        </p>
      </div>
    </article>
  );
}

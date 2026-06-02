import Link from "next/link";
import { LogoMark } from "@/components/BrandLogo";

export type CollectionCardData = {
  slug: string;
  name: string;
  cover: string | null;
  tags: string[];          // spaceTag/styleTag — эйбрау-пилюли
  metaLine?: string;       // охват: «Клинкер · 4 формата · Матовая»
  isNew?: boolean;
  isRecommended?: boolean;
};

// Крупная редакционная карточка коллекции: имя и теги ЛЕЖАТ на фото
// (как у tubadzin), бейджи в углу, премиум-ховер. Только CSS — серверный компонент.
export default function CollectionCard({
  c,
  featured = false,
  aspectClass,
  className = "",
}: {
  c: CollectionCardData;
  featured?: boolean;
  aspectClass?: string;     // переопределение пропорции (бенто-ритм)
  className?: string;
}) {
  const ratio = aspectClass ?? (featured ? "aspect-[16/10] md:aspect-[21/9]" : "aspect-[4/5]");

  return (
    <Link
      href={`/collections/${c.slug}`}
      className={`group relative block overflow-hidden rounded-2xl border border-white/[.08] bg-[var(--bg-3)] transition-all duration-300 will-change-transform hover:-translate-y-2 hover:border-[rgba(206,173,120,.45)] hover:shadow-[0_30px_80px_-30px_rgba(0,0,0,.85)] ${ratio} ${className}`}
    >
      {/* Фото / заглушка */}
      {c.cover ? (
        <img
          src={c.cover}
          alt={c.name}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover brightness-[.82] saturate-[.92] transition-all duration-700 ease-[var(--ease)] group-hover:brightness-100 group-hover:saturate-100 group-hover:scale-[1.04]"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--brand-navy)]">
          <LogoMark height={featured ? 64 : 48} color="rgba(206,173,120,.30)" />
        </div>
      )}

      {/* Вуаль снизу — «сажает» фото в тёмную сцену и держит читаемость текста */}
      <div className="absolute inset-0 bg-gradient-to-t from-[rgba(8,10,15,.82)] via-[rgba(8,10,15,.12)] to-transparent" />

      {/* Бейджи (на фото, верхний левый угол) */}
      {(c.isNew || c.isRecommended) && (
        <div className="absolute top-4 left-4 z-10 flex flex-wrap gap-1.5">
          {c.isNew && (
            <span className="px-3 py-1 rounded-full text-[10px] font-semibold tracking-[.14em] uppercase bg-[var(--color-gold-400)] text-[#0c1018]">
              Новинка
            </span>
          )}
          {c.isRecommended && (
            <span className="px-3 py-1 rounded-full text-[10px] font-semibold tracking-[.14em] uppercase bg-[rgba(12,16,24,.55)] backdrop-blur-md border border-white/15 text-[var(--ink)]">
              Рекомендуем
            </span>
          )}
        </div>
      )}

      {/* Появляющаяся стрелка-CTA */}
      <span className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full border border-white/15 bg-[rgba(8,10,15,.45)] backdrop-blur-md flex items-center justify-center text-[var(--ink)] opacity-0 -translate-y-1 transition-all duration-400 ease-[var(--ease)] group-hover:opacity-100 group-hover:translate-y-0">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3.5 10.5L10.5 3.5M5 3.5h5.5V9" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      </span>

      {/* Имя + теги + охват ЛЕЖАТ на фото снизу */}
      <div className={`absolute left-0 right-0 bottom-0 z-10 ${featured ? "p-7 md:p-10" : "p-5 md:p-6"}`}>
        {/* Эйбрау-теги с золотой засечкой, удлиняющейся на ховере */}
        <div className="flex items-center gap-3 mb-2.5">
          <span className="h-px w-6 bg-[var(--color-gold-400)] transition-all duration-500 ease-[var(--ease)] group-hover:w-12" />
          {c.tags.length > 0 && (
            <span className="text-[10px] md:text-[11px] tracking-[.2em] uppercase text-[var(--ink-soft)]">
              {c.tags.join(" · ")}
            </span>
          )}
        </div>
        <h3
          className={`text-[var(--ink)] leading-[0.98] transition-colors duration-300 group-hover:text-[var(--color-gold-400)] ${
            featured ? "text-[clamp(30px,4.4vw,60px)]" : "text-[clamp(22px,2.4vw,34px)]"
          }`}
          style={{ fontFamily: "var(--font-display)" }}
        >
          {c.name}
        </h3>
        {c.metaLine && (
          <div className="mt-2.5 text-[12px] md:text-[13px] text-[var(--ink-mute)]">{c.metaLine}</div>
        )}
      </div>
    </Link>
  );
}

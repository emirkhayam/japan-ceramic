"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

type PortfolioCard = { img: string; tag: string; title: string; meta: string };

// Демо-объекты по умолчанию (показываются, пока админ не добавил свои).
const DEFAULT_PORTFOLIO: PortfolioCard[] = [
  { img: "https://images.unsplash.com/photo-1605231591078-1d6208654b08?q=80&w=820&auto=format&fit=crop", tag: "Фасад · Керамогранит", title: "ЖК «Меридиан»", meta: "Бишкек · 2023" },
  { img: "https://images.unsplash.com/photo-1521459467264-802e2ef3141f?q=80&w=820&auto=format&fit=crop", tag: "Входная группа · Керамогранит", title: "БЦ «Альтаир»", meta: "Бишкек · 2022" },
  { img: "https://images.unsplash.com/photo-1625008668243-e10fa6121030?q=80&w=820&auto=format&fit=crop", tag: "Стены · Клинкер", title: "Ресторан «Кура»", meta: "Бишкек · 2023" },
  { img: "https://images.unsplash.com/photo-1726987242665-d0a7d2268ea0?q=80&w=820&auto=format&fit=crop", tag: "Интерьер · Мозаика", title: "Резиденция «Тихая»", meta: "Бишкек · 2024" },
  { img: "https://images.unsplash.com/photo-1536566482680-fca31930a0bd?q=80&w=820&auto=format&fit=crop", tag: "Лобби · Керамогранит", title: "Отель «Северная гавань»", meta: "Иссык-Куль · 2022" },
  { img: "https://images.unsplash.com/photo-1703867110039-dc2ad34be121?q=80&w=820&auto=format&fit=crop", tag: "Бассейн · Мозаика", title: "Спа-комплекс «Тэрма»", meta: "Бишкек · 2024" },
];
const DEFAULT_CAPTION = "Где керамогранит, клинкер и мозаика Japan Ceramic уже работают — от фасадов до интерьеров.";

export default function AboutContent({
  portfolio,
  portfolioCaption,
}: {
  portfolio?: PortfolioCard[];
  portfolioCaption?: string;
} = {}) {
  const projects = portfolio && portfolio.length ? portfolio : DEFAULT_PORTFOLIO;
  const projectsCaption = portfolioCaption || DEFAULT_CAPTION;
  const wallRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const pjRef = useRef<HTMLDivElement>(null);

  // Прокрутка карусели «Наши объекты» на одну карточку (стрелки).
  const scrollPj = (dir: number) => {
    const el = pjRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>(".ab-pj-card");
    const step = card ? card.offsetWidth + 16 : el.clientWidth * 0.8;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  // Авто-прокрутка карусели (бесшовная, набор продублирован) + перетаскивание «ладошкой».
  useEffect(() => {
    const el = pjRef.current;
    if (!el) return;
    let raf = 0;
    let paused = false;
    let dragging = false;
    let startX = 0;
    let startScroll = 0;
    let acc = 0; // накопитель долей пикселя (scrollLeft округляется до целого)
    const SPEED = 0.5; // px за кадр — медленно и плавно (~30px/с)
    const half = () => el.scrollWidth / 2 || 1; // ширина одного (недублированного) набора
    const wrap = () => {
      const h = half();
      if (el.scrollLeft >= h) el.scrollLeft -= h;
      else if (el.scrollLeft < 0) el.scrollLeft += h;
    };
    const step = () => {
      if (!paused && !dragging && el.scrollWidth > el.clientWidth) {
        acc += SPEED;
        const whole = Math.floor(acc);
        if (whole >= 1) {
          acc -= whole;
          el.scrollLeft += whole;
          wrap();
        }
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    const onEnter = () => { paused = true; };
    const onLeave = () => { paused = false; };
    const onDown = (e: PointerEvent) => {
      dragging = true;
      startX = e.clientX;
      startScroll = el.scrollLeft;
      el.classList.add("dragging");
      el.setPointerCapture?.(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      el.scrollLeft = startScroll - (e.clientX - startX);
      wrap();
    };
    const onUp = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      el.classList.remove("dragging");
      el.releasePointerCapture?.(e.pointerId);
    };

    el.addEventListener("mouseenter", onEnter);
    el.addEventListener("mouseleave", onLeave);
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);

    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("mouseenter", onEnter);
      el.removeEventListener("mouseleave", onLeave);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    };
  }, [projects.length]);

  // Build tile wall + parallax
  useEffect(() => {
    const wall = wallRef.current;
    const hero = heroRef.current;
    if (!wall || !hero) return;

    const COLS = 9, ROWS = 6, N = COLS * ROWS;
    const variants = ["tile-a", "tile-b", "tile-c", "tile-d"];
    const texUrls = [
      "https://images.unsplash.com/photo-1747696766706-5485b39bf358",
      "https://images.unsplash.com/photo-1625008668243-e10fa6121030",
      "https://images.unsplash.com/photo-1703867110039-dc2ad34be121",
      "https://images.unsplash.com/photo-1726987242665-d0a7d2268ea0",
      "https://images.unsplash.com/photo-1536566482680-fca31930a0bd",
      "https://images.unsplash.com/photo-1605231591078-1d6208654b08",
      "https://images.unsplash.com/photo-1553345723-5d0630e0886c",
      "https://images.unsplash.com/photo-1521459467264-802e2ef3141f",
    ];
    const TEX: Record<number, string> = {};
    [2, 4, 9, 12, 16, 19, 21, 24, 28, 30, 33, 37, 40, 43, 46, 49, 52].forEach((idx, k) => {
      TEX[idx] = texUrls[k % texUrls.length];
    });

    const faces: HTMLElement[] = [];
    for (let i = 0; i < N; i++) {
      const col = i % COLS, row = (i / COLS) | 0;
      const t = document.createElement("div");
      t.className = "ab-wtile";
      t.style.transitionDelay = ((col + row) * 0.045).toFixed(3) + "s";
      const face = document.createElement("div");
      face.className = "ab-wt-face " + variants[(i * 5 + row * 3) % 4];
      if (TEX[i]) {
        const im = document.createElement("img");
        im.src = TEX[i] + "?q=68&w=360&auto=format&fit=crop";
        im.alt = "";
        im.loading = "lazy";
        face.appendChild(im);
      }
      t.appendChild(face);
      wall.appendChild(t);
      faces.push(face);
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        wall.querySelectorAll(".ab-wtile").forEach((t) => t.classList.add("in"));
        hero.classList.add("ready");
      });
    });

    if (matchMedia("(pointer:fine)").matches) {
      let mx = -999, my = -999, raf = 0;
      const onMove = (e: PointerEvent) => {
        mx = e.clientX; my = e.clientY;
        const r = hero.getBoundingClientRect();
        const x = (mx - r.left) / r.width - 0.5;
        const y = (my - r.top) / r.height - 0.5;
        wall.style.transform = `rotateY(${(x * 6).toFixed(2)}deg) rotateX(${(-y * 4).toFixed(2)}deg)`;
        if (!raf) raf = requestAnimationFrame(glow);
      };
      const onLeave = () => {
        mx = my = -999;
        wall.style.transform = "";
        faces.forEach((f) => f.style.setProperty("--l", "0"));
      };
      function glow() {
        raf = 0;
        const R = 240;
        for (let i = 0; i < faces.length; i++) {
          const b = faces[i].getBoundingClientRect();
          const d = Math.hypot(b.left + b.width / 2 - mx, b.top + b.height / 2 - my);
          const l = Math.max(0, 1 - d / R);
          faces[i].style.setProperty("--l", (l * l).toFixed(3));
        }
      }
      hero.addEventListener("pointermove", onMove as EventListener);
      hero.addEventListener("pointerleave", onLeave);
      return () => {
        hero.removeEventListener("pointermove", onMove as EventListener);
        hero.removeEventListener("pointerleave", onLeave);
      };
    }
  }, []);

  // Scroll reveal
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
        });
      },
      { threshold: 0.16 }
    );
    document.querySelectorAll(".ab-reveal,.ab-stile").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  // Counters
  useEffect(() => {
    const cio = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          const el = e.target as HTMLElement;
          const end = +(el.dataset.count || "0");
          let t0: number | null = null;
          const step = (t: number) => {
            if (!t0) t0 = t;
            const p = Math.min((t - t0) / 1700, 1);
            el.textContent = String(Math.floor((1 - Math.pow(1 - p, 3)) * end));
            if (p < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
          cio.unobserve(el);
        });
      },
      { threshold: 0.6 }
    );
    document.querySelectorAll(".ab-count").forEach((el) => cio.observe(el));
    return () => cio.disconnect();
  }, []);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: aboutStyles }} />

      {/* HERO */}
      <section className="ab-hero" id="hero" ref={heroRef}>
        <div className="ab-wall" id="wall" ref={wallRef} />
        <div className="ab-hero-veil" />
        <div className="ab-hero-in">
          <div className="ab-wrap">
            <div className="ab-crumbs"><Link href="/">Главная</Link><span>/</span>О бренде</div>
            <div className="ab-eyebrow">О компании</div>
            <h1>
              <span className="ab-ln"><span>Японская керамика,</span></span>
              <span className="ab-ln"><span>выложенная&nbsp;<i>точностью</i></span></span>
              <span className="ab-ln"><span>до&nbsp;последней&nbsp;плиты</span></span>
            </h1>
            <p className="ab-hero-lead">Japan Ceramic — поставщик премиального керамогранита, клинкера и мозаики. Мы соединяем точность японского производства с эстетикой, которую ценят архитекторы и дизайнеры.</p>
            <div className="ab-hero-hint"><span className="ab-ln-d" />Проведите по стене — она оживёт</div>
          </div>
        </div>
      </section>

      {/* MANIFESTO */}
      <section className="ab-sec ab-manifesto">
        <div className="ab-wrap ab-mf-grid">
          <div>
            <div className="ab-eyebrow ab-reveal" style={{ marginBottom: 26 }}>Философия</div>
            <blockquote className="ab-mf-quote ab-reveal" data-d="1">
              «Поверхность формирует пространство. Мы относимся к&nbsp;керамограниту как к&nbsp;<span className="accent">материалу архитектуры</span>, а&nbsp;не отделке.»
            </blockquote>
            <div className="ab-mf-body ab-reveal" data-d="2" style={{ marginTop: 30 }}>
              <p>Компания начиналась с простой идеи — сделать по-настоящему качественную японскую керамику доступной для проектов в нашем регионе. Без посредников, без компромиссов в характеристиках, без случайных партий.</p>
              <p>Сегодня Japan Ceramic — это выверенный каталог из трёх направлений плитки. Каждая коллекция проходит отбор по тону, геометрии, прочности и фактуре.</p>
              <div className="ab-mf-sign">Japan Ceramic — <b>искусство в деталях</b></div>
            </div>
          </div>
          <div className="ab-mf-tiles ab-reveal" data-d="1">
            {[
              { cls: "tile-b", img: "https://images.unsplash.com/photo-1747696766706-5485b39bf358?q=80&w=700&auto=format&fit=crop", num: "01", label: "Керамогранит" },
              { cls: "tile-c", img: "https://images.unsplash.com/photo-1625008668243-e10fa6121030?q=80&w=700&auto=format&fit=crop", num: "02", label: "Клинкер" },
              { cls: "tile-b", img: "https://images.unsplash.com/photo-1703867110039-dc2ad34be121?q=80&w=700&auto=format&fit=crop", num: "03", label: "Мозаика" },
            ].map((t) => (
              <div key={t.num} className={`ab-mf-tile ab-bevel ${t.cls}`}>
                <img src={t.img} alt={t.label} />
                <span>{t.num}</span><b>{t.label}</b>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROJECTS */}
      <section className="ab-sec ab-projects">
        <div className="ab-wrap">
          <div className="ab-sec-head">
            <div className="ab-eyebrow ab-reveal">Портфолио</div>
            <h2 className="ab-reveal" data-d="1">Наши объекты</h2>
            <p className="ab-reveal" data-d="2">{projectsCaption}</p>
          </div>
          <div className="ab-pj-carousel ab-reveal">
            <button type="button" className="ab-pj-nav ab-pj-prev" aria-label="Предыдущие" onClick={() => scrollPj(-1)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <div className="ab-pj-track" ref={pjRef}>
              {/* дублируем набор для бесшовной авто-прокрутки */}
              {[...projects, ...projects].map((p, i) => (
                <article key={`${p.title}-${i}`} className="ab-pj-card" aria-hidden={i >= projects.length ? true : undefined}>
                  <span className="ab-pj-arrow"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3.5 10.5L10.5 3.5M5 3.5h5.5V9" stroke="currentColor" strokeWidth="1.3" /></svg></span>
                  <div className="ab-pj-img"><img src={p.img} alt={p.title} draggable={false} /></div>
                  <div className="ab-pj-info">
                    {p.tag && <span className="ab-pj-tag">{p.tag}</span>}
                    {p.title && <h3>{p.title}</h3>}
                    {p.meta && <span className="ab-pj-meta">{p.meta}</span>}
                  </div>
                </article>
              ))}
            </div>
            <button type="button" className="ab-pj-nav ab-pj-next" aria-label="Следующие" onClick={() => scrollPj(1)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>
        </div>
      </section>

      {/* WHY */}
      <section className="ab-sec ab-why">
        <div className="ab-wrap">
          <div className="ab-sec-head">
            <div className="ab-eyebrow ab-reveal">Преимущества</div>
            <h2 className="ab-reveal" data-d="1">Почему люди выбирают нас</h2>
            <p className="ab-reveal" data-d="2">Пять причин, по которым архитекторы и заказчики возвращаются в Japan Ceramic.</p>
          </div>
          <div className="ab-why-grid">
            <div className="ab-why-video ab-reveal">
              <video
                className="ab-why-video-el"
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                poster="/room-assembly-poster.jpg"
              >
                <source src="/room-assembly.mp4" type="video/mp4" />
              </video>
              <span className="ab-why-video-tag">Сборка 3D-комнаты</span>
            </div>
            <div className="ab-why-list">
              {[
                { n: "01", title: "Японское качество без компромиссов", desc: "Многоступенчатый контроль на каждом этапе — от проверки сырья до геометрии и тона готовой плиты." },
                { n: "02", title: "Честная цена без посредников", desc: "Прямые поставки с фабрик Японии: прозрачные цены и предсказуемые сроки на каждом проекте." },
                { n: "03", title: "Большой выбор — 150+ моделей", desc: "Керамогранит, клинкер и мозаика — решение под фасад, интерьер и акцентные детали." },
                { n: "04", title: "Натуральный и долговечный материал", desc: "Экологичная керамика, которая сохраняет внешний вид и характеристики десятилетиями." },
                { n: "05", title: "Экспертное сопровождение", desc: "Помогаем с подбором, расчётом и AI-визуализацией — от идеи до укладки на объекте." },
              ].map((item, idx) => (
                <div key={item.n} className="ab-why-item ab-reveal" data-d={Math.min(idx, 3)}>
                  <span className="ab-why-n">{item.n}</span>
                  <div><h3>{item.title}</h3><p>{item.desc}</p></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="ab-sec ab-stats-sec">
        <div className="ab-wrap">
          <div className="ab-sec-head">
            <div className="ab-eyebrow ab-reveal">Компания в цифрах</div>
            <h2 className="ab-reveal" data-d="1">Коротко и по делу</h2>
          </div>
          <div className="ab-stiles">
            {[
              { count: 150, suffix: "+", label: "Моделей керамогранита, клинкера и мозаики", cls: "tile-a" },
              { count: 10, suffix: "+", label: "Лет на рынке отделочных материалов", cls: "tile-b" },
              { count: 3, suffix: "", label: "Направления: керамогранит, клинкер, мозаика", cls: "tile-b" },
              { count: 100, suffix: "%", label: "Продукции произведено на фабриках Японии", cls: "tile-a" },
            ].map((s) => (
              <div key={s.label} className={`ab-stile ab-bevel ${s.cls}`}>
                <div className="ab-stile-num"><span className="ab-count" data-count={s.count}>0</span>{s.suffix && <em>{s.suffix}</em>}</div>
                <div className="ab-stile-lb">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="ab-cta">
        <div className="ab-wrap">
          <div className="ab-eyebrow ab-reveal" style={{ justifyContent: "center" }}>Каталог Japan Ceramic</div>
          <h2 className="ab-reveal" data-d="1">Соберите своё пространство<br />из японской керамики</h2>
          <p className="ab-reveal" data-d="2">Откройте каталог из более чем 150 моделей или запишитесь в шоурум, чтобы увидеть фактуру вживую.</p>
          <div className="ab-cta-btns ab-reveal" data-d="2">
            <Link href="/catalog" className="ab-btn ab-btn-light">
              Смотреть каталог
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M1 7.5h12M8 2.5l5 5-5 5" stroke="currentColor" strokeWidth="1.4" /></svg>
            </Link>
            <a href="/#contacts" className="ab-btn ab-btn-outline">
              Записаться в шоурум
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M1 7.5h12M8 2.5l5 5-5 5" stroke="currentColor" strokeWidth="1.4" /></svg>
            </a>
          </div>
        </div>
      </section>
    </>
  );
}

/* All about page styles — prefixed with ab- to avoid conflicts */
const aboutStyles = `
  .ab-wrap{max-width:1320px;margin:0 auto;padding:0 40px}
  .ab-serif{font-family:var(--font-serif),'Playfair Display',serif}
  .ab-eyebrow{font-size:11px;font-weight:600;letter-spacing:.34em;text-transform:uppercase;color:var(--ink-mute);display:flex;align-items:center;gap:14px}
  .ab-eyebrow::before{content:"";width:34px;height:1px;background:var(--line-2)}
  .ab-reveal{opacity:0;transform:translateY(30px);transition:opacity 1s var(--ease),transform 1s var(--ease)}
  .ab-reveal.in{opacity:1;transform:none}
  .ab-reveal[data-d="1"]{transition-delay:.09s}
  .ab-reveal[data-d="2"]{transition-delay:.18s}
  .ab-reveal[data-d="3"]{transition-delay:.27s}
  .tile-a{background:linear-gradient(152deg,#2c3547,#151b27 76%)}
  .tile-b{background:linear-gradient(152deg,#232b3b,#11161f 76%)}
  .tile-c{background:linear-gradient(152deg,#37425a,#1b2230 76%)}
  .tile-d{background:linear-gradient(152deg,#1d2431,#0e131c 76%)}
  .ab-bevel{box-shadow:inset 0 1.5px 0 rgba(255,255,255,.12),inset 0 -30px 50px -34px rgba(0,0,0,.9),inset 0 0 0 1px rgba(255,255,255,.055)}
  .ab-sec{padding:120px 0}
  .ab-sec-head{margin-bottom:58px}
  .ab-sec-head .ab-eyebrow{margin-bottom:22px}
  .ab-sec-head h2{font-size:clamp(32px,4vw,52px);max-width:680px}
  .ab-sec-head p{font-size:15px;color:var(--ink-mute);max-width:460px;margin-top:16px}

  .ab-hero{position:relative;min-height:100vh;display:flex;align-items:center;overflow:hidden;perspective:1500px;margin-top:-80px;padding-top:80px}
  .ab-wall{position:absolute;inset:-7% -5%;display:grid;grid-template-columns:repeat(9,1fr);gap:6px;transform-style:preserve-3d;transition:transform .6s var(--ease);z-index:1}
  .ab-wtile{position:relative;border-radius:2px;transform-style:preserve-3d;opacity:0;transform:translateZ(-150px) rotateX(-26deg);transition:opacity .85s var(--ease),transform .85s var(--ease)}
  .ab-wtile.in{opacity:1;transform:none}
  .ab-wt-face{position:absolute;inset:0;border-radius:2px;overflow:hidden;background:linear-gradient(152deg,#232b3b,#11161f 76%);box-shadow:inset 0 1.5px 0 rgba(255,255,255,.1),inset 0 -18px 34px -24px rgba(0,0,0,.85),inset 0 0 0 1px rgba(255,255,255,.045);transform:translateZ(calc(var(--l,0)*42px));filter:brightness(calc(1 + var(--l,0)*1.05));transition:transform .4s var(--ease),filter .4s var(--ease)}
  .ab-wt-face::before{content:"";position:absolute;inset:0;z-index:1;pointer-events:none;background:radial-gradient(125% 95% at 28% 16%,rgba(255,255,255,.08),transparent 56%)}
  .ab-wt-face img{width:100%;height:100%;object-fit:cover;filter:grayscale(.25) brightness(.78) contrast(1.05)}
  .ab-hero-veil{position:absolute;inset:0;z-index:2;pointer-events:none;background:linear-gradient(98deg,rgba(8,10,15,.96) 0%,rgba(8,10,15,.85) 32%,rgba(8,10,15,.26) 62%,rgba(8,10,15,.5) 100%)}
  .ab-hero-veil::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(8,10,15,.7),transparent 22%,transparent 70%,rgba(8,10,15,.88))}
  .ab-hero-in{position:relative;z-index:3;width:100%;padding-top:60px}
  .ab-hero .ab-crumbs{font-size:12px;letter-spacing:.04em;color:var(--ink-mute);margin-bottom:30px;opacity:0;transition:opacity 1s .2s}
  .ab-hero.ready .ab-crumbs{opacity:1}
  .ab-hero .ab-crumbs a:hover{color:var(--ink)}
  .ab-hero .ab-crumbs span{color:var(--ink-faint);margin:0 8px}
  .ab-hero .ab-eyebrow{margin-bottom:26px;opacity:0;transition:opacity 1s .35s}
  .ab-hero.ready .ab-eyebrow{opacity:1}
  .ab-hero h1{font-size:clamp(38px,4.9vw,68px);max-width:none}
  .ab-hero h1 .ab-ln{display:block;overflow:hidden}
  .ab-hero h1 .ab-ln span{display:block;transform:translateY(112%);transition:transform 1.05s var(--ease)}
  .ab-hero.ready h1 .ab-ln:nth-child(1) span{transition-delay:.12s}
  .ab-hero.ready h1 .ab-ln:nth-child(2) span{transition-delay:.24s}
  .ab-hero.ready h1 .ab-ln:nth-child(3) span{transition-delay:.36s}
  .ab-hero.ready h1 .ab-ln span{transform:none}
  .ab-hero h1 i{font-family:var(--font-serif),'Playfair Display',serif;font-style:italic;font-weight:500}
  .ab-hero-lead{font-size:clamp(15px,1.55vw,17.5px);color:var(--ink-soft);max-width:520px;margin-top:30px;opacity:0;transform:translateY(20px);transition:opacity 1s .62s,transform 1s .62s var(--ease)}
  .ab-hero.ready .ab-hero-lead{opacity:1;transform:none}
  .ab-hero-hint{margin-top:50px;display:flex;align-items:center;gap:14px;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--ink-mute);opacity:0;transition:opacity 1s .8s}
  .ab-hero.ready .ab-hero-hint{opacity:1}
  .ab-ln-d{width:50px;height:1px;background:var(--line-2);position:relative;overflow:hidden}
  .ab-ln-d::after{content:"";position:absolute;inset:0;background:var(--accent);animation:ab-slide 2.4s var(--ease) infinite}
  @keyframes ab-slide{0%{transform:translateX(-100%)}60%,100%{transform:translateX(100%)}}

  .ab-manifesto{background:linear-gradient(180deg,var(--bg),var(--bg-2))}
  .ab-mf-grid{display:grid;grid-template-columns:1fr .8fr;gap:64px;align-items:center}
  .ab-mf-quote{font-family:var(--font-serif),'Playfair Display',serif;font-size:clamp(27px,3vw,40px);font-style:italic;font-weight:500;line-height:1.34}
  .ab-mf-quote .accent{color:var(--accent)}
  .ab-mf-body p{font-size:15px;color:var(--ink-soft);margin-bottom:16px}
  .ab-mf-sign{margin-top:26px;font-size:12.5px;letter-spacing:.05em;color:var(--ink-mute)}
  .ab-mf-sign b{color:var(--ink-soft);font-weight:500}
  .ab-mf-tiles{display:flex;flex-direction:column;gap:10px;perspective:1000px}
  .ab-mf-tile{position:relative;height:128px;border-radius:3px;overflow:hidden;transition:transform .5s var(--ease),filter .5s var(--ease)}
  .ab-mf-tile img{width:100%;height:100%;object-fit:cover;filter:grayscale(.2) brightness(.78)}
  .ab-mf-tile:hover{transform:translateZ(22px);filter:brightness(1.2)}
  .ab-mf-tile b{position:absolute;left:18px;bottom:14px;font-weight:400;font-size:16px}
  .ab-mf-tile span{position:absolute;left:18px;top:14px;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--ink-soft)}

  .ab-projects{background:var(--bg-2)}
  .ab-pj-carousel{position:relative}
  .ab-pj-track{display:flex;gap:16px;overflow-x:auto;padding:4px 2px 14px;cursor:grab;user-select:none;scrollbar-width:none;-ms-overflow-style:none}
  .ab-pj-track::-webkit-scrollbar{display:none}
  .ab-pj-track.dragging{cursor:grabbing}
  .ab-pj-card{flex:0 0 auto;width:clamp(290px,31%,390px);position:relative;border-radius:4px;overflow:hidden;border:1px solid var(--line);transition:border-color .4s var(--ease),transform .5s var(--ease)}
  .ab-pj-card:hover{border-color:var(--line-2);transform:translateY(-4px)}
  .ab-pj-img{aspect-ratio:3/4;overflow:hidden;background:linear-gradient(152deg,#232b3b,#11161f 76%)}
  .ab-pj-img img{width:100%;height:100%;object-fit:cover;object-position:center;filter:grayscale(.18) brightness(.74) contrast(1.03);transition:filter .6s var(--ease)}
  .ab-pj-card:hover .ab-pj-img img{filter:grayscale(0) brightness(.86)}
  .ab-pj-nav{position:absolute;top:42%;transform:translateY(-50%);z-index:6;width:48px;height:48px;border-radius:50%;border:1px solid var(--line-2);background:rgba(8,10,15,.74);backdrop-filter:blur(8px);color:var(--ink);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .35s var(--ease),border-color .35s var(--ease)}
  .ab-pj-nav:hover{background:rgba(8,10,15,.96);border-color:rgba(255,255,255,.4)}
  .ab-pj-prev{left:-12px}
  .ab-pj-next{right:-12px}
  .ab-pj-info{position:absolute;left:0;right:0;bottom:0;z-index:2;padding:26px 24px;background:linear-gradient(180deg,transparent,rgba(8,10,15,.55) 38%,rgba(8,10,15,.93))}
  .ab-pj-tag{font-size:10.5px;letter-spacing:.17em;text-transform:uppercase;color:var(--accent)}
  .ab-pj-info h3{font-size:20px;font-weight:300;margin:9px 0 5px}
  .ab-pj-meta{font-size:12.5px;color:var(--ink-mute)}
  .ab-pj-arrow{position:absolute;top:20px;right:20px;z-index:2;width:42px;height:42px;border-radius:50%;border:1px solid var(--line-2);display:flex;align-items:center;justify-content:center;color:var(--ink);background:rgba(8,10,15,.5);backdrop-filter:blur(6px);opacity:0;transform:translateY(-8px);transition:.45s var(--ease)}
  .ab-pj-card:hover .ab-pj-arrow{opacity:1;transform:none}

  .ab-why{background:var(--bg)}
  .ab-why-grid{display:grid;grid-template-columns:1fr 1.05fr;gap:50px;align-items:stretch}
  .ab-why-video{position:relative;border-radius:5px;overflow:hidden;min-height:486px;border:1px solid var(--line-2);background:linear-gradient(160deg,var(--bg-3),var(--bg));box-shadow:0 40px 80px -54px rgba(0,0,0,.9)}
  .ab-why-video-el{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
  .ab-why-video::after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(180deg,transparent 55%,rgba(8,10,15,.55) 100%)}
  .ab-why-video-tag{position:absolute;left:20px;bottom:18px;z-index:2;font-size:10.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--ink-soft);padding:6px 12px;border:1px solid var(--line-2);border-radius:999px;background:rgba(8,10,15,.5);backdrop-filter:blur(8px)}
  .ab-why-video-ph{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;text-align:center;padding:32px}
  .ab-why-video-ph::before{content:"";position:absolute;inset:0;opacity:.6;pointer-events:none;background:repeating-linear-gradient(0deg,transparent 0 52px,rgba(255,255,255,.03) 52px 54px),repeating-linear-gradient(90deg,transparent 0 52px,rgba(255,255,255,.03) 52px 54px)}
  .ab-why-video-ph .ph-ico{position:relative;color:var(--ink-faint)}
  .ab-why-video-ph .ph-tx{position:relative;font-size:11.5px;letter-spacing:.18em;text-transform:uppercase;color:var(--ink-mute);line-height:1.9}
  .ab-why-list{display:flex;flex-direction:column;justify-content:center}
  .ab-why-item{display:flex;gap:22px;align-items:flex-start;padding:24px 6px 24px 0;border-top:1px solid var(--line);transition:padding-left .4s var(--ease)}
  .ab-why-item:last-child{border-bottom:1px solid var(--line)}
  .ab-why-item:hover{padding-left:10px}
  .ab-why-n{font-family:var(--font-serif),'Playfair Display',serif;font-size:21px;color:var(--ink-faint);flex:none;width:34px;transition:color .4s var(--ease)}
  .ab-why-item:hover .ab-why-n{color:var(--accent)}
  .ab-why-item h3{font-size:18px;font-weight:400;margin-bottom:6px}
  .ab-why-item p{font-size:13.5px;color:var(--ink-mute);line-height:1.56}

  .ab-timeline{background:linear-gradient(180deg,var(--bg-2),var(--bg))}
  .ab-tl-head{display:flex;justify-content:space-between;align-items:flex-end;gap:30px;margin-bottom:46px}
  .ab-tl-nav{display:flex;gap:10px}
  .ab-tl-nav button{width:50px;height:50px;border:1px solid var(--line-2);border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--ink);transition:.4s var(--ease);background:none;cursor:pointer}
  .ab-tl-nav button:hover{background:var(--ink);color:#0a0d12;border-color:var(--ink)}
  .ab-tl-nav button:disabled{opacity:.3;pointer-events:none}
  .ab-tl-track{display:flex;gap:14px;overflow-x:auto;scroll-snap-type:x proximity;scrollbar-width:none;cursor:grab;padding-bottom:4px}
  .ab-tl-track::-webkit-scrollbar{display:none}
  .ab-tl-track.drag{cursor:grabbing;scroll-snap-type:none}
  .ab-tl-card{flex:0 0 clamp(290px,31vw,418px);scroll-snap-align:start;border-radius:4px;border:1px solid var(--line);padding:36px 34px;min-height:300px;display:flex;flex-direction:column;position:relative;opacity:0;transform:translateY(34px);transition:opacity .8s var(--ease),transform .8s var(--ease),border-color .4s}
  .ab-tl-track.in .ab-tl-card{opacity:1;transform:none}
  .ab-tl-track.in .ab-tl-card:nth-child(2){transition-delay:.09s}
  .ab-tl-track.in .ab-tl-card:nth-child(3){transition-delay:.18s}
  .ab-tl-track.in .ab-tl-card:nth-child(4){transition-delay:.27s}
  .ab-tl-track.in .ab-tl-card:nth-child(5){transition-delay:.36s}
  .ab-tl-card:hover{border-color:var(--line-2)}
  .ab-tl-i{position:absolute;right:30px;top:26px;font-size:14px;color:var(--ink-faint)}
  .ab-tl-year{font-family:var(--font-serif),'Playfair Display',serif;font-size:clamp(46px,4.6vw,64px);font-weight:500;color:var(--accent);line-height:1;margin-bottom:auto}
  .ab-tl-card h3{font-size:21px;font-weight:300;margin:30px 0 10px}
  .ab-tl-card p{font-size:14px;color:var(--ink-mute)}
  .ab-tl-bar{margin-top:28px;height:2px;background:var(--line);border-radius:2px;position:relative;overflow:hidden}
  .ab-tl-bar i{position:absolute;left:0;top:0;height:100%;background:var(--accent);border-radius:2px;width:24%;transition:left .25s var(--ease),width .25s var(--ease)}

  .ab-stats-sec{background:var(--bg-2)}
  .ab-stiles{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
  .ab-stile{border-radius:3px;padding:34px 28px;border:1px solid var(--line);min-height:182px;display:flex;flex-direction:column;justify-content:space-between;opacity:0;transform:translateY(34px) scale(.96);transition:opacity .8s var(--ease),transform .8s var(--ease),border-color .4s}
  .ab-stile.in{opacity:1;transform:none}
  .ab-stile:hover{border-color:var(--line-2)}
  .ab-stile-num{font-family:var(--font-sans),'Inter',system-ui,sans-serif;font-size:clamp(50px,5.2vw,72px);font-weight:700;letter-spacing:-.03em;line-height:1;font-variant-numeric:tabular-nums lining-nums;font-feature-settings:"tnum" 1,"lnum" 1}
  .ab-stile-num em{font-style:normal;font-weight:600;color:var(--accent);margin-left:3px}
  .ab-stile-lb{font-size:13px;color:var(--ink-mute);line-height:1.45}

  .ab-cta{position:relative;overflow:hidden;border-top:1px solid var(--line);background:var(--bg);padding:108px 0;text-align:center}
  .ab-cta::before{content:"";position:absolute;inset:0;pointer-events:none;opacity:.5;background:repeating-linear-gradient(0deg,transparent 0 96px,rgba(255,255,255,.03) 96px 98px),repeating-linear-gradient(90deg,transparent 0 96px,rgba(255,255,255,.03) 96px 98px)}
  .ab-cta::after{content:"";position:absolute;left:50%;top:-40%;width:680px;height:480px;transform:translateX(-50%);background:radial-gradient(ellipse,var(--glow),transparent 68%);pointer-events:none}
  .ab-cta .ab-wrap{position:relative;z-index:1}
  .ab-cta h2{font-size:clamp(30px,4vw,52px);max-width:660px;margin:22px auto 16px}
  .ab-cta p{font-size:15px;color:var(--ink-mute);max-width:430px;margin:0 auto 36px}
  .ab-cta-btns{display:flex;gap:14px;justify-content:center;flex-wrap:wrap}
  .ab-btn{display:inline-flex;align-items:center;gap:13px;padding:17px 32px;font-size:13.5px;font-weight:500;border-radius:2px;transition:.45s var(--ease);white-space:nowrap}
  .ab-btn svg{transition:transform .45s var(--ease)}
  .ab-btn:hover svg{transform:translateX(5px)}
  .ab-btn-light{background:var(--ink);color:#0a0d12}
  .ab-btn-light:hover{background:#fff}
  .ab-btn-outline{border:1px solid var(--line-2);color:var(--ink)}
  .ab-btn-outline:hover{background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.34)}

  @media(max-width:1080px){
    .ab-sec{padding:90px 0}
    .ab-mf-grid,.ab-why-grid{grid-template-columns:1fr;gap:40px}
    .ab-pj-card{width:clamp(260px,46%,360px)}
    .ab-stiles{grid-template-columns:repeat(2,1fr)}
  }
  @media(max-width:720px){
    .ab-wrap{padding:0 22px}
    .ab-hero{min-height:88vh}
    .ab-hero h1{font-size:clamp(29px,7vw,46px)}
    .ab-hero h1 .ab-ln{overflow:visible}
    .ab-hero h1 .ab-ln span{transform:none}
    .ab-hero-veil{background:linear-gradient(180deg,rgba(8,10,15,.9),rgba(8,10,15,.66) 42%,rgba(8,10,15,.82))}
    .ab-wall{grid-template-columns:repeat(6,1fr)}
    .ab-pj-card{width:84%}
    .ab-pj-nav{display:none}
    .ab-stiles{grid-template-columns:1fr}
    .ab-tl-head{flex-direction:column;align-items:flex-start;gap:22px}
    .ab-cta{padding:74px 0}
  }
`;

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

interface Showroom {
  name: string | null;
  address: string | null;
  hours: string | null;
  mapLink: string | null;
  mapEmbedUrl: string | null;
}

interface Contacts {
  phone: string | null;
  phoneHref: string | null;
  email: string | null;
  telegram: string | null;
  whatsapp: string | null;
  showrooms: Showroom[];
}

interface CategoryCard {
  slug: string;
  title: string;
  desc: string;
  idx: string;
  i: number;
  img: string;
}

interface Props {
  user: { fullName: string; role: string } | null;
  categories: CategoryCard[];
  contacts: Contacts;
}

// Фолбэк для 3D-блока категорий, если проп не передан (переиспользование компонента).
const CATEGORY_FALLBACK: CategoryCard[] = [
  { i: 0, img: "https://images.unsplash.com/photo-1747696766706-5485b39bf358?q=80&w=1100&auto=format&fit=crop", title: "Керамогранит", desc: "Крупноформатные решения для стен и полов", idx: "01", slug: "keramogranit" },
  { i: 1, img: "https://images.unsplash.com/photo-1625008668243-e10fa6121030?q=80&w=1100&auto=format&fit=crop", title: "Клинкер", desc: "Прочность, фактура и архитектурный характер", idx: "02", slug: "clinker" },
  { i: 2, img: "https://images.unsplash.com/photo-1703867110039-dc2ad34be121?q=80&w=1100&auto=format&fit=crop", title: "Мозаика", desc: "Детали, которые создают уникальный стиль", idx: "03", slug: "mosaic" },
];

// Фото витрин/коллекций из шоурума для блока «Пространства» на главной.
const HOME_COLLECTIONS = [
  "/home-collections/col-1.webp",
  "/home-collections/col-2.webp",
  "/home-collections/col-3.webp",
  "/home-collections/col-4.webp",
  "/home-collections/col-5.webp",
  "/home-collections/col-6.webp",
];

export default function LandingContent({ user, categories, contacts }: Props) {
  const catCards = categories?.length ? categories : CATEGORY_FALLBACK;
  const showrooms = contacts.showrooms.length ? contacts.showrooms : [{ name: "Шоурум", address: null, hours: null, mapLink: null, mapEmbedUrl: null }];
  const [room, setRoom] = useState(0);
  const active = showrooms[Math.min(room, showrooms.length - 1)];
  const atmoRef = useRef<HTMLDivElement>(null);

  // Scroll reveal
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  // Animated counters
  useEffect(() => {
    const cio = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          const el = e.target as HTMLElement;
          const end = +(el.dataset.count || "0");
          const suffix = el.dataset.suffix || "";
          let t0: number | null = null;
          const dur = 1600;
          const step = (t: number) => {
            if (!t0) t0 = t;
            const p = Math.min((t - t0) / dur, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            el.textContent = Math.floor(eased * end) + suffix;
            if (p < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
          cio.unobserve(el);
        });
      },
      { threshold: 0.6 }
    );
    document.querySelectorAll("[data-count]").forEach((el) => cio.observe(el));
    return () => cio.disconnect();
  }, []);

  // Rail sliders
  useEffect(() => {
    document.querySelectorAll<HTMLButtonElement>(".arrows button[data-rail]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const rail = document.getElementById(btn.dataset.rail || "");
        if (!rail) return;
        const card = rail.querySelector("article");
        if (!card) return;
        const step = card.getBoundingClientRect().width + 24;
        rail.scrollBy({ left: step * +(btn.dataset.dir || "1") * 1.05, behavior: "smooth" });
      });
    });
    // drag to scroll on rails
    document.querySelectorAll<HTMLElement>(".rail").forEach((rail) => {
      let down = false, sx = 0, sl = 0;
      rail.addEventListener("pointerdown", (e) => { down = true; sx = e.pageX; sl = rail.scrollLeft; rail.style.cursor = "grabbing"; });
      window.addEventListener("pointerup", () => { down = false; rail.style.cursor = ""; });
      rail.addEventListener("pointermove", (e) => { if (down) rail.scrollLeft = sl - (e.pageX - sx); });
    });
  }, []);

  // Карусель коллекций: плавная бесконечная авто-прокрутка + перетаскивание «ладошкой».
  // Набор картинок продублирован в разметке — на середине бесшовно сбрасываем скролл.
  useEffect(() => {
    const el = atmoRef.current;
    if (!el) return;
    let raf = 0, paused = false, dragging = false, startX = 0, startScroll = 0, acc = 0;
    const SPEED = 0.5; // px/кадр
    const half = () => el.scrollWidth / 2 || 1;
    const wrap = () => { const h = half(); if (el.scrollLeft >= h) el.scrollLeft -= h; else if (el.scrollLeft < 0) el.scrollLeft += h; };
    const step = () => {
      if (!paused && !dragging && el.scrollWidth > el.clientWidth) {
        acc += SPEED;
        const whole = Math.floor(acc);
        if (whole >= 1) { acc -= whole; el.scrollLeft += whole; wrap(); }
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    const onEnter = () => { paused = true; };
    const onLeave = () => { paused = false; };
    const onDown = (e: PointerEvent) => { dragging = true; startX = e.clientX; startScroll = el.scrollLeft; el.classList.add("dragging"); el.setPointerCapture?.(e.pointerId); };
    const onMove = (e: PointerEvent) => { if (!dragging) return; el.scrollLeft = startScroll - (e.clientX - startX); wrap(); };
    const onUp = (e: PointerEvent) => { if (!dragging) return; dragging = false; el.classList.remove("dragging"); el.releasePointerCapture?.(e.pointerId); };
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
  }, []);

  // 3D category cards
  useEffect(() => {
    const stage = document.getElementById("cat3dStage");
    const section = document.querySelector(".collections");
    if (!stage || !section) return;
    // Уважать prefers-reduced-motion: не навешивать 3D-tilt и не крутить rAF-петлю перспективы.
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!matchMedia("(pointer:fine) and (min-width:761px)").matches) return;

    const BASE: Record<number, string> = {
      0: "rotateY(31deg) translateZ(-46px)",
      1: "translateZ(60px) translateY(-34px) scale(1.05)",
      2: "rotateY(-31deg) translateZ(-46px)",
    };
    stage.querySelectorAll<HTMLElement>(".cat3d").forEach((card) => {
      const box = card.querySelector<HTMLElement>(".cat3d-box");
      if (!box) return;
      const i = +(card.dataset.i || "0");
      card.addEventListener("pointermove", (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        box.style.transform = BASE[i] + ` translateZ(42px) translateY(-16px) rotateX(${(-py * 6).toFixed(2)}deg) rotateY(${(px * 6).toFixed(2)}deg)`;
        box.style.setProperty("--mx", ((px + 0.5) * 100).toFixed(1) + "%");
        box.style.setProperty("--my", ((py + 0.5) * 100).toFixed(1) + "%");
      });
      card.addEventListener("pointerleave", () => { box.style.transform = ""; });
    });

    let cx = 50, cy = 33, tx = 50, ty = 33, lastMove = -1e9;
    section.addEventListener("pointermove", (e) => {
      const r = (section as HTMLElement).getBoundingClientRect();
      tx = 41 + (((e as PointerEvent).clientX - r.left) / r.width) * 18;
      ty = 25 + (((e as PointerEvent).clientY - r.top) / r.height) * 17;
      lastMove = performance.now();
    });
    section.addEventListener("pointerleave", () => { lastMove = -1e9; });
    let raf: number;
    const loop = (t: number) => {
      if (t - lastMove > 2000) {
        tx = 50 + Math.sin(t / 3600) * 8;
        ty = 33 + Math.cos(t / 4600) * 4.5;
      }
      cx += (tx - cx) * 0.055;
      cy += (ty - cy) * 0.055;
      stage.style.perspectiveOrigin = cx.toFixed(2) + "% " + cy.toFixed(2) + "%";
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Lead form
  useEffect(() => {
    const form = document.getElementById("leadForm") as HTMLFormElement | null;
    if (!form) return;
    const msg = document.getElementById("leadMsg");
    const handler = async (e: Event) => {
      e.preventDefault();
      const name = (form.querySelector('input[name="name"]') as HTMLInputElement).value.trim();
      const phone = (form.querySelector('input[name="phone"]') as HTMLInputElement).value.trim();
      const message = (form.querySelector('textarea[name="message"]') as HTMLTextAreaElement).value.trim();
      if (!name || !phone) { if (msg) { msg.style.color = "var(--ink-soft)"; msg.textContent = "Заполните имя и телефон"; } return; }
      if (msg) { msg.style.color = "var(--ink-soft)"; msg.textContent = "Отправляем…"; }
      try {
        const r = await fetch("/api/contacts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, phone, message, source: "contacts" }) });
        if (r.ok) { form.reset(); if (msg) { msg.style.color = "var(--accent,#c8d2e0)"; msg.textContent = "Спасибо! Заявка отправлена — мы свяжемся с вами."; } }
        else { if (msg) { msg.style.color = "#e58"; msg.textContent = "Не удалось отправить. Попробуйте позже."; } }
      } catch { if (msg) { msg.style.color = "#e58"; msg.textContent = "Ошибка сети. Попробуйте позже."; } }
    };
    form.addEventListener("submit", handler);
    return () => form.removeEventListener("submit", handler);
  }, []);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: landingStyles }} />

      {/* HERO */}
      <section className="hero">
        <div className="hero-bg">
          <video autoPlay muted loop playsInline preload="auto">
            <source src="/hero-video.mp4" type="video/mp4" />
          </video>
        </div>
        <div className="wrap hero-inner">
          <div className="hero-card">
            <div className="eyebrow reveal">Премиальная клинкерная плитка</div>
            <h1 className="reveal" data-d="1"><span>JAPAN</span><span>CERAMIC</span></h1>
            <p className="lead reveal" data-d="2">Премиальная клинкерная плитка<br />для современной архитектуры</p>
            <p className="sub reveal" data-d="2">Коллекции, созданные для дизайнеров, архитекторов и современных пространств.</p>
            <div className="hero-actions reveal" data-d="3">
              <Link href="/catalog" className="btn btn-light">
                Смотреть коллекции
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M1 7.5h12M8 2.5l5 5-5 5" stroke="currentColor" strokeWidth="1.4" /></svg>
              </Link>
              {user ? (
                <Link href="/visualize" className="btn btn-glass">
                  AI-визуализация интерьера
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M1 7.5h12M8 2.5l5 5-5 5" stroke="currentColor" strokeWidth="1.4" /></svg>
                </Link>
              ) : (
                <Link href="/auth/login?from=/visualize" className="btn btn-glass">
                  AI-визуализация интерьера
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M1 7.5h12M8 2.5l5 5-5 5" stroke="currentColor" strokeWidth="1.4" /></svg>
                </Link>
              )}
            </div>
          </div>
          <div className="hero-side" style={{ display: "none" }} />
        </div>
        <div className="wrap hero-foot">
          <div className="scroll-hint reveal" data-d="3">
            <span>Scroll to explore</span>
            <span className="dot"><b /></span>
          </div>
        </div>
      </section>

      {/* COLLECTIONS */}
      <section className="collections sec-pad" id="collections">
        <div className="wrap">
          <div className="sec-top sec-head">
            <div>
              <div className="eyebrow reveal">Каталог</div>
              <h2 className="reveal" data-d="1">Вдохновение в каждой категории</h2>
              <p className="reveal" data-d="2">Три направления. Тысячи решений.<br />Выберите материал, который подчеркнёт идею вашего пространства.</p>
            </div>
          </div>
          <div className="cat3d-stage reveal" data-d="1" id="cat3dStage">
            {catCards.map((c) => (
              // Ссылка-обёртка — это СТАБИЛЬНЫЙ внешний элемент (.cat3d), он НЕ
              // трансформируется в 3D (двигается только дочерний .cat3d-box). Любой клик
              // внутри карточки всплывает к этому <a> и навигирует, даже если внутренняя
              // 3D-грань «уплыла» под курсором между pointerdown и pointerup.
              <Link key={c.i} href={`/catalog?category=${c.slug}`} className="cat3d" data-i={c.i} aria-label={`${c.title} — смотреть коллекции`}>
                <div className="cat3d-box">
                  <span className="cat3d-edge cat3d-edge-l" />
                  <span className="cat3d-edge cat3d-edge-r" />
                  <div className="cat3d-inner">
                    <div className="cat3d-tex"><img src={c.img} alt={c.title} /></div>
                    <div className="cat3d-rim" />
                    <div className="cat3d-gloss" />
                    <div className="cat3d-body">
                      <span className="cat3d-idx">{c.idx}</span>
                      <span className="cat3d-line" />
                      <h3 className="cat3d-title">{c.title}</h3>
                      <p className="cat3d-desc">{c.desc}</p>
                      <span className="cat3d-link">
                        Смотреть коллекции<span className="ll" />
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 7h11M7.5 2l5 5-5 5" stroke="currentColor" strokeWidth="1.4" /></svg>
                      </span>
                    </div>
                  </div>
                </div>
                <span className="cat3d-floor" />
              </Link>
            ))}
          </div>
          <p className="cat3d-caption reveal">Каждая коллекция — это гармония текстуры, цвета и формы.</p>
        </div>
      </section>

      {/* AI VISUALIZATION */}
      <section className="ai sec-pad" id="ai">
        <div className="wrap ai-grid">
          <div className="ai-text">
            <div className="eyebrow reveal">AI-визуализация</div>
            <h2 className="reveal" data-d="1" style={{ marginTop: 26 }}>Увидьте будущий интерьер уже сейчас</h2>
            <p className="reveal" data-d="2">Загрузите фото помещения и подберите идеальный керамогранит с помощью искусственного интеллекта.</p>
            <div className="steps reveal" data-d="2">
              <div className="step"><span className="num">01</span><div className="st-body"><strong>Загрузите фото вашего интерьера</strong><span>Любое помещение — гостиная, ванная, фасад</span></div></div>
              <div className="step"><span className="num">02</span><div className="st-body"><strong>Выберите коллекцию</strong><span>Камень, мрамор, бетон или металл</span></div></div>
              <div className="step"><span className="num">03</span><div className="st-body"><strong>Получите реалистичный результат от AI</strong><span>Фотореалистичная визуализация за секунды</span></div></div>
            </div>
            <Link href={user ? "/visualize" : "/auth/login?from=/visualize"} className="btn btn-light reveal" data-d="3">
              {user ? "Попробовать AI-визуализацию" : "Войти и попробовать AI"}
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M1 7.5h12M8 2.5l5 5-5 5" stroke="currentColor" strokeWidth="1.4" /></svg>
            </Link>
          </div>
          <div className="reveal" data-d="2">
            {/* AI preview — демо-изображения вместо функциональной дропзоны */}
            <div className="ai-preview-card">
              <div className="ai-preview-icon">
                <svg width="30" height="30" viewBox="0 0 30 30" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 5l1.8 4.8L21.6 11l-4.8 1.8L15 17.6l-1.8-4.8L8.4 11l4.8-1.2L15 5z" />
                  <path d="M23.5 18.5l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7.7-1.9z" />
                </svg>
              </div>
              <h4>AI подберёт плитку для вашего интерьера</h4>
              <p className="ai-preview-sub">Загрузите фото — получите фотореалистичный результат за 15–30 секунд</p>
              <div className="dz-thumbs">
                <span className="dz-thumb"><img src="/demos/ai-1.jpg" alt="Пример AI-визуализации: тёплый бежевый керамогранит" loading="lazy" /></span>
                <span className="dz-thumb"><img src="/demos/ai-2.jpg" alt="Пример AI-визуализации: светло-серый мрамор" loading="lazy" /></span>
                <span className="dz-thumb"><img src="/demos/ai-3.jpg" alt="Пример AI-визуализации: тёмный графит" loading="lazy" /></span>
              </div>
              <div className="dz-tag">Примеры визуализаций</div>
              <Link href={user ? "/visualize" : "/auth/login?from=/visualize"} className="btn btn-light" style={{ marginTop: 26, width: "100%", justifyContent: "center" }}>
                {user ? "Открыть AI-визуализацию" : "Войти и попробовать"}
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M1 7.5h12M8 2.5l5 5-5 5" stroke="currentColor" strokeWidth="1.4" /></svg>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ATMOSPHERES */}
      <section className="atmo sec-pad" id="atmospheres">
        <div className="wrap">
          <div className="sec-head">
            <div className="eyebrow reveal">Коллекции</div>
            <h2 className="reveal" data-d="1">Пространства.<br />Рождённые ощущениями</h2>
            <p className="reveal" data-d="2">Готовые интерьерные решения, где каждая текстура создаёт свою атмосферу.</p>
          </div>
          <div className="atmo-track reveal" data-d="1" ref={atmoRef}>
            {/* набор продублирован для бесшовной авто-прокрутки */}
            {[...HOME_COLLECTIONS, ...HOME_COLLECTIONS].map((img, i) => (
              <Link
                key={i}
                href="/catalog"
                className="atmo-card"
                aria-label="Открыть каталог"
                aria-hidden={i >= HOME_COLLECTIONS.length ? true : undefined}
              >
                <img src={img} alt={`Коллекции Japan Ceramic — фото ${(i % HOME_COLLECTIONS.length) + 1}`} loading="lazy" draggable={false} />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ADVANTAGES */}
      <section className="adv sec-pad">
        <div className="wrap">
          <div className="adv-head">
            <div>
              <div className="eyebrow reveal" style={{ marginBottom: 24 }}>Преимущества</div>
              <h2 className="reveal" data-d="1">Технологии.<br />Дизайн. Качество.</h2>
            </div>
            <p className="reveal" data-d="2">Мы объединяем инновации и эстетику, чтобы создавать покрытия будущего.</p>
          </div>
          <div className="adv-grid">
            {[
              { d: "1", icon: <path d="M11 2l2.6 5.3 5.9.9-4.3 4.1 1 5.9L11 15.4 5.8 18.2l1-5.9L2.5 8.2l5.9-.9L11 2z" stroke="currentColor" strokeWidth="1.2" />, title: "Премиальное качество", desc: "Используем только лучшие материалы и технологии производства." },
              { d: "2", icon: <><circle cx="11" cy="11" r="3.2" stroke="currentColor" strokeWidth="1.2" /><path d="M11 2v3M11 17v3M2 11h3M17 11h3M4.6 4.6l2.1 2.1M15.3 15.3l2.1 2.1M17.4 4.6l-2.1 2.1M6.7 15.3l-2.1 2.1" stroke="currentColor" strokeWidth="1.2" /></>, title: "Инновационные технологии", desc: "Современное оборудование и цифровой контроль на всех этапах." },
              { d: "3", icon: <path d="M11 19c5-2 7-6 7-12-4 0-9 1-9 7M11 19c-5-2-7-6-7-12 3 0 5 .5 6.6 2.3M11 19v-7" stroke="currentColor" strokeWidth="1.2" />, title: "Экологичность", desc: "Безопасные материалы и забота об окружающей среде." },
              { d: "4", icon: <><path d="M11 2l8 3v6c0 5-3.4 8.4-8 9.5C6.4 19.4 3 16 3 11V5l8-3z" stroke="currentColor" strokeWidth="1.2" /><path d="M7.8 11l2.2 2.2 4.2-4.4" stroke="currentColor" strokeWidth="1.2" /></>, title: "Долговечность", desc: "Устойчивость к износу, влаге и перепадам температур." },
            ].map((item) => (
              <div key={item.title} className="adv-item reveal" data-d={item.d}>
                <div className="ic"><svg width="22" height="22" viewBox="0 0 22 22" fill="none">{item.icon}</svg></div>
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BRAND */}
      <section className="brand sec-pad" id="brand">
        <div className="wrap brand-grid">
          <div className="brand-text">
            <div className="eyebrow reveal">О компании</div>
            <h2 className="reveal" data-d="1">Japan Ceramic — искусство в деталях</h2>
            <p className="reveal" data-d="2">Мы вдохновлены природой Японии, её философией и стремлением к совершенству. Каждая коллекция — это баланс эстетики, функциональности и технологий.</p>
            <Link href="/about" className="btn btn-outline reveal" data-d="3">
              Подробнее о бренде
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M1 7.5h12M8 2.5l5 5-5 5" stroke="currentColor" strokeWidth="1.4" /></svg>
            </Link>
            <div className="stats reveal" data-d="3">
              <div className="stat"><div className="nm" data-count="10" data-suffix="+">0</div><div className="lb">Лет опыта</div></div>
              <div className="stat"><div className="nm" data-count="500" data-suffix="+">0</div><div className="lb">Дизайнеров с нами</div></div>
              <div className="stat"><div className="nm" data-count="50" data-suffix="+">0</div><div className="lb">Коллекций</div></div>
              <div className="stat"><div className="nm" data-count="1000" data-suffix="+">0</div><div className="lb">Реализованных проектов</div></div>
            </div>
          </div>
          <div className="brand-visual reveal" data-d="2">
            <img src="/showroom.webp" alt="Шоурум Japan Ceramic" />
            <div className="brand-sign"><b>JAPAN CERAMIC</b><span>SHOWROOM</span></div>
            <div className="showroom-card">
              <div className="eyebrow">Наш шоурум</div>
              <p>Приглашаем вас посетить наш шоурум и открыть мир премиального керамогранита.</p>
              <a href="#contacts" className="btn btn-light" style={{ padding: "13px 24px" }}>
                Записаться на визит
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 7h11M7.5 2l5 5-5 5" stroke="currentColor" strokeWidth="1.4" /></svg>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* CONTACTS */}
      <section className="contacts sec-pad" id="contacts">
        <div className="wrap">
          <div className="sec-head">
            <div className="eyebrow reveal">Контакты</div>
            <h2 className="reveal" data-d="1">Приходите в шоурум</h2>
            <p className="reveal" data-d="2">Покажем фактуру вживую, поможем с подбором и расчётом проекта.</p>
          </div>
          <div className="ct-grid">
            <div className="ct-left reveal">
              <div className="ct-direct">
                {contacts.phone && (
                  <a className="ct-line" href={contacts.phoneHref || undefined}>
                    <span className="ct-ic"><svg width="17" height="17" viewBox="0 0 18 18" fill="none"><path d="M6.4 3.4C6.4 2.9 6 2.5 5.5 2.5H3.6C3 2.5 2.5 3 2.6 3.6 3 8.6 7 14.6 14.4 15.4 15 15.5 15.5 15 15.5 14.4V12.5C15.5 12 15.1 11.6 14.6 11.6L12.2 11.3C11.8 11.3 11.4 11.5 11.2 11.8L10.1 13C8 11.9 6.1 10 5 7.9L6.2 6.8C6.5 6.6 6.7 6.2 6.7 5.8L6.4 3.4Z" stroke="currentColor" strokeWidth="1.2" /></svg></span>
                    <span><span className="ct-lab">Телефон</span><span className="ct-val">{contacts.phone}</span></span>
                  </a>
                )}
                {contacts.email && (
                  <a className="ct-line" href={`mailto:${contacts.email}`}>
                    <span className="ct-ic"><svg width="17" height="17" viewBox="0 0 18 18" fill="none"><rect x="2.5" y="4" width="13" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" /><path d="M3.2 5L9 9.6 14.8 5" stroke="currentColor" strokeWidth="1.2" /></svg></span>
                    <span><span className="ct-lab">Почта</span><span className="ct-val">{contacts.email}</span></span>
                  </a>
                )}
              </div>
              <div className="ct-msgr">
                {contacts.telegram && (
                  <a href={contacts.telegram} target="_blank" rel="noopener"><svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M14.5 2L1.5 7l3.5 1.4L13 4 6.5 9.7l-.2 3.6L8.4 11l3.1 2.3L14.5 2z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" /></svg>Telegram</a>
                )}
                {contacts.whatsapp && (
                  <a href={contacts.whatsapp} target="_blank" rel="noopener"><svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M8 1.7a6.3 6.3 0 00-5.4 9.5L1.6 14.4l3.3-1A6.3 6.3 0 108 1.7Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" /><path d="M6 5.5c.6 1.6 1.9 2.9 3.5 3.5l.9-.9 1.5.6c0 1-.9 1.6-1.8 1.5C7.8 11 5 8.2 4.8 5.9c-.1-.9.5-1.8 1.5-1.8l.6 1.4-.9.9-.1.1Z" fill="currentColor" /></svg>WhatsApp</a>
                )}
              </div>
              <form id="leadForm" style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
                <span className="ct-rooms-label" style={{ marginBottom: 2 }}>Оставить заявку</span>
                <input name="name" placeholder="Ваше имя" required style={{ background: "rgba(255,255,255,.04)", border: "1px solid var(--line-2)", borderRadius: 2, color: "var(--ink)", padding: "12px 16px", fontFamily: "inherit", fontSize: 14, outline: "none" }} />
                <input name="phone" placeholder="Телефон" required style={{ background: "rgba(255,255,255,.04)", border: "1px solid var(--line-2)", borderRadius: 2, color: "var(--ink)", padding: "12px 16px", fontFamily: "inherit", fontSize: 14, outline: "none" }} />
                <textarea name="message" placeholder="Комментарий (необязательно)" rows={2} style={{ background: "rgba(255,255,255,.04)", border: "1px solid var(--line-2)", borderRadius: 2, color: "var(--ink)", padding: "12px 16px", fontFamily: "inherit", fontSize: 14, outline: "none", resize: "vertical" }} />
                <button type="submit" className="ct-route" style={{ border: "none", cursor: "pointer", justifyContent: "center" }}>
                  Отправить заявку
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 7h11M7.5 2l5 5-5 5" stroke="currentColor" strokeWidth="1.4" /></svg>
                </button>
                <div id="leadMsg" style={{ fontSize: 13, color: "var(--ink-soft)", minHeight: 18 }} />
              </form>
              <div>
                <span className="ct-rooms-label">{showrooms.length > 1 ? "Наши шоурумы" : "Наш шоурум"}</span>
                {showrooms.map((sr, i) => (
                  <button key={i} type="button" className={`ct-room ${i === room ? "active" : ""}`} onClick={() => setRoom(i)}>
                    <span className="ct-cdot" />
                    <span className="ct-rc"><b>{sr.name}</b><span>{sr.address}</span></span>
                    <span className="ct-rarrow"><svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M3 7.5h9M8 3l4.5 4.5L8 12" stroke="currentColor" strokeWidth="1.3" /></svg></span>
                  </button>
                ))}
              </div>
            </div>
            <div className="ct-panel reveal" data-d="1">
              {active.mapEmbedUrl ? (
                /* Карта 2ГИС/OSM — встраивается из админки (виджет 2ГИС или авто-карта по ссылке). */
                <iframe key={active.mapEmbedUrl} className="ct-map" src={active.mapEmbedUrl} title={`Карта — ${active.name || "шоурум"}`} loading="lazy" allowFullScreen />
              ) : (
                <>
                  <div className="ct-streets" />
                  <div className="ct-glow" style={{ left: "50%", top: "50%" }} />
                  <div className="ct-city">{active.name}</div>
                  <div className="ct-pin" style={{ left: "50%", top: "50%" }}><span className="pr" /><span className="pd" /></div>
                </>
              )}
              <div className="ct-detail" key={room}>
                <div className="cd-type">Шоурум</div>
                <div className="cd-name">{active.name}</div>
                {active.address && <div className="cd-row"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1.6c2.5 0 4.3 1.9 4.3 4.3C11.3 9 7 12.4 7 12.4S2.7 9 2.7 5.9C2.7 3.5 4.5 1.6 7 1.6Z" stroke="currentColor" strokeWidth="1.2" /><circle cx="7" cy="5.8" r="1.5" stroke="currentColor" strokeWidth="1.2" /></svg><span>{active.address}</span></div>}
                {active.hours && <div className="cd-row"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.3" stroke="currentColor" strokeWidth="1.2" /><path d="M7 3.9V7l2.1 1.6" stroke="currentColor" strokeWidth="1.2" /></svg><span>{active.hours}</span></div>}
                {active.mapLink && (
                  <a className="ct-route" href={active.mapLink} target="_blank" rel="noopener">
                    Построить маршрут
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 7h11M7.5 2l5 5-5 5" stroke="currentColor" strokeWidth="1.4" /></svg>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

/* ===== ALL LANDING STYLES ===== */
const landingStyles = `
  .wrap{max-width:1320px;margin:0 auto;padding:0 40px}
  .eyebrow{font-size:11px;font-weight:600;letter-spacing:.34em;text-transform:uppercase;color:var(--color-gold-400);display:flex;align-items:center;gap:14px}
  .eyebrow::before{content:"";width:34px;height:1px;background:linear-gradient(90deg,var(--color-gold-500),rgba(198,154,78,.12))}
  .reveal{opacity:0;transform:translateY(34px);transition:opacity 1.1s var(--ease),transform 1.1s var(--ease)}
  .reveal.in{opacity:1;transform:none}
  .reveal[data-d="1"]{transition-delay:.08s}
  .reveal[data-d="2"]{transition-delay:.16s}
  .reveal[data-d="3"]{transition-delay:.24s}
  .reveal[data-d="4"]{transition-delay:.32s}
  .btn{display:inline-flex;align-items:center;gap:14px;padding:17px 30px;font-size:13.5px;font-weight:500;letter-spacing:.02em;border-radius:2px;transition:.45s var(--ease);white-space:nowrap}
  .btn svg{transition:transform .45s var(--ease)}
  .btn:hover svg{transform:translateX(5px)}
  .btn-light{background:var(--ink);color:#0a0d12}
  .btn-light:hover{background:#fff}
  .btn-glass{background:rgba(255,255,255,.04);color:var(--ink);border:1px solid var(--line-2);backdrop-filter:blur(10px)}
  .btn-glass:hover{background:rgba(255,255,255,.09);border-color:rgba(255,255,255,.32)}
  .btn-outline{border:1px solid var(--line-2);color:var(--ink)}
  .btn-outline:hover{background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.34)}

  .hero{position:relative;min-height:100vh;display:flex;align-items:center;padding:128px 0 150px;overflow:hidden}
  .hero-bg{position:absolute;inset:0;z-index:-2;background:#080a0f}
  .hero-bg video{width:100%;height:100%;object-fit:cover}
  .hero::before{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(105deg,rgba(8,10,15,.95) 0%,rgba(8,10,15,.55) 42%,rgba(8,10,15,.15) 70%),linear-gradient(0deg,rgba(8,10,15,.9) 0%,transparent 45%)}
  .hero-inner{width:100%;display:flex;justify-content:space-between;align-items:flex-end;gap:40px}
  .hero-card{max-width:620px}
  .hero-card .eyebrow{margin-bottom:34px}
  .hero h1{font-size:clamp(56px,8vw,116px);font-weight:200;letter-spacing:.04em;line-height:.96;margin-bottom:30px}
  .hero h1 span{display:block}
  .hero h1 span:last-child{color:var(--ink-soft)}
  .hero .lead{font-size:clamp(17px,1.7vw,21px);font-weight:300;color:var(--ink);margin-bottom:14px;letter-spacing:.005em;line-height:1.4}
  .hero .sub{font-size:14.5px;color:var(--ink-mute);max-width:430px;margin-bottom:38px}
  .hero-actions{display:flex;gap:14px;flex-wrap:wrap}
  .hero-foot{position:absolute;left:0;right:0;bottom:42px;z-index:2;display:flex;justify-content:space-between;align-items:flex-end;gap:30px}
  .scroll-hint{display:flex;align-items:center;gap:12px;font-size:10.5px;letter-spacing:.3em;text-transform:uppercase;color:var(--ink-mute)}
  .scroll-hint .dot{width:34px;height:34px;border:1px solid var(--line-2);border-radius:50%;display:flex;align-items:center;justify-content:center}
  .scroll-hint .dot b{width:4px;height:4px;background:var(--ink);border-radius:50%;animation:bob 1.8s var(--ease) infinite}
  @keyframes bob{0%,100%{transform:translateY(-3px);opacity:.4}50%{transform:translateY(3px);opacity:1}}
  .play-row{display:flex;align-items:center;gap:14px;font-size:13px;color:var(--ink-soft)}
  .play-btn{width:54px;height:54px;border:1px solid var(--line-2);border-radius:50%;display:flex;align-items:center;justify-content:center;transition:.4s var(--ease)}
  .play-btn:hover{background:rgba(255,255,255,.07);transform:scale(1.06)}

  section{position:relative}
  section[id]{scroll-margin-top:78px}
  .sec-pad{padding:130px 0}
  .sec-head{margin-bottom:60px}
  .sec-head .eyebrow{margin-bottom:26px}
  .sec-head h2{font-size:clamp(34px,4.3vw,58px);margin-bottom:18px;max-width:760px}
  .sec-head p{font-size:15px;color:var(--ink-mute);max-width:430px}
  .sec-top{display:flex;justify-content:space-between;align-items:flex-end;gap:30px}
  .arrows{display:flex;gap:10px}
  .arrows button{width:48px;height:48px;border:1px solid var(--line-2);border-radius:50%;display:flex;align-items:center;justify-content:center;transition:.4s var(--ease);color:var(--ink-soft)}
  .arrows button:hover{background:var(--ink);color:#0a0d12;border-color:var(--ink)}

  .collections{background:linear-gradient(180deg,var(--bg) 0%,var(--bg-2) 100%)}
  .rail{display:flex;gap:24px;overflow-x:auto;scroll-behavior:smooth;scrollbar-width:none;padding-bottom:6px;margin-top:46px}
  .rail::-webkit-scrollbar{display:none}
  .cat3d-stage{position:relative;margin-top:74px;display:flex;justify-content:center;align-items:flex-end;gap:clamp(2px,1.2vw,20px);perspective:2000px;perspective-origin:50% 33%;padding:48px 0 32px}
  .cat3d-stage::before{content:"";position:absolute;left:50%;top:4%;width:820px;height:520px;transform:translateX(-50%);pointer-events:none;z-index:-2;background:radial-gradient(ellipse,rgba(198,154,78,.16),transparent 66%)}
  .cat3d-stage::after{content:"";position:absolute;left:50%;bottom:-90px;width:96%;height:260px;transform:translateX(-50%);pointer-events:none;z-index:-2;background:radial-gradient(ellipse 58% 100% at 50% 38%,rgba(198,154,78,.13),transparent 74%)}
  .cat3d{position:relative;flex:0 1 374px;min-width:0;aspect-ratio:67/100;transform-style:preserve-3d;cursor:pointer;color:inherit;text-decoration:none}
  .cat3d-box{position:absolute;inset:0;transform-style:preserve-3d;transition:transform .5s var(--ease);cursor:pointer;will-change:transform}
  .cat3d:focus-visible{outline:2px solid var(--color-gold-400);outline-offset:4px;border-radius:14px}
  .cat3d[data-i="0"] .cat3d-box{transform:rotateY(31deg) translateZ(-46px)}
  .cat3d[data-i="1"] .cat3d-box{transform:translateZ(60px) translateY(-34px) scale(1.05)}
  .cat3d[data-i="2"] .cat3d-box{transform:rotateY(-31deg) translateZ(-46px)}
  .cat3d[data-i="1"]{z-index:3}
  .cat3d-edge{position:absolute;top:20px;bottom:20px;width:42px;background:linear-gradient(180deg,#3c4450 0%,#1a202b 48%,#080a0f 100%)}
  .cat3d-edge::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(255,255,255,.12),transparent 42%,rgba(0,0,0,.5))}
  .cat3d-edge-l::before,.cat3d-edge-r::before{content:"";position:absolute;top:0;bottom:0;width:2px;background:linear-gradient(180deg,rgba(198,154,78,.55),rgba(198,154,78,.08) 60%,transparent)}
  .cat3d-edge-l::before{right:0}
  .cat3d-edge-r::before{left:0}
  .cat3d-edge-l{left:0;transform-origin:left center;transform:rotateY(90deg)}
  .cat3d-edge-r{right:0;transform-origin:right center;transform:rotateY(-90deg)}
  .cat3d[data-i="0"] .cat3d-edge-r{display:none}
  .cat3d[data-i="1"] .cat3d-edge{display:none}
  .cat3d[data-i="2"] .cat3d-edge-l{display:none}
  .cat3d-inner{position:absolute;inset:0;border-radius:13px;overflow:hidden;border:1px solid var(--line-2);background:#0b0e15}
  .cat3d[data-i="1"] .cat3d-inner{border-color:rgba(198,154,78,.42);box-shadow:0 0 0 1px rgba(198,154,78,.14),0 28px 70px -40px rgba(198,154,78,.3)}
  .cat3d-tex{position:absolute;inset:0}
  .cat3d-tex img{width:100%;height:100%;object-fit:cover;filter:grayscale(.2) brightness(.7) contrast(1.05);transition:filter .7s var(--ease),transform 1s var(--ease)}
  .cat3d-tex::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(8,10,15,.16) 0%,rgba(8,10,15,.44) 44%,rgba(8,10,15,.97) 100%)}
  .cat3d[data-i="1"] .cat3d-tex img{filter:grayscale(.12) brightness(.84) contrast(1.04)}
  .cat3d-box:hover .cat3d-tex img{filter:grayscale(.04) brightness(.92);transform:scale(1.05)}
  .cat3d-rim{position:absolute;inset:0;z-index:2;pointer-events:none;border-radius:inherit;box-shadow:inset 0 1px 0 rgba(255,255,255,.26),inset 0 18px 40px -28px rgba(255,255,255,.14),inset 0 -88px 86px -64px rgba(0,0,0,.88)}
  .cat3d-gloss{position:absolute;inset:0;z-index:3;pointer-events:none;opacity:0;border-radius:inherit;background:radial-gradient(440px circle at var(--mx,50%) var(--my,10%),rgba(255,255,255,.16),transparent 60%);transition:opacity .4s var(--ease)}
  .cat3d-box:hover .cat3d-gloss{opacity:1}
  .cat3d-body{position:absolute;left:30px;right:30px;top:34px;bottom:34px;z-index:4;display:flex;flex-direction:column}
  .cat3d-idx{font-family:var(--font-serif),'Playfair Display',serif;font-size:23px;font-weight:500;color:var(--color-gold-300);letter-spacing:.07em;text-shadow:0 1px 14px rgba(198,154,78,.28)}
  .cat3d-line{width:1px;flex:1;margin:16px 0 16px 1px;background:linear-gradient(180deg,rgba(198,154,78,.32),rgba(255,255,255,.04))}
  .cat3d-title{font-size:clamp(24px,2vw,31px);font-weight:300;letter-spacing:.012em}
  .cat3d-desc{font-size:13.5px;color:var(--ink-soft);margin-top:12px;max-width:236px;line-height:1.5}
  .cat3d-link{display:inline-flex;align-items:center;gap:12px;margin-top:24px;font-size:11px;letter-spacing:.15em;text-transform:uppercase;color:var(--ink)}
  .cat3d-link .ll{width:46px;height:1px;background:var(--line-2);transition:width .5s var(--ease),background .5s var(--ease)}
  .cat3d-link svg{transition:transform .45s var(--ease)}
  .cat3d-box:hover .cat3d-link{color:var(--color-gold-400)}
  .cat3d-box:hover .cat3d-link .ll{width:82px;background:var(--color-gold-500)}
  .cat3d-box:hover .cat3d-link svg{transform:translateX(4px)}
  .cat3d-floor{position:absolute;left:-9%;right:-9%;bottom:-5%;height:108px;z-index:-1;background:radial-gradient(ellipse 54% 100% at 50% 100%,rgba(0,0,0,.9),transparent 75%);filter:blur(14px)}
  .cat3d[data-i="1"] .cat3d-floor{background:radial-gradient(ellipse 60% 100% at 50% 100%,rgba(0,0,0,.92),transparent 73%),radial-gradient(ellipse 98% 80% at 50% 78%,rgba(198,154,78,.2),transparent 76%)}
  .cat3d-caption{text-align:center;margin-top:58px;font-size:13.5px;color:var(--ink-mute);letter-spacing:.015em}
  @media (prefers-reduced-motion: reduce){
    .cat3d-stage{perspective:none}
    .cat3d-box,.cat3d[data-i="0"] .cat3d-box,.cat3d[data-i="1"] .cat3d-box,.cat3d[data-i="2"] .cat3d-box{transform:none!important;transition:none}
    .cat3d-edge,.cat3d-floor{display:none}
    .cat3d-tex img,.cat3d-link .ll,.cat3d-link svg{transition:none}
    .collections .reveal{opacity:1;transform:none;transition:none}
  }

  .ai{background:var(--bg-2);overflow:hidden}
  .ai::before{content:"";position:absolute;left:-10%;top:10%;width:600px;height:600px;background:radial-gradient(circle,var(--glow),transparent 65%);pointer-events:none}
  .ai-grid{display:grid;grid-template-columns:1fr 1fr;gap:70px;align-items:center}
  .ai-text h2{font-size:clamp(32px,3.6vw,50px);margin-bottom:22px}
  .ai-text>p{font-size:15px;color:var(--ink-mute);max-width:420px;margin-bottom:40px}
  .steps{display:flex;flex-direction:column;gap:2px;margin-bottom:40px}
  .step{display:flex;gap:20px;align-items:flex-start;padding:20px 0;border-top:1px solid var(--line)}
  .step:last-child{border-bottom:1px solid var(--line)}
  .step .num{font-family:var(--font-serif),'Playfair Display',serif;font-size:30px;color:var(--ink-faint);line-height:1;flex:none;width:38px}
  .step .st-body strong{display:block;font-weight:500;font-size:15px;margin-bottom:3px}
  .step .st-body span{font-size:13px;color:var(--ink-mute)}
  .ai-preview-card{border:1px solid var(--line-2);border-radius:14px;background:linear-gradient(160deg,rgba(255,255,255,.055),rgba(255,255,255,.02));padding:48px 40px;text-align:center;transition:.4s var(--ease);position:relative;box-shadow:0 24px 60px -30px rgba(0,0,0,.7),0 0 0 1px rgba(255,255,255,.03) inset}
  .ai-preview-card::before{content:"";position:absolute;inset:0;border-radius:14px;padding:1px;background:linear-gradient(160deg,rgba(198,154,78,.35),transparent 40%);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none}
  .ai-preview-icon{width:74px;height:74px;margin:0 auto 24px;border-radius:50%;border:1px solid rgba(198,154,78,.4);display:flex;align-items:center;justify-content:center;background:rgba(198,154,78,.1);color:var(--color-gold-400)}
  .ai-preview-card h4{font-weight:300;font-size:21px;margin-bottom:8px}
  .ai-preview-sub{font-size:13px;color:var(--ink-mute)}
  .dz-thumbs{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:30px}
  .dz-thumb{display:block;overflow:hidden;border-radius:8px;border:1px solid var(--line-2);aspect-ratio:4/3;position:relative}
  .dz-thumb img{width:100%;height:100%;object-fit:cover;transition:transform .5s var(--ease)}
  .dz-thumb:hover img{transform:scale(1.08)}
  .dz-tag{margin-top:14px;font-size:10.5px;letter-spacing:.18em;text-transform:uppercase;color:var(--ink-faint)}

  .atmo{background:linear-gradient(180deg,var(--bg-2),var(--bg))}
  /* Карусель: горизонтальная лента с авто-прокруткой и перетаскиванием «ладошкой». */
  .atmo-track{display:flex;gap:20px;margin-top:46px;overflow-x:auto;cursor:grab;user-select:none;scrollbar-width:none;-ms-overflow-style:none;padding-bottom:4px}
  .atmo-track::-webkit-scrollbar{display:none}
  .atmo-track.dragging{cursor:grabbing}
  /* Карточка-«рамка»: тонкая золотистая обводка + внутренний кант + мягкая тень. */
  .atmo-card{flex:0 0 clamp(300px,32%,420px);position:relative;display:block;aspect-ratio:3/2;border-radius:6px;overflow:hidden;border:1px solid var(--line-2);box-shadow:0 18px 44px -28px rgba(0,0,0,.85);transition:transform .5s var(--ease),border-color .5s var(--ease),box-shadow .5s var(--ease)}
  .atmo-card::before{content:"";position:absolute;inset:0;z-index:2;border-radius:6px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.06);pointer-events:none;transition:box-shadow .5s var(--ease)}
  .atmo-card img{width:100%;height:100%;object-fit:cover;filter:grayscale(.1) brightness(.9);transition:transform 1.2s var(--ease),filter 1.2s var(--ease)}
  .atmo-card:hover{transform:translateY(-4px);border-color:var(--color-gold-500);box-shadow:0 26px 60px -26px rgba(198,154,78,.4)}
  .atmo-card:hover::before{box-shadow:inset 0 0 0 1px rgba(198,154,78,.45)}
  .atmo-card:hover img{transform:scale(1.05);filter:grayscale(0) brightness(1)}

  .adv{background:var(--bg)}
  .adv-head{display:grid;grid-template-columns:1fr 1fr;gap:60px;align-items:end;margin-bottom:66px}
  .adv-head h2{font-size:clamp(32px,3.8vw,52px)}
  .adv-head p{font-size:15px;color:var(--ink-mute);max-width:380px}
  .adv-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:0}
  .adv-item{padding:38px 30px 38px 0;border-top:1px solid var(--line-2)}
  .adv-item .ic{width:52px;height:52px;border:1px solid var(--line-2);border-radius:50%;display:flex;align-items:center;justify-content:center;margin-bottom:24px;transition:.45s var(--ease)}
  .adv-item:hover .ic{background:var(--color-gold-500);color:var(--on-gold);border-color:var(--color-gold-500);transform:translateY(-4px)}
  .adv-item h3{font-size:17px;font-weight:500;margin-bottom:12px}
  .adv-item p{font-size:13px;color:var(--ink-mute);line-height:1.55}

  .brand{background:linear-gradient(180deg,var(--bg),var(--bg-2))}
  .brand-grid{display:grid;grid-template-columns:.92fr 1.08fr;gap:64px;align-items:center}
  .brand-text .eyebrow{margin-bottom:28px}
  .brand-text h2{font-size:clamp(32px,3.8vw,52px);margin-bottom:24px}
  .brand-text>p{font-size:15px;color:var(--ink-soft);max-width:430px;margin-bottom:34px}
  .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;margin-top:46px;padding-top:40px;border-top:1px solid var(--line)}
  .stat .nm{font-family:var(--font-serif),'Playfair Display',serif;font-size:46px;font-weight:500;line-height:1;letter-spacing:-.01em;color:var(--color-gold-400)}
  .stat .lb{font-size:11.5px;color:var(--ink-mute);margin-top:8px;letter-spacing:.02em}
  .brand-visual{position:relative;aspect-ratio:4/4.4;border-radius:3px;overflow:hidden;border:1px solid var(--line)}
  .brand-visual>img{width:100%;height:100%;object-fit:cover;filter:brightness(.7) grayscale(.2)}
  .brand-visual::after{content:"";position:absolute;inset:0;background:linear-gradient(0deg,rgba(8,10,15,.9),transparent 60%)}
  .brand-sign{position:absolute;top:46px;left:0;right:0;text-align:center;z-index:2}
  .brand-sign b{font-family:var(--font-krona);font-weight:400;font-size:clamp(24px,2.7vw,38px);letter-spacing:.12em;display:block;color:rgba(255,255,255,.92)}
  .brand-sign span{font-size:9px;letter-spacing:.5em;color:rgba(255,255,255,.5)}
  .showroom-card{position:absolute;left:30px;right:30px;bottom:30px;z-index:3;background:rgba(12,16,24,.82);backdrop-filter:blur(16px);border:1px solid var(--line-2);border-radius:3px;padding:28px 30px}
  .showroom-card .eyebrow{margin-bottom:14px}
  .showroom-card p{font-size:13.5px;color:var(--ink-soft);margin-bottom:20px}

  .contacts{background:linear-gradient(180deg,var(--bg-2),var(--bg))}
  .ct-grid{display:grid;grid-template-columns:.92fr 1.08fr;gap:46px;align-items:stretch}
  .ct-left{display:flex;flex-direction:column;gap:28px}
  .ct-direct{display:flex;flex-direction:column}
  .ct-line{display:flex;align-items:center;gap:18px;padding:18px 0;border-bottom:1px solid var(--line);transition:padding-left .35s var(--ease)}
  .ct-line:first-child{border-top:1px solid var(--line)}
  .ct-line:hover{padding-left:8px}
  .ct-ic{width:46px;height:46px;border:1px solid var(--line-2);border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;color:var(--accent);transition:.35s var(--ease)}
  .ct-line:hover .ct-ic{background:rgba(255,255,255,.05)}
  .ct-lab{font-size:10.5px;letter-spacing:.18em;text-transform:uppercase;color:var(--ink-mute);display:block;margin-bottom:3px}
  .ct-val{font-size:19px;font-weight:300}
  .ct-msgr{display:flex;gap:10px;flex-wrap:wrap}
  .ct-msgr a{display:flex;align-items:center;gap:9px;padding:12px 18px;border:1px solid var(--line-2);border-radius:2px;font-size:13px;color:var(--ink-soft);transition:.35s var(--ease)}
  .ct-msgr a:hover{background:rgba(255,255,255,.05);color:var(--ink);border-color:rgba(255,255,255,.32)}
  .ct-rooms-label{font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--ink-mute);display:block;margin-bottom:14px}
  .ct-room{display:flex;align-items:center;gap:15px;width:100%;text-align:left;padding:17px 16px;border:1px solid var(--line);border-radius:3px;margin-bottom:8px;transition:.35s var(--ease);background:none;color:inherit;font-family:inherit;cursor:pointer}
  .ct-room:hover{border-color:var(--line-2)}
  .ct-room.active{border-color:var(--accent);background:rgba(142,166,207,.07)}
  .ct-cdot{width:9px;height:9px;border-radius:50%;border:1px solid var(--line-2);flex:none;transition:.35s var(--ease)}
  .ct-room.active .ct-cdot{background:var(--accent);border-color:var(--accent);box-shadow:0 0 10px var(--accent)}
  .ct-rc{flex:1}
  .ct-rc b{font-weight:400;font-size:15px;display:block;margin-bottom:2px}
  .ct-rc span{font-size:12.5px;color:var(--ink-mute)}
  .ct-rarrow{color:var(--ink-faint);transition:.35s var(--ease)}
  .ct-room.active .ct-rarrow,.ct-room:hover .ct-rarrow{color:var(--ink)}
  .ct-panel{position:relative;border:1px solid var(--line-2);border-radius:5px;overflow:hidden;min-height:486px;background:linear-gradient(160deg,var(--bg-3),var(--bg));box-shadow:0 40px 80px -54px rgba(0,0,0,.9);display:flex;flex-direction:column;justify-content:flex-end}
  .ct-streets{position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(24deg,transparent 0 46px,rgba(255,255,255,.045) 46px 47px),repeating-linear-gradient(114deg,transparent 0 62px,rgba(255,255,255,.04) 62px 63px),repeating-linear-gradient(24deg,transparent 0 150px,rgba(255,255,255,.055) 150px 152px),repeating-linear-gradient(114deg,transparent 0 188px,rgba(255,255,255,.05) 188px 190px)}
  .ct-map{position:absolute;inset:0;width:100%;height:100%;border:0}
  .ct-glow{position:absolute;width:300px;height:300px;border-radius:50%;pointer-events:none;transform:translate(-50%,-50%);background:radial-gradient(circle,var(--glow),transparent 66%);transition:left .7s var(--ease),top .7s var(--ease)}
  .ct-city{position:absolute;top:30px;left:34px;right:34px;font-family:var(--font-serif),'Playfair Display',serif;font-size:clamp(38px,4.6vw,64px);font-weight:500;font-style:italic;color:rgba(255,255,255,.08);transition:opacity .4s var(--ease)}
  .ct-pin{position:absolute;width:16px;height:16px;transform:translate(-50%,-50%);z-index:2;transition:left .7s var(--ease),top .7s var(--ease)}
  .ct-pin .pd{position:absolute;inset:0;border-radius:50%;background:var(--accent);border:2px solid var(--bg);box-shadow:0 0 14px var(--accent)}
  .ct-pin .pr{position:absolute;left:50%;top:50%;width:16px;height:16px;border-radius:50%;border:1px solid var(--accent);transform:translate(-50%,-50%);animation:ctping 2.6s var(--ease) infinite}
  @keyframes ctping{0%{transform:translate(-50%,-50%) scale(1);opacity:.75}70%,100%{transform:translate(-50%,-50%) scale(4.6);opacity:0}}
  .ct-detail{position:relative;z-index:3;padding:32px 34px;background:linear-gradient(180deg,transparent,rgba(8,10,15,.55) 26%,rgba(8,10,15,.96))}
  .cd-type{font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--color-gold-400);margin-bottom:8px}
  .cd-name{font-family:var(--font-serif),'Playfair Display',serif;font-size:30px;font-weight:500;margin-bottom:16px}
  .cd-row{display:flex;gap:12px;align-items:flex-start;font-size:14px;color:var(--ink-soft);padding:4px 0}
  .cd-row svg{flex:none;margin-top:3px;color:var(--accent)}
  .ct-route{display:inline-flex;align-items:center;gap:11px;margin-top:20px;padding:13px 24px;background:var(--ink);color:#0a0d12;font-size:13px;font-weight:500;border-radius:2px;transition:.4s var(--ease)}
  .ct-route:hover{background:#fff}
  .ct-route svg{transition:transform .4s var(--ease)}
  .ct-route:hover svg{transform:translateX(4px)}
  @keyframes ctfade{from{opacity:0;transform:translateY(12px)}}




  @media(max-width:1080px){
    .ai-grid,.adv-head,.brand-grid{grid-template-columns:1fr;gap:48px}
    .adv-grid{grid-template-columns:repeat(2,1fr)}
    .adv-item{padding-right:24px}
    .cat3d-stage{gap:4px;perspective:1500px}
    .atmo-card{flex-basis:46%}
    .ct-grid{grid-template-columns:1fr;gap:36px}
  }
  @media(max-width:760px){
    .wrap{padding:0 22px}

    .sec-pad{padding:84px 0}
    .hero-inner{flex-direction:column;align-items:flex-start;gap:34px}
    .scroll-hint{display:none}
    .hero{padding-bottom:40px}
    .hero-actions .btn{flex:1;justify-content:center}
    .sec-top{flex-direction:column;align-items:flex-start}
    .cat3d-stage{overflow-x:auto;overflow-y:hidden;touch-action:pan-x;overscroll-behavior-x:contain;scrollbar-width:none;perspective:none;justify-content:flex-start;align-items:stretch;margin-top:42px;padding:14px 22px 8px;gap:16px;scroll-snap-type:x mandatory;scroll-padding:0 22px}
    .cat3d-stage::-webkit-scrollbar{display:none}
    /* декоративные свечения растягивают ширину прокрутки — на мобиле убираем */
    .cat3d-stage::before,.cat3d-stage::after{display:none}
    .cat3d{flex:0 0 80%;aspect-ratio:7/10;scroll-snap-align:center}
    .cat3d[data-i="0"] .cat3d-box,.cat3d[data-i="1"] .cat3d-box,.cat3d[data-i="2"] .cat3d-box{transform:none}
    .cat3d-edge,.cat3d-floor{display:none}
    .atmo-track{gap:14px}
    .atmo-card{flex-basis:82%}
    .adv-grid{grid-template-columns:1fr}
    .stats{grid-template-columns:1fr 1fr;gap:26px}
    .brand-visual{aspect-ratio:3/3.6}
  }
`;

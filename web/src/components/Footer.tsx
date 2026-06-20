import Link from "next/link";
import BrandLogo from "./BrandLogo";
import { getSiteSettings, telHref, waHref, tgHref } from "@/lib/settings";

export default async function Footer() {
  const s = await getSiteSettings();
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: footerStyles }} />
      <footer id="footer" className="site-footer">
        <div className="ft-wrap">
          <div className="ft-top">
            <div className="ft-news">
              <h3>Будьте в курсе новинок</h3>
              <p>Подпишитесь на нашу рассылку и получайте вдохновение и актуальные предложения.</p>
              <div className="ft-news-form">
                <input type="email" placeholder="Ваш e-mail" />
                <button aria-label="Подписаться">
                  <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><path d="M1 8h13M9 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" /></svg>
                </button>
              </div>
            </div>
            <div className="ft-col">
              <h4>Каталог</h4>
              <Link href="/collections">Коллекции</Link>
              <Link href="/catalog?category=keramogranit">Керамогранит</Link>
              <Link href="/catalog?category=clinker">Клинкер</Link>
              <Link href="/catalog?category=mosaic">Мозаика</Link>
              <Link href="/catalog">Все коллекции</Link>
            </div>
            <div className="ft-col">
              <h4>Компания</h4>
              <Link href="/about">О компании</Link>
              <Link href="/visualize">AI-визуализация</Link>
              <a href="/#contacts">Партнёрам</a>
              <a href="/#contacts">Контакты</a>
            </div>
            <div className="ft-col">
              <h4>Клиентам</h4>
              <a href="/#contacts">Доставка и оплата</a>
              <a href="/#contacts">Заказать образец</a>
              {s.mapLink && <a href={s.mapLink} target="_blank" rel="noopener">Шоурум на карте</a>}
            </div>
            <div className="ft-col ft-brand">
              <a href="/" className="ft-logo" aria-label="Japan Ceramic — на главную"><BrandLogo height={34} wordSize={16} /></a>
              <div className="ft-socials">
                {s.instagram && (
                  <a href={s.instagram} target="_blank" rel="noopener" aria-label="Instagram"><svg width="18" height="18" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="1.5" width="13" height="13" rx="4" stroke="currentColor" strokeWidth="1.2" /><circle cx="8" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.2" /><circle cx="12" cy="4" r="1" fill="currentColor" /></svg></a>
                )}
                {s.telegram && (
                  <a href={tgHref(s.telegram)} target="_blank" rel="noopener" aria-label="Telegram"><svg width="18" height="18" viewBox="0 0 16 16" fill="none"><path d="M14.5 2L1.5 7l3.5 1.4L13 4 6.5 9.7l-.2 3.6L8.4 11l3.1 2.3L14.5 2z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" /></svg></a>
                )}
                {s.whatsapp && (
                  <a href={waHref(s.whatsapp)} target="_blank" rel="noopener" aria-label="WhatsApp"><svg width="18" height="18" viewBox="0 0 16 16" fill="none"><path d="M8 1.7a6.3 6.3 0 00-5.4 9.5L1.6 14.4l3.3-1A6.3 6.3 0 108 1.7Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" /><path d="M6 5.5c.6 1.6 1.9 2.9 3.5 3.5l.9-.9 1.5.6c0 1-.9 1.6-1.8 1.5C7.8 11 5 8.2 4.8 5.9c-.1-.9.5-1.8 1.5-1.8l.6 1.4-.9.9-.1.1Z" fill="currentColor" /></svg></a>
                )}
              </div>
              <div className="ft-contacts">
                {s.phone && <p><a href={telHref(s.phone)}>{s.phone}</a></p>}
                {s.email && <p><a href={`mailto:${s.email}`}>{s.email}</a></p>}
                {s.address && <p>{s.address}</p>}
              </div>
            </div>
          </div>
          <div className="ft-bot">
            <span>&copy; 2026 Japan Ceramic. Все права защищены.</span>
            <div className="ft-links">
              <Link href="/privacy">Политика конфиденциальности</Link>
              <Link href="/terms">Пользовательское соглашение</Link>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}

const footerStyles = `
  .site-footer{background:var(--bg-2);border-top:1px solid var(--line);padding-top:88px}
  .ft-wrap{max-width:1320px;margin:0 auto;padding:0 40px}
  .ft-top{display:grid;grid-template-columns:1.5fr .92fr .92fr .92fr 1.2fr;gap:44px;padding-bottom:64px;border-bottom:1px solid var(--line)}
  .ft-news h3{font-size:25px;font-weight:200;margin-bottom:14px}
  .ft-news p{font-size:14px;color:var(--ink-mute);max-width:330px;margin-bottom:24px}
  .ft-news-form{display:flex;border:1px solid var(--line-2);border-radius:2px;overflow:hidden;max-width:370px}
  .ft-news-form input{flex:1;background:transparent;border:none;outline:none;color:var(--ink);padding:17px 22px;font-family:inherit;font-size:15px}
  .ft-news-form input::placeholder{color:var(--ink-faint)}
  .ft-news-form button{padding:0 24px;background:var(--ink);color:#0a0d12;transition:.3s;display:flex;align-items:center;border:none;cursor:pointer}
  .ft-news-form button:hover{background:#fff}
  .ft-col h4{font-size:12.5px;letter-spacing:.26em;text-transform:uppercase;color:var(--ink-mute);margin-bottom:28px}
  .ft-col a{display:block;font-size:15px;color:var(--ink-soft);padding:8px 0;transition:color .3s,padding-left .3s var(--ease)}
  .ft-col a:hover{color:var(--ink);padding-left:6px}
  .ft-brand .ft-logo{margin-bottom:28px;display:inline-flex}
  .ft-socials{display:flex;gap:10px;margin-bottom:24px}
  .ft-socials a{width:40px;height:40px;border:1px solid var(--line-2);border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--ink-soft);transition:.4s var(--ease)}
  .ft-socials a:hover{background:var(--ink);color:#0a0d12;border-color:var(--ink)}
  .ft-contacts p{font-size:15px;color:var(--ink-soft);padding:4px 0}
  .ft-contacts a{color:inherit;display:inline;padding:0;transition:color .3s}
  .ft-contacts a:hover{color:var(--ink)}
  .ft-bot{display:flex;justify-content:space-between;align-items:center;padding:22px 0;font-size:12.5px;color:var(--ink-faint);flex-wrap:wrap;gap:14px}
  .ft-links{display:flex;gap:32px}
  .ft-links a:hover{color:var(--ink-soft)}
  @media(max-width:1080px){
    .ft-top{grid-template-columns:1fr 1fr;gap:40px}
  }
  @media(max-width:760px){
    .site-footer{padding-top:56px}
    .ft-wrap{padding:0 22px}
    /* Ссылочные колонки — в ряд (3 столбца), новостной блок и бренд — во всю ширину */
    .ft-top{grid-template-columns:repeat(3,1fr);gap:30px 14px;padding-bottom:40px}
    .ft-news{grid-column:1/-1}
    .ft-brand{grid-column:1/-1}
    .ft-news h3{font-size:21px;margin-bottom:10px}
    .ft-news p{margin-bottom:16px}
    .ft-col h4{margin-bottom:14px;font-size:11px;letter-spacing:.16em}
    .ft-col a{font-size:13px;padding:5px 0}
    .ft-brand .ft-logo{margin-bottom:18px}
    .ft-socials{margin-bottom:16px}
    .ft-bot{flex-direction:column;align-items:flex-start}
  }
  @media(max-width:420px){
    /* На совсем узких — два столбца, чтобы названия не ломались в кашу */
    .ft-top{grid-template-columns:1fr 1fr;gap:26px 16px}
  }
`;

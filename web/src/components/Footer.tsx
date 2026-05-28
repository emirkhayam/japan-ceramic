import Link from "next/link";

export default function Footer() {
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
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1 8h13M9 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" /></svg>
                </button>
              </div>
            </div>
            <div className="ft-col">
              <h4>Каталог</h4>
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
              <a href="https://2gis.kg/bishkek/firm/70000001100637803" target="_blank" rel="noopener">Шоурум на карте</a>
            </div>
            <div className="ft-col ft-brand">
              <a href="/" className="ft-logo"><b>JAPAN</b><span>CERAMIC</span></a>
              <div className="ft-socials">
                <a href="https://instagram.com/japanceramic" target="_blank" rel="noopener" aria-label="Instagram"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="1.5" width="13" height="13" rx="4" stroke="currentColor" strokeWidth="1.2" /><circle cx="8" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.2" /><circle cx="12" cy="4" r="1" fill="currentColor" /></svg></a>
                <a href="https://t.me/japanceramic" target="_blank" rel="noopener" aria-label="Telegram"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M14.5 2L1.5 7l3.5 1.4L13 4 6.5 9.7l-.2 3.6L8.4 11l3.1 2.3L14.5 2z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" /></svg></a>
                <a href="https://pinterest.com/japanceramic" target="_blank" rel="noopener" aria-label="Pinterest"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2" /><path d="M8 4.5C6.3 4.5 5.3 5.8 5.3 7.2c0 .7.3 1.4.9 1.7.1 0 .2 0 .2-.1l.1-.5c0-.1 0-.2-.1-.3-.2-.3-.4-.7-.4-1.2 0-1.2.9-2.3 2.4-2.3 1.3 0 2 .8 2 1.9 0 1.4-.6 2.6-1.5 2.6-.5 0-.9-.4-.7-1l.4-1.5c.1-.4-.1-.7-.4-.7-.4 0-.7.4-.7 1l-1 4.2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" /></svg></a>
              </div>
              <div className="ft-contacts">
                <p>+996 503 33 77 33</p>
                <p>info@japanceramic.ru</p>
                <p>г. Бишкек, ул. Юнусалиева, 28</p>
              </div>
            </div>
          </div>
          <div className="ft-bot">
            <span>&copy; 2026 Japan Ceramic. Все права защищены.</span>
            <div className="ft-links">
              <a href="#">Политика конфиденциальности</a>
              <a href="#">Пользовательское соглашение</a>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}

const footerStyles = `
  .site-footer{background:var(--bg-2);border-top:1px solid var(--line);padding-top:90px}
  .ft-wrap{max-width:1320px;margin:0 auto;padding:0 40px}
  .ft-top{display:grid;grid-template-columns:1.5fr .92fr .92fr .92fr 1.2fr;gap:40px;padding-bottom:70px;border-bottom:1px solid var(--line)}
  .ft-news h3{font-size:24px;font-weight:200;margin-bottom:14px}
  .ft-news p{font-size:13.5px;color:var(--ink-mute);max-width:300px;margin-bottom:26px}
  .ft-news-form{display:flex;border:1px solid var(--line-2);border-radius:2px;overflow:hidden;max-width:330px}
  .ft-news-form input{flex:1;background:transparent;border:none;outline:none;color:var(--ink);padding:14px 18px;font-family:inherit;font-size:13.5px}
  .ft-news-form input::placeholder{color:var(--ink-faint)}
  .ft-news-form button{padding:0 20px;background:var(--ink);color:#0a0d12;transition:.3s;display:flex;align-items:center;border:none;cursor:pointer}
  .ft-news-form button:hover{background:#fff}
  .ft-col h4{font-size:11px;letter-spacing:.26em;text-transform:uppercase;color:var(--ink-mute);margin-bottom:22px}
  .ft-col a{display:block;font-size:13.5px;color:var(--ink-soft);padding:6px 0;transition:color .3s,padding-left .3s var(--ease)}
  .ft-col a:hover{color:var(--ink);padding-left:6px}
  .ft-brand .ft-logo{margin-bottom:22px;display:flex;flex-direction:column;line-height:.92}
  .ft-brand .ft-logo b{font-weight:300;font-size:20px;letter-spacing:.26em}
  .ft-brand .ft-logo span{font-size:8.5px;font-weight:600;letter-spacing:.46em;color:var(--ink-mute);padding-left:2px}
  .ft-socials{display:flex;gap:10px;margin-bottom:26px}
  .ft-socials a{width:38px;height:38px;border:1px solid var(--line-2);border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--ink-soft);transition:.4s var(--ease)}
  .ft-socials a:hover{background:var(--ink);color:#0a0d12;border-color:var(--ink)}
  .ft-contacts p{font-size:13.5px;color:var(--ink-soft);padding:3px 0}
  .ft-bot{display:flex;justify-content:space-between;align-items:center;padding:28px 0;font-size:12.5px;color:var(--ink-faint);flex-wrap:wrap;gap:14px}
  .ft-links{display:flex;gap:28px}
  .ft-links a:hover{color:var(--ink-soft)}
  @media(max-width:1080px){
    .ft-top{grid-template-columns:1fr 1fr;gap:40px}
  }
  @media(max-width:760px){
    .ft-wrap{padding:0 22px}
    .ft-top{grid-template-columns:1fr}
    .ft-bot{flex-direction:column;align-items:flex-start}
  }
`;

import fs from "fs";
import path from "path";
import { getSession } from "@/lib/auth";

export default async function LandingPage() {
  const user = await getSession();
  const htmlPath = path.join(process.cwd(), "..", "japan-ceramic.html");
  const raw = fs.readFileSync(htmlPath, "utf-8");

  // Extract only <style>...</style> and body content (between <body> and </body>)
  const styleMatch = raw.match(/<style>([\s\S]*?)<\/style>/);
  const bodyMatch = raw.match(/<body>([\s\S]*?)<\/body>/);
  const scriptMatch = raw.match(/<script>([\s\S]*?)<\/script>/);

  let bodyContent = bodyMatch?.[1] || "";
  const styles = styleMatch?.[1] || "";
  const script = scriptMatch?.[1] || "";

  // Fix video path
  bodyContent = bodyContent.replace(
    'src="kling_20260522_作品_Ultra_cine_2396_0.mp4"',
    'src="/hero-video.mp4"'
  );

  // Update navigation: replace useless "Шоурум" with "Каталог" link, add auth links
  // Desktop nav
  bodyContent = bodyContent.replace(
    `<a href="#brand">Шоурум</a>\n      <a href="#footer">Контакты</a>`,
    `<a href="/catalog">Каталог</a>\n      <a href="#footer">Контакты</a>`
  );
  // Mobile drawer
  bodyContent = bodyContent.replace(
    `<a href="#brand">Шоурум</a>\n  <a href="#footer">Контакты</a>`,
    `<a href="/catalog">Каталог</a>\n  <a href="#footer">Контакты</a>`
  );

  // Update "Каталог" button in header to link to /catalog
  bodyContent = bodyContent.replace(
    `<button class="catalog-btn"><span>Каталог</span></button>`,
    `<a href="/catalog" class="catalog-btn"><span>Каталог</span></a>`
  );

  // Add auth link to header (before grid-btn)
  const authLink = user
    ? `<a href="/cabinet" class="catalog-btn" style="margin-right:4px"><span>${user.fullName}</span></a>`
    : `<a href="/auth/login" class="catalog-btn" style="margin-right:4px"><span>Войти</span></a>`;

  bodyContent = bodyContent.replace(
    `<button class="grid-btn"`,
    `${authLink}\n      <button class="grid-btn"`
  );

  // Update hero CTA buttons
  bodyContent = bodyContent.replace(
    `<a href="#collections" class="btn btn-light">Смотреть коллекции`,
    `<a href="/catalog" class="btn btn-light">Смотреть коллекции`
  );

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      <div dangerouslySetInnerHTML={{ __html: bodyContent }} suppressHydrationWarning />
      <script dangerouslySetInnerHTML={{ __html: script }} />
    </>
  );
}

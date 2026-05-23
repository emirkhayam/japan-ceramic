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

  let bodyContent = bodyMatch?.[1] || "";
  const styles = styleMatch?.[1] || "";

  // Fix video path
  bodyContent = bodyContent.replace(
    'src="kling_20260522_作品_Ultra_cine_2396_0.mp4"',
    'src="/hero-video.mp4"'
  );

  // Navigation is already updated in the HTML file - no need to replace

  // Update AI visualization links to go to /visualize page
  bodyContent = bodyContent.replace(
    /<a href="#ai">/g,
    '<a href="/visualize">'
  );
  bodyContent = bodyContent.replace(
    '<a href="#" class="btn btn-light reveal" data-d="3">Попробовать AI-визуализацию',
    '<a href="/visualize" class="btn btn-light reveal" data-d="3">Попробовать AI-визуализацию'
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
    </>
  );
}

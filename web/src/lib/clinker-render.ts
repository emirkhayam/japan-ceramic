/**
 * Детерминированный рендер кладки клинкера на фото (только браузер, canvas).
 *
 * Почему не чистый ИИ: генеративная модель не соблюдает ни точный размер плитки,
 * ни её форму/текстуру — «перерисовывает по мотивам». Здесь мы берём НАСТОЯЩЕЕ фото
 * плитки и раскладываем его ровной сеткой строго нужного размера (число плиток
 * считается из реальных размеров плитки и участка, а не угадывается).
 *
 * Полировка под фотореализм: фаска кирпича (свет сверху-слева, тень снизу-справа),
 * перенос освещённости подложки (multiply), мягкая растушёвка края зоны.
 *
 * Перспективный режим (renderClinkerPerspective): по 4 углам плоскости стены/пола и
 * её реальным размерам строится гомография, плитка раскладывается в реальных метрах и
 * «сгибается» в перспективу фото — плитка сама мельчает вдали. Это и есть основной режим.
 */
import { computeHomography, applyHomography, type Pt } from './homography';

const DEFAULT_GROUT_COLOR = '#8d8b83';

export type FlatParams = {
  photo: CanvasImageSource;
  photoW: number;
  photoH: number;
  tile: CanvasImageSource;
  tileImgW: number;
  tileImgH: number;
  mask: CanvasImageSource;
  maskBBox: { minX: number; minY: number; maxX: number; maxY: number };
  /** Ширина одного кирпича в пикселях фото. */
  brickPxWidth: number;
  /** Высота кирпича в пикселях (если задана отдельно — для разного масштаба X/Y). */
  brickPxHeight?: number;
  /** Реальные размеры клинкера, мм — для пропорции и шва. */
  tileWmm: number;
  tileHmm: number;
  groutMm?: number;
  runningBond?: boolean;
  groutColor?: string;
  lighting?: boolean;
  /** Полировка: фаска/объём кирпича. */
  bevel?: boolean;
  maxBricks?: number;
};

export function renderClinkerFlat(p: FlatParams): HTMLCanvasElement {
  const groutColor = p.groutColor ?? DEFAULT_GROUT_COLOR;
  const runningBond = p.runningBond ?? true;
  const maxBricks = p.maxBricks ?? 12000;
  const groutMm = p.groutMm ?? 10;
  const bevel = p.bevel ?? true;

  const bw = Math.max(4, p.brickPxWidth);
  const bh = Math.max(2, p.brickPxHeight ?? bw * (p.tileHmm / p.tileWmm));
  // Шов в пикселях считаем отдельно по X и Y (масштаб осей может отличаться).
  const gpxX = bw * (groutMm / p.tileWmm);
  const gpxY = bh * (groutMm / p.tileHmm);
  const stepX = bw + gpxX;
  const stepY = bh + gpxY;

  // Обрезаем картинку до самого кирпича (убираем прозрачные/белые поля),
  // иначе кирпич занимает лишь центр ячейки и вокруг светит шов.
  const crop = contentBBox(p.tile, p.tileImgW, p.tileImgH);

  const bb = p.maskBBox;
  const tiles = document.createElement('canvas');
  tiles.width = p.photoW;
  tiles.height = p.photoH;
  const t = tiles.getContext('2d')!;

  // Шов под кирпич: заливаем всю зону (+запас), потом кладём кирпичи с зазорами.
  t.fillStyle = groutColor;
  t.fillRect(bb.minX - stepX, bb.minY - stepY, bb.maxX - bb.minX + 2 * stepX, bb.maxY - bb.minY + 2 * stepY);

  const col0 = Math.floor(bb.minX / stepX) - 1;
  const col1 = Math.ceil(bb.maxX / stepX) + 1;
  const row0 = Math.floor(bb.minY / stepY) - 1;
  const row1 = Math.ceil(bb.maxY / stepY) + 1;
  if ((col1 - col0) * (row1 - row0) > maxBricks) {
    return toCanvas(p.photo, p.photoW, p.photoH);
  }

  // Толщина фаски — доля высоты кирпича, но не больше разумного.
  const bevelPx = bevel ? Math.max(0.6, Math.min(2.2, bh * 0.08)) : 0;

  for (let row = row0; row <= row1; row++) {
    const off = runningBond && (((row % 2) + 2) % 2 === 1) ? stepX / 2 : 0;
    const y = row * stepY;
    for (let col = col0; col <= col1; col++) {
      const x = col * stepX + off;
      // +0.5px перекрытие, чтобы между кирпичами не мигал фон.
      t.drawImage(p.tile, crop.sx, crop.sy, crop.sw, crop.sh, x, y, bw + 0.5, bh + 0.5);
      if (bevelPx > 0) drawBevel(t, x, y, bw, bh, bevelPx);
    }
  }

  const alpha = maskToAlpha(p.mask, p.photoW, p.photoH, 2);
  return finishComposite(p.photo, p.photoW, p.photoH, tiles, alpha, p.lighting ?? true);
}

// ---------- Перспективный режим (гомография) ----------
export type PerspectiveParams = {
  photo: CanvasImageSource;
  photoW: number;
  photoH: number;
  tile: CanvasImageSource;
  tileImgW: number;
  tileImgH: number;
  /** 4 угла плоскости в пикселях фото, порядок TL, TR, BR, BL. */
  corners: Pt[];
  /** Реальные размеры плоскости, м. */
  planeWmeters: number;
  planeHmeters: number;
  tileWmm: number;
  tileHmm: number;
  /** Маска видимости (белое=показать). Если не задана — генерим из проекции плоскости. */
  mask?: CanvasImageSource;
  groutMm?: number;
  runningBond?: boolean;
  groutColor?: string;
  lighting?: boolean;
  maxBricks?: number;
};

export function renderClinkerPerspective(p: PerspectiveParams): HTMLCanvasElement {
  const groutMm = p.groutMm ?? 10;
  const runningBond = p.runningBond ?? true;
  const groutColor = p.groutColor ?? DEFAULT_GROUT_COLOR;
  const maxBricks = p.maxBricks ?? 12000;

  // Прямоугольник плоскости в реальных метрах → углы в пикселях фото.
  const planeRect: Pt[] = [
    { x: 0, y: 0 },
    { x: p.planeWmeters, y: 0 },
    { x: p.planeWmeters, y: p.planeHmeters },
    { x: 0, y: p.planeHmeters },
  ];
  const Hplane2img = computeHomography(planeRect, p.corners);

  // Bbox углов — для fallback и для построения маски при отсутствии кисти.
  const bb = cornersBBox(p.corners, p.photoW, p.photoH);

  // Вырожденная геометрия → плоский режим по bbox углов (гарантируем результат).
  if (!Hplane2img) {
    const maskSrc = p.mask ?? quadMaskCanvas(p.corners, p.photoW, p.photoH);
    const bboxW = bb.maxX - bb.minX;
    return renderClinkerFlat({
      photo: p.photo, photoW: p.photoW, photoH: p.photoH,
      tile: p.tile, tileImgW: p.tileImgW, tileImgH: p.tileImgH,
      mask: maskSrc, maskBBox: bb,
      brickPxWidth: (p.tileWmm / 1000) * (bboxW / Math.max(0.1, p.planeWmeters)),
      tileWmm: p.tileWmm, tileHmm: p.tileHmm,
      groutMm, runningBond, groutColor, lighting: p.lighting ?? true,
    });
  }

  const tileWm = p.tileWmm / 1000;
  const tileHm = p.tileHmm / 1000;
  const groutM = groutMm / 1000;
  const stepX = tileWm + groutM;
  const stepY = tileHm + groutM;

  const cols = Math.ceil(p.planeWmeters / stepX) + 1;
  const rows = Math.ceil(p.planeHmeters / stepY) + 1;
  if (cols * rows > maxBricks || cols < 1 || rows < 1) {
    return toCanvas(p.photo, p.photoW, p.photoH);
  }

  const crop = contentBBox(p.tile, p.tileImgW, p.tileImgH);

  const tiles = document.createElement('canvas');
  tiles.width = p.photoW;
  tiles.height = p.photoH;
  const tctx = tiles.getContext('2d')!;

  // Заливка шва — проекция четырёхугольника плоскости (с запасом).
  tctx.fillStyle = groutColor;
  fillQuad(tctx, [
    applyHomography(Hplane2img, { x: -stepX, y: -stepY }),
    applyHomography(Hplane2img, { x: p.planeWmeters + stepX, y: -stepY }),
    applyHomography(Hplane2img, { x: p.planeWmeters + stepX, y: p.planeHmeters + stepY }),
    applyHomography(Hplane2img, { x: -stepX, y: p.planeHmeters + stepY }),
  ]);

  // Раскладка плитки в метрах → варп каждой в перспективу.
  for (let row = 0; row < rows; row++) {
    const offset = runningBond && row % 2 === 1 ? stepX / 2 : 0;
    const y0 = row * stepY;
    const y1 = y0 + tileHm;
    for (let col = -1; col < cols; col++) {
      const x0 = col * stepX + offset;
      const x1 = x0 + tileWm;
      const quad = [
        applyHomography(Hplane2img, { x: x0, y: y0 }),
        applyHomography(Hplane2img, { x: x1, y: y0 }),
        applyHomography(Hplane2img, { x: x1, y: y1 }),
        applyHomography(Hplane2img, { x: x0, y: y1 }),
      ];
      drawImageQuad(tctx, p.tile, crop, quad);
    }
  }

  const maskSrc = p.mask ?? quadMaskCanvas(p.corners, p.photoW, p.photoH);
  const alpha = maskToAlpha(maskSrc, p.photoW, p.photoH, 2);
  return finishComposite(p.photo, p.photoW, p.photoH, tiles, alpha, p.lighting ?? true);
}

// ---------- Control-image для ControlNet ----------
// Рисует БЕЛЫЕ линии грунта на чёрном по той же сетке, что и раскладка. Подаётся в
// ControlNet (canny) — точный «замок» геометрии, чище, чем canny по шумному композиту.
export function renderGridMap(p: PerspectiveParams): HTMLCanvasElement {
  const groutMm = p.groutMm ?? 10;
  const runningBond = p.runningBond ?? true;
  const planeRect: Pt[] = [
    { x: 0, y: 0 },
    { x: p.planeWmeters, y: 0 },
    { x: p.planeWmeters, y: p.planeHmeters },
    { x: 0, y: p.planeHmeters },
  ];
  const H = computeHomography(planeRect, p.corners);
  const c = document.createElement('canvas');
  c.width = p.photoW;
  c.height = p.photoH;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, p.photoW, p.photoH);
  if (!H) return c;

  const stepX = (p.tileWmm + groutMm) / 1000;
  const stepY = (p.tileHmm + groutMm) / 1000;
  const cols = Math.ceil(p.planeWmeters / stepX) + 1;
  const rows = Math.ceil(p.planeHmeters / stepY) + 1;
  if (cols * rows > 40000) return c; // защита от перебора линий

  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  for (let row = 0; row < rows; row++) {
    const offset = runningBond && row % 2 === 1 ? stepX / 2 : 0;
    const y0 = row * stepY;
    const y1 = y0 + p.tileHmm / 1000;
    for (let col = -1; col < cols; col++) {
      const x0 = col * stepX + offset;
      const x1 = x0 + p.tileWmm / 1000;
      const q = [
        applyHomography(H, { x: x0, y: y0 }),
        applyHomography(H, { x: x1, y: y0 }),
        applyHomography(H, { x: x1, y: y1 }),
        applyHomography(H, { x: x0, y: y1 }),
      ];
      ctx.beginPath();
      ctx.moveTo(q[0].x, q[0].y);
      for (let i = 1; i < 4; i++) ctx.lineTo(q[i].x, q[i].y);
      ctx.closePath();
      ctx.stroke();
    }
  }
  return c;
}

// Bbox 4 углов, зажатый в кадр.
function cornersBBox(corners: Pt[], w: number, h: number) {
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  return {
    minX: Math.max(0, Math.min(...xs)),
    minY: Math.max(0, Math.min(...ys)),
    maxX: Math.min(w, Math.max(...xs)),
    maxY: Math.min(h, Math.max(...ys)),
  };
}

// Маска «белое по чёрному» из проекции плоскости (для пол/стена без кисти).
function quadMaskCanvas(corners: Pt[], w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#fff';
  fillQuad(ctx, corners);
  return c;
}

function fillQuad(ctx: CanvasRenderingContext2D, q: Pt[]) {
  ctx.beginPath();
  ctx.moveTo(q[0].x, q[0].y);
  for (let i = 1; i < q.length; i++) ctx.lineTo(q[i].x, q[i].y);
  ctx.closePath();
  ctx.fill();
}

/** Рисует обрезанную картинку в произвольный четырёхугольник через 2 аффинных треугольника. */
function drawImageQuad(ctx: CanvasRenderingContext2D, img: CanvasImageSource, crop: Crop, d: Pt[]) {
  const s: Pt[] = [
    { x: crop.sx, y: crop.sy },
    { x: crop.sx + crop.sw, y: crop.sy },
    { x: crop.sx + crop.sw, y: crop.sy + crop.sh },
    { x: crop.sx, y: crop.sy + crop.sh },
  ];
  drawImageTriangle(ctx, img, s[0], s[1], s[2], d[0], d[1], d[2]);
  drawImageTriangle(ctx, img, s[0], s[2], s[3], d[0], d[2], d[3]);
}

function drawImageTriangle(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  s0: Pt, s1: Pt, s2: Pt,
  d0: Pt, d1: Pt, d2: Pt,
) {
  ctx.save();
  // Чуть расширяем треугольник от центроида — против хайрлайн-швов между кирпичами.
  const cx = (d0.x + d1.x + d2.x) / 3;
  const cy = (d0.y + d1.y + d2.y) / 3;
  const grow = (p: Pt): Pt => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const len = Math.hypot(dx, dy) || 1;
    return { x: p.x + (dx / len) * 0.5, y: p.y + (dy / len) * 0.5 };
  };
  const g0 = grow(d0), g1 = grow(d1), g2 = grow(d2);

  ctx.beginPath();
  ctx.moveTo(g0.x, g0.y);
  ctx.lineTo(g1.x, g1.y);
  ctx.lineTo(g2.x, g2.y);
  ctx.closePath();
  ctx.clip();

  const denom = s0.x * (s2.y - s1.y) - s1.x * s2.y + s2.x * s1.y + (s1.x - s2.x) * s0.y;
  if (Math.abs(denom) < 1e-9) {
    ctx.restore();
    return;
  }
  const a = (d0.x * (s2.y - s1.y) - d1.x * s2.y + d2.x * s1.y + (d1.x - d2.x) * s0.y) / denom;
  const b = (d0.y * (s2.y - s1.y) - d1.y * s2.y + d2.y * s1.y + (d1.y - d2.y) * s0.y) / denom;
  const c = (s0.x * (d2.x - d1.x) - s1.x * d2.x + s2.x * d1.x + (s1.x - s2.x) * d0.x) / denom;
  const dd = (s0.x * (d2.y - d1.y) - s1.x * d2.y + s2.x * d1.y + (s1.x - s2.x) * d0.y) / denom;
  const e =
    (s0.x * (s2.y * d1.x - s1.y * d2.x) +
      s0.y * (s1.x * d2.x - s2.x * d1.x) +
      (s2.x * s1.y - s1.x * s2.y) * d0.x) / denom;
  const f =
    (s0.x * (s2.y * d1.y - s1.y * d2.y) +
      s0.y * (s1.x * d2.y - s2.x * d1.y) +
      (s2.x * s1.y - s1.x * s2.y) * d0.y) / denom;

  ctx.setTransform(a, b, c, dd, e, f);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

// Объём кирпича: светлая кромка сверху-слева, тёмная снизу-справа.
function drawBevel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t: number) {
  ctx.save();
  // Свет сверху-слева
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = t;
  ctx.beginPath();
  ctx.moveTo(x + t / 2, y + h - t / 2);
  ctx.lineTo(x + t / 2, y + t / 2);
  ctx.lineTo(x + w - t / 2, y + t / 2);
  ctx.stroke();
  // Тень снизу-справа
  ctx.strokeStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.moveTo(x + w - t / 2, y + t / 2);
  ctx.lineTo(x + w - t / 2, y + h - t / 2);
  ctx.lineTo(x + t / 2, y + h - t / 2);
  ctx.stroke();
  ctx.restore();
}

// ---------- Общие шаги ----------

// Делает из маски «белое-на-чёрном» альфа-маску (белое=непрозрачно, чёрное=прозрачно)
// с лёгкой растушёвкой края. destination-in затем убирает всё прозрачное.
function maskToAlpha(
  mask: CanvasImageSource,
  w: number,
  h: number,
  featherPx: number,
): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(mask, 0, 0, w, h);
  const id = ctx.getImageData(0, 0, w, h);
  const d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i]; // яркость белого штриха
    d[i] = 255;
    d[i + 1] = 255;
    d[i + 2] = 255;
    d[i + 3] = a;
  }
  ctx.putImageData(id, 0, 0);
  if (featherPx > 0) {
    const c2 = document.createElement('canvas');
    c2.width = w;
    c2.height = h;
    const x2 = c2.getContext('2d')!;
    x2.filter = `blur(${featherPx}px)`;
    x2.drawImage(c, 0, 0);
    return c2;
  }
  return c;
}

// Переносит освещённость подложки на кладку, обрезает по альфа-маске и кладёт на фото.
function finishComposite(
  photo: CanvasImageSource,
  w: number,
  h: number,
  tiles: HTMLCanvasElement,
  maskAlpha: HTMLCanvasElement,
  lighting: boolean,
): HTMLCanvasElement {
  const tctx = tiles.getContext('2d')!;

  if (lighting) {
    // Размытая полусветлая копия фото → multiply → на кладку ложатся тени/свет стены.
    const lum = document.createElement('canvas');
    lum.width = w;
    lum.height = h;
    const lc = lum.getContext('2d')!;
    lc.filter = 'grayscale(1) blur(6px)';
    lc.drawImage(photo, 0, 0, w, h);
    lc.filter = 'none';
    // Поднимаем яркость к белому, чтобы multiply давал только мягкие тени, а не темнил всё.
    lc.globalCompositeOperation = 'source-over';
    lc.fillStyle = 'rgba(255,255,255,0.55)';
    lc.fillRect(0, 0, w, h);

    tctx.save();
    tctx.globalCompositeOperation = 'multiply';
    tctx.drawImage(lum, 0, 0);
    tctx.restore();
  }

  // Обрезка строго по зоне.
  tctx.save();
  tctx.setTransform(1, 0, 0, 1, 0, 0);
  tctx.globalCompositeOperation = 'destination-in';
  tctx.drawImage(maskAlpha, 0, 0);
  tctx.restore();

  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const o = out.getContext('2d')!;
  o.drawImage(photo, 0, 0, w, h);
  o.drawImage(tiles, 0, 0);
  return out;
}

export type Crop = { sx: number; sy: number; sw: number; sh: number };

// Находит прямоугольник с самим кирпичом (без прозрачных/белых полей).
// Если поля не обнаружены — возвращает всю картинку.
function contentBBox(img: CanvasImageSource, w: number, h: number): Crop {
  const full: Crop = { sx: 0, sy: 0, sw: w, sh: h };
  if (!w || !h) return full;
  try {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    // Есть ли реальная прозрачность?
    let hasAlpha = false;
    for (let i = 3; i < data.length; i += 4 * 50) {
      if (data[i] < 250) { hasAlpha = true; break; }
    }
    let minX = w, minY = h, maxX = -1, maxY = -1;
    const step = 2;
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const i = (y * w + x) * 4;
        const content = hasAlpha
          ? data[i + 3] > 24
          : !(data[i] > 243 && data[i + 1] > 243 && data[i + 2] > 243);
        if (content) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0 || maxX - minX < 4 || maxY - minY < 4) return full;
    // Небольшой внутренний отступ, чтобы не зацепить полупрозрачную кромку.
    const padX = (maxX - minX) * 0.01;
    const padY = (maxY - minY) * 0.01;
    return {
      sx: minX + padX,
      sy: minY + padY,
      sw: maxX - minX - 2 * padX,
      sh: maxY - minY - 2 * padY,
    };
  } catch {
    return full;
  }
}

function toCanvas(img: CanvasImageSource, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d')!.drawImage(img, 0, 0, w, h);
  return c;
}

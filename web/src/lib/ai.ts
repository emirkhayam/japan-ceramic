/**
 * AI-ядро визуализатора. Живые генерации выполняются только через
 * fal-ai/nano-banana-pro/edit; mock оставлен для локальной разработки без FAL_KEY.
 */
import { fal } from '@fal-ai/client';

export type Provider = 'fal' | 'mock';
export type Surface = 'floor' | 'wall' | 'mask' | 'facade';
export type Pattern = 'stack' | 'offset-half' | 'offset-third' | 'herringbone';
export type Orientation = 'horizontal' | 'vertical';
export type Grout = 'match' | 'contrast' | 'minimal';
export type FacadeZone =
  | 'full'
  | 'between-windows'
  | 'around-windows'
  | 'corners'
  | 'plinth'
  | 'columns';
export type FacadeBaseColor = 'white' | 'beige' | 'grey';

export type VisualizeInput = {
  roomImageUrl: string;
  tileImageUrls: string[];
  tileName: string;
  surface: Surface;
  /** PNG-маска: белое = зона замены, чёрное = сохранить. */
  maskImageUrl?: string;
  /** Жёсткий физический масштаб для измеренной поверхности. */
  scale?: { tilesAcross: number; tilesDown?: number; tileWmm: number; tileHmm: number };
  /** Реальная площадь пола из UX линии A — для жёсткой оценки общего числа плиток. */
  floorAreaM2?: number;
  /** Реальные габариты одной плитки без толщины. */
  tileDims?: { wmm: number; hmm: number };
  pattern: Pattern;
  orientation: Orientation;
  grout: Grout;
  zones?: FacadeZone[];
  baseColor?: FacadeBaseColor;
  note?: string;
  provider?: Provider;
};

export type TokenUsage = {
  promptTokens: number;
  outputTokens: number;
  totalTokens: number;
};

type ProviderOutput = { imageUrl: string; usage?: TokenUsage };

export type VisualizeResult = {
  imageUrl: string;
  durationMs: number;
  provider: Provider;
  usage?: TokenUsage;
};

const RENDER_ENDPOINT = 'fal-ai/nano-banana-pro/edit';
export const RENDER_PROVIDER_LABEL = 'nano-banana-pro-edit';

const PATTERN_INSTRUCTION: Record<Pattern, string> = {
  stack: 'straight stacked rows with every joint aligned and no row offset',
  'offset-half': 'running bond with each row offset by exactly one-half of a tile',
  'offset-third': 'running bond with each row offset by exactly one-third of a tile',
  herringbone: 'a true herringbone layout',
};

const ORIENTATION_INSTRUCTION: Record<Orientation, string> = {
  horizontal: 'the long side of each tile runs horizontally and the rows run horizontally',
  vertical: 'the long side of each tile runs vertically and the rows run vertically',
};

const GROUT_INSTRUCTION: Record<Grout, string> = {
  match: 'use grout matching the tile tone, with thin seams',
  contrast: 'use a contrasting grout color that clearly emphasizes each tile',
  minimal: 'use minimal, nearly invisible seams',
};

// Реальные размеры и словесная фиксация пропорции не дают модели превращать
// длинный клинкер в квадрат. Ориентация при этом задаётся отдельным layout-правилом.
function tileShapeRule(wmm: number, hmm: number): string {
  if (!(wmm > 0) || !(hmm > 0)) return '';
  const ratio = (wmm / hmm).toFixed(2);
  const longer = wmm >= hmm ? 'wide (landscape)' : 'tall (portrait)';
  return `Each individual tile is a rectangle of EXACTLY ${wmm}×${hmm} mm (width×height), aspect ratio ${ratio}:1 — a ${longer} tile, NOT a square. Keep every tile this exact shape and proportion; never round it toward a square. Its placement orientation is controlled only by the LAYOUT instruction.`;
}

function pickProvider(requested?: Provider): Provider {
  if (requested === 'fal' || requested === 'mock') return requested;
  const fromEnv = process.env.AI_PROVIDER;
  if (fromEnv === 'fal' || fromEnv === 'mock') return fromEnv;
  return process.env.FAL_KEY ? 'fal' : 'mock';
}

function buildPrompt(input: VisualizeInput): string {
  const tileReferenceEnd = input.tileImageUrls.length + 1;
  const shapeRule = input.tileDims
    ? tileShapeRule(input.tileDims.wmm, input.tileDims.hmm)
    : '';
  const dimensions = input.tileDims
    ? `${input.tileDims.wmm}×${input.tileDims.hmm} mm`
    : null;
  const additionalInstruction = input.note
    ? `\n\nAdditional user instruction (higher priority): ${JSON.stringify(input.note)}.`
    : '';
  const surfaceWord =
    input.surface === 'floor'
      ? 'floor'
      : input.surface === 'mask'
        ? 'surface selected by the white mask'
        : input.surface === 'facade'
          ? 'facade'
          : 'one main wall';
  const tileCharacterInstruction = `TILE CHARACTER — STRICT ACCURACY:
- Faithfully reproduce the exact color palette, texture, geometry, material character, surface relief and visual identity of the tile shown in IMAGES 2..${tileReferenceEnd}.
- NEVER substitute a different or generic tile.
- Fully remove the ORIGINAL ${input.surface === 'facade' ? 'surface material in every area being clad' : `${surfaceWord} material`}; do not keep, blend with or echo its pattern.
${shapeRule ? `- ${shapeRule}` : ''}`.trim();
  const naturalVariationInstruction = `NATURAL VARIATION — FREE:
- Real ceramic and clinker tiles vary naturally in tone, shade and relief between individual tiles. Mix the provided reference variations naturally across the surface.
- No two adjacent tiles should look perfectly identical. Avoid all visible repetition and cloning artifacts while preserving the tile product's exact character.`;
  const layoutInstruction = `LAYOUT — STRICT:
- Pattern: ${PATTERN_INSTRUCTION[input.pattern]}.
- Orientation: ${ORIENTATION_INSTRUCTION[input.orientation]}.
- Grout: ${GROUT_INSTRUCTION[input.grout]}.`;
  const realWorldScaleInstruction = (scaleTarget: 'room' | 'building') => `REAL-WORLD SCALE — STRICT:
${dimensions
  ? `- Each tile is exactly ${dimensions} in real life. Render every tile at the correct real-world scale relative to the ${scaleTarget}; do not enlarge it.`
  : `- Render the tiles at a believable real-world scale relative to the ${scaleTarget}; do not enlarge them.`}`;
  const physicalCountInstruction = buildPhysicalCountInstruction(input, surfaceWord);

  if (input.surface === 'facade') {
    return buildFacadePrompt({
      input,
      tileReferenceEnd,
      tileCharacterInstruction,
      naturalVariationInstruction,
      layoutInstruction,
      realWorldScaleInstruction: realWorldScaleInstruction('building'),
      physicalCountInstruction,
      additionalInstruction,
    });
  }

  const maskInstruction =
    input.surface === 'mask'
      ? `\nMASK — ABSOLUTE:
- IMAGE LAST is a black-and-white mask — apply the tile ONLY where the mask is white, keep everything else untouched.
- The mask has exactly the same size and framing as IMAGE 1. Preserve every black-masked pixel, including windows, doors, objects, sky, lighting and camera framing.`
      : '';

  return `You are a photorealistic interior and architectural surface visualization engine.

REFERENCE IMAGES:
- IMAGE 1 is a photo of a real room or building.
- IMAGES 2..${tileReferenceEnd} are reference variations of ONE AND THE SAME tile product ${JSON.stringify(input.tileName)}. They show its natural differences in tone, shade, surface relief and texture; they are not different products.${input.surface === 'mask' ? '\n- IMAGE LAST is the black-and-white placement mask.' : ''}

TASK:
Completely re-surface the ${surfaceWord} in IMAGE 1 with this tile, fully replacing the existing covering.

${tileCharacterInstruction}

${naturalVariationInstruction}

${layoutInstruction}
- Lay the tiles in correct perspective for the ${surfaceWord}; all seams must follow the scene's vanishing lines.

${realWorldScaleInstruction('room')}
${physicalCountInstruction}
${maskInstruction}

SCENE INTEGRITY — STRICT:
- Preserve the original photo's lighting, shadows and reflections so the new surface sits naturally.
- Keep EVERYTHING else identical: walls, ceiling, furniture, windows, doors, decor and camera framing. Change only the ${surfaceWord}.
- Output only the final edited photo, nothing else.${additionalInstruction}`;
}

function buildFacadePrompt({
  input,
  tileReferenceEnd,
  tileCharacterInstruction,
  naturalVariationInstruction,
  layoutInstruction,
  realWorldScaleInstruction,
  physicalCountInstruction,
  additionalInstruction,
}: {
  input: VisualizeInput;
  tileReferenceEnd: number;
  tileCharacterInstruction: string;
  naturalVariationInstruction: string;
  layoutInstruction: string;
  realWorldScaleInstruction: string;
  physicalCountInstruction: string;
  additionalInstruction: string;
}): string {
  const requestedZones: FacadeZone[] = [
    ...new Set(input.zones?.length ? input.zones : ['full' as FacadeZone]),
  ];
  const zones: FacadeZone[] = requestedZones.includes('full') ? ['full'] : requestedZones;
  const baseColor = input.baseColor ?? 'white';
  const plasterInstruction: Record<FacadeBaseColor, string> = {
    white: 'clean white plaster',
    beige: 'warm light beige plaster',
    grey: 'light grey plaster',
  };
  const zoneInstruction: Record<Exclude<FacadeZone, 'full'>, string> = {
    'between-windows': 'vertical strips between the windows, from foundation to roof',
    'around-windows': 'framing around windows and the entrance',
    corners: 'the building corners',
    plinth: 'the plinth/base along the bottom',
    columns: 'columns and entrance pillars, clad full height to the roof',
  };
  const facadeTreatment = zones.includes('full')
    ? '- Clad all facade walls entirely with the clinker tile.'
    : `- Finish the main facade walls with smooth decorative plaster in this finish: ${plasterInstruction[baseColor]}.
- Apply clinker ONLY to the following selected zones, and nowhere else:
${zones
  .map((zone) => `  - ${zoneInstruction[zone as Exclude<FacadeZone, 'full'>]}.`)
  .join('\n')}`;

  return `You are a photorealistic exterior facade visualization engine.

REFERENCE IMAGES:
- IMAGE 1 is a photo of a real house. It may be unfinished, with bare brick, block or concrete walls.
- IMAGES 2..${tileReferenceEnd} are reference variations of ONE AND THE SAME clinker tile product ${JSON.stringify(input.tileName)}. They show its natural differences in tone, shade, surface relief and texture; they are not different products.

TASK:
Photorealistically clad this house's facade with the clinker tile from IMAGES 2..${tileReferenceEnd}.
${facadeTreatment}

${tileCharacterInstruction}

${naturalVariationInstruction}

${layoutInstruction}
- Lay the tiles in correct perspective on every treated facade plane; all seams must follow the building's perspective and geometry.

${realWorldScaleInstruction}
${physicalCountInstruction}

SCENE INTEGRITY — STRICT:
- Preserve the building's exact geometry, proportions and architectural details.
- Keep the roof, windows, doors, yard/site, sky and original lighting identical.
- Preserve natural shadows and reflections so the new facade finishes sit naturally in the photo.
- Do not change the camera angle or framing. Do NOT zoom in or crop: the output must show the exact same field of view as IMAGE 1, with the entire building visible exactly as in the original photo, at the same aspect ratio.
- Output only the final edited photo, nothing else.${additionalInstruction}`;
}

function buildPhysicalCountInstruction(
  input: VisualizeInput,
  surfaceWord: string,
): string {
  if (input.scale) {
    const rowsClause = input.scale.tilesDown
      ? ` × ${input.scale.tilesDown} rows`
      : '';
    return `PHYSICAL TILE COUNT — HIGHEST PRIORITY:
- The measured ${surfaceWord} is about ${input.scale.tilesAcross} tiles across${input.scale.tilesDown ? ` and ${input.scale.tilesDown} rows down` : ''}. Lay exactly about ${input.scale.tilesAcross} tile columns${rowsClause}.
- One real tile is ${input.scale.tileWmm}×${input.scale.tileHmm} mm. Do not zoom it to look decorative; obey this physical count even when it creates many small tiles.`;
  }
  if (input.surface === 'floor' && input.floorAreaM2 && input.tileDims) {
    const tileAreaM2 =
      (input.tileDims.wmm / 1000) * (input.tileDims.hmm / 1000);
    const totalTiles = Math.max(1, Math.round(input.floorAreaM2 / tileAreaM2));
    return `PHYSICAL TILE COUNT — HIGHEST PRIORITY:
- The real floor area is ${input.floorAreaM2} m² and one tile covers ${tileAreaM2.toFixed(4)} m². Lay approximately ${totalTiles} tiles in total so the scale is physically correct.`;
  }
  return '';
}

async function toDataUri(url: string): Promise<string> {
  if (url.startsWith('data:')) return url;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) {
    throw new Error(`Не удалось загрузить изображение (HTTP ${res.status}): ${url}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const mime = res.headers.get('content-type') || 'image/jpeg';
  return `data:${mime};base64,${buf.toString('base64')}`;
}

// Пиксельные размеры изображения из data URI (PNG IHDR / JPEG SOF) — без внешних библиотек.
function imageDimsFromDataUri(dataUri: string): { w: number; h: number } | null {
  const match = dataUri.match(/^data:[^;]+;base64,(.+)$/);
  if (!match) return null;
  // Заголовков хватает в первых килобайтах — не декодируем весь файл.
  const buf = Buffer.from(match[1].slice(0, 262144), 'base64');
  // PNG: сигнатура + IHDR (ширина/высота в байтах 16..24)
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50) {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }
  // JPEG: ищем SOF0..SOF15 (кроме DHT/DAC/RST) маркеры
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let off = 2;
    while (off + 9 < buf.length) {
      if (buf[off] !== 0xff) { off++; continue; }
      const marker = buf[off + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { w: buf.readUInt16BE(off + 7), h: buf.readUInt16BE(off + 5) };
      }
      const len = buf.readUInt16BE(off + 2);
      if (len < 2) break;
      off += 2 + len;
    }
  }
  return null;
}

// Ближайший к фото аспект из enum'а nano-banana-pro — жёстко фиксирует кадр результата,
// чтобы модель не уезжала в квадрат/коллаж при нестандартных пропорциях входа.
type FalAspect = '21:9' | '16:9' | '3:2' | '4:3' | '5:4' | '1:1' | '4:5' | '3:4' | '2:3' | '9:16';

const FAL_ASPECTS: { id: FalAspect; ratio: number }[] = [
  { id: '21:9', ratio: 21 / 9 },
  { id: '16:9', ratio: 16 / 9 },
  { id: '3:2', ratio: 3 / 2 },
  { id: '4:3', ratio: 4 / 3 },
  { id: '5:4', ratio: 5 / 4 },
  { id: '1:1', ratio: 1 },
  { id: '4:5', ratio: 4 / 5 },
  { id: '3:4', ratio: 3 / 4 },
  { id: '2:3', ratio: 2 / 3 },
  { id: '9:16', ratio: 9 / 16 },
];

function closestFalAspect(w: number, h: number): FalAspect {
  const r = w / h;
  let best = FAL_ASPECTS[0];
  for (const a of FAL_ASPECTS) {
    if (Math.abs(a.ratio - r) < Math.abs(best.ratio - r)) best = a;
  }
  return best.id;
}

async function buildFalInput(input: VisualizeInput): Promise<{
  prompt: string;
  image_urls: string[];
  aspect_ratio?: FalAspect;
}> {
  if (input.tileImageUrls.length === 0) {
    throw new Error('Не передано ни одного изображения плитки');
  }
  if (input.surface === 'mask' && !input.maskImageUrl) {
    throw new Error('Для режима кисти обязательна маска');
  }
  const urls = [
    input.roomImageUrl,
    ...input.tileImageUrls,
    ...(input.surface === 'mask' && input.maskImageUrl ? [input.maskImageUrl] : []),
  ];
  // fal не скачивает localhost/приватные URL — инлайним фото, все референсы и маску.
  const imageUris = await Promise.all(urls.map(toDataUri));
  const roomDims = imageDimsFromDataUri(imageUris[0]);
  return {
    prompt: buildPrompt(input),
    image_urls: imageUris,
    ...(roomDims ? { aspect_ratio: closestFalAspect(roomDims.w, roomDims.h) } : {}),
  };
}

export async function visualize(input: VisualizeInput): Promise<VisualizeResult> {
  const provider = pickProvider(input.provider);
  const started = Date.now();
  try {
    const out = provider === 'fal' ? await viaFal(input) : await viaMock(input);
    return {
      imageUrl: out.imageUrl,
      durationMs: Date.now() - started,
      provider,
      usage: out.usage,
    };
  } catch (err) {
    throw new Error(`[${provider}] ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function viaFal(input: VisualizeInput): Promise<ProviderOutput> {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error('FAL_KEY не задан в .env.local');
  fal.config({ credentials: key });

  const result = await fal.subscribe(RENDER_ENDPOINT, {
    input: await buildFalInput(input),
    logs: false,
  });
  const url = result.data.images[0]?.url;
  if (!url) throw new Error('Ответ fal.ai без URL картинки');
  return { imageUrl: url };
}

async function viaMock(input: VisualizeInput): Promise<ProviderOutput> {
  await new Promise((resolve) => setTimeout(resolve, 1500 + Math.random() * 1500));
  return { imageUrl: input.tileImageUrls[0] ?? input.roomImageUrl };
}

// Асинхронная очередь использует тот же buildFalInput, что и синхронный visualize().
export async function submitGptImageJob(
  input: VisualizeInput,
): Promise<{ requestId: string }> {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error('FAL_KEY не задан');
  fal.config({ credentials: key });
  const submitted = await fal.queue.submit(RENDER_ENDPOINT, {
    input: await buildFalInput(input),
  });
  return { requestId: submitted.request_id };
}

export type GptImageJobState =
  | { status: 'in_progress' }
  | { status: 'completed'; imageUrl: string }
  | { status: 'failed'; error: string };

export async function pollGptImageJob(requestId: string): Promise<GptImageJobState> {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error('FAL_KEY не задан');
  fal.config({ credentials: key });

  const status = await fal.queue.status(RENDER_ENDPOINT, { requestId, logs: false });
  if (status.status !== 'COMPLETED') return { status: 'in_progress' };

  try {
    const result = await fal.queue.result(RENDER_ENDPOINT, { requestId });
    const url = result.data.images[0]?.url;
    if (!url) return { status: 'failed', error: 'fal: ответ без URL картинки' };
    try {
      const buf = await fetchToBuffer(url);
      const mime = buf[0] === 0x89 && buf[1] === 0x50 ? 'image/png' : 'image/jpeg';
      return {
        status: 'completed',
        imageUrl: `data:${mime};base64,${buf.toString('base64')}`,
      };
    } catch {
      return { status: 'completed', imageUrl: url };
    }
  } catch (err) {
    return {
      status: 'failed',
      error: err instanceof Error ? err.message : 'fal: ошибка рендера',
    };
  }
}

// Без удалённого vision-провайдера endpoint масштаба остаётся рабочим и возвращает
// безопасную оценку. Точный пользовательский размер из основной формы имеет приоритет.
export type ScaleEstimate = { widthM: number; confidence: number; reasoning: string };

export async function estimateRegionWidthMeters(input: {
  roomImageUrl: string;
  maskImageUrl?: string;
}): Promise<ScaleEstimate> {
  void input;
  return {
    widthM: 4,
    confidence: 0,
    reasoning: 'Локальная оценка по умолчанию; уточните ширину вручную для точного масштаба.',
  };
}

export type PlaneCorners = {
  corners: [number, number][];
  openings: [number, number][][];
  widthM: number;
  heightM: number;
  confidence: number;
  reasoning: string;
};

type BBoxNorm = { minX: number; minY: number; maxX: number; maxY: number };

function frontalQuad(bbox: BBoxNorm): [number, number][] {
  return [
    [bbox.minX, bbox.minY],
    [bbox.maxX, bbox.minY],
    [bbox.maxX, bbox.maxY],
    [bbox.minX, bbox.maxY],
  ];
}

// Геометрия без удалённого vision-провайдера строится детерминированно по bbox.
export async function analyzeSurfacePlane(input: {
  roomImageUrl: string;
  surface: 'mask' | 'floor' | 'wall';
  maskImageUrl?: string;
  maskBBoxNorm?: BBoxNorm;
}): Promise<PlaneCorners> {
  const bbox = input.maskBBoxNorm ?? { minX: 0.1, minY: 0.1, maxX: 0.9, maxY: 0.9 };
  const estimate = await estimateRegionWidthMeters({
    roomImageUrl: input.roomImageUrl,
    maskImageUrl: input.maskImageUrl,
  });
  const bboxWidth = Math.max(0.01, bbox.maxX - bbox.minX);
  const bboxHeight = Math.max(0.01, bbox.maxY - bbox.minY);
  return {
    corners: frontalQuad(bbox),
    openings: [],
    widthM: estimate.widthM,
    heightM: Math.min(40, Math.max(0.3, estimate.widthM * (bboxHeight / bboxWidth))),
    confidence: 0,
    reasoning: 'Локальная фронтальная плоскость по границам выделения.',
  };
}

// Доводка готового композита теперь также использует nano-banana через fal.
export async function relightComposite(
  compositeDataUrl: string,
  opts?: { tileWmm?: number; tileHmm?: number; tileName?: string; tileImageUrl?: string },
): Promise<ProviderOutput> {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error('FAL_KEY не задан');
  fal.config({ credentials: key });

  const shapeLock =
    opts?.tileWmm && opts.tileHmm
      ? ` Each tile is ${opts.tileWmm}×${opts.tileHmm} mm. Preserve that exact rectangular proportion and never turn it into a square.`
      : '';
  const hasTileReference = Boolean(opts?.tileImageUrl);
  const prompt = `IMAGE 1 is an already composited architectural photo. The tile layout, size, count, positions, perspective and grout lines in IMAGE 1 are FINAL and CORRECT.${hasTileReference ? ' IMAGE 2 is the exact tile reference.' : ''}

Only improve the photorealistic integration of the tiled region: match the scene lighting, soft contact shadows, relief, texture and reflections.
- Do NOT move, resize, recolor, add, remove or rearrange any tile.${shapeLock}
- Keep everything outside the tiled region and the exact camera framing unchanged.
${hasTileReference ? `- Match IMAGE 2${opts?.tileName ? ` (${JSON.stringify(opts.tileName)})` : ''} exactly; do not invent a generic material.` : ''}
- Output only the final edited photo.`;
  const imageUrls = [
    compositeDataUrl,
    ...(opts?.tileImageUrl ? [opts.tileImageUrl] : []),
  ];
  const result = await fal.subscribe(RENDER_ENDPOINT, {
    input: {
      prompt,
      image_urls: await Promise.all(imageUrls.map(toDataUri)),
    },
    logs: false,
  });
  const url = result.data.images[0]?.url;
  if (!url) throw new Error('fal.ai не вернул картинку');
  return { imageUrl: url };
}

export type RefineProvider = 'fal' | 'none';

export type RefineInput = {
  compositeUrl: string;
  maskUrl: string;
  controlUrl?: string;
  tileName?: string;
  strength?: number;
  provider?: RefineProvider;
};

export type RefineResult = {
  imageUrl: string;
  durationMs: number;
  provider: RefineProvider;
  refined: boolean;
};

function pickRefineProvider(requested?: RefineProvider): RefineProvider {
  if (requested === 'none') return 'none';
  if (requested === 'fal') return process.env.FAL_KEY ? 'fal' : 'none';
  return process.env.FAL_KEY ? 'fal' : 'none';
}

const REFINE_PROMPT =
  'Enhance ONLY the photorealism of the already-tiled wall/floor region: natural lighting consistent with the scene, soft contact shadows in the grout joints, subtle surface relief and micro-texture of the clinker, gentle realistic reflections. Do NOT move, resize, add, remove, re-arrange or re-colour any tile. Keep the exact tile size, count, grout lines, layout and perspective. Keep everything outside the tiled region unchanged.';

export async function refineCompositeStructLocked(
  input: RefineInput,
): Promise<RefineResult> {
  const provider = pickRefineProvider(input.provider);
  const started = Date.now();
  if (provider === 'none') {
    return {
      imageUrl: input.compositeUrl,
      durationMs: 0,
      provider,
      refined: false,
    };
  }
  try {
    const imageUrl = await refineViaFal(input);
    return {
      imageUrl,
      durationMs: Date.now() - started,
      provider,
      refined: true,
    };
  } catch (err) {
    console.error('[refine:fal]', err);
    return {
      imageUrl: input.compositeUrl,
      durationMs: Date.now() - started,
      provider,
      refined: false,
    };
  }
}

async function refineViaFal(input: RefineInput): Promise<string> {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error('FAL_KEY не задан');
  fal.config({ credentials: key });
  const depthSource = input.controlUrl ?? input.compositeUrl;
  const [imageSmall, controlSmall] = await Promise.all([
    downscaleDataUrl(input.compositeUrl, 1280),
    downscaleDataUrl(depthSource, 1280),
  ]);
  const result = await fal.subscribe('fal-ai/flux-control-lora-depth/image-to-image', {
    input: {
      prompt: REFINE_PROMPT,
      image_url: imageSmall,
      control_lora_image_url: controlSmall,
      strength: input.strength ?? 0.5,
      num_inference_steps: 24,
    },
    logs: false,
  });
  const url = result.data.images[0]?.url;
  if (!url) throw new Error('fal.ai не вернул картинку');
  return maskedRecompose(input.compositeUrl, url, input.maskUrl);
}

export async function maskedRecompose(
  baseUrl: string,
  overlayUrl: string,
  maskUrl: string,
): Promise<string> {
  const sharp = (await import('sharp')).default;
  const [baseBuffer, overlayBuffer, maskBuffer] = await Promise.all([
    fetchToBuffer(baseUrl),
    fetchToBuffer(overlayUrl),
    fetchToBuffer(maskUrl),
  ]);
  const metadata = await sharp(baseBuffer).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (!width || !height) return overlayUrl;

  const overlay = await sharp(overlayBuffer)
    .resize(width, height, { fit: 'fill' })
    .removeAlpha()
    .toBuffer();
  const alpha = await sharp(maskBuffer)
    .resize(width, height, { fit: 'fill' })
    .greyscale()
    .toColourspace('b-w')
    .toBuffer();
  const maskedOverlay = await sharp(overlay).joinChannel(alpha).png().toBuffer();
  const composed = await sharp(baseBuffer)
    .composite([{ input: maskedOverlay, blend: 'over' }])
    .jpeg({ quality: 92 })
    .toBuffer();
  return `data:image/jpeg;base64,${composed.toString('base64')}`;
}

async function subtractOpenings(
  userMaskUrl: string,
  openingsMaskUrl: string,
  sizeReferenceUrl: string,
): Promise<string> {
  const sharp = (await import('sharp')).default;
  const [userBuffer, openingsBuffer, referenceBuffer] = await Promise.all([
    fetchToBuffer(userMaskUrl),
    fetchToBuffer(openingsMaskUrl),
    fetchToBuffer(sizeReferenceUrl),
  ]);
  const metadata = await sharp(referenceBuffer).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (!width || !height) return userMaskUrl;

  const userMask = await sharp(userBuffer)
    .resize(width, height, { fit: 'fill' })
    .greyscale()
    .toColourspace('b-w')
    .toBuffer();
  const nonOpenings = await sharp(openingsBuffer)
    .resize(width, height, { fit: 'fill' })
    .greyscale()
    .negate()
    .toColourspace('b-w')
    .png()
    .toBuffer();
  const result = await sharp(userMask)
    .composite([{ input: nonOpenings, blend: 'multiply' }])
    .png()
    .toBuffer();
  return `data:image/png;base64,${result.toString('base64')}`;
}

async function whiteFraction(maskUrl: string): Promise<number> {
  const sharp = (await import('sharp')).default;
  const stats = await sharp(await fetchToBuffer(maskUrl)).greyscale().stats();
  return (stats.channels[0]?.mean ?? 0) / 255;
}

export async function compositeMaskedResult(input: {
  roomImageUrl: string;
  resultUrl: string;
  maskUrl: string;
  segRequestId?: string | null;
}): Promise<string> {
  let effectiveMask = input.maskUrl;
  if (input.segRequestId) {
    const openingsMask = await fetchEvfSamMask(input.segRequestId);
    if (openingsMask) {
      const candidate = await subtractOpenings(
        input.maskUrl,
        openingsMask,
        input.roomImageUrl,
      );
      const [candidateFraction, userFraction] = await Promise.all([
        whiteFraction(candidate),
        whiteFraction(input.maskUrl),
      ]);
      if (userFraction > 0 && candidateFraction >= 0.15 * userFraction) {
        effectiveMask = candidate;
      }
    }
  }
  return maskedRecompose(input.roomImageUrl, input.resultUrl, effectiveMask);
}

async function downscaleDataUrl(url: string, maxEdge: number): Promise<string> {
  try {
    const sharp = (await import('sharp')).default;
    const output = await sharp(await fetchToBuffer(url))
      .resize(maxEdge, maxEdge, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toBuffer();
    return `data:image/jpeg;base64,${output.toString('base64')}`;
  } catch (err) {
    console.error('[downscaleDataUrl]', err);
    return url;
  }
}

async function fetchToBuffer(url: string): Promise<Buffer> {
  if (url.startsWith('data:')) {
    const match = url.match(/^data:[^;]+;base64,(.+)$/);
    if (!match) throw new Error('Невалидный data URL');
    return Buffer.from(match[1], 'base64');
  }
  const backoff = [400, 900, 1800];
  let lastError: unknown;
  for (let attempt = 0; attempt <= backoff.length; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (err) {
      lastError = err;
      const message = err instanceof Error ? err.message : String(err);
      if (/HTTP 4\d\d/.test(message)) throw err;
      if (attempt < backoff.length) {
        await new Promise((resolve) => setTimeout(resolve, backoff[attempt]));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

const EVF_SAM_ENDPOINT = 'fal-ai/evf-sam';
type EvfSamResult = {
  image?: { url?: string };
  data?: { image?: { url?: string } };
};

export async function segmentSurfaceMask(input: {
  imageUrl: string;
  surface: 'floor' | 'wall';
}): Promise<string | null> {
  const key = process.env.FAL_KEY;
  if (!key) return null;
  fal.config({ credentials: key });
  const prompt =
    input.surface === 'floor' ? 'floor, ground, paving' : 'wall, building facade wall surface';
  const negativePrompt =
    'door, gate, garage door, window, glass, balcony, lamp, light fixture, sconce, sign, pipe, downspout, plant, bush, tree, sky, roof, person, car';
  try {
    const result = (await fal.subscribe(EVF_SAM_ENDPOINT, {
      input: {
        image_url: input.imageUrl,
        prompt,
        negative_prompt: negativePrompt,
        mask_only: true,
        fill_holes: true,
      },
      logs: false,
    })) as EvfSamResult;
    const url = result.data?.image?.url ?? result.image?.url;
    if (!url) return null;
    return `data:image/png;base64,${(await fetchToBuffer(url)).toString('base64')}`;
  } catch (err) {
    console.error('[segmentSurfaceMask]', err);
    return null;
  }
}

const EVF_OPENINGS_PROMPT =
  'window, glass, door, glass door, gate, garage door, balcony door, shop window, storefront, wall lamp, light fixture';

export async function submitEvfSamJob(input: {
  imageUrl: string;
}): Promise<{ requestId: string }> {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error('FAL_KEY не задан');
  fal.config({ credentials: key });
  const submitted = await fal.queue.submit(EVF_SAM_ENDPOINT, {
    input: {
      image_url: input.imageUrl,
      prompt: EVF_OPENINGS_PROMPT,
      mask_only: true,
      fill_holes: true,
    },
  });
  return { requestId: submitted.request_id };
}

export async function fetchEvfSamMask(
  requestId: string,
  timeoutMs = 20000,
): Promise<string | null> {
  const key = process.env.FAL_KEY;
  if (!key) return null;
  fal.config({ credentials: key });
  const deadline = Date.now() + timeoutMs;
  try {
    while (Date.now() < deadline) {
      const status = await fal.queue.status(EVF_SAM_ENDPOINT, {
        requestId,
        logs: false,
      });
      if (status.status === 'COMPLETED') {
        const result = (await fal.queue.result(EVF_SAM_ENDPOINT, {
          requestId,
        })) as EvfSamResult;
        const url = result.data?.image?.url ?? result.image?.url;
        if (!url) return null;
        return `data:image/png;base64,${(await fetchToBuffer(url)).toString('base64')}`;
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  } catch (err) {
    console.error('[fetchEvfSamMask]', err);
  }
  return null;
}

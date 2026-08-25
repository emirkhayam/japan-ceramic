/**
 * AI-ядро визуализатора. Основной рендер — gpt-image-2/edit через fal,
 * nano-banana-pro/edit остаётся запасной веткой, mock — локальным фолбэком.
 */
import { ApiError, fal } from '@fal-ai/client';

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

type RenderModel = 'gpt-image-2' | 'nano-banana';
type GptImageSize =
  | 'square_hd'
  | 'square'
  | 'portrait_4_3'
  | 'portrait_16_9'
  | 'landscape_4_3'
  | 'landscape_16_9'
  | 'auto'
  | { width: number; height: number };
type GptImageQuality = 'low' | 'medium' | 'high';
type GptImageEditInput = {
  prompt: string;
  image_urls: string[];
  mask_image_url?: string;
  image_size?: GptImageSize;
  quality?: GptImageQuality;
  output_format?: 'jpeg' | 'png' | 'webp';
  num_images?: number;
};
type NanoBananaEditInput = {
  prompt: string;
  image_urls: string[];
  aspect_ratio?: FalAspect;
};

const GPT_IMAGE_ENDPOINT = 'openai/gpt-image-2/edit';
const NANO_BANANA_ENDPOINT = 'fal-ai/nano-banana-pro/edit';
const CHAT_ENDPOINT = 'openrouter/router';
const CHAT_MODEL = process.env.AI_CHAT_MODEL?.trim() || 'openai/gpt-5.6';
const RENDER_MODEL: RenderModel =
  process.env.AI_RENDER_MODEL === 'nano-banana'
    ? 'nano-banana'
    : 'gpt-image-2';
const RENDER_ENDPOINT =
  RENDER_MODEL === 'nano-banana' ? NANO_BANANA_ENDPOINT : GPT_IMAGE_ENDPOINT;

export const RENDER_PROVIDER_LABEL =
  RENDER_MODEL === 'nano-banana'
    ? 'nano-banana-pro-edit'
    : 'gpt-image-2-edit';

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

function gptImageQuality(): GptImageQuality {
  const quality = process.env.AI_IMAGE_QUALITY;
  return quality === 'low' || quality === 'medium' || quality === 'high'
    ? quality
    : 'high';
}

function gptImageSizeFromDims(
  dims: { w: number; h: number } | null,
): GptImageSize {
  if (!dims || !(dims.w > 0) || !(dims.h > 0)) return 'auto';
  if (Math.max(dims.w, dims.h) / Math.min(dims.w, dims.h) > 3) return 'auto';
  const scale = 1536 / Math.max(dims.w, dims.h);
  const toValidSide = (side: number) =>
    Math.max(512, Math.round((side * scale) / 16) * 16);
  return {
    width: toValidSide(dims.w),
    height: toValidSide(dims.h),
  };
}

async function buildFalInput(
  input: VisualizeInput,
  opts?: { forceAutoSize?: boolean },
): Promise<GptImageEditInput | NanoBananaEditInput> {
  if (input.tileImageUrls.length === 0) {
    throw new Error('Не передано ни одного изображения плитки');
  }
  if (input.surface === 'mask' && !input.maskImageUrl) {
    throw new Error('Для режима кисти обязательна маска');
  }
  // fal не скачивает localhost/приватные URL — инлайним фото, все референсы и маску.
  const imageUris = await Promise.all(
    [input.roomImageUrl, ...input.tileImageUrls].map(toDataUri),
  );
  const roomDims = imageDimsFromDataUri(imageUris[0]);
  if (RENDER_MODEL === 'gpt-image-2') {
    const maskImageUrl =
      input.surface === 'mask' && input.maskImageUrl
        ? await toDataUri(input.maskImageUrl)
        : undefined;
    return {
      prompt: buildPrompt(input),
      image_urls: imageUris,
      ...(maskImageUrl ? { mask_image_url: maskImageUrl } : {}),
      image_size: opts?.forceAutoSize ? 'auto' : gptImageSizeFromDims(roomDims),
      quality: gptImageQuality(),
      output_format: 'jpeg',
      num_images: 1,
    };
  }

  const nanoImageUris = input.maskImageUrl
    ? [...imageUris, await toDataUri(input.maskImageUrl)]
    : imageUris;
  return {
    prompt: buildPrompt(input),
    image_urls: nanoImageUris,
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

  const endpoint = RENDER_ENDPOINT;
  const result = await fal.subscribe(endpoint as never, {
    // @fal-ai/client@1.10.1 ещё не типизирует gpt-image-2/edit.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    input: (await buildFalInput(input)) as any,
    logs: false,
  });
  const url = falImageUrl(result);
  if (!url) throw new Error('Ответ fal.ai без URL картинки');
  return { imageUrl: url };
}

async function viaMock(input: VisualizeInput): Promise<ProviderOutput> {
  await new Promise((resolve) => setTimeout(resolve, 1500 + Math.random() * 1500));
  return { imageUrl: input.tileImageUrls[0] ?? input.roomImageUrl };
}

// Асинхронная очередь использует тот же endpoint и buildFalInput, что и sync-ветка.
export async function submitGptImageJob(
  input: VisualizeInput,
): Promise<{ requestId: string }> {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error('FAL_KEY не задан');
  fal.config({ credentials: key });
  const endpoint = RENDER_ENDPOINT;
  const submit = async (forceAutoSize = false) =>
    fal.queue.submit(endpoint as never, {
      // @fal-ai/client@1.10.1 ещё не типизирует gpt-image-2/edit.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      input: (await buildFalInput(input, { forceAutoSize })) as any,
    });
  try {
    const submitted = await submit();
    return { requestId: submitted.request_id };
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 800));
    const forceAutoSize = RENDER_MODEL !== 'nano-banana';
    if (forceAutoSize) {
      console.warn('[submitGptImageJob] retrying with image_size:auto');
    }
    const submitted = await submit(forceAutoSize);
    return { requestId: submitted.request_id };
  }
}

export type ChatVisualizeInput = {
  baseImageUrl: string;
  tileImageUrls: string[];
  tileName: string;
  tileDims?: { wmm: number; hmm: number };
  referenceImageUrl?: string;
  userMessage: string;
  tileChanged?: boolean;
  strongEdit?: boolean;
};

export type ChatDecision = {
  action: 'reply' | 'generate';
  reply: string;
  imagePrompt?: string;
};

export type ChatOrchestrateInput = {
  userMessage: string;
  history: { role: 'user' | 'assistant'; text: string }[];
  tileName: string;
  tileDims?: { wmm: number; hmm: number };
  hasTile: boolean;
  hasBaseImage: boolean;
  tileChanged?: boolean;
};

function buildChatOrchestratorPrompt(input: ChatOrchestrateInput): string {
  const tileDimensions = input.tileDims
    ? ` (${input.tileDims.wmm}×${input.tileDims.hmm} мм)`
    : '';
  const tileChangedContext = input.tileChanged
    ? '\n- Плитка только что СМЕНЕНА: при генерации полностью замени старую плитку в текущей сцене новой выбранной плиткой.'
    : '';
  const history = input.history
    .slice(-12)
    .map(
      (item) =>
        `${item.role === 'user' ? 'Клиент' : 'Ассистент'}: ${item.text}`,
    )
    .join('\n');

  return `Ты — ассистент-визуализатор магазина плитки Japan Ceramic. Клиент примеряет плитку на фото своего помещения/фасада. Твоя задача — по диалогу решить: (a) ответить текстом (приветствие, уточнение, совет) или (b) запустить генерацию изображения.

Правила:
- Отвечай кратко и дружелюбно.
- Уточняющий вопрос задавай ТОЛЬКО если без него нельзя сгенерировать, максимум один вопрос.
- Если запрос понятен — сразу action=generate.
- НИКОГДА не предлагай другую плитку вместо выбранной.
- Если плитка ещё не выбрана (hasTile=false) — генерировать нельзя. На вопросы отвечай текстом; если клиент просит визуализацию — дружелюбно попроси сначала выбрать плитку из каталога или загрузить фото своей (кнопка «Плитка» вверху).
- Если фото ещё не приложено (hasBaseImage=false) — генерировать нельзя, попроси прислать фото.
- imagePrompt пиши как самодостаточное задание image-модели: что изменить относительно ТЕКУЩЕГО состояния сцены, сохраняя всё остальное. Помни: «тоже» и «ещё» означают добавить к уже сделанному, а не переделывать существующий результат.

Контекст:
- Выбранная плитка: ${input.hasTile ? `${input.tileName}${tileDimensions}` : 'ещё не выбрана'}.
- Фото приложено: ${input.hasBaseImage ? 'да' : 'нет'}.${tileChangedContext}

История диалога:
${history || '(пока пусто)'}

Новое сообщение клиента:
${input.userMessage}

Ответь СТРОГО одним JSON без markdown:
{"action":"reply"|"generate","reply":"короткий ответ клиенту по-русски","imagePrompt":"задание для image-модели, только если action=generate"}`;
}

function firstJsonObject(value: string): string | null {
  const start = value.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < value.length; index += 1) {
    const char = value[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
    } else if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) return value.slice(start, index + 1);
    }
  }
  return null;
}

function fallbackChatDecision(input: ChatOrchestrateInput): ChatDecision {
  return {
    action: 'generate',
    reply: '',
    imagePrompt: input.userMessage,
  };
}

function requireBaseImage(
  decision: ChatDecision,
  hasBaseImage: boolean,
): ChatDecision {
  if (decision.action !== 'generate' || hasBaseImage) return decision;
  return {
    action: 'reply',
    reply: 'Прикрепите фото помещения или фасада',
  };
}

// Плитка теперь опциональна для входа/вопросов, но обязательна для рендера:
// если модель решила генерировать без выбранной плитки — мягко возвращаем к выбору.
function requireTile(decision: ChatDecision, hasTile: boolean): ChatDecision {
  if (decision.action !== 'generate' || hasTile) return decision;
  return {
    action: 'reply',
    reply:
      'Чтобы сделать визуализацию, выберите плитку из каталога или загрузите фото своей — кнопка «Плитка» вверху.',
  };
}

// Тайл-гейт приоритетнее (выбор плитки — первый шаг); затем гейт фото.
function gateDecision(
  decision: ChatDecision,
  hasTile: boolean,
  hasBaseImage: boolean,
): ChatDecision {
  return requireBaseImage(requireTile(decision, hasTile), hasBaseImage);
}

export async function chatOrchestrate(
  input: ChatOrchestrateInput,
): Promise<ChatDecision> {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error('FAL_KEY не задан');
  fal.config({ credentials: key });

  // openrouter/router периодически даёт транзиентный блип (~1 из 4) — одна
  // тихая повторная попытка прячет его от клиента; только если и она упала —
  // мягко деградируем в текстовый ответ (без слепой платной генерации).
  const callOrchestrator = () =>
    fal.subscribe(CHAT_ENDPOINT as never, {
      input: {
        model: CHAT_MODEL,
        prompt: buildChatOrchestratorPrompt(input),
      } as never,
      logs: false,
    }) as unknown;

  let result: unknown;
  try {
    result = await callOrchestrator();
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 800));
    try {
      result = await callOrchestrator();
    } catch (err) {
      console.error('[chatOrchestrate] openrouter/router недоступен после ретрая:', err);
      return {
        action: 'reply',
        reply: 'Секунду, связь с ассистентом подвисла — повторите запрос.',
      };
    }
  }
  const root =
    result !== null && typeof result === 'object'
      ? (result as { data?: unknown; output?: unknown })
      : null;
  const data =
    root?.data !== null && typeof root?.data === 'object'
      ? (root.data as { output?: unknown })
      : root;
  const output = typeof data?.output === 'string' ? data.output : '';
  const json = firstJsonObject(output);

  try {
    if (!json) {
      return gateDecision(
        fallbackChatDecision(input),
        input.hasTile,
        input.hasBaseImage,
      );
    }
    const parsed = JSON.parse(json) as {
      action?: unknown;
      reply?: unknown;
      imagePrompt?: unknown;
    };
    if (parsed.action !== 'reply' && parsed.action !== 'generate') {
      return gateDecision(
        fallbackChatDecision(input),
        input.hasTile,
        input.hasBaseImage,
      );
    }
    const reply = typeof parsed.reply === 'string' ? parsed.reply.trim() : '';
    if (parsed.action === 'reply') {
      return { action: 'reply', reply };
    }
    return gateDecision(
      {
        action: 'generate',
        reply,
        imagePrompt:
          typeof parsed.imagePrompt === 'string' && parsed.imagePrompt.trim()
            ? parsed.imagePrompt.trim()
            : input.userMessage,
      },
      input.hasTile,
      input.hasBaseImage,
    );
  } catch {
    return gateDecision(
      fallbackChatDecision(input),
      input.hasTile,
      input.hasBaseImage,
    );
  }
}

function buildChatPrompt(input: ChatVisualizeInput): string {
  const tileReferenceEnd =
    1 + input.tileImageUrls.slice(0, input.referenceImageUrl ? 3 : 4).length;
  const tileDimensions = input.tileDims
    ? `, exactly ${input.tileDims.wmm}×${input.tileDims.hmm} mm each`
    : '';
  const shapeRule = input.tileDims
    ? ` ${tileShapeRule(input.tileDims.wmm, input.tileDims.hmm)}`
    : '';
  const tileChanged = input.tileChanged
    ? ` The tile product has just been CHANGED by the user: replace ALL previously applied tile in the scene with ${input.tileName}.`
    : '';
  const styleReference = input.referenceImageUrl
    ? `\nThe LAST image is a desired-style reference (a finished project the client likes): borrow its layout, mood and composition ideas, but KEEP IMAGE 1's real building geometry, camera and framing; do NOT copy its tile unless it matches the selected tile.`
    : '';
  const strongEdit = input.strongEdit
    ? `\nCRITICAL: the previous attempt returned the image almost unchanged. You MUST now make the requested tiling change clearly and visibly across the target area.`
    : '';

  return `You are a photorealistic tile visualization assistant for a ceramic tile store.
IMAGE 1 is the current state of the client's scene (a photo or the previous edit of this very scene) — continue editing this exact scene.
IMAGES 2..${tileReferenceEnd} are reference photos of ONE AND THE SAME tile to apply (whether from catalog or the client's own tile photo): ${input.tileName}${tileDimensions}. NEVER substitute a different tile. Real tiles vary naturally in tone and relief between individual tiles — no visible cloning.${shapeRule}${styleReference}
Keep the building/room geometry, camera angle, framing, field of view and lighting exactly as in IMAGE 1 unless the user explicitly asks otherwise.
CHANGE ONLY what the user asks below. Every other surface of IMAGE 1 — walls, plaster, and any tile already applied in previous steps — must stay EXACTLY as it is in IMAGE 1. When the user says "also"/"тоже", they mean ADD to the existing result, not redo it.
ONLY IF the user explicitly asks to change the tile or re-clad an already tiled area: fully replace the old tile with ${input.tileName} there — never mix two different tile products.${tileChanged}
Render realistic thin grout joints between the tiles with correct even coursing, and clean cuts at every edge, opening and corner; the newly tiled surface must catch the same daylight, shadows and reflections as the rest of IMAGE 1.
You MUST visibly apply the tile to the requested area. NEVER output IMAGE 1 unchanged — the applied tile must be clearly visible in the result.${strongEdit}
USER REQUEST (highest priority): ${JSON.stringify(input.userMessage)}
Output only the final edited photo.`;
}

async function buildChatFalInput(
  input: ChatVisualizeInput,
  opts?: { forceAutoSize?: boolean },
): Promise<GptImageEditInput | NanoBananaEditInput> {
  if (input.tileImageUrls.length === 0) {
    throw new Error('Не передано ни одного изображения плитки');
  }
  const tileImageUrls = input.tileImageUrls.slice(
    0,
    input.referenceImageUrl ? 3 : 4,
  );
  const imageUris = await Promise.all(
    [
      input.baseImageUrl,
      ...tileImageUrls,
      ...(input.referenceImageUrl ? [input.referenceImageUrl] : []),
    ].map(toDataUri),
  );
  const baseDims = imageDimsFromDataUri(imageUris[0]);
  if (RENDER_MODEL === 'nano-banana') {
    return {
      prompt: buildChatPrompt(input),
      image_urls: imageUris,
      ...(baseDims ? { aspect_ratio: closestFalAspect(baseDims.w, baseDims.h) } : {}),
    };
  }
  return {
    prompt: buildChatPrompt(input),
    image_urls: imageUris,
    image_size: opts?.forceAutoSize ? 'auto' : gptImageSizeFromDims(baseDims),
    quality: gptImageQuality(),
    output_format: 'jpeg',
    num_images: 1,
  };
}

export async function submitChatVisualizationJob(
  input: ChatVisualizeInput,
): Promise<{ requestId: string }> {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error('FAL_KEY не задан');
  fal.config({ credentials: key });
  const endpoint = RENDER_ENDPOINT;
  const submit = async (forceAutoSize = false) =>
    fal.queue.submit(endpoint as never, {
      // @fal-ai/client@1.10.1 ещё не типизирует gpt-image-2/edit.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      input: (await buildChatFalInput(input, { forceAutoSize })) as any,
    });
  try {
    const submitted = await submit(input.strongEdit === true);
    return { requestId: submitted.request_id };
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 800));
    const forceAutoSize = RENDER_MODEL !== 'nano-banana';
    if (forceAutoSize) {
      console.warn('[submitChatVisualizationJob] retrying with image_size:auto');
    }
    const submitted = await submit(forceAutoSize);
    return { requestId: submitted.request_id };
  }
}

export type GptImageJobState =
  | { status: 'in_progress' }
  | { status: 'completed'; imageUrl: string; sourceUrl: string }
  | { status: 'failed'; error: string };

function falQueueErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (
    err !== null &&
    typeof err === 'object' &&
    typeof (err as { message?: unknown }).message === 'string'
  ) {
    return (err as { message: string }).message;
  }
  return 'fal: ошибка рендера';
}

function falQueueErrorState(err: unknown): GptImageJobState {
  const status =
    err instanceof ApiError
      ? err.status
      : err !== null &&
          typeof err === 'object' &&
          typeof (err as { status?: unknown }).status === 'number'
        ? (err as { status: number }).status
        : null;
  const message = falQueueErrorMessage(err);
  if ((status !== null && status >= 400 && status < 500) || /HTTP 4\d\d/i.test(message)) {
    return { status: 'failed', error: message };
  }
  return { status: 'in_progress' };
}

export async function pollGptImageJob(requestId: string): Promise<GptImageJobState> {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error('FAL_KEY не задан');
  fal.config({ credentials: key });

  const endpoint = RENDER_ENDPOINT;
  let status;
  try {
    status = await fal.queue.status(endpoint as never, { requestId, logs: false });
  } catch (err) {
    return falQueueErrorState(err);
  }
  if (status.status !== 'COMPLETED') return { status: 'in_progress' };

  try {
    const result = await fal.queue.result(endpoint as never, { requestId });
    const url = falImageUrl(result);
    if (!url) return { status: 'failed', error: 'fal: ответ без URL картинки' };
    try {
      const buf = await fetchToBuffer(url);
      const mime = imageMimeFromBytes(buf);
      return {
        status: 'completed',
        imageUrl: `data:${mime};base64,${buf.toString('base64')}`,
        sourceUrl: url,
      };
    } catch {
      return { status: 'completed', imageUrl: url, sourceUrl: url };
    }
  } catch (err) {
    return falQueueErrorState(err);
  }
}

function falImageUrl(result: unknown): string | null {
  if (!result || typeof result !== 'object') return null;
  const root = result as {
    data?: { images?: Array<{ url?: unknown }> };
    images?: Array<{ url?: unknown }>;
  };
  const url = root.data?.images?.[0]?.url ?? root.images?.[0]?.url;
  return typeof url === 'string' && url ? url : null;
}

function imageMimeFromBytes(buf: Buffer): 'image/png' | 'image/jpeg' | 'image/webp' {
  if (buf[0] === 0x89 && buf[1] === 0x50) return 'image/png';
  if (
    buf.length >= 12 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return 'image/jpeg';
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
  const result = await fal.subscribe(NANO_BANANA_ENDPOINT, {
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

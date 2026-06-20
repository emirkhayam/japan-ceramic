/**
 * Мульти-провайдерная обёртка над AI-визуализацией.
 * Все провайдеры принимают одинаковый input и возвращают одинаковый output.
 * Переключение: через env AI_PROVIDER или через поле `provider` в запросе.
 */
import { fal } from '@fal-ai/client';

export type Provider = 'fal' | 'replicate' | 'gemini' | 'mock';

export type VisualizeInput = {
  roomImageUrl: string;
  tileImageUrl: string;
  tileName: string;
  surface: 'floor' | 'wall' | 'mask';
  /** PNG-маска (белое = куда класть плитку, чёрное = не трогать). Только для surface==='mask'. */
  maskImageUrl?: string;
  /**
   * Реальный масштаб кладки. Считается на сервере из размеров плитки и введённых
   * пользователем ширины/высоты участка. Передаётся модели как жёсткое число плиток —
   * чтобы она не угадывала масштаб клинкера. Только для surface==='mask'.
   * tilesDown — число рядов по высоте (если высота участка задана).
   */
  scale?: { tilesAcross: number; tilesDown?: number; tileWmm: number; tileHmm: number };
  /**
   * Реальные размеры плитки (мм) для floor/wall: фиксируют форму/пропорцию в промпте,
   * чтобы модель не делала квадраты вместо длинных узких кирпичей. Без числа плиток.
   */
  tileDims?: { wmm: number; hmm: number };
  provider?: Provider;
};

// Описание формы плитки для промпта: реальные размеры + пропорция словами,
// чтобы Gemini не галлюцинировал форму (частая беда с клинкером → квадраты).
function tileShapeRule(wmm: number, hmm: number): string {
  if (!(wmm > 0) || !(hmm > 0)) return '';
  const ratio = (wmm / hmm).toFixed(2);
  const longer = wmm >= hmm ? 'wide (landscape)' : 'tall (portrait)';
  return ` Each individual tile is a rectangle of EXACTLY ${wmm}×${hmm} mm (width×height), aspect ratio ${ratio}:1 — a ${longer} brick, NOT a square. Keep every tile this exact shape and proportion; never round it toward a square and never rotate it.`;
}

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

export const PROVIDERS_META: Record<
  Provider,
  { label: string; price: string; free: boolean; envVar: string }
> = {
  fal: {
    label: 'fal.ai · FLUX Kontext Pro',
    price: '~$0.04 / картинка',
    free: false,
    envVar: 'FAL_KEY',
  },
  replicate: {
    label: 'Replicate · FLUX Kontext',
    price: '~$0.04 / картинка',
    free: false,
    envVar: 'REPLICATE_API_TOKEN',
  },
  gemini: {
    label: 'Google Gemini 2.5 Flash Image',
    price: 'Бесплатный tier',
    free: true,
    envVar: 'GOOGLE_API_KEY',
  },
  mock: {
    label: 'Демо (без живого AI)',
    price: 'Бесплатно',
    free: true,
    envVar: '',
  },
};

const SURFACE_PROMPT: Record<'floor' | 'wall', string> = {
  floor:
    'Replace the floor surface of this interior room with the ceramic tile texture from the reference image. Maintain perfect perspective, realistic seams between tiles, accurate lighting and shadows from the original photo. Keep all walls, furniture, ceiling and other objects completely unchanged. The tile pattern must follow the floor perspective naturally and look photorealistic.',
  wall:
    'Replace one main wall of this interior room with the ceramic tile texture from the reference image. Maintain perfect perspective, realistic grout lines between tiles, accurate lighting and reflections. Keep floor, ceiling, furniture and other walls completely unchanged.',
};

function pickProvider(requested?: Provider): Provider {
  if (requested && PROVIDERS_META[requested]) return requested;
  const fromEnv = process.env.AI_PROVIDER as Provider | undefined;
  if (fromEnv && PROVIDERS_META[fromEnv]) return fromEnv;
  // Default order: gemini (free) → fal → replicate → mock
  if (process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY) return 'gemini';
  if (process.env.FAL_KEY) return 'fal';
  if (process.env.REPLICATE_API_TOKEN) return 'replicate';
  return 'mock';
}

export async function visualize(input: VisualizeInput): Promise<VisualizeResult> {
  const provider = pickProvider(input.provider);
  const started = Date.now();
  let out: ProviderOutput;

  try {
    switch (provider) {
      case 'fal':
        out = await viaFal(input);
        break;
      case 'replicate':
        out = await viaReplicate(input);
        break;
      case 'gemini':
        out = await viaGemini(input);
        break;
      case 'mock':
      default:
        out = await viaMock(input);
    }
  } catch (err) {
    throw new Error(
      `[${provider}] ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return { imageUrl: out.imageUrl, durationMs: Date.now() - started, provider, usage: out.usage };
}

// ---------- fal.ai ----------
async function viaFal(input: VisualizeInput): Promise<ProviderOutput> {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error('FAL_KEY не задан в .env.local');
  fal.config({ credentials: key });

  const prompt = `${SURFACE_PROMPT[input.surface === 'floor' ? 'floor' : 'wall']} The tile is: ${input.tileName}. Photorealistic interior design rendering, high detail.`;

  const result: any = await fal.subscribe('fal-ai/flux-pro/kontext', {
    input: {
      prompt,
      image_url: input.roomImageUrl,
      reference_image_url: input.tileImageUrl,
      guidance_scale: 3.5,
      num_inference_steps: 28,
      output_format: 'jpeg',
      safety_tolerance: '5',
    } as any,
    logs: false,
  });

  const url: string | undefined =
    result?.data?.images?.[0]?.url ??
    result?.images?.[0]?.url ??
    result?.image?.url;
  if (!url) throw new Error('Ответ fal.ai без URL картинки');
  return { imageUrl: url };
}

// ---------- Replicate ----------
async function viaReplicate(input: VisualizeInput): Promise<ProviderOutput> {
  const key = process.env.REPLICATE_API_TOKEN;
  if (!key) throw new Error('REPLICATE_API_TOKEN не задан в .env.local');

  // Lazy-load to avoid breaking build when not installed
  const { default: Replicate } = await import('replicate');
  const client = new Replicate({ auth: key });

  const prompt = `${SURFACE_PROMPT[input.surface === 'floor' ? 'floor' : 'wall']} Tile texture: ${input.tileName}. Apply the reference tile to the surface.`;

  const output: any = await client.run('black-forest-labs/flux-kontext-pro', {
    input: {
      prompt,
      input_image: input.roomImageUrl,
      aspect_ratio: 'match_input_image',
      output_format: 'jpg',
      safety_tolerance: 5,
    },
  });

  if (typeof output === 'string') return { imageUrl: output };
  if (Array.isArray(output) && output[0]) {
    return { imageUrl: typeof output[0] === 'string' ? output[0] : String(output[0]) };
  }
  if (output?.url) return { imageUrl: typeof output.url === 'function' ? output.url() : output.url };
  throw new Error('Replicate: неожиданная форма ответа');
}

// ---------- Google Gemini 2.5 Flash Image ----------
async function viaGemini(input: VisualizeInput): Promise<ProviderOutput> {
  const key = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GOOGLE_API_KEY не задан в .env.local');

  console.log('[viaGemini] Starting, API key present:', !!key);

  try {
    const { GoogleGenAI } = await import('@google/genai');
    console.log('[viaGemini] GoogleGenAI imported');

    const client = new GoogleGenAI({ apiKey: key });
    console.log('[viaGemini] Client created');

    // Режим маски: пользователь кистью выделил участок. Передаём третью картинку — маску.
    const maskMode = input.surface === 'mask' && !!input.maskImageUrl;

    const [roomPart, tilePart, maskPart] = await Promise.all([
      urlToInlinePart(input.roomImageUrl),
      urlToInlinePart(input.tileImageUrl),
      maskMode ? urlToInlinePart(input.maskImageUrl as string) : Promise.resolve(null),
    ]);
    console.log('[viaGemini] Images loaded, room size:', roomPart.inlineData.data.length, 'tile size:', tilePart.inlineData.data.length, 'mask:', maskMode);

    type InlinePart = { inlineData: { data: string; mimeType: string } };
    let prompt: string;
    let requestParts: Array<{ text: string } | InlinePart>;

    if (maskMode && maskPart) {
      // Если известен реальный масштаб — даём модели точное число плиток по ширине,
      // вместо того чтобы она угадывала размер клинкера (главная причина промахов).
      const rowsClause = input.scale?.tilesDown
        ? ` and about ${input.scale.tilesDown} tile rows down its height — lay both counts (about ${input.scale.tilesAcross} columns × ${input.scale.tilesDown} rows)`
        : '';
      const scaleRule = input.scale
        ? `\n- SCALE — THIS IS THE MOST IMPORTANT RULE: in reality the white-masked region is about ${input.scale.tilesAcross} tiles wide${rowsClause}. One real tile is ${input.scale.tileWmm}×${input.scale.tileHmm} mm. Lay EXACTLY about ${input.scale.tilesAcross} tile columns across the width of the masked region — count them. Do NOT zoom the tile in or out to "look nice"; the physical tile size and this count must be respected even if it means many small tiles. A wrong tile size is the single worst failure here.${tileShapeRule(input.scale.tileWmm, input.scale.tileHmm)}`
        : '';
      prompt = `You are a photorealistic surface-replacement engine. IMAGE 1 is a real photo (interior or building facade). IMAGE 2 is a binary MASK of the SAME size and framing as IMAGE 1: the WHITE region marks the EXACT area to re-surface, the BLACK region must stay untouched. IMAGE 3 is a single ceramic/clinker tile texture/swatch called "${input.tileName}".

Task: cover ONLY the white-masked region of IMAGE 1 with the tile from IMAGE 3, fully replacing whatever material is there.

Hard rules:
- Change ONLY the area that is white in the MASK. Every pixel in the black-masked region must remain pixel-for-pixel identical to IMAGE 1 — same walls, windows, sky, objects, lighting and camera framing.
- IMAGE 3 is ONE tile. Treat it as a repeating tile and lay many identical copies edge-to-edge in a regular grid across the masked area.
- Reproduce IMAGE 3 EXACTLY — its pattern, geometry, scale, color, veining and grout. NEVER substitute a different or generic tile.
- Lay the tiles in correct perspective for the masked surface, with realistic seams that follow the surface's vanishing lines.${scaleRule}
- Preserve the original photo's lighting, shadows and reflections so the new surface sits naturally.
Output only the final edited photo, nothing else.`;
      requestParts = [{ text: prompt }, roomPart, maskPart, tilePart];
    } else {
      const surfaceWord = input.surface === 'floor' ? 'floor' : 'one main wall';
      const shapeRule = input.tileDims
        ? tileShapeRule(input.tileDims.wmm, input.tileDims.hmm)
        : '';
      prompt = `You are a photorealistic interior visualization engine. IMAGE 1 is a photo of a real room. IMAGE 2 is a seamless ceramic tile texture/swatch called "${input.tileName}".

Task: completely re-surface the ${surfaceWord} in IMAGE 1 with the tile shown in IMAGE 2, fully replacing the existing covering.

Hard rules:
- IMAGE 2 is ONE tile. Treat it as a repeating tile and lay many identical copies edge-to-edge in a regular grid across the ${surfaceWord}.${shapeRule}
- Reproduce IMAGE 2 EXACTLY — its pattern, geometry, scale, color, veining and grout. If it is a fine geometric or decorative pattern, copy that exact pattern faithfully; if it is stone, marble or wood, copy that exact look. NEVER substitute a different or generic tile.
- Fully remove the ORIGINAL ${surfaceWord} material — do not keep, blend with, or echo the existing floor/wall pattern.
- Lay the tiles in correct perspective for the ${surfaceWord}, with realistic seams between tiles that follow the vanishing lines.
- Preserve the original photo's lighting, shadows and reflections so the new surface sits naturally.
- Keep EVERYTHING else identical: walls, ceiling, furniture, windows, decor, camera framing — change only the ${surfaceWord}.
Output only the final edited photo, nothing else.`;
      requestParts = [{ text: prompt }, roomPart, tilePart];
    }

    console.log('[viaGemini] Calling Gemini API...');
    const response: any = await client.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: [
        {
          role: 'user',
          parts: requestParts,
        },
      ],
      config: { responseModalities: ['TEXT', 'IMAGE'] },
    });
    console.log('[viaGemini] Response received:', JSON.stringify(response).substring(0, 500));

    const um = response?.usageMetadata || {};
    const usage: TokenUsage = {
      promptTokens: um.promptTokenCount ?? 0,
      outputTokens: um.candidatesTokenCount ?? 0,
      totalTokens: um.totalTokenCount ?? (um.promptTokenCount ?? 0) + (um.candidatesTokenCount ?? 0),
    };
    const parts = response?.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part?.inlineData?.data) {
        const mime = part.inlineData.mimeType || 'image/png';
        console.log('[viaGemini] Image found in response, size:', part.inlineData.data.length);
        return { imageUrl: `data:${mime};base64,${part.inlineData.data}`, usage };
      }
    }
    console.error('[viaGemini] No image in response. Parts:', JSON.stringify(parts));
    console.error('[viaGemini] finishReason:', response?.candidates?.[0]?.finishReason);
    throw new Error('Gemini: в ответе нет картинки (возможно сработала safety-фильтрация)');
  } catch (err) {
    console.error('[viaGemini] Error:', err);
    throw err;
  }
}

// ---------- Авто-оценка масштаба ----------
// Просим Gemini оценить реальную ширину выделенной стены в метрах по видимым
// ориентирам (дверь, окна, этаж). Нужна, чтобы класть клинкер сразу в правильном
// размере без ручной калибровки. При любой ошибке — безопасный фолбэк 4 м.
export type ScaleEstimate = { widthM: number; confidence: number; reasoning: string };

export async function estimateRegionWidthMeters(input: {
  roomImageUrl: string;
  maskImageUrl?: string;
}): Promise<ScaleEstimate> {
  const fallback: ScaleEstimate = { widthM: 4, confidence: 0, reasoning: 'fallback' };
  const key = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!key) return fallback;
  try {
    const { GoogleGenAI } = await import('@google/genai');
    const client = new GoogleGenAI({ apiKey: key });

    const hasMask = !!input.maskImageUrl;
    const prompt = `IMAGE 1 is a photo of a building facade or wall.${
      hasMask ? ' IMAGE 2 is a mask: the WHITE area marks one specific wall region.' : ''
    } Estimate the real-world WIDTH in meters of ${
      hasMask ? 'the white-masked wall region' : 'the main visible wall'
    }. Use visible references for scale: a standard entrance door is about 0.9 m wide and 2.0–2.1 m tall; one storey is about 2.8–3 m; a typical window is 1.2–1.5 m; a brick course is about 0.075 m. Reply with ONLY compact JSON, no markdown: {"widthM": number, "confidence": number 0..1, "reasoning": "short"}.`;

    const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [
      { text: prompt },
      await urlToInlinePart(input.roomImageUrl),
    ];
    if (input.maskImageUrl) parts.push(await urlToInlinePart(input.maskImageUrl));

    const resp = (await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts }],
    })) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text: string =
      resp?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') ?? '';
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return fallback;
    const j = JSON.parse(m[0]);
    const w = Number(j.widthM);
    if (!Number.isFinite(w) || w <= 0) return fallback;
    return {
      widthM: Math.min(40, Math.max(0.3, w)),
      confidence: Number.isFinite(Number(j.confidence)) ? Number(j.confidence) : 0,
      reasoning: String(j.reasoning ?? ''),
    };
  } catch (err) {
    console.error('[estimateRegionWidthMeters]', err);
    return fallback;
  }
}

// ---------- Анализ геометрии плоскости (Gemini как «глаза», не рисовальщик) ----------
// Просим Gemini вернуть 4 угла плоскости стены/пола (норм. 0..1, порядок TL,TR,BR,BL) и
// реальные ширину/высоту в метрах. Эти данные нужны детерминированному перспективному
// рендеру — модель НЕ рисует пиксели, только понимает геометрию (что у неё получается).
export type PlaneCorners = {
  corners: [number, number][]; // 4 пары [x,y], нормализованные 0..1, порядок TL,TR,BR,BL
  openings: [number, number][][]; // проёмы (двери/окна) внутри плоскости — вырезать из кладки
  widthM: number;
  heightM: number;
  confidence: number;
  reasoning: string;
};

type BBoxNorm = { minX: number; minY: number; maxX: number; maxY: number };

// Фронтальный quad (без перспективы) из bbox — безопасный фолбэк.
function frontalQuad(bb: BBoxNorm): [number, number][] {
  return [
    [bb.minX, bb.minY],
    [bb.maxX, bb.minY],
    [bb.maxX, bb.maxY],
    [bb.minX, bb.maxY],
  ];
}

// Проверка валидности набора углов: ровно 4 конечные пары, площадь не вырождена.
function validCorners(c: unknown): c is [number, number][] {
  if (!Array.isArray(c) || c.length !== 4) return false;
  for (const p of c) {
    if (!Array.isArray(p) || p.length !== 2) return false;
    if (!Number.isFinite(p[0]) || !Number.isFinite(p[1])) return false;
  }
  // Площадь полигона (shoelace) — отсекаем коллинеарные/схлопнутые.
  const pts = c as [number, number][];
  let area = 0;
  for (let i = 0; i < 4; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % 4];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area) / 2 > 0.01; // > 1% единичного квадрата
}

export async function analyzeSurfacePlane(input: {
  roomImageUrl: string;
  surface: 'mask' | 'floor' | 'wall';
  maskImageUrl?: string;
  maskBBoxNorm?: BBoxNorm;
}): Promise<PlaneCorners> {
  const fallbackBBox: BBoxNorm = input.maskBBoxNorm ?? { minX: 0.1, minY: 0.1, maxX: 0.9, maxY: 0.9 };
  const buildFallback = async (): Promise<PlaneCorners> => {
    const est = await estimateRegionWidthMeters({
      roomImageUrl: input.roomImageUrl,
      maskImageUrl: input.maskImageUrl,
    });
    const bw = fallbackBBox.maxX - fallbackBBox.minX;
    const bh = fallbackBBox.maxY - fallbackBBox.minY;
    const aspect = bw > 0 ? bh / bw : 0.6;
    return {
      corners: frontalQuad(fallbackBBox),
      openings: [],
      widthM: est.widthM,
      heightM: Math.min(40, Math.max(0.3, est.widthM * aspect)),
      confidence: 0,
      reasoning: 'fallback (frontal quad)',
    };
  };

  const key = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!key) return buildFallback();

  try {
    const { GoogleGenAI } = await import('@google/genai');
    const client = new GoogleGenAI({ apiKey: key });

    const target =
      input.surface === 'floor'
        ? 'the floor plane'
        : input.surface === 'wall'
          ? 'the main visible wall plane'
          : 'the planar wall/facade surface that the WHITE-masked region lies on';
    const maskNote = input.maskImageUrl
      ? ' IMAGE 2 is a mask: the WHITE area marks the region of interest.'
      : '';

    const prompt = `IMAGE 1 is a photo of a room interior or building facade.${maskNote}
Identify ${target} and return its FOUR corners in image coordinates, NORMALIZED to 0..1 (x from left, y from top), in the order: top-left, top-right, bottom-right, bottom-left of that real-world rectangular surface as it appears (perspective) in the photo.
Also list ALL openings and non-wall objects that lie WITHIN that surface and must NOT be covered with tiles — doors, windows, gates, garage doors, wall lamps, pipes. Return each as its 4 corners (same normalized coords, TL,TR,BR,BL). Empty array if none.
Also estimate the real-world WIDTH and HEIGHT of that surface in meters, using visible references: a standard door ≈ 0.9 m wide / 2.0–2.1 m tall; one storey ≈ 2.8–3 m; a window ≈ 1.2–1.5 m; a brick course ≈ 0.075 m.
Reply with ONLY compact JSON, no markdown: {"corners":[[x,y],[x,y],[x,y],[x,y]],"openings":[[[x,y],[x,y],[x,y],[x,y]]],"widthM":number,"heightM":number,"confidence":number 0..1,"reasoning":"short"}.`;

    const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [
      { text: prompt },
      await urlToInlinePart(input.roomImageUrl),
    ];
    if (input.maskImageUrl) parts.push(await urlToInlinePart(input.maskImageUrl));

    const resp = (await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts }],
    })) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text: string =
      resp?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') ?? '';
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return buildFallback();
    const j = JSON.parse(m[0]);

    if (!validCorners(j.corners)) return buildFallback();
    const clamp01 = ([x, y]: [number, number]): [number, number] => [
      Math.min(1.1, Math.max(-0.1, x)),
      Math.min(1.1, Math.max(-0.1, y)),
    ];
    const corners = (j.corners as [number, number][]).map(clamp01);
    // Проёмы: берём только валидные четырёхугольники, остальное молча отбрасываем.
    const openings: [number, number][][] = Array.isArray(j.openings)
      ? (j.openings as unknown[])
          .filter((o): o is [number, number][] => validCorners(o))
          .map((o) => o.map(clamp01))
      : [];
    const w = Number(j.widthM);
    const h = Number(j.heightM);
    if (!Number.isFinite(w) || w <= 0) return buildFallback();

    return {
      corners,
      openings,
      widthM: Math.min(40, Math.max(0.3, w)),
      heightM: Number.isFinite(h) && h > 0 ? Math.min(40, Math.max(0.3, h)) : Math.min(40, Math.max(0.3, w * 0.6)),
      confidence: Number.isFinite(Number(j.confidence)) ? Number(j.confidence) : 0,
      reasoning: String(j.reasoning ?? ''),
    };
  } catch (err) {
    console.error('[analyzeSurfacePlane]', err);
    return buildFallback();
  }
}

// ---------- Фотореализм поверх готовой раскладки ----------
// Получает наш точный composite (плитка уже разложена в правильном размере) и просит
// Gemini только добавить свет/тени/реализм, НЕ меняя раскладку и размер плитки.
// Дополнительно показываем модели ЭТАЛОННОЕ фото выбранной плитки (IMAGE 2), чтобы
// она точно воспроизводила её текстуру/цвет, а не подменяла обобщённым кирпичом.
export async function relightComposite(
  compositeDataUrl: string,
  opts?: { tileWmm?: number; tileHmm?: number; tileName?: string; tileImageUrl?: string },
): Promise<ProviderOutput> {
  const key = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GOOGLE_API_KEY не задан');
  const { GoogleGenAI } = await import('@google/genai');
  const client = new GoogleGenAI({ apiKey: key });

  // Если знаем реальные размеры плитки — явно фиксируем форму/пропорцию, чтобы
  // relight не «починил» длинный кирпич в квадрат (частая галлюцинация клинкера).
  const shapeLock =
    opts?.tileWmm && opts?.tileHmm && opts.tileWmm > 0 && opts.tileHmm > 0
      ? ` Each tile is a ${opts.tileWmm}×${opts.tileHmm} mm rectangle (aspect ratio ${(opts.tileWmm / opts.tileHmm).toFixed(2)}:1); preserve this exact shape and proportion for every tile — never reshape it toward a square.`
      : '';

  // Подгружаем эталон плитки, если дан. При ошибке — работаем без него.
  let tilePart: { inlineData: { data: string; mimeType: string } } | null = null;
  if (opts?.tileImageUrl) {
    try {
      tilePart = await urlToInlinePart(opts.tileImageUrl);
    } catch (e) {
      console.error('[relightComposite] не удалось загрузить эталон плитки:', e);
    }
  }
  const tileName = opts?.tileName ? ` "${opts.tileName}"` : '';
  const refRule = tilePart
    ? `\n- IMAGE 2 is the EXACT clinker/brick tile${tileName} that is laid in IMAGE 1. Reproduce its real texture, color, surface relief and edges faithfully on every tile — match IMAGE 2, do not invent a generic brick.`
    : '';

  const prompt = `IMAGE 1 is a photo of a building facade where one wall area has already been covered with clinker/brick tiles laid in a correct, regular grid. The tile LAYOUT, SIZE, COUNT, positions and grout lines are FINAL and CORRECT.${tilePart ? ' IMAGE 2 is a close-up of the exact tile used.' : ''}

Hard rules:
- Do NOT move, resize, re-tile, re-arrange, add or remove any tile. Keep the exact same tile size, the exact same number of tiles and the exact same grout lines and pattern as IMAGE 1.${shapeLock}${refRule}
- ONLY make the tiled area look photorealistic: add realistic lighting, soft shadows, depth between bricks, subtle surface texture and reflections that match the lighting of the rest of the photo. Make the seams and edges of the tiled area blend naturally into the wall.
- Keep EVERYTHING outside the tiled area pixel-for-pixel identical: walls, door, windows, sky, ground, framing.
Output only the final photorealistic photo, nothing else.`;

  const part = await urlToInlinePart(compositeDataUrl);
  type GenResp = {
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
    candidates?: { content?: { parts?: { text?: string; inlineData?: { data?: string; mimeType?: string } }[] } }[];
  };
  const requestParts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [
    { text: prompt },
    part,
  ];
  if (tilePart) requestParts.push(tilePart);
  const response = (await client.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: [{ role: 'user', parts: requestParts }],
    config: { responseModalities: ['TEXT', 'IMAGE'] },
  })) as GenResp;
  const um = response?.usageMetadata || {};
  const usage: TokenUsage = {
    promptTokens: um.promptTokenCount ?? 0,
    outputTokens: um.candidatesTokenCount ?? 0,
    totalTokens: um.totalTokenCount ?? 0,
  };
  const parts = response?.candidates?.[0]?.content?.parts || [];
  for (const p of parts) {
    if (p?.inlineData?.data) {
      const mime = p.inlineData.mimeType || 'image/png';
      return { imageUrl: `data:${mime};base64,${p.inlineData.data}`, usage };
    }
  }
  throw new Error('Gemini не вернул картинку (возможно safety-фильтрация)');
}

// ---------- Структурно-зафиксированная ИИ-доводка (ControlNet) ----------
// Берёт ТОЧНЫЙ детерминированный композит (плитка уже в правильном размере/перспективе) и
// делает его фотореалистичным через img2img с НИЗКИМ strength + ControlNet (canny по сетке
// грунта). Геометрия физически не может сдвинуться. Требует FAL_KEY или REPLICATE_API_TOKEN —
// без них слой отключается и возвращается композит как есть. Gemini сюда не подходит
// (нет strength/маски/ControlNet — он перерисовывает свободно).
export type RefineProvider = 'fal' | 'replicate' | 'none';

export type RefineInput = {
  compositeUrl: string;
  maskUrl: string;
  controlUrl?: string; // карта линий грунта (control image для ControlNet)
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

export const REFINE_PROVIDERS_META: Record<RefineProvider, { label: string; price: string; envVar: string }> = {
  fal: { label: 'fal.ai · FLUX General (img2img + ControlNet canny)', price: '~$0.03–0.05', envVar: 'FAL_KEY' },
  replicate: { label: 'Replicate · FLUX ControlNet inpaint', price: '~$0.03–0.06', envVar: 'REPLICATE_API_TOKEN' },
  none: { label: 'Выкл (только детерминированный рендер)', price: 'Бесплатно', envVar: '' },
};

function pickRefineProvider(req?: RefineProvider): RefineProvider {
  if (req && req !== 'none') return req;
  const env = process.env.REFINE_PROVIDER as RefineProvider | undefined;
  if (env && env !== 'none' && REFINE_PROVIDERS_META[env]) return env;
  if (process.env.FAL_KEY) return 'fal';
  if (process.env.REPLICATE_API_TOKEN) return 'replicate';
  return 'none';
}

const REFINE_PROMPT =
  'Enhance ONLY the photorealism of the already-tiled wall/floor region: natural lighting consistent with the scene, soft contact shadows in the grout joints, subtle surface relief and micro-texture of the clinker, gentle realistic reflections. Do NOT move, resize, add, remove, re-arrange or re-colour any tile. Keep the exact tile size, count, grout lines, layout and perspective. Keep everything outside the tiled region unchanged.';
const REFINE_NEGATIVE =
  'different tile layout, resized tiles, larger bricks, new grout pattern, warped grid, distorted perspective, added objects, text, watermark';

export async function refineCompositeStructLocked(input: RefineInput): Promise<RefineResult> {
  const provider = pickRefineProvider(input.provider);
  const started = Date.now();
  if (provider === 'none') {
    return { imageUrl: input.compositeUrl, durationMs: 0, provider: 'none', refined: false };
  }
  try {
    const out = provider === 'fal' ? await refineViaFal(input) : await refineViaReplicate(input);
    return { imageUrl: out, durationMs: Date.now() - started, provider, refined: true };
  } catch (err) {
    console.error(`[refine:${provider}]`, err);
    // Любая ошибка — отдаём точный композит, продукт не ломается.
    return { imageUrl: input.compositeUrl, durationMs: Date.now() - started, provider, refined: false };
  }
}

// fal.ai: flux-control-lora-depth/image-to-image.
// depth-карта (со СЦЕНЫ) задаёт структуру и углы поверхностей, наш композит (image_url)
// задаёт цвет/текстуру плитки. Так доводка следует реальной геометрии, а не клеит
// плоскую текстуру. Чистая схема (без controlnets.path) — не валится на ValidationError.
// Депт берём из исходного фото (controlUrl=photo), иначе из самого композита.
async function refineViaFal(input: RefineInput): Promise<string> {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error('FAL_KEY не задан');
  fal.config({ credentials: key });
  const strength = input.strength ?? 0.5;

  // Уменьшаем до ~1280px перед отправкой — на полном размере inference идёт минутами.
  const depthSource = input.controlUrl ?? input.compositeUrl;
  const [imageSmall, controlSmall] = await Promise.all([
    downscaleDataUrl(input.compositeUrl, 1280),
    downscaleDataUrl(depthSource, 1280),
  ]);

  const result = (await fal.subscribe('fal-ai/flux-control-lora-depth/image-to-image', {
    input: {
      prompt: REFINE_PROMPT,
      image_url: imageSmall,
      control_lora_image_url: controlSmall,
      strength,
      num_inference_steps: 24,
    },
    logs: false,
  })) as {
    data?: { images?: { url?: string }[] };
    images?: { url?: string }[];
    image?: { url?: string };
  };
  const url: string | undefined =
    result?.data?.images?.[0]?.url ?? result?.images?.[0]?.url ?? result?.image?.url;
  if (!url) throw new Error('fal.ai: ответ без URL картинки');
  // Возвращаем изменения только внутри маски (maskedRecompose апскейлит обратно к базе).
  return maskedRecompose(input.compositeUrl, url, input.maskUrl);
}

// Replicate: flux-dev-inpainting-controlnet — нативная маска (белое=менять).
async function refineViaReplicate(input: RefineInput): Promise<string> {
  const key = process.env.REPLICATE_API_TOKEN;
  if (!key) throw new Error('REPLICATE_API_TOKEN не задан');
  const { default: Replicate } = await import('replicate');
  const client = new Replicate({ auth: key });
  const strength = input.strength ?? 0.28;

  const output = (await client.run('zsxkib/flux-dev-inpainting-controlnet', {
    input: {
      prompt: REFINE_PROMPT,
      negative_prompt: REFINE_NEGATIVE,
      image: input.compositeUrl,
      mask: input.maskUrl,
      control_image: input.controlUrl ?? input.compositeUrl,
      controlnet_type: 'canny',
      controlnet_conditioning_scale: 0.9,
      strength,
      guidance_scale: 3.5,
      num_inference_steps: 20,
      output_format: 'jpg',
    },
  })) as string | string[] | { url?: unknown };
  if (typeof output === 'string') return output;
  if (Array.isArray(output) && output[0]) {
    return typeof output[0] === 'string' ? output[0] : String(output[0]);
  }
  if (output && typeof output === 'object' && 'url' in output) {
    const u = (output as { url?: unknown }).url;
    return typeof u === 'function' ? (u as () => string)() : String(u);
  }
  throw new Error('Replicate: неожиданная форма ответа');
}

// Накладывает overlay поверх base ТОЛЬКО внутри белой зоны маски (через sharp).
// Так пиксели вне зоны плитки остаются исходными до пикселя.
export async function maskedRecompose(baseUrl: string, overlayUrl: string, maskUrl: string): Promise<string> {
  const sharp = (await import('sharp')).default;
  const [baseBuf, overlayBuf, maskBuf] = await Promise.all([
    fetchToBuffer(baseUrl),
    fetchToBuffer(overlayUrl),
    fetchToBuffer(maskUrl),
  ]);
  const base = sharp(baseBuf);
  const meta = await base.metadata();
  const W = meta.width ?? 0;
  const H = meta.height ?? 0;
  if (!W || !H) return overlayUrl;

  // overlay → ровно 3 канала RGB (без альфы), чтобы joinChannel дал RGBA.
  const overlayResized = await sharp(overlayBuf).resize(W, H, { fit: 'fill' }).removeAlpha().toBuffer();
  // Маска: белое (зона плитки) → alpha 255, чёрное → 0. 1-канальная яркость как альфа.
  const maskAlpha = await sharp(maskBuf).resize(W, H, { fit: 'fill' }).greyscale().toColourspace('b-w').toBuffer();
  const overlayMasked = await sharp(overlayResized)
    .joinChannel(maskAlpha) // маска как альфа-канал overlay → RGBA
    .png()
    .toBuffer();

  const composed = await sharp(baseBuf)
    .composite([{ input: overlayMasked, blend: 'over' }])
    .jpeg({ quality: 92 })
    .toBuffer();
  return `data:image/jpeg;base64,${composed.toString('base64')}`;
}

// Вычитает зону проёмов из маски выделения: белое там, где выделено И это НЕ проём.
// (выделение) × (НЕ проём): бел×бел=бел, бел×чёрн=чёрн. Размер берём по sizeRef.
async function subtractOpenings(userMaskUrl: string, openingsMaskUrl: string, sizeRefUrl: string): Promise<string> {
  const sharp = (await import('sharp')).default;
  const [uBuf, oBuf, refBuf] = await Promise.all([
    fetchToBuffer(userMaskUrl),
    fetchToBuffer(openingsMaskUrl),
    fetchToBuffer(sizeRefUrl),
  ]);
  const refMeta = await sharp(refBuf).metadata();
  const W = refMeta.width ?? 0;
  const H = refMeta.height ?? 0;
  if (!W || !H) return userMaskUrl;

  const user = await sharp(uBuf).resize(W, H, { fit: 'fill' }).greyscale().toColourspace('b-w').toBuffer();
  // Проёмы инвертируем: белое = НЕ проём.
  const notOpening = await sharp(oBuf).resize(W, H, { fit: 'fill' }).greyscale().negate().toColourspace('b-w').png().toBuffer();
  const out = await sharp(user)
    .composite([{ input: notOpening, blend: 'multiply' }])
    .png()
    .toBuffer();
  return `data:image/png;base64,${out.toString('base64')}`;
}

// Доля белого в маске (0..1) — защита от сегментации, «съевшей» почти всё выделение.
async function whiteFraction(maskUrl: string): Promise<number> {
  const sharp = (await import('sharp')).default;
  const buf = await fetchToBuffer(maskUrl);
  const stats = await sharp(buf).greyscale().stats();
  return (stats.channels[0]?.mean ?? 0) / 255;
}

// Детерминированная обрезка результата AI по маске выделения (+ исключение проёмов).
// Нужна потому, что gpt-image-1 не имеет нативной маски и перекладывает весь фасад —
// здесь мы оставляем плитку только в выбранной зоне, а вне её пиксели = оригинал.
export async function compositeMaskedResult(input: {
  roomImageUrl: string;
  resultUrl: string;
  maskUrl: string;
  /** requestId заранее запущенной (параллельно с рендером) EVF-SAM-сегментации проёмов.
   *  Если задан и маска успеет — окна/двери вычитаются из зоны; иначе обрезаем только по выделению. */
  segRequestId?: string | null;
}): Promise<string> {
  let effectiveMask = input.maskUrl;
  if (input.segRequestId) {
    const openingsMask = await fetchEvfSamMask(input.segRequestId);
    if (openingsMask) {
      const candidate = await subtractOpenings(input.maskUrl, openingsMask, input.roomImageUrl);
      // Защита: если после вычитания осталось <15% от выделения — сегментация ненадёжна
      // (приняла стену за проём), откатываемся к ПОЛНОМУ выделению, чтобы не показать оригинал.
      const [cf, uf] = await Promise.all([whiteFraction(candidate), whiteFraction(input.maskUrl)]);
      if (uf > 0 && cf >= 0.15 * uf) effectiveMask = candidate;
    }
  }
  return maskedRecompose(input.roomImageUrl, input.resultUrl, effectiveMask);
}

// Уменьшает картинку до maxEdge по длинной стороне и возвращает data URL (jpeg).
// Нужно, чтобы refine на flux+controlnet не считался минутами на полноразмерном фото.
async function downscaleDataUrl(url: string, maxEdge: number): Promise<string> {
  try {
    const sharp = (await import('sharp')).default;
    const buf = await fetchToBuffer(url);
    const out = await sharp(buf)
      .resize(maxEdge, maxEdge, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toBuffer();
    return `data:image/jpeg;base64,${out.toString('base64')}`;
  } catch (e) {
    console.error('[downscaleDataUrl]', e);
    return url; // на крайний случай шлём как есть
  }
}

async function fetchToBuffer(url: string): Promise<Buffer> {
  if (url.startsWith('data:')) {
    const m = url.match(/^data:[^;]+;base64,(.+)$/);
    if (!m) throw new Error('Невалидный data URL');
    return Buffer.from(m[1], 'base64');
  }
  // Ретраи с backoff: связь с fal/supabase иногда даёт транзиентный connect-timeout
  // (UND_ERR_CONNECT_TIMEOUT) → без ретраев это роняло весь composite («fetch failed»).
  // HTTP 4xx не ретраим (это не транзиентная ошибка) — пробрасываем сразу.
  const backoff = [400, 900, 1800];
  let lastErr: unknown;
  for (let attempt = 0; attempt <= backoff.length; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) {
        if (res.status >= 400 && res.status < 500) throw new Error(`HTTP ${res.status}`);
        throw new Error(`HTTP ${res.status}`); // 5xx → ретраим ниже
      }
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (/HTTP 4\d\d/.test(msg)) throw err; // клиентская ошибка — не ретраим
      if (attempt < backoff.length) {
        await new Promise((r) => setTimeout(r, backoff[attempt]));
        continue;
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

// ---------- Прямое редактирование фасада через fal (multi-image edit) ----------
// На вход — фото объекта + образец плитки (+ маска) + промпт; модель меняет только
// поверхность, сохраняя окна/двери/кадр. Модель вынесена в env RENDER_MODEL —
// по умолчанию Nano Banana 2 (Gemini-image edit): лучший «честный эдит» + цвет, и в
// ~6 раз дешевле gpt-image-1 (по бенчмарку моделей fal на нашем кейсе).
// Бенч: nano-banana-2 ≈ $0.08 vs gpt-image-1 ≈ $0.46.
const RENDER_MODEL = process.env.RENDER_MODEL || 'fal-ai/nano-banana-2/edit';
// Метка провайдера для логов/ответа (короткое имя из slug).
export const RENDER_PROVIDER_LABEL = RENDER_MODEL.split('/').slice(1).join('-') || RENDER_MODEL;
const GPT_IMAGE_ENDPOINT = RENDER_MODEL;

export type GptImageInput = {
  roomImageUrl: string;
  tileImageUrl: string;
  tileName: string;
  tileWmm?: number;
  tileHmm?: number;
  surface: 'floor' | 'wall' | 'mask';
  /** Маска кисти (белое=куда класть). Только для surface==='mask' — передаётся как IMAGE 3. */
  maskImageUrl?: string;
  /** Реальные размеры поверхности (введены пользователем) — для точного масштаба плитки.
   *  Стена/выделение: ширина×высота, м. Пол: площадь, м². Необязательно. */
  surfaceWidthM?: number;
  surfaceHeightM?: number;
  floorAreaM2?: number;
  quality?: 'low' | 'medium' | 'high';
};

// Собирает «раскладку» плитки (мини-стенку) из студийного фото — визуальный сигнал ФОРМЫ
// (размер ячейки, пропорция, шов, порядовка, рельеф), чтобы модель не перекрашивала
// обобщённую кладку. ratio = длина/высота плитки. Любая ошибка → null (рендерим без swatch).
async function buildTiledSwatch(tileImageUrl: string, ratio: number): Promise<string | null> {
  try {
    const sharp = (await import('sharp')).default;
    const tileBuf = await fetchToBuffer(tileImageUrl);
    // Срезаем студийный фон, оставляя лицо плитки.
    let face = tileBuf;
    try {
      const t = await sharp(tileBuf).trim({ threshold: 14 }).toBuffer();
      const m = await sharp(t).metadata();
      if ((m.width ?? 0) >= 24 && (m.height ?? 0) >= 24) face = t;
    } catch {
      /* фон не срезался — берём фото как есть */
    }
    const SW = 1024, SH = 1024, gap = 7;
    const grout = { r: 92, g: 90, b: 88 };
    const cols = ratio >= 2 ? 4 : ratio <= 1.2 ? 2 : 3;
    const cellW = Math.floor((SW - gap * (cols + 1)) / cols);
    const cellH = Math.max(8, Math.round(cellW / ratio));
    const rows = Math.ceil((SH + cellH) / (cellH + gap)) + 1;
    const cell = await sharp(face).resize(cellW, cellH, { fit: 'cover' }).toBuffer();
    const comps: Array<{ input: Buffer; top: number; left: number }> = [];
    for (let r = 0; r < rows; r++) {
      const top = gap + r * (cellH + gap);
      if (top + cellH > SH) break;
      const off = r % 2 ? Math.round((cellW + gap) / 2) : 0; // кирпичная порядовка
      for (let c = 0; c < cols + 1; c++) {
        const left = gap + c * (cellW + gap) - off;
        if (left < 0 || left + cellW > SW) continue; // только полностью влезающие ячейки
        comps.push({ input: cell, top, left });
      }
    }
    const out = await sharp({ create: { width: SW, height: SH, channels: 3, background: grout } })
      .composite(comps)
      .jpeg({ quality: 88 })
      .toBuffer();
    return `data:image/jpeg;base64,${out.toString('base64')}`;
  } catch (e) {
    console.error('[buildTiledSwatch]', e);
    return null;
  }
}

// Сборка входа для gpt-image-1 — общая для синхронного (subscribe) и асинхронного
// (queue.submit) путей, чтобы промпт/формат/маска не разъезжались между ними.
async function buildGptImageInput(input: GptImageInput) {
  const useMask = input.surface === 'mask' && !!input.maskImageUrl;
  const surfaceWord =
    input.surface === 'floor'
      ? 'the floor'
      : useMask
        ? 'ONLY the area marked white in the mask (IMAGE 3)'
        : 'the main facade walls (all visible wall planes of the building)';
  // Форма/размер плитки — из РЕАЛЬНЫХ размеров товара, а не хардкод «кирпич».
  // Клинкер (узкий, напр. 240×71) сам читается как кирпичная пропорция из чисел,
  // а керамогранит (напр. 600×1200) — как крупноформат, чтобы модель не дробила его
  // на мелкие кирпичи.
  let sizeHint = '';
  if (input.tileWmm && input.tileHmm) {
    const w = input.tileWmm;
    const h = input.tileHmm;
    const longer = Math.max(w, h);
    const shorter = Math.min(w, h);
    const ratio = (longer / shorter).toFixed(2);
    const orient = w === h ? 'square' : w > h ? 'wide landscape' : 'tall portrait';
    const large = longer >= 400; // крупноформатная плитка
    sizeHint =
      ` Each individual tile is a ${w}×${h} mm rectangle (${orient}, aspect ratio ${ratio}:1)` +
      (large
        ? ' — a LARGE-FORMAT tile, NOT small bricks; use big tiles with thin grout lines.'
        : '.') +
      ' Lay the tiles at exactly this real-world size and proportion — do not shrink them into small bricks and do not enlarge them.';

    // Если пользователь ввёл реальные размеры поверхности — даём ТОЧНОЕ число плиток,
    // чтобы масштаб был физически верным, а не «на глаз».
    if (input.surface !== 'floor' && input.surfaceWidthM && input.surfaceHeightM) {
      const across = Math.max(1, Math.round((input.surfaceWidthM * 1000) / w));
      const rows = Math.max(1, Math.round((input.surfaceHeightM * 1000) / h));
      sizeHint += ` The real surface is about ${input.surfaceWidthM} m wide and ${input.surfaceHeightM} m tall, so lay approximately ${across} tiles across and ${rows} rows down — match this count exactly so the tile scale is physically correct, even if the tiles end up small.`;
    } else if (input.surface === 'floor' && input.floorAreaM2) {
      const tileAreaM2 = (w / 1000) * (h / 1000);
      const total = Math.max(1, Math.round(input.floorAreaM2 / tileAreaM2));
      sizeHint += ` The real floor is about ${input.floorAreaM2} m²; each tile covers ${tileAreaM2.toFixed(2)} m², so lay approximately ${total} tiles in total — match this count so the tile scale is physically correct.`;
    }
  }
  // «Раскладка» плитки (мини-стенка) — визуальный сигнал ФОРМЫ (размер ячейки, пропорция,
  // шов, порядовка, рельеф). Без неё модель перекрашивает обобщённую кладку. null → без неё.
  const ratio = input.tileWmm && input.tileHmm ? input.tileWmm / input.tileHmm : null;
  const swatchUrl = ratio ? await buildTiledSwatch(input.tileImageUrl, ratio) : null;

  // Нумерация картинок: 1=фото, 2=плитка, [3=раскладка], [последняя=маска].
  const images: string[] = [input.roomImageUrl, input.tileImageUrl];
  let swatchIdx = 0;
  let maskIdx = 0;
  if (swatchUrl) { images.push(swatchUrl); swatchIdx = images.length; }
  if (useMask) { images.push(input.maskImageUrl as string); maskIdx = images.length; }

  const maskNote = useMask
    ? ` IMAGE ${maskIdx} is a binary mask of IMAGE 1: change ONLY the white region, keep the black region pixel-identical.`
    : '';
  const swatchNote = swatchUrl
    ? ` IMAGE ${swatchIdx} shows the SAME tile laid as a wall — use it for the EXACT unit size, proportion, grout joints and coursing/bond.`
    : '';

  // Material-lock по названию товара — главная защита от «дерева вместо клинкера»:
  // жёстко фиксируем тип материала и требование точного цвета IMAGE 2.
  const nm = input.tileName.toLowerCase();
  let materialLock = '';
  if (nm.includes('клинкер') || nm.includes('clinker')) {
    materialLock =
      ' This is a fired-clay CLINKER BRICK: the result MUST be real brick masonry — many small bricks laid in regular courses with grout joints. It must NEVER look like wood, planks, siding, panels or large slabs. Reproduce the EXACT colour and hue of IMAGE 2.';
  } else if (nm.includes('керамогранит') || nm.includes('porcelain') || nm.includes('gres')) {
    materialLock =
      ' This is LARGE-FORMAT PORCELAIN/GRES tile: use big rectangular tiles with thin grout lines — NOT small bricks and NOT wood. Reproduce the EXACT colour and pattern of IMAGE 2.';
  } else if (nm.includes('мозаик') || nm.includes('mosaic')) {
    materialLock =
      ' This is MOSAIC: use small mosaic tesserae in a fine regular grid. Reproduce the EXACT colour and pattern of IMAGE 2.';
  }

  const layoutRule = swatchUrl
    ? `Lay the tiles EXACTLY like IMAGE ${swatchIdx}: same unit shape and size, same grout joints, same coursing/bond — do not change the format into a generic brick.`
    : 'Lay the tiles in correct coursing with aligned grout lines, wrapping correctly around building corners.';

  const prompt = `IMAGE 1 is a real photograph of a building. IMAGE 2 is a single sample of the tile "${input.tileName}" — use it for the EXACT colour, surface finish and 3D surface relief (grooves/bevels).${swatchNote}${materialLock}${maskNote}
Re-clad ${surfaceWord} in IMAGE 1 with this tile:
- ${layoutRule}${sizeHint}
- Reproduce the EXACT colour, hue, finish and the 3D surface relief of IMAGE 2 — keep the surface textured/embossed, not flat; do not invent a different tile, do not shift the colour, do not default to a generic brick or to wood.
- Follow the TRUE perspective and angles of every wall surface.
- Do NOT cover or change windows, doors, frames, window sills, lamps, decorative trim, balconies, the roof, ground, sky, plants — keep all of them pixel-identical and tile cleanly AROUND them.
- Match the original photo's lighting, shadows and reflections.
Output a single photorealistic edited photograph, nothing else.`;

  const image_urls = images;

  // Параметры зависят от модели. gpt-image-1 принимает input_fidelity/quality/image_size;
  // nano-banana / seedream / flux-2 edit — только prompt + image_urls (лишние поля могут
  // ломать валидацию). По умолчанию модель — nano-banana-2 (минимальный вход).
  if (GPT_IMAGE_ENDPOINT.includes('gpt-image-1')) {
    // gpt-image-1 отдаёт только 1024x1024 / 1536x1024 / 1024x1536; подбираем под пропорцию.
    const image_size = await pickGptImageSize(input.roomImageUrl);
    return {
      prompt,
      image_urls,
      input_fidelity: 'high' as const,
      quality: input.quality ?? ('high' as const),
      image_size,
      output_format: 'jpeg' as const,
    };
  }
  return { prompt, image_urls };
}

type GptImageResult = { images?: { url?: string }[]; data?: { images?: { url?: string }[] } };

// Синхронный рендер (subscribe держит соединение весь рендер ~60-90с). Подходит для
// локали/скриптов; на проде за прокси с таймаутом используем очередь — см. submit/poll.
export async function editFacadeViaGptImage(input: GptImageInput): Promise<ProviderOutput> {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error('FAL_KEY не задан');
  fal.config({ credentials: key });

  const falInput = await buildGptImageInput(input);
  const result = (await fal.subscribe(GPT_IMAGE_ENDPOINT, {
    input: falInput,
    logs: false,
  })) as GptImageResult;
  const url = result?.images?.[0]?.url ?? result?.data?.images?.[0]?.url;
  if (!url) throw new Error('gpt-image-1: ответ без URL картинки');
  return { imageUrl: url };
}

// Асинхронно: ставим рендер в очередь fal и сразу возвращаем requestId — HTTP-запрос
// НЕ ждёт рендер, поэтому таймауты Cloudflare/Caddy (504/524) больше не при чём.
export async function submitGptImageJob(input: GptImageInput): Promise<{ requestId: string }> {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error('FAL_KEY не задан');
  fal.config({ credentials: key });

  const falInput = await buildGptImageInput(input);
  const submitted = (await fal.queue.submit(GPT_IMAGE_ENDPOINT, {
    input: falInput,
  })) as { request_id: string };
  return { requestId: submitted.request_id };
}

export type GptImageJobState =
  | { status: 'in_progress' }
  | { status: 'completed'; imageUrl: string }
  | { status: 'failed'; error: string };

// Опрос статуса очереди. Пока не COMPLETED → in_progress; на готовности забираем результат.
export async function pollGptImageJob(requestId: string): Promise<GptImageJobState> {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error('FAL_KEY не задан');
  fal.config({ credentials: key });

  const st = (await fal.queue.status(GPT_IMAGE_ENDPOINT, {
    requestId,
    logs: false,
  })) as { status?: string };
  if (st.status !== 'COMPLETED') return { status: 'in_progress' };

  try {
    const result = (await fal.queue.result(GPT_IMAGE_ENDPOINT, { requestId })) as GptImageResult;
    const url = result?.data?.images?.[0]?.url ?? result?.images?.[0]?.url;
    if (!url) return { status: 'failed', error: 'gpt-image-1: ответ без URL картинки' };
    // Забираем результат сразу в data URL (с ретраями) — чтобы следующий шаг (composite)
    // не пере-фетчил картинку по сети: на флаки-связи с fal это роняло «fetch failed».
    // Не получилось скачать — отдаём URL как есть (хуже не будет).
    try {
      const buf = await fetchToBuffer(url);
      const mime = buf[0] === 0x89 && buf[1] === 0x50 ? 'image/png' : 'image/jpeg';
      return { status: 'completed', imageUrl: `data:${mime};base64,${buf.toString('base64')}` };
    } catch {
      return { status: 'completed', imageUrl: url };
    }
  } catch (err) {
    return { status: 'failed', error: err instanceof Error ? err.message : 'gpt-image-1: ошибка рендера' };
  }
}

// Подбор формата вывода gpt-image-1 под пропорцию исходного фото (чтобы не обрезал/зумил).
async function pickGptImageSize(imageUrl: string): Promise<'1024x1024' | '1536x1024' | '1024x1536'> {
  try {
    const sharp = (await import('sharp')).default;
    const buf = await fetchToBuffer(imageUrl);
    const meta = await sharp(buf).metadata();
    const w = meta.width ?? 1;
    const h = meta.height ?? 1;
    const ratio = w / h;
    if (ratio > 1.2) return '1536x1024'; // горизонтальное
    if (ratio < 0.83) return '1024x1536'; // вертикальное
    return '1024x1024'; // близко к квадрату
  } catch {
    return '1536x1024';
  }
}

// ---------- Пиксельная сегментация поверхности (fal EVF-SAM) ----------
// Возвращает бинарную маску (белое = поверхность) для стены/пола, точно по пикселям
// исключая двери/окна/фонари через negative_prompt. Это надёжнее, чем грубые рамки
// проёмов от Gemini. Требует FAL_KEY. data URL фото подаётся как image_url.
export async function segmentSurfaceMask(input: {
  imageUrl: string;
  surface: 'floor' | 'wall';
}): Promise<string | null> {
  const key = process.env.FAL_KEY;
  if (!key) return null;
  fal.config({ credentials: key });

  const prompt = input.surface === 'floor' ? 'floor, ground, paving' : 'wall, building facade wall surface';
  const negative_prompt =
    'door, gate, garage door, window, glass, balcony, lamp, light fixture, sconce, sign, pipe, downspout, plant, bush, tree, sky, roof, person, car';

  try {
    const result = (await fal.subscribe('fal-ai/evf-sam', {
      input: {
        image_url: input.imageUrl,
        prompt,
        negative_prompt,
        mask_only: true,
        fill_holes: true,
      },
      logs: false,
    })) as EvfSamResult;
    // fal.subscribe отдаёт { data, requestId } — маска лежит в data.image.url.
    const url = result?.data?.image?.url ?? result?.image?.url;
    if (!url) return null;
    const buf = await fetchToBuffer(url);
    return `data:image/png;base64,${buf.toString('base64')}`;
  } catch (e) {
    console.error('[segmentSurfaceMask]', e);
    return null;
  }
}

const EVF_SAM_ENDPOINT = 'fal-ai/evf-sam';
type EvfSamResult = { image?: { url?: string }; data?: { image?: { url?: string } } };

// Сегментируем ПРОЁМЫ (окна/двери/витрины), а НЕ «стену»: их потом вычитаем из выделения.
// Позитивный промпт безопаснее — если проёмов нет или они не нашлись, выделение остаётся
// целым и плитка ложится на весь выбранный участок (а не «ничего не наложилось»).
const EVF_OPENINGS_PROMPT =
  'window, glass, door, glass door, gate, garage door, balcony door, shop window, storefront, wall lamp, light fixture';

// Ставим EVF-SAM-сегментацию проёмов в очередь fal — ПАРАЛЛЕЛЬНО с рендером gpt-image-1
// (холодный старт ~78с перекрывается рендером, а не висит отдельным синхронным запросом).
export async function submitEvfSamJob(input: { imageUrl: string }): Promise<{ requestId: string }> {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error('FAL_KEY не задан');
  fal.config({ credentials: key });

  const submitted = (await fal.queue.submit(EVF_SAM_ENDPOINT, {
    input: { image_url: input.imageUrl, prompt: EVF_OPENINGS_PROMPT, mask_only: true, fill_holes: true },
  })) as { request_id: string };
  return { requestId: submitted.request_id };
}

// Забираем готовую маску EVF-SAM по requestId (задача уже запущена параллельно).
// Ждём максимум timeoutMs; не готово/ошибка → null (composite откатится на обрезку без проёмов).
export async function fetchEvfSamMask(requestId: string, timeoutMs = 20000): Promise<string | null> {
  const key = process.env.FAL_KEY;
  if (!key) return null;
  fal.config({ credentials: key });
  const deadline = Date.now() + timeoutMs;
  try {
    while (Date.now() < deadline) {
      const st = (await fal.queue.status(EVF_SAM_ENDPOINT, { requestId, logs: false })) as { status?: string };
      if (st.status === 'COMPLETED') {
        const result = (await fal.queue.result(EVF_SAM_ENDPOINT, { requestId })) as EvfSamResult;
        const url = result?.data?.image?.url ?? result?.image?.url;
        if (!url) return null;
        const buf = await fetchToBuffer(url);
        return `data:image/png;base64,${buf.toString('base64')}`;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  } catch (e) {
    console.error('[fetchEvfSamMask]', e);
  }
  return null;
}

// ---------- Mock ----------
async function viaMock(input: VisualizeInput): Promise<ProviderOutput> {
  // Имитируем задержку настоящего инференса
  await new Promise((r) => setTimeout(r, 1500 + Math.random() * 1500));
  // Возвращаем тайл-картинку как "результат" — для офлайн-демо
  return { imageUrl: input.tileImageUrl };
}

// ---------- Helpers ----------
async function urlToInlinePart(
  url: string,
): Promise<{ inlineData: { data: string; mimeType: string } }> {
  if (url.startsWith('data:')) {
    const match = url.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) throw new Error('Невалидный data URL');
    return { inlineData: { mimeType: match[1], data: match[2] } };
  }

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const mime = res.headers.get('content-type') || 'image/jpeg';
    return { inlineData: { mimeType: mime, data: buf.toString('base64') } };
  } catch (err) {
    console.error(`[urlToInlinePart] Failed to fetch ${url}:`, err);
    // Return a simple 1x1 transparent PNG as fallback
    const placeholder = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    return { inlineData: { mimeType: 'image/png', data: placeholder } };
  }
}

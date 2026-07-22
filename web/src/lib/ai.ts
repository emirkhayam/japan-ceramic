/**
 * Обёртка над AI-визуализацией.
 * Переключение: через env AI_PROVIDER или через поле `provider` в запросе.
 */
import { fal } from '@fal-ai/client';

export type Provider = 'fal' | 'mock';
export type Pattern = 'stack' | 'offset-half' | 'offset-third' | 'herringbone';
export type Orientation = 'horizontal' | 'vertical';
export type Grout = 'match' | 'contrast' | 'minimal';

export type VisualizeInput = {
  roomImageUrl: string;
  tileImageUrls: string[];
  tileName: string;
  tileDimensions?: string;
  surface: 'floor' | 'wall';
  pattern: Pattern;
  orientation: Orientation;
  grout: Grout;
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

export const PROVIDERS_META: Record<
  Provider,
  { label: string; price: string; free: boolean; envVar: string }
> = {
  fal: {
    label: 'fal.ai · Nano Banana Pro (Gemini 3 Pro Image)',
    price: '≈13,12 сом / картинка',
    free: false,
    envVar: 'FAL_KEY',
  },
  mock: {
    label: 'Демо (без живого AI)',
    price: 'Бесплатно',
    free: true,
    envVar: '',
  },
};

function pickProvider(requested?: Provider): Provider {
  if (requested === 'fal' || requested === 'mock') return requested;
  const fromEnv = process.env.AI_PROVIDER;
  if (fromEnv === 'fal' || fromEnv === 'mock') return fromEnv;
  if (process.env.FAL_KEY) return 'fal';
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

  const surfaceWord = input.surface === 'floor' ? 'floor' : 'one main wall';
  const lastReferenceNumber = input.tileImageUrls.length + 1;
  const patternInstruction: Record<Pattern, string> = {
    stack: 'straight stacked rows with every joint aligned and no row offset',
    'offset-half': 'running bond with each row offset by exactly one-half of a tile',
    'offset-third': 'running bond with each row offset by exactly one-third of a tile',
    herringbone: 'a true herringbone layout',
  };
  const orientationInstruction: Record<Orientation, string> = {
    horizontal: 'the long side of each tile runs horizontally and the rows run horizontally',
    vertical: 'the long side of each tile runs vertically and the rows run vertically',
  };
  const groutInstruction: Record<Grout, string> = {
    match: 'use grout matching the tile tone, with thin seams',
    contrast: 'use a contrasting grout color that clearly emphasizes each tile',
    minimal: 'use minimal, nearly invisible seams',
  };
  const dimensions = input.tileDimensions
    ? /(?:mm|мм)\s*$/i.test(input.tileDimensions.trim())
      ? input.tileDimensions.trim().replace(/мм\s*$/i, 'mm')
      : `${input.tileDimensions.trim()} mm`
    : null;
  const additionalInstruction = input.note
    ? `\n\nAdditional user instruction (higher priority): ${JSON.stringify(input.note)}.`
    : '';

  const prompt = `You are a photorealistic interior visualization engine.

REFERENCE IMAGES:
- IMAGE 1 is a photo of a real room.
- IMAGES 2..${lastReferenceNumber} are reference variations of ONE AND THE SAME tile product ${JSON.stringify(input.tileName)}. They show its natural differences in tone, shade, surface relief and texture; they are not different products.

TASK:
Completely re-surface the ${surfaceWord} in IMAGE 1 with this tile, fully replacing the existing covering.

TILE CHARACTER — STRICT ACCURACY:
- Faithfully reproduce the exact color palette, texture, geometry, material character, surface relief and visual identity of the tile shown in IMAGES 2..${lastReferenceNumber}.
- NEVER substitute a different or generic tile.
- Fully remove the ORIGINAL ${surfaceWord} material; do not keep, blend with or echo its pattern.

NATURAL VARIATION — FREE:
- Real ceramic and clinker tiles vary naturally in tone, shade and relief between individual tiles. Mix the provided reference variations naturally across the surface.
- No two adjacent tiles should look perfectly identical. Avoid all visible repetition and cloning artifacts while preserving the tile product's exact character.

LAYOUT — STRICT:
- Pattern: ${patternInstruction[input.pattern]}.
- Orientation: ${orientationInstruction[input.orientation]}.
- Grout: ${groutInstruction[input.grout]}.
- Lay the tiles in correct perspective for the ${surfaceWord}; all seams must follow the room's vanishing lines.

REAL-WORLD SCALE — STRICT:
${dimensions
  ? `- Each tile is exactly ${dimensions} in real life. Render every tile at the correct real-world scale relative to the room; do not enlarge it.`
  : '- Render the tiles at a believable real-world scale relative to the room; do not enlarge them.'}

SCENE INTEGRITY — STRICT:
- Preserve the original photo's lighting, shadows and reflections so the new surface sits naturally.
- Keep EVERYTHING else identical: walls, ceiling, furniture, windows, decor and camera framing. Change only the ${surfaceWord}.
- Output only the final edited photo, nothing else.${additionalInstruction}`;

  // fal не может скачать локальные/непубличные URL (localhost) — инлайним все изображения.
  const imageUris = await Promise.all(
    [input.roomImageUrl, ...input.tileImageUrls].map(toDataUri),
  );

  const result = await fal.subscribe('fal-ai/nano-banana-pro/edit', {
    input: {
      prompt,
      image_urls: imageUris,
    },
    logs: false,
  });

  const url = result.data.images[0]?.url;
  if (!url) throw new Error('Ответ fal.ai без URL картинки');
  return { imageUrl: url };
}

async function toDataUri(url: string): Promise<string> {
  if (url.startsWith('data:')) return url;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Не удалось загрузить изображение (HTTP ${res.status}): ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const mime = res.headers.get('content-type') || 'image/jpeg';
  return `data:${mime};base64,${buf.toString('base64')}`;
}

// ---------- Mock ----------
async function viaMock(input: VisualizeInput): Promise<ProviderOutput> {
  // Имитируем задержку настоящего инференса
  await new Promise((r) => setTimeout(r, 1500 + Math.random() * 1500));
  // Возвращаем тайл-картинку как "результат" — для офлайн-демо
  return { imageUrl: input.tileImageUrls[0] };
}

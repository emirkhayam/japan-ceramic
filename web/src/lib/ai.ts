/**
 * Обёртка над AI-визуализацией.
 * Переключение: через env AI_PROVIDER или через поле `provider` в запросе.
 */
import { fal } from '@fal-ai/client';

export type Provider = 'fal' | 'mock';
export type Surface = 'floor' | 'wall' | 'facade';
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
  tileDimensions?: string;
  surface: Surface;
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
  const tileCharacterInstruction = `TILE CHARACTER — STRICT ACCURACY:
- Faithfully reproduce the exact color palette, texture, geometry, material character, surface relief and visual identity of the tile shown in IMAGES 2..${lastReferenceNumber}.
- NEVER substitute a different or generic tile.
- Fully remove the ORIGINAL ${input.surface === 'facade' ? 'material inside every selected clinker zone' : `${surfaceWord} material`}; do not keep, blend with or echo its pattern.`;
  const naturalVariationInstruction = `NATURAL VARIATION — FREE:
- Real ceramic and clinker tiles vary naturally in tone, shade and relief between individual tiles. Mix the provided reference variations naturally across the surface.
- No two adjacent tiles should look perfectly identical. Avoid all visible repetition and cloning artifacts while preserving the tile product's exact character.`;
  const layoutInstruction = `LAYOUT — STRICT:
- Pattern: ${patternInstruction[input.pattern]}.
- Orientation: ${orientationInstruction[input.orientation]}.
- Grout: ${groutInstruction[input.grout]}.`;
  const realWorldScaleInstruction = (scaleTarget: 'room' | 'building') => `REAL-WORLD SCALE — STRICT:
${dimensions
  ? `- Each tile is exactly ${dimensions} in real life. Render every tile at the correct real-world scale relative to the ${scaleTarget}; do not enlarge it.`
  : `- Render the tiles at a believable real-world scale relative to the ${scaleTarget}; do not enlarge them.`}`;

  const prompt = input.surface === 'facade'
    ? buildFacadePrompt({
        input,
        lastReferenceNumber,
        tileCharacterInstruction,
        naturalVariationInstruction,
        layoutInstruction,
        realWorldScaleInstruction: realWorldScaleInstruction('building'),
        additionalInstruction,
      })
    : `You are a photorealistic interior visualization engine.

REFERENCE IMAGES:
- IMAGE 1 is a photo of a real room.
- IMAGES 2..${lastReferenceNumber} are reference variations of ONE AND THE SAME tile product ${JSON.stringify(input.tileName)}. They show its natural differences in tone, shade, surface relief and texture; they are not different products.

TASK:
Completely re-surface the ${surfaceWord} in IMAGE 1 with this tile, fully replacing the existing covering.

${tileCharacterInstruction}

${naturalVariationInstruction}

${layoutInstruction}
- Lay the tiles in correct perspective for the ${surfaceWord}; all seams must follow the room's vanishing lines.

${realWorldScaleInstruction('room')}

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

function buildFacadePrompt({
  input,
  lastReferenceNumber,
  tileCharacterInstruction,
  naturalVariationInstruction,
  layoutInstruction,
  realWorldScaleInstruction,
  additionalInstruction,
}: {
  input: VisualizeInput;
  lastReferenceNumber: number;
  tileCharacterInstruction: string;
  naturalVariationInstruction: string;
  layoutInstruction: string;
  realWorldScaleInstruction: string;
  additionalInstruction: string;
}): string {
  const requestedZones: FacadeZone[] = input.zones?.length ? input.zones : ['full'];
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
${zones.map((zone) => `  - ${zoneInstruction[zone as Exclude<FacadeZone, 'full'>]}.`).join('\n')}`;

  return `You are a photorealistic exterior facade visualization engine.

REFERENCE IMAGES:
- IMAGE 1 is a photo of a real house. It may be unfinished, with bare brick, block or concrete walls.
- IMAGES 2..${lastReferenceNumber} are reference variations of ONE AND THE SAME clinker tile product ${JSON.stringify(input.tileName)}. They show its natural differences in tone, shade, surface relief and texture; they are not different products.

TASK:
Photorealistically clad this house's facade with the clinker tile from IMAGES 2..${lastReferenceNumber}.
${facadeTreatment}

${tileCharacterInstruction}

${naturalVariationInstruction}

${layoutInstruction}
- Lay the tiles in correct perspective on every treated facade plane; all seams must follow the building's perspective and geometry.

${realWorldScaleInstruction}

SCENE INTEGRITY — STRICT:
- Preserve the building's exact geometry, proportions and architectural details.
- Keep the roof, windows, doors, yard/site, sky and original lighting identical.
- Preserve natural shadows and reflections so the new facade finishes sit naturally in the photo.
- Do not change the camera angle or framing. Do NOT zoom in or crop: the output must show the exact same field of view as IMAGE 1, with the entire building visible exactly as in the original photo, at the same aspect ratio.
- Output only the final edited photo, nothing else.${additionalInstruction}`;
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

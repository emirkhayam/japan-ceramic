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
  surface: 'floor' | 'wall';
  provider?: Provider;
};

export type VisualizeResult = {
  imageUrl: string;
  durationMs: number;
  provider: Provider;
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

const SURFACE_PROMPT: Record<VisualizeInput['surface'], string> = {
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
  let imageUrl: string;

  try {
    switch (provider) {
      case 'fal':
        imageUrl = await viaFal(input);
        break;
      case 'replicate':
        imageUrl = await viaReplicate(input);
        break;
      case 'gemini':
        imageUrl = await viaGemini(input);
        break;
      case 'mock':
      default:
        imageUrl = await viaMock(input);
    }
  } catch (err) {
    throw new Error(
      `[${provider}] ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return { imageUrl, durationMs: Date.now() - started, provider };
}

// ---------- fal.ai ----------
async function viaFal(input: VisualizeInput): Promise<string> {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error('FAL_KEY не задан в .env.local');
  fal.config({ credentials: key });

  const prompt = `${SURFACE_PROMPT[input.surface]} The tile is: ${input.tileName}. Photorealistic interior design rendering, high detail.`;

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
  return url;
}

// ---------- Replicate ----------
async function viaReplicate(input: VisualizeInput): Promise<string> {
  const key = process.env.REPLICATE_API_TOKEN;
  if (!key) throw new Error('REPLICATE_API_TOKEN не задан в .env.local');

  // Lazy-load to avoid breaking build when not installed
  const { default: Replicate } = await import('replicate');
  const client = new Replicate({ auth: key });

  const prompt = `${SURFACE_PROMPT[input.surface]} Tile texture: ${input.tileName}. Apply the reference tile to the surface.`;

  const output: any = await client.run('black-forest-labs/flux-kontext-pro', {
    input: {
      prompt,
      input_image: input.roomImageUrl,
      aspect_ratio: 'match_input_image',
      output_format: 'jpg',
      safety_tolerance: 5,
    },
  });

  if (typeof output === 'string') return output;
  if (Array.isArray(output) && output[0]) {
    return typeof output[0] === 'string' ? output[0] : String(output[0]);
  }
  if (output?.url) return typeof output.url === 'function' ? output.url() : output.url;
  throw new Error('Replicate: неожиданная форма ответа');
}

// ---------- Google Gemini 2.5 Flash Image ----------
async function viaGemini(input: VisualizeInput): Promise<string> {
  const key = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GOOGLE_API_KEY не задан в .env.local');

  console.log('[viaGemini] Starting, API key present:', !!key);

  try {
    const { GoogleGenAI } = await import('@google/genai');
    console.log('[viaGemini] GoogleGenAI imported');

    const client = new GoogleGenAI({ apiKey: key });
    console.log('[viaGemini] Client created');

    const [roomPart, tilePart] = await Promise.all([
      urlToInlinePart(input.roomImageUrl),
      urlToInlinePart(input.tileImageUrl),
    ]);
    console.log('[viaGemini] Images loaded, room size:', roomPart.inlineData.data.length, 'tile size:', tilePart.inlineData.data.length);

    const surfaceWord = input.surface === 'floor' ? 'floor' : 'one main wall';
    const prompt = `You are a photorealistic interior visualization engine. IMAGE 1 is a photo of a real room. IMAGE 2 is a seamless ceramic tile texture/swatch called "${input.tileName}".

Task: re-render IMAGE 1 with the ${surfaceWord} surfaced in EXACTLY the tile from IMAGE 2.

Hard rules:
- Reproduce the tile's real pattern, color, veining and grout from IMAGE 2 as faithfully as possible — do NOT invent a different tile.
- Lay the tiles in correct perspective for the ${surfaceWord}, with realistic seams between tiles that follow the floor/wall vanishing lines.
- Preserve the original photo's lighting, shadows and reflections so the new surface sits naturally.
- Keep EVERYTHING else identical: walls, ceiling, furniture, windows, decor, camera framing — change only the ${surfaceWord}.
Output only the final edited photo, nothing else.`;

    console.log('[viaGemini] Calling Gemini API...');
    const response: any = await client.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }, roomPart, tilePart],
        },
      ],
      config: { responseModalities: ['TEXT', 'IMAGE'] },
    });
    console.log('[viaGemini] Response received:', JSON.stringify(response).substring(0, 500));

    const parts = response?.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part?.inlineData?.data) {
        const mime = part.inlineData.mimeType || 'image/png';
        console.log('[viaGemini] Image found in response, size:', part.inlineData.data.length);
        return `data:${mime};base64,${part.inlineData.data}`;
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

// ---------- Mock ----------
async function viaMock(input: VisualizeInput): Promise<string> {
  // Имитируем задержку настоящего инференса
  await new Promise((r) => setTimeout(r, 1500 + Math.random() * 1500));
  // Возвращаем тайл-картинку как "результат" — для офлайн-демо
  return input.tileImageUrl;
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

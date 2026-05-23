import { NextResponse } from 'next/server';
import { getTileById } from '@/lib/tiles';
import { visualize, type Provider } from '@/lib/ai';
import { lookupCache } from '@/lib/demo-cache';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Body = {
  roomImage: string;
  tileId: string;
  surface: 'floor' | 'wall';
  provider?: Provider;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { roomImage, tileId, surface, provider } = body;
  if (!roomImage || !tileId || !surface) {
    return NextResponse.json(
      { error: 'roomImage, tileId, and surface are required' },
      { status: 400 },
    );
  }

  const tile = getTileById(tileId);
  if (!tile) {
    return NextResponse.json({ error: `Unknown tile: ${tileId}` }, { status: 400 });
  }

  const origin = req.headers.get('origin') || new URL(req.url).origin;
  const tileImageUrl = tile.image.startsWith('http')
    ? tile.image
    : `${origin}${tile.image}`;

  const cachedProvider = provider || 'auto';
  const cached = await lookupCache({
    roomImage,
    tileId,
    surface,
    provider: cachedProvider,
  });
  if (cached) {
    return NextResponse.json({
      imageUrl: cached.startsWith('http') ? cached : `${origin}${cached}`,
      durationMs: 0,
      provider: 'cache',
      tile: { id: tile.id, name: tile.name },
    });
  }

  try {
    const result = await visualize({
      roomImageUrl: roomImage,
      tileImageUrl,
      tileName: `${tile.name} (${tile.texture}, ${tile.size})`,
      surface,
      provider,
    });

    return NextResponse.json({
      imageUrl: result.imageUrl,
      durationMs: result.durationMs,
      provider: result.provider,
      tile: { id: tile.id, name: tile.name },
    });
  } catch (err) {
    console.error('[visualize]', err);
    const message = err instanceof Error ? err.message : 'Generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  // Возвращаем список провайдеров и какие из них настроены (имеется ключ)
  return NextResponse.json({
    providers: {
      fal: !!process.env.FAL_KEY,
      replicate: !!process.env.REPLICATE_API_TOKEN,
      gemini: !!(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY),
      mock: true,
    },
    default:
      process.env.AI_PROVIDER ||
      (process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY
        ? 'gemini'
        : process.env.FAL_KEY
          ? 'fal'
          : process.env.REPLICATE_API_TOKEN
            ? 'replicate'
            : 'mock'),
  });
}

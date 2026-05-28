import { NextResponse } from 'next/server';
import { getTileById } from '@/lib/tiles';
import { visualize, type Provider } from '@/lib/ai';
import { lookupCache } from '@/lib/demo-cache';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Body = {
  roomImage: string;
  tileId: string;
  surface: 'floor' | 'wall';
  provider?: Provider;
};

export async function POST(req: Request) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json(
      { error: 'Войдите в аккаунт, чтобы пользоваться визуализатором' },
      { status: 401 },
    );
  }

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

  // Try static tiles first, then database products
  const staticTile = getTileById(tileId);
  const origin = req.headers.get('origin') || new URL(req.url).origin;

  let tileName: string;
  let tileImageUrl: string;
  let tileKey: string;

  if (staticTile) {
    tileName = `${staticTile.name} (${staticTile.texture}, ${staticTile.size})`;
    tileImageUrl = staticTile.image.startsWith('http')
      ? staticTile.image
      : `${origin}${staticTile.image}`;
    tileKey = staticTile.id;
  } else {
    // Look up in database by slug or id
    const dbProduct = await prisma.product.findFirst({
      where: { OR: [{ slug: tileId }, { id: tileId }] },
      include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } },
    });
    if (!dbProduct) {
      return NextResponse.json({ error: `Unknown tile: ${tileId}` }, { status: 400 });
    }
    tileName = `${dbProduct.name}${dbProduct.dimensions ? ` (${dbProduct.dimensions})` : ''}`;
    const img = dbProduct.images[0]?.imageUrl;
    if (!img) {
      return NextResponse.json({ error: 'У товара нет изображения для визуализации' }, { status: 400 });
    }
    tileImageUrl = img.startsWith('http') ? img : `${origin}${img}`;
    tileKey = dbProduct.slug;
  }

  const cachedProvider = provider || 'auto';
  const cached = await lookupCache({
    roomImage,
    tileId: tileKey,
    surface,
    provider: cachedProvider,
  });
  if (cached) {
    return NextResponse.json({
      imageUrl: cached.startsWith('http') ? cached : `${origin}${cached}`,
      durationMs: 0,
      provider: 'cache',
      tile: { id: tileKey, name: tileName },
    });
  }

  try {
    const result = await visualize({
      roomImageUrl: roomImage,
      tileImageUrl,
      tileName,
      surface,
      provider,
    });

    return NextResponse.json({
      imageUrl: result.imageUrl,
      durationMs: result.durationMs,
      provider: result.provider,
      tile: { id: tileKey, name: tileName },
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

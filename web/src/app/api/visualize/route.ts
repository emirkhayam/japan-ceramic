import { NextResponse } from 'next/server';
import { getTileById } from '@/lib/tiles';
import {
  visualize,
  type Grout,
  type Orientation,
  type Pattern,
  type Provider,
} from '@/lib/ai';
import { lookupCache } from '@/lib/demo-cache';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Body = {
  roomImage?: unknown;
  tileId?: unknown;
  surface?: unknown;
  provider?: unknown;
  pattern?: unknown;
  orientation?: unknown;
  grout?: unknown;
  note?: unknown;
};

const PATTERNS: Pattern[] = ['stack', 'offset-half', 'offset-third', 'herringbone'];
const ORIENTATIONS: Orientation[] = ['horizontal', 'vertical'];
const GROUTS: Grout[] = ['match', 'contrast', 'minimal'];

export async function POST(req: Request) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json(
      { error: 'Войдите в аккаунт, чтобы пользоваться визуализатором' },
      { status: 401 },
    );
  }
  if (user.status !== 'approved') {
    return NextResponse.json(
      { error: 'Доступ к визуализатору открывается после одобрения заявки менеджером.' },
      { status: 403 },
    );
  }

  let body: Body;
  try {
    const parsed: unknown = await req.json();
    body = parsed !== null && typeof parsed === 'object' ? (parsed as Body) : {};
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const roomImage = typeof body.roomImage === 'string' ? body.roomImage : '';
  const tileId = typeof body.tileId === 'string' ? body.tileId : '';
  const surface = body.surface === 'floor' || body.surface === 'wall' ? body.surface : null;
  const provider: Provider | undefined =
    body.provider === 'fal' || body.provider === 'mock' ? body.provider : undefined;
  const requestedPattern = PATTERNS.includes(body.pattern as Pattern)
    ? (body.pattern as Pattern)
    : undefined;
  const orientation: Orientation = ORIENTATIONS.includes(body.orientation as Orientation)
    ? (body.orientation as Orientation)
    : 'horizontal';
  const grout: Grout = GROUTS.includes(body.grout as Grout)
    ? (body.grout as Grout)
    : 'match';
  const note =
    typeof body.note === 'string' && body.note.length <= 300
      ? body.note.trim() || undefined
      : undefined;
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
  let tileImageUrls: string[];
  let tileDimensions: string | undefined;
  let tileKey: string;
  let isClinker: boolean;

  if (staticTile) {
    tileName = `${staticTile.name} (${staticTile.texture}, ${staticTile.size})`;
    tileImageUrls = [resolveImageUrl(staticTile.image, origin)];
    tileDimensions = staticSizeToMillimeters(staticTile.size);
    tileKey = staticTile.id;
    isClinker = staticTile.type === 'clinker';
  } else {
    // Look up in database by slug or id
    const dbProduct = await prisma.product.findFirst({
      where: { OR: [{ slug: tileId }, { id: tileId }] },
      include: {
        category: true,
        images: { orderBy: { sortOrder: 'asc' }, take: 4 },
      },
    });
    if (!dbProduct) {
      return NextResponse.json({ error: `Unknown tile: ${tileId}` }, { status: 400 });
    }
    tileName = `${dbProduct.name}${dbProduct.dimensions ? ` (${dbProduct.dimensions})` : ''}`;
    tileImageUrls = dbProduct.images.map((image) => resolveImageUrl(image.imageUrl, origin));
    if (tileImageUrls.length === 0) {
      return NextResponse.json({ error: 'У товара нет изображения для визуализации' }, { status: 400 });
    }
    tileDimensions = dbProduct.dimensions || undefined;
    tileKey = dbProduct.slug;
    const categoryIdentity = `${dbProduct.category.slug} ${dbProduct.category.name}`.toLowerCase();
    isClinker = categoryIdentity.includes('clinker') || categoryIdentity.includes('клинкер');
  }

  const defaultPattern: Pattern = isClinker ? 'offset-half' : 'stack';
  const pattern = requestedPattern ?? defaultPattern;
  const settings = { pattern, orientation, grout, note: note ?? '' };
  const hasDefaultSettings =
    pattern === defaultPattern &&
    orientation === 'horizontal' &&
    grout === 'match' &&
    !note;

  const cachedProvider = provider || 'auto';
  // Старые демо-кэши не учитывают параметры укладки, поэтому используем их
  // только для полностью дефолтного запроса.
  const cached = hasDefaultSettings
    ? await lookupCache({
        roomImage,
        tileId: tileKey,
        surface,
        provider: cachedProvider,
      })
    : null;
  if (cached) {
    await logVisualization({ userId: user.id, tileSlug: tileKey, tileName, surface, provider: 'cache' });
    return NextResponse.json({
      imageUrl: cached.startsWith('http') ? cached : `${origin}${cached}`,
      durationMs: 0,
      provider: 'cache',
      tile: { id: tileKey, name: tileName },
      settings,
    });
  }

  try {
    const result = await visualize({
      roomImageUrl: roomImage,
      tileImageUrls,
      tileName,
      tileDimensions,
      surface,
      pattern,
      orientation,
      grout,
      note,
      provider,
    });

    await logVisualization({
      userId: user.id,
      tileSlug: tileKey,
      tileName,
      surface,
      provider: result.provider,
      promptTokens: result.usage?.promptTokens ?? 0,
      outputTokens: result.usage?.outputTokens ?? 0,
      totalTokens: result.usage?.totalTokens ?? 0,
    });

    return NextResponse.json({
      imageUrl: result.imageUrl,
      durationMs: result.durationMs,
      provider: result.provider,
      tile: { id: tileKey, name: tileName },
      settings,
    });
  } catch (err) {
    console.error('[visualize]', err);
    const message = err instanceof Error ? err.message : 'Generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function resolveImageUrl(url: string, origin: string): string {
  if (url.startsWith('data:')) return url;
  return new URL(url, origin).toString();
}

function staticSizeToMillimeters(size: string): string {
  return `${size.replace(/\d+(?:[.,]\d+)?/g, (value) => {
    const millimeters = Number(value.replace(',', '.')) * 10;
    return String(millimeters);
  })}mm`;
}

// Пишем лог визуализации. Ошибка лога не должна ломать ответ пользователю.
async function logVisualization(data: {
  userId: string;
  tileSlug: string;
  tileName: string;
  surface: 'floor' | 'wall';
  provider: string;
  promptTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}) {
  try {
    await prisma.visualizationLog.create({
      data: {
        userId: data.userId,
        tileSlug: data.tileSlug,
        tileName: data.tileName,
        surface: data.surface,
        provider: data.provider,
        promptTokens: data.promptTokens ?? 0,
        outputTokens: data.outputTokens ?? 0,
        totalTokens: data.totalTokens ?? 0,
        success: true,
      },
    });
  } catch (err) {
    console.error('[visualize] не удалось записать лог:', err);
  }
}

export async function GET() {
  // Возвращаем список провайдеров и какие из них настроены (имеется ключ)
  return NextResponse.json({
    providers: {
      fal: !!process.env.FAL_KEY,
      mock: true,
    },
    default: process.env.FAL_KEY ? 'fal' : 'mock',
  });
}

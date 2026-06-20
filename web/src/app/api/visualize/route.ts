import { NextResponse } from 'next/server';
import { getTileById } from '@/lib/tiles';
import { visualize, submitGptImageJob, submitEvfSamJob, type Provider } from '@/lib/ai';
import { lookupCache } from '@/lib/demo-cache';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { parseTileSize } from '@/lib/tile';

export const runtime = 'nodejs';
export const maxDuration = 300;

type Body = {
  roomImage: string;
  tileId: string;
  surface: 'floor' | 'wall' | 'mask';
  /** PNG-маска (data URL): белое = куда класть плитку. Обязательна при surface==='mask'. */
  maskImage?: string;
  /** Реальная ширина поверхности (стена/выделение), в метрах. Для корректного масштаба плитки. */
  regionWidthM?: number;
  /** Реальная высота поверхности (стена/выделение), в метрах. Даёт число рядов плиток. */
  regionHeightM?: number;
  /** Реальная площадь пола, м² (для surface==='floor'). */
  floorAreaM2?: number;
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
  if (user.status !== 'approved') {
    return NextResponse.json(
      { error: 'Доступ к визуализатору открывается после одобрения заявки менеджером.' },
      { status: 403 },
    );
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { roomImage, tileId, surface, maskImage, provider } = body;
  if (!roomImage || !tileId || !surface) {
    return NextResponse.json(
      { error: 'roomImage, tileId, and surface are required' },
      { status: 400 },
    );
  }
  if (surface === 'mask' && !maskImage) {
    return NextResponse.json(
      { error: 'Выделите участок кистью перед генерацией' },
      { status: 400 },
    );
  }

  // Try static tiles first, then database products
  const staticTile = getTileById(tileId);
  const origin = req.headers.get('origin') || new URL(req.url).origin;

  let tileName: string;
  let tileImageUrl: string;
  let tileKey: string;
  let tileDimsRaw: string | null = null;

  if (staticTile) {
    tileName = `${staticTile.name} (${staticTile.texture}, ${staticTile.size})`;
    tileImageUrl = staticTile.image.startsWith('http')
      ? staticTile.image
      : `${origin}${staticTile.image}`;
    tileKey = staticTile.id;
    tileDimsRaw = staticTile.size;
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
    tileDimsRaw = dbProduct.dimensions ?? null;
  }

  const parsedDims = parseTileSize(tileDimsRaw);

  // Основной движок — gpt-image-1 (через fal): понимает сцену, перспективу, окна/двери
  // и накладывает плитку реалистично. Рендер ~60-90с, поэтому НЕ ждём его в этом запросе
  // (иначе прокси рвёт соединение → 504), а ставим в очередь fal и отдаём requestId.
  // Клиент опрашивает /api/visualize/status. Включается при наличии FAL_KEY.
  if (process.env.FAL_KEY) {
    try {
      // Для режима выделения параллельно запускаем EVF-SAM-сегментацию поверхности —
      // её холодный старт (~78с) перекрывается рендером, а composite заберёт результат
      // по segRequestId и вычтет окна/двери из выбранной зоны.
      const [gpt, seg] = await Promise.all([
        submitGptImageJob({
          roomImageUrl: roomImage,
          tileImageUrl,
          tileName,
          tileWmm: parsedDims?.w,
          tileHmm: parsedDims?.h,
          surface,
          maskImageUrl: maskImage,
          surfaceWidthM: body.regionWidthM,
          surfaceHeightM: body.regionHeightM,
          floorAreaM2: body.floorAreaM2,
        }),
        surface === 'mask'
          ? submitEvfSamJob({ imageUrl: roomImage }).catch((e) => {
              console.error('[visualize:evf-sam] submit failed (продолжим без исключения проёмов):', e);
              return null;
            })
          : Promise.resolve(null),
      ]);
      // Лог пишем при постановке задачи — здесь весь контекст (юзер/плитка/поверхность);
      // токены у gpt-image-1 не отдаются (usageMetadata только у Gemini), поэтому нули.
      await logVisualization({
        userId: user.id, tileSlug: tileKey, tileName, surface, provider: 'gpt-image-1',
      });
      return NextResponse.json({
        async: true,
        requestId: gpt.requestId,
        segRequestId: seg?.requestId ?? null,
        provider: 'gpt-image-1',
        tile: { id: tileKey, name: tileName },
      });
    } catch (err) {
      // fal — основной движок. Раньше здесь был тихий фолбэк в legacy visualize() →
      // viaGemini, который маскировал настоящую ошибку fal чужим «429 Gemini».
      // Теперь возвращаем реальную ошибку fal как есть, чтобы её было видно.
      console.error('[visualize:gpt-image-1] submit failed:', err);
      const message = err instanceof Error ? err.message : 'fal: не удалось поставить рендер в очередь';
      return NextResponse.json(
        { error: `fal (gpt-image-1): ${message}` },
        { status: 502 },
      );
    }
  }

  // Реальный масштаб (старый путь — Gemini/прочие провайдеры) для surface==='mask'.
  const scale:
    | { tilesAcross: number; tilesDown?: number; tileWmm: number; tileHmm: number }
    | undefined = undefined;

  // Для floor/wall числа плиток не считаем, но реальные размеры плитки передаём.
  const tileDims =
    surface !== 'mask' && parsedDims ? { wmm: parsedDims.w, hmm: parsedDims.h } : undefined;

  // Маска уникальна на каждый запрос — кэш демо-сцен здесь не применим.
  const cachedProvider = provider || 'auto';
  const cached =
    surface === 'mask'
      ? null
      : await lookupCache({
          roomImage,
          tileId: tileKey,
          surface,
          provider: cachedProvider,
        });
  if (cached) {
    await logVisualization({ userId: user.id, tileSlug: tileKey, tileName, surface, provider: 'cache' });
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
      maskImageUrl: maskImage,
      scale,
      tileDims,
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
    });
  } catch (err) {
    console.error('[visualize]', err);
    const message = err instanceof Error ? err.message : 'Generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Пишем лог визуализации. Ошибка лога не должна ломать ответ пользователю.
async function logVisualization(data: {
  userId: string;
  tileSlug: string;
  tileName: string;
  surface: 'floor' | 'wall' | 'mask';
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

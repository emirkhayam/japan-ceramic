import { NextResponse } from 'next/server';
import {
  RENDER_PROVIDER_LABEL,
  submitEvfSamJob,
  submitGptImageJob,
  visualize,
  type FacadeBaseColor,
  type FacadeZone,
  type Grout,
  type Orientation,
  type Pattern,
  type Provider,
  type Surface,
  type VisualizeInput,
} from '@/lib/ai';
import { getSession } from '@/lib/auth';
import { lookupCache } from '@/lib/demo-cache';
import { prisma } from '@/lib/db';
import {
  resolveTileSize,
  tilesAcross as countTilesAcross,
  tilesDown as countTilesDown,
} from '@/lib/tile';
import { getTileById } from '@/lib/tiles';

export const runtime = 'nodejs';
export const maxDuration = 300;

type Body = {
  roomImage?: unknown;
  tileId?: unknown;
  surface?: unknown;
  maskImage?: unknown;
  regionWidthM?: unknown;
  regionHeightM?: unknown;
  floorAreaM2?: unknown;
  provider?: unknown;
  pattern?: unknown;
  orientation?: unknown;
  grout?: unknown;
  zones?: unknown;
  baseColor?: unknown;
  note?: unknown;
};

const DAILY_VISUALIZATION_LIMIT = 5;
const PATTERNS: Pattern[] = ['stack', 'offset-half', 'offset-third', 'herringbone'];
const ORIENTATIONS: Orientation[] = ['horizontal', 'vertical'];
const GROUTS: Grout[] = ['match', 'contrast', 'minimal'];
const FACADE_ZONES: FacadeZone[] = [
  'full',
  'between-windows',
  'around-windows',
  'corners',
  'plinth',
  'columns',
];
const FACADE_BASE_COLORS: FacadeBaseColor[] = ['white', 'beige', 'grey'];

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

  // Личный дневной лимит и глобальный месячный бюджет независимы и работают вместе.
  if (user.role !== 'admin') {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const todayCount = await prisma.visualizationLog.count({
      where: { userId: user.id, createdAt: { gte: dayStart } },
    });
    if (todayCount >= DAILY_VISUALIZATION_LIMIT) {
      return NextResponse.json(
        {
          error: `Дневной лимит визуализаций исчерпан (${DAILY_VISUALIZATION_LIMIT} в день). Попробуйте завтра.`,
        },
        { status: 429 },
      );
    }
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
  const surface: Surface | null =
    body.surface === 'floor' ||
    body.surface === 'wall' ||
    body.surface === 'mask' ||
    body.surface === 'facade'
      ? body.surface
      : null;
  const maskImage = typeof body.maskImage === 'string' ? body.maskImage : undefined;
  const provider: Provider | undefined =
    body.provider === 'fal' || body.provider === 'mock' ? body.provider : undefined;
  const requestedPattern = PATTERNS.includes(body.pattern as Pattern)
    ? (body.pattern as Pattern)
    : undefined;
  const requestedOrientation = ORIENTATIONS.includes(
    body.orientation as Orientation,
  )
    ? (body.orientation as Orientation)
    : undefined;
  const grout: Grout = GROUTS.includes(body.grout as Grout)
    ? (body.grout as Grout)
    : 'match';
  const zones = normalizeFacadeZones(body.zones);
  const baseColor: FacadeBaseColor = FACADE_BASE_COLORS.includes(
    body.baseColor as FacadeBaseColor,
  )
    ? (body.baseColor as FacadeBaseColor)
    : 'white';
  const note =
    typeof body.note === 'string' ? body.note.trim().slice(0, 300) || undefined : undefined;

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

  const budgetResponse = await checkMonthlyGenerationBudget();
  if (budgetResponse) return budgetResponse;

  // Товар из БД приоритетнее статического каталога при совпадающем id/slug.
  const dbProduct = await prisma.product.findFirst({
    where: { OR: [{ slug: tileId }, { id: tileId }] },
    include: {
      category: true,
      images: { orderBy: { sortOrder: 'asc' }, take: 4 },
    },
  });
  const staticTile = dbProduct ? undefined : getTileById(tileId);
  const origin = req.headers.get('origin') || new URL(req.url).origin;

  let tileName: string;
  let tileImageUrls: string[];
  let tileKey: string;
  let tileDims: { wmm: number; hmm: number };
  let isClinker: boolean;

  if (dbProduct) {
    tileDims = toTileDims(resolveTileSize(dbProduct.dimensions, dbProduct.name));
    tileName = `${dbProduct.name} (${formatTileDimensions(tileDims)})`;
    tileImageUrls = dbProduct.images.map((image) =>
      resolveImageUrl(image.imageUrl, origin),
    );
    if (tileImageUrls.length === 0) {
      return NextResponse.json(
        { error: 'У товара нет изображения для визуализации' },
        { status: 400 },
      );
    }
    tileKey = dbProduct.slug;
    const categoryIdentity =
      `${dbProduct.category.slug} ${dbProduct.category.name}`.toLowerCase();
    isClinker =
      categoryIdentity.includes('clinker') || categoryIdentity.includes('клинкер');
  } else if (staticTile) {
    const dimensionsMm = staticSizeToMillimeters(staticTile.size);
    tileDims = toTileDims(resolveTileSize(dimensionsMm, staticTile.name));
    tileName = `${staticTile.name} (${staticTile.texture}, ${formatTileDimensions(tileDims)})`;
    tileImageUrls = [resolveImageUrl(staticTile.image, origin)];
    tileKey = staticTile.id;
    isClinker = staticTile.type === 'clinker';
  } else {
    return NextResponse.json({ error: `Unknown tile: ${tileId}` }, { status: 400 });
  }

  const defaultPattern: Pattern =
    surface === 'facade' || isClinker ? 'offset-half' : 'stack';
  const pattern = requestedPattern ?? defaultPattern;
  const defaultOrientation: Orientation =
    tileDims.hmm > tileDims.wmm ? 'vertical' : 'horizontal';
  const orientation = requestedOrientation ?? defaultOrientation;
  const settings = {
    pattern,
    orientation,
    grout,
    note: note ?? '',
    ...(surface === 'facade' ? { zones, baseColor } : {}),
  };
  const hasDefaultSettings =
    pattern === defaultPattern &&
    orientation === defaultOrientation &&
    grout === 'match' &&
    !note &&
    (surface !== 'facade' ||
      (zones.length === 1 && zones[0] === 'full' && baseColor === 'white'));

  const cached =
    surface !== 'mask' && hasDefaultSettings
      ? await lookupCache({
          roomImage,
          tileId: tileKey,
          surface,
          provider: provider || 'auto',
        })
      : null;
  if (cached) {
    await logVisualization({
      userId: user.id,
      tileSlug: tileKey,
      tileName,
      surface,
      provider: 'cache',
    });
    return NextResponse.json({
      imageUrl: cached.startsWith('http') ? cached : `${origin}${cached}`,
      durationMs: 0,
      provider: 'cache',
      tile: { id: tileKey, name: tileName },
      settings,
    });
  }

  const widthM = positiveNumber(body.regionWidthM);
  const heightM = positiveNumber(body.regionHeightM);
  const floorAreaM2 = positiveNumber(body.floorAreaM2);
  const horizontalTileMm =
    orientation === 'vertical' ? tileDims.hmm : tileDims.wmm;
  const verticalTileMm =
    orientation === 'vertical' ? tileDims.wmm : tileDims.hmm;
  const scale =
    surface !== 'floor' && widthM
      ? {
          tilesAcross: countTilesAcross(widthM, horizontalTileMm),
          ...(heightM ? { tilesDown: countTilesDown(heightM, verticalTileMm) } : {}),
          tileWmm: tileDims.wmm,
          tileHmm: tileDims.hmm,
        }
      : undefined;
  const visualizeInput: VisualizeInput = {
    roomImageUrl: roomImage,
    tileImageUrls,
    tileName,
    tileDims,
    surface,
    maskImageUrl: maskImage,
    scale,
    floorAreaM2: surface === 'floor' ? floorAreaM2 : undefined,
    pattern,
    orientation,
    grout,
    ...(surface === 'facade' ? { zones, baseColor } : {}),
    note,
    provider,
  };

  const useAsyncFal =
    Boolean(process.env.FAL_KEY) &&
    provider !== 'mock' &&
    process.env.AI_PROVIDER !== 'mock';
  if (useAsyncFal) {
    try {
      const [renderJob, segmentationJob] = await Promise.all([
        submitGptImageJob(visualizeInput),
        surface === 'mask'
          ? submitEvfSamJob({ imageUrl: roomImage }).catch((err) => {
              console.error(
                '[visualize:evf-sam] submit failed; продолжим без исключения проёмов:',
                err,
              );
              return null;
            })
          : Promise.resolve(null),
      ]);
      await logVisualization({
        userId: user.id,
        tileSlug: tileKey,
        tileName,
        surface,
        provider: RENDER_PROVIDER_LABEL,
      });
      return NextResponse.json({
        async: true,
        requestId: renderJob.requestId,
        segRequestId: segmentationJob?.requestId ?? null,
        provider: RENDER_PROVIDER_LABEL,
        tile: { id: tileKey, name: tileName },
        settings,
      });
    } catch (err) {
      console.error('[visualize:nano-banana] submit failed:', err);
      const message =
        err instanceof Error ? err.message : 'не удалось поставить рендер в очередь';
      return NextResponse.json(
        { error: `fal (nano-banana-pro/edit): ${message}` },
        { status: 502 },
      );
    }
  }

  try {
    const result = await visualize(visualizeInput);
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

function normalizeFacadeZones(value: unknown): FacadeZone[] {
  const validZones = Array.isArray(value)
    ? value.filter(
        (zone): zone is FacadeZone =>
          typeof zone === 'string' && FACADE_ZONES.includes(zone as FacadeZone),
      )
    : [];
  const uniqueZones = [...new Set(validZones)];
  if (uniqueZones.includes('full')) return ['full'];
  return uniqueZones.length > 0 ? uniqueZones : ['full'];
}

function positiveNumber(value: unknown): number | undefined {
  const number =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value.replace(',', '.'))
        : Number.NaN;
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function resolveImageUrl(url: string, origin: string): string {
  if (url.startsWith('data:')) return url;
  return new URL(url, origin).toString();
}

function staticSizeToMillimeters(size: string): string {
  return size.replace(/\d+(?:[.,]\d+)?/g, (value) => {
    const millimeters = Number(value.replace(',', '.')) * 10;
    return String(millimeters);
  });
}

function toTileDims(size: { w: number; h: number }): { wmm: number; hmm: number } {
  return { wmm: size.w, hmm: size.h };
}

function formatTileDimensions(tileDims: { wmm: number; hmm: number }): string {
  return `${tileDims.wmm}×${tileDims.hmm} mm`;
}

async function checkMonthlyGenerationBudget(): Promise<NextResponse | null> {
  const settings = await prisma.siteSettings.findUnique({
    where: { id: 'default' },
    select: { aiTokenBudget: true },
  });
  const budget = settings?.aiTokenBudget;
  // Значения >1000 принадлежат старому токенному масштабу.
  if (budget == null || budget < 1 || budget > 1000) return null;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthCount = await prisma.visualizationLog.count({
    where: { createdAt: { gte: monthStart } },
  });
  if (monthCount < budget) return null;
  return NextResponse.json(
    { error: 'Месячный лимит AI-генераций исчерпан. Обратитесь к администратору.' },
    { status: 429 },
  );
}

async function logVisualization(data: {
  userId: string;
  tileSlug: string;
  tileName: string;
  surface: Surface;
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
  return NextResponse.json({
    providers: {
      fal: Boolean(process.env.FAL_KEY),
      mock: true,
    },
    default:
      process.env.AI_PROVIDER === 'mock' || !process.env.FAL_KEY ? 'mock' : 'fal',
  });
}

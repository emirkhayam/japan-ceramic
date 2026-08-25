import { NextResponse } from 'next/server';
import {
  RENDER_PROVIDER_LABEL,
  chatOrchestrate,
  submitChatVisualizationJob,
  type ChatDecision,
} from '@/lib/ai';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import {
  DAILY_VISUALIZATION_LIMIT,
  remainingDailyGenerations,
  remainingMonthlyBudget,
} from '@/lib/limits';
import { resolveTileSize } from '@/lib/tile';
import { getTileById } from '@/lib/tiles';
import {
  logVisualization,
  resolveImageUrl,
  staticSizeToMillimeters,
  toTileDims,
} from '@/lib/visualization';

export const runtime = 'nodejs';
export const maxDuration = 120;

type Body = {
  baseImage?: unknown;
  sceneImages?: unknown;
  tileId?: unknown;
  tileImages?: unknown;
  tileName?: unknown;
  tileWmm?: unknown;
  tileHmm?: unknown;
  referenceImage?: unknown;
  message?: unknown;
  tileChanged?: unknown;
  history?: unknown;
  strongEdit?: unknown;
};

type HistoryItem = {
  role: 'user' | 'assistant';
  text: string;
};

function validateHistory(value: unknown): HistoryItem[] {
  if (!Array.isArray(value) || value.length > 16) return [];
  const history: HistoryItem[] = [];
  for (const item of value) {
    if (
      item === null ||
      typeof item !== 'object' ||
      !('role' in item) ||
      !('text' in item) ||
      (item.role !== 'user' && item.role !== 'assistant') ||
      typeof item.text !== 'string' ||
      item.text.length > 600
    ) {
      return [];
    }
    history.push({ role: item.role, text: item.text });
  }
  return history;
}

function normalizeImageArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    return null;
  }
  return value.map((item) => item.trim()).filter(Boolean);
}

function positiveNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

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
    return NextResponse.json({ error: 'Некорректный JSON' }, { status: 400 });
  }

  let sceneImages: string[];
  if (body.sceneImages === undefined) {
    const baseImage =
      typeof body.baseImage === 'string' ? body.baseImage.trim() : '';
    sceneImages = baseImage ? [baseImage] : [];
  } else {
    const normalizedSceneImages = normalizeImageArray(body.sceneImages);
    if (!normalizedSceneImages) {
      return NextResponse.json(
        { error: 'sceneImages должен быть массивом строк' },
        { status: 400 },
      );
    }
    sceneImages = normalizedSceneImages.slice(0, 4);
  }

  const tileId = typeof body.tileId === 'string' ? body.tileId.trim() : '';
  const normalizedTileImages =
    body.tileImages === undefined ? [] : normalizeImageArray(body.tileImages);
  if (normalizedTileImages === null) {
    return NextResponse.json(
      { error: 'tileImages должен быть массивом строк' },
      { status: 400 },
    );
  }
  const customTileName =
    typeof body.tileName === 'string' ? body.tileName.trim() : '';
  const tileWmm = positiveNumber(body.tileWmm);
  const tileHmm = positiveNumber(body.tileHmm);
  const referenceImage =
    typeof body.referenceImage === 'string'
      ? body.referenceImage.trim() || undefined
      : undefined;
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const tileChanged = body.tileChanged === true;
  const strongEdit = body.strongEdit === true;
  const history = validateHistory(body.history);

  if (message.length < 1 || message.length > 500) {
    return NextResponse.json(
      { error: 'Сообщение должно содержать от 1 до 500 символов' },
      { status: 400 },
    );
  }

  const origin = req.headers.get('origin') || new URL(req.url).origin;

  // Плитка опциональна для входа/вопросов; обязательна только для рендера.
  const hasTile = Boolean(tileId) || normalizedTileImages.length > 0;
  let tileName = '';
  let tileImageUrls: string[] = [];
  let tileKey = '';
  let tileDims: { wmm: number; hmm: number } | undefined;

  if (tileId) {
    const dbProduct = await prisma.product.findFirst({
      where: { OR: [{ slug: tileId }, { id: tileId }] },
      include: {
        category: true,
        images: { orderBy: { sortOrder: 'asc' }, take: 4 },
      },
    });
    const staticTile = dbProduct ? undefined : getTileById(tileId);

    if (dbProduct) {
      tileDims = toTileDims(
        resolveTileSize(dbProduct.dimensions, dbProduct.name),
      );
      tileName = dbProduct.name;
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
    } else if (staticTile) {
      const dimensionsMm = staticSizeToMillimeters(staticTile.size);
      tileDims = toTileDims(resolveTileSize(dimensionsMm, staticTile.name));
      tileName = staticTile.name;
      tileImageUrls = [resolveImageUrl(staticTile.image, origin)];
      tileKey = staticTile.id;
    } else {
      return NextResponse.json(
        { error: `Не удалось найти плитку: ${tileId}` },
        { status: 400 },
      );
    }
  } else if (normalizedTileImages.length > 0) {
    tileName = customTileName || 'Своя плитка';
    tileImageUrls = normalizedTileImages.map((image) =>
      resolveImageUrl(image, origin),
    );
    tileKey = 'custom';
    tileDims =
      tileWmm && tileHmm ? { wmm: tileWmm, hmm: tileHmm } : undefined;
  }

  const hasBaseImage = sceneImages.length > 0;
  let decision: ChatDecision;
  try {
    decision = await chatOrchestrate({
      userMessage: message,
      history,
      tileName,
      tileDims,
      hasTile,
      hasBaseImage,
      tileChanged,
    });
  } catch (err) {
    console.error('[visualize:chat] orchestration failed:', err);
    const reason =
      err instanceof Error ? err.message : 'не удалось получить ответ ассистента';
    return NextResponse.json(
      { error: `fal (openrouter/router): ${reason}` },
      { status: 502 },
    );
  }

  if (decision.action === 'reply') {
    return NextResponse.json({ reply: decision.reply });
  }

  // Рендер требует и плитку, и фото объекта. Оркестратор уже отсекает эти случаи
  // (переводит в reply), но подстраховываемся здесь, чтобы не уйти в сабмит зря.
  if (!hasTile || !hasBaseImage) {
    const missing: string[] = [];
    if (!hasTile) {
      missing.push('выберите плитку (кнопка «Плитка» вверху) или загрузите фото своей');
    }
    if (!hasBaseImage) missing.push('прикрепите фото объекта');
    return NextResponse.json({
      reply: `Чтобы сделать визуализацию, ${missing.join(' и ')}.`,
    });
  }

  const [dailyRemaining, monthlyRemaining] = await Promise.all([
    remainingDailyGenerations(user.id),
    remainingMonthlyBudget(),
  ]);
  const requestedJobs = sceneImages.length;
  const remaining = Math.min(
    dailyRemaining,
    monthlyRemaining ?? requestedJobs,
  );
  if (remaining <= 0) {
    const limitReply =
      dailyRemaining <= 0
        ? `Дневной лимит визуализаций исчерпан (${DAILY_VISUALIZATION_LIMIT} в день). Попробуйте завтра.`
        : 'Месячный лимит AI-генераций исчерпан. Обратитесь к администратору.';
    return NextResponse.json({ reply: limitReply });
  }

  const launch = Math.min(requestedJobs, remaining);
  const limitNotice =
    launch < requestedJobs
      ? `Сегодня осталось ${launch} генераций — сделаю ${launch} из ${requestedJobs} ракурсов.`
      : '';
  const reply = [decision.reply.trim(), limitNotice].filter(Boolean).join(' ');
  const jobs: { requestId: string; sceneIndex: number }[] = [];
  let lastSubmitError: unknown;

  for (let sceneIndex = 0; sceneIndex < launch; sceneIndex += 1) {
    try {
      const renderJob = await submitChatVisualizationJob({
        baseImageUrl: sceneImages[sceneIndex],
        tileImageUrls,
        tileName,
        tileDims,
        referenceImageUrl: referenceImage,
        userMessage: decision.imagePrompt ?? message,
        tileChanged,
        strongEdit,
      });
      jobs.push({ requestId: renderJob.requestId, sceneIndex });
      await logVisualization({
        userId: user.id,
        tileSlug: tileKey,
        tileName,
        surface: 'chat',
        provider: RENDER_PROVIDER_LABEL,
      });
    } catch (err) {
      lastSubmitError = err;
      console.error(
        `[visualize:chat] submit failed for scene ${sceneIndex}:`,
        err,
      );
    }
  }

  if (jobs.length === 0) {
    const errorMessage =
      lastSubmitError instanceof Error
        ? lastSubmitError.message
        : 'не удалось поставить рендер в очередь';
    return NextResponse.json(
      { error: `fal (${RENDER_PROVIDER_LABEL}): ${errorMessage}` },
      { status: 502 },
    );
  }

  return NextResponse.json({
    async: true,
    jobs,
    reply,
    provider: RENDER_PROVIDER_LABEL,
    tile: { id: tileKey, name: tileName },
  });
}

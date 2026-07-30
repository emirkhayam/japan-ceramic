import { NextResponse } from 'next/server';
import {
  RENDER_PROVIDER_LABEL,
  chatOrchestrate,
  submitChatVisualizationJob,
  type ChatDecision,
} from '@/lib/ai';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { checkDailyLimit, checkMonthlyBudget } from '@/lib/limits';
import { resolveTileSize } from '@/lib/tile';
import { getTileById } from '@/lib/tiles';
import {
  logVisualization,
  resolveImageUrl,
  staticSizeToMillimeters,
  toTileDims,
} from '@/lib/visualization';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Body = {
  baseImage?: unknown;
  tileId?: unknown;
  message?: unknown;
  tileChanged?: unknown;
  history?: unknown;
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

  const baseImage =
    typeof body.baseImage === 'string' ? body.baseImage.trim() : '';
  const tileId = typeof body.tileId === 'string' ? body.tileId.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const tileChanged = body.tileChanged === true;
  const history = validateHistory(body.history);

  if (!tileId) {
    return NextResponse.json({ error: 'Выберите плитку' }, { status: 400 });
  }
  if (message.length < 1 || message.length > 500) {
    return NextResponse.json(
      { error: 'Сообщение должно содержать от 1 до 500 символов' },
      { status: 400 },
    );
  }

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

  if (dbProduct) {
    tileDims = toTileDims(resolveTileSize(dbProduct.dimensions, dbProduct.name));
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

  let decision: ChatDecision;
  try {
    decision = await chatOrchestrate({
      userMessage: message,
      history,
      tileName,
      tileDims,
      hasBaseImage: Boolean(baseImage),
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

  if (!baseImage) {
    return NextResponse.json({
      reply: 'Прикрепите фото помещения или фасада, чтобы запустить визуализацию.',
    });
  }

  if (user.role !== 'admin') {
    const dailyLimitError = await checkDailyLimit(user.id);
    if (dailyLimitError) {
      return NextResponse.json({ reply: dailyLimitError });
    }
  }

  const monthlyBudgetError = await checkMonthlyBudget();
  if (monthlyBudgetError) {
    return NextResponse.json({ reply: monthlyBudgetError });
  }

  try {
    const renderJob = await submitChatVisualizationJob({
      baseImageUrl: baseImage,
      tileImageUrls,
      tileName,
      tileDims,
      userMessage: decision.imagePrompt ?? message,
      tileChanged,
    });
    await logVisualization({
      userId: user.id,
      tileSlug: tileKey,
      tileName,
      surface: 'chat',
      provider: RENDER_PROVIDER_LABEL,
    });
    return NextResponse.json({
      async: true,
      requestId: renderJob.requestId,
      reply: decision.reply,
      provider: RENDER_PROVIDER_LABEL,
      tile: { id: tileKey, name: tileName },
    });
  } catch (err) {
    console.error('[visualize:chat] submit failed:', err);
    const message =
      err instanceof Error ? err.message : 'не удалось поставить рендер в очередь';
    return NextResponse.json(
      { error: `fal (${RENDER_PROVIDER_LABEL}): ${message}` },
      { status: 502 },
    );
  }
}

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { refineCompositeStructLocked } from '@/lib/ai';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Структурно-зафиксированная ИИ-доводка: берёт точный композит (плитка уже в правильном
// размере/перспективе) + маску + карту сетки → фотореализм через ControlNet, НЕ меняя
// раскладку. Требует FAL_KEY; без него возвращает композит как есть.
export async function POST(req: Request) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: 'Войдите в аккаунт' }, { status: 401 });
  }
  if (user.status !== 'approved') {
    return NextResponse.json(
      { error: 'Доступ к визуализатору открывается после одобрения заявки менеджером.' },
      { status: 403 },
    );
  }

  let body: {
    compositeImage?: string;
    maskImage?: string;
    controlImage?: string;
    tileSlug?: string;
    tileName?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!body.compositeImage || !body.maskImage) {
    return NextResponse.json({ error: 'compositeImage и maskImage обязательны' }, { status: 400 });
  }

  try {
    const result = await refineCompositeStructLocked({
      compositeUrl: body.compositeImage,
      maskUrl: body.maskImage,
      controlUrl: body.controlImage,
      tileName: body.tileName,
    });

    try {
      await prisma.visualizationLog.create({
        data: {
          userId: user.id,
          tileSlug: body.tileSlug ?? 'refine',
          tileName: body.tileName ?? 'refine',
          surface: 'mask',
          provider: `refine-${result.provider}`,
          promptTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          success: result.refined,
        },
      });
    } catch (e) {
      console.error('[refine] log error', e);
    }

    return NextResponse.json({
      imageUrl: result.imageUrl,
      refined: result.refined,
      provider: result.provider,
      durationMs: result.durationMs,
    });
  } catch (err) {
    // Никогда не оставляем клиента без картинки — отдаём исходный композит.
    console.error('[refine]', err);
    return NextResponse.json({ imageUrl: body.compositeImage, refined: false, provider: 'none', durationMs: 0 });
  }
}

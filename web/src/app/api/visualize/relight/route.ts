import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { relightComposite } from '@/lib/ai';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Делает готовую (точную по размеру) раскладку клинкера фотореалистичной через Gemini:
// добавляет свет/тени, не трогая размер и раскладку.
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
    tileSlug?: string;
    tileName?: string;
    tileWmm?: number;
    tileHmm?: number;
    tileImageUrl?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!body.compositeImage) {
    return NextResponse.json({ error: 'compositeImage required' }, { status: 400 });
  }

  // Эталон плитки может прийти относительным путём — резолвим в абсолютный для server-fetch.
  const origin = req.headers.get('origin') || new URL(req.url).origin;
  const tileImageUrl = body.tileImageUrl
    ? body.tileImageUrl.startsWith('http') || body.tileImageUrl.startsWith('data:')
      ? body.tileImageUrl
      : `${origin}${body.tileImageUrl}`
    : undefined;

  try {
    const started = Date.now();
    const out = await relightComposite(body.compositeImage, {
      tileWmm: body.tileWmm,
      tileHmm: body.tileHmm,
      tileName: body.tileName,
      tileImageUrl,
    });
    try {
      await prisma.visualizationLog.create({
        data: {
          userId: user.id,
          tileSlug: body.tileSlug ?? 'relight',
          tileName: body.tileName ?? 'relight',
          surface: 'mask',
          provider: 'gemini-relight',
          promptTokens: out.usage?.promptTokens ?? 0,
          outputTokens: out.usage?.outputTokens ?? 0,
          totalTokens: out.usage?.totalTokens ?? 0,
          success: true,
        },
      });
    } catch (e) {
      console.error('[relight] log error', e);
    }
    return NextResponse.json({ imageUrl: out.imageUrl, durationMs: Date.now() - started });
  } catch (err) {
    console.error('[relight]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Relight failed' },
      { status: 500 },
    );
  }
}

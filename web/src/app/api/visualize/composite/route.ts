import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { compositeMaskedResult } from '@/lib/ai';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Финальная обрезка результата gpt-image-1 по маске выделения (+ исключение окон/дверей).
// Вызывается клиентом ПОСЛЕ готовности рендера (см. POST /api/visualize → requestId →
// /api/visualize/status). gpt-image-1 не имеет нативной маски и кладёт плитку на весь
// фасад — здесь детерминированно оставляем её только в выбранной зоне на стене.
export async function POST(req: Request) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: 'Войдите в аккаунт' }, { status: 401 });
  }

  let body: { resultUrl?: string; roomImage?: string; maskImage?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { resultUrl, roomImage, maskImage } = body;
  if (!resultUrl || !roomImage || !maskImage) {
    return NextResponse.json(
      { error: 'resultUrl, roomImage и maskImage обязательны' },
      { status: 400 },
    );
  }

  try {
    const imageUrl = await compositeMaskedResult({
      roomImageUrl: roomImage,
      resultUrl,
      maskUrl: maskImage,
      excludeOpenings: true,
      surface: 'wall',
    });
    return NextResponse.json({ imageUrl });
  } catch (err) {
    console.error('[visualize:composite]', err);
    const message = err instanceof Error ? err.message : 'Не удалось обрезать результат по маске';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

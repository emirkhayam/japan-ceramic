import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { pollGptImageJob } from '@/lib/ai';

export const runtime = 'nodejs';

// Опрос статуса асинхронного рендера gpt-image-1 (см. POST /api/visualize → { requestId }).
// Запрос лёгкий и быстрый, поэтому в таймауты прокси не упирается.
export async function GET(req: Request) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const requestId = new URL(req.url).searchParams.get('requestId');
  if (!requestId) {
    return NextResponse.json({ error: 'requestId required' }, { status: 400 });
  }

  try {
    const state = await pollGptImageJob(requestId);
    return NextResponse.json(state);
  } catch (err) {
    console.error('[visualize:status]', err);
    return NextResponse.json({
      status: 'failed',
      error: err instanceof Error ? err.message : 'Не удалось получить статус',
    });
  }
}

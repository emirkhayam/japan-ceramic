import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { estimateRegionWidthMeters } from '@/lib/ai';

export const runtime = 'nodejs';
export const maxDuration = 30;

// Оценивает реальную ширину выделенной стены (в метрах) по фото — чтобы клинкер
// лёг сразу в правильном размере, без ручной калибровки пользователем.
export async function POST(req: Request) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: 'Войдите в аккаунт' }, { status: 401 });
  }

  let body: { roomImage?: string; maskImage?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!body.roomImage) {
    return NextResponse.json({ error: 'roomImage required' }, { status: 400 });
  }

  const result = await estimateRegionWidthMeters({
    roomImageUrl: body.roomImage,
    maskImageUrl: body.maskImage,
  });
  return NextResponse.json(result);
}

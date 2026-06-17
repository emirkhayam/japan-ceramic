import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { segmentSurfaceMask } from '@/lib/ai';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Пиксельная маска поверхности (стена/пол) через fal EVF-SAM — точно исключает
// двери/окна/фонари. Используется как маска видимости в перспективном рендере.
export async function POST(req: Request) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: 'Войдите в аккаунт' }, { status: 401 });
  }

  let body: { roomImage?: string; surface?: 'floor' | 'wall' };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!body.roomImage || (body.surface !== 'floor' && body.surface !== 'wall')) {
    return NextResponse.json({ error: 'roomImage и surface (floor|wall) обязательны' }, { status: 400 });
  }

  const mask = await segmentSurfaceMask({ imageUrl: body.roomImage, surface: body.surface });
  // null → клиент откатится на маску из плоскости с вырезом проёмов.
  return NextResponse.json({ mask });
}

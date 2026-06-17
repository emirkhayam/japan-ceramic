import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { analyzeSurfacePlane } from '@/lib/ai';

export const runtime = 'nodejs';
export const maxDuration = 30;

// Анализ геометрии плоскости (Gemini-vision): 4 угла стены/пола + реальные размеры.
// Нужен детерминированному перспективному рендеру — модель НЕ рисует пиксели.
export async function POST(req: Request) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: 'Войдите в аккаунт' }, { status: 401 });
  }

  let body: {
    roomImage?: string;
    surface?: 'mask' | 'floor' | 'wall';
    maskImage?: string;
    maskBBoxNorm?: { minX: number; minY: number; maxX: number; maxY: number };
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!body.roomImage) {
    return NextResponse.json({ error: 'roomImage required' }, { status: 400 });
  }

  const result = await analyzeSurfacePlane({
    roomImageUrl: body.roomImage,
    surface: body.surface ?? 'mask',
    maskImageUrl: body.maskImage,
    maskBBoxNorm: body.maskBBoxNorm,
  });
  return NextResponse.json(result);
}

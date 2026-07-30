import { prisma } from '@/lib/db';

export function resolveImageUrl(url: string, origin: string): string {
  if (url.startsWith('data:')) return url;
  return new URL(url, origin).toString();
}

export function staticSizeToMillimeters(size: string): string {
  return size.replace(/\d+(?:[.,]\d+)?/g, (value) => {
    const millimeters = Number(value.replace(',', '.')) * 10;
    return String(millimeters);
  });
}

export function toTileDims(size: {
  w: number;
  h: number;
}): {
  wmm: number;
  hmm: number;
} {
  return { wmm: size.w, hmm: size.h };
}

export function formatTileDimensions(tileDims: {
  wmm: number;
  hmm: number;
}): string {
  return `${tileDims.wmm}×${tileDims.hmm} mm`;
}

export async function logVisualization(data: {
  userId: string;
  tileSlug: string;
  tileName: string;
  surface: string;
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

import { createHash } from 'crypto';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import type { Surface } from '@/lib/ai';

export type CacheKey = {
  roomImage: string;
  tileId: string;
  surface: Surface;
  provider: string;
};

export function hashKey(k: CacheKey): string {
  const room = k.roomImage.startsWith('data:')
    ? k.roomImage.slice(0, 256)
    : k.roomImage;
  return createHash('sha1')
    .update(`${room}|${k.tileId}|${k.surface}|${k.provider}`)
    .digest('hex')
    .slice(0, 16);
}

const CACHE_DIR = path.join(process.cwd(), 'public', 'demos-cache');
const INDEX_PATH = path.join(process.cwd(), 'data', 'demos-cache.json');

export async function readCacheIndex(): Promise<Record<string, string>> {
  if (!existsSync(INDEX_PATH)) return {};
  try {
    const raw = await readFile(INDEX_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function cacheFilePath(hash: string): string {
  return path.join(CACHE_DIR, `${hash}.jpg`);
}

export function cachePublicUrl(hash: string): string {
  return `/demos-cache/${hash}.jpg`;
}

export async function lookupCache(k: CacheKey): Promise<string | null> {
  const hash = hashKey(k);
  const file = cacheFilePath(hash);
  if (existsSync(file)) return cachePublicUrl(hash);
  const idx = await readCacheIndex();
  const url = idx[hash];
  return url || null;
}

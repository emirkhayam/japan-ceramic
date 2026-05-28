'use client';

import { tiles, type Tile } from '@/lib/tiles';
import { cn } from '@/lib/cn';
import { Check } from 'lucide-react';

type Props = {
  selectedId: string | null;
  onSelect: (tile: Tile) => void;
  compact?: boolean;
};

export function TileSelector({ selectedId, onSelect, compact = false }: Props) {
  return (
    <div
      className={cn(
        'grid gap-3',
        compact
          ? 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-6'
          : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
      )}
    >
      {tiles.map((tile) => {
        const isSelected = selectedId === tile.id;
        return (
          <button
            key={tile.id}
            onClick={() => onSelect(tile)}
            className={cn(
              'group relative overflow-hidden rounded-xl border bg-ink-800/40 text-left transition',
              isSelected
                ? 'border-gold-500 ring-2 ring-gold-500/40'
                : 'border-white/10 hover:border-white/30',
            )}
          >
            <div className="relative aspect-square">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={tile.image}
                alt={tile.name}
                className="h-full w-full object-cover transition group-hover:scale-105"
                onError={(e) => {
                  // Placeholder gradient while real images not yet downloaded
                  const target = e.currentTarget;
                  target.style.background = `linear-gradient(135deg, ${stringToColor(tile.color)} 0%, ${stringToColor(tile.color + '2')} 100%)`;
                  target.style.display = 'block';
                  target.removeAttribute('src');
                }}
              />
              {isSelected && (
                <div className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-gold-500 text-ink-900">
                  <Check size={16} />
                </div>
              )}
            </div>
            {!compact && (
              <div className="p-2.5">
                <div className="truncate text-sm font-semibold">{tile.name}</div>
                <div className="mt-0.5 text-[11px] text-mist-400">
                  {tile.sku} · {tile.size}
                </div>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 25%, 55%)`;
}

'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/cn';

type Props = {
  beforeSrc: string;
  afterSrc: string;
  beforeLabel?: string;
  afterLabel?: string;
  className?: string;
};

export function BeforeAfterSlider({
  beforeSrc,
  afterSrc,
  beforeLabel = 'ДО',
  afterLabel = 'ПОСЛЕ',
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(50);
  const [dragging, setDragging] = useState(false);

  const updatePos = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setPos(pct);
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0]?.clientX ?? 0 : e.clientX;
      updatePos(clientX);
    };
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchend', onUp);
    };
  }, [dragging, updatePos]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative aspect-[16/10] w-full overflow-hidden rounded-2xl border border-white/10 select-none cursor-ew-resize',
        className,
      )}
      onMouseDown={(e) => {
        setDragging(true);
        updatePos(e.clientX);
      }}
      onTouchStart={(e) => {
        setDragging(true);
        updatePos(e.touches[0]?.clientX ?? 0);
      }}
    >
      <Image
        src={beforeSrc}
        alt="before"
        fill
        className="object-cover"
        sizes="(max-width: 1024px) 100vw, 800px"
        priority
      />
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 0 0 ${pos}%)` }}
      >
        <Image
          src={afterSrc}
          alt="after"
          fill
          className="object-cover"
          sizes="(max-width: 1024px) 100vw, 800px"
          priority
        />
      </div>

      <span className="pointer-events-none absolute left-4 top-4 rounded-full bg-ink-900/70 px-3 py-1 text-xs font-semibold tracking-wider backdrop-blur">
        {beforeLabel}
      </span>
      <span className="pointer-events-none absolute right-4 top-4 rounded-full bg-gold-500 px-3 py-1 text-xs font-semibold tracking-wider text-ink-900">
        {afterLabel}
      </span>

      <div
        className="pointer-events-none absolute inset-y-0 w-0.5 bg-gold-500"
        style={{ left: `${pos}%` }}
      >
        <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold-500 text-ink-900 shadow-xl">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 7l-5 5 5 5V7zm8 0v10l5-5-5-5z" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

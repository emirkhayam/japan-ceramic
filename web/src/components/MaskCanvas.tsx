'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { cn } from '@/lib/cn';
import { Brush, Eraser, Trash2 } from 'lucide-react';

export type MaskCanvasHandle = {
  /** PNG data URL: белая зона = куда класть плитку, чёрный фон = не трогать. null если ничего не нарисовано. */
  getMask: () => string | null;
  /** Стереть всё выделение. */
  clear: () => void;
};

type Props = {
  imageSrc: string;
  onMaskChange?: (hasStrokes: boolean) => void;
};

type Tool = 'brush' | 'eraser';

// Подсветка выделения для пользователя (золото бренда). Маска для AI строится отдельно — чисто белой.
const HIGHLIGHT = 'rgba(206, 173, 120, 0.55)';

export const MaskCanvas = forwardRef<MaskCanvasHandle, Props>(function MaskCanvas(
  { imageSrc, onMaskChange },
  ref,
) {
  const imgRef = useRef<HTMLImageElement>(null);
  // Видимый холст (подсветка поверх фото).
  const viewRef = useRef<HTMLCanvasElement>(null);
  // Скрытый холст-маска (чисто белое на чёрном) в натуральном разрешении.
  const maskRef = useRef<HTMLCanvasElement>(null);

  const [tool, setTool] = useState<Tool>('brush');
  const [brush, setBrush] = useState(48);
  const [ready, setReady] = useState(false);
  const [hasStrokes, setHasStrokes] = useState(false);

  const drawing = useRef(false);
  const lastPt = useRef<{ x: number; y: number } | null>(null);

  // Инициализация холстов под натуральный размер фото.
  const initCanvases = useCallback(() => {
    const img = imgRef.current;
    if (!img || !img.naturalWidth) return;
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    for (const c of [viewRef.current, maskRef.current]) {
      if (!c) continue;
      c.width = w;
      c.height = h;
    }
    const mctx = maskRef.current?.getContext('2d');
    if (mctx) {
      mctx.fillStyle = '#000';
      mctx.fillRect(0, 0, w, h);
    }
    setReady(true);
    setHasStrokes(false);
    onMaskChange?.(false);
  }, [onMaskChange]);

  // Переинициализация при смене фото.
  useEffect(() => {
    setReady(false);
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth) initCanvases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageSrc]);

  // Переводим координаты указателя в пиксели натурального изображения.
  const toImageCoords = useCallback((e: React.PointerEvent) => {
    const c = viewRef.current;
    if (!c) return null;
    const rect = c.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * c.width;
    const y = ((e.clientY - rect.top) / rect.height) * c.height;
    return { x, y };
  }, []);

  const stroke = useCallback(
    (from: { x: number; y: number } | null, to: { x: number; y: number }) => {
      const view = viewRef.current?.getContext('2d');
      const mask = maskRef.current?.getContext('2d');
      if (!view || !mask) return;

      const erase = tool === 'eraser';
      for (const [ctx, color] of [
        [view, HIGHLIGHT] as const,
        [mask, '#fff'] as const,
      ]) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = brush;
        ctx.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
        // У маски ластик должен возвращать чёрный фон, а не прозрачность.
        if (erase && ctx === mask) {
          ctx.globalCompositeOperation = 'source-over';
          ctx.strokeStyle = '#000';
          ctx.fillStyle = '#000';
        } else {
          ctx.strokeStyle = color;
          ctx.fillStyle = color;
        }
        ctx.beginPath();
        if (from) {
          ctx.moveTo(from.x, from.y);
          ctx.lineTo(to.x, to.y);
          ctx.stroke();
        }
        // Точка-кружок, чтобы одиночный тап тоже рисовал.
        ctx.beginPath();
        ctx.arc(to.x, to.y, brush / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
    },
    [brush, tool],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!ready) return;
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      drawing.current = true;
      const pt = toImageCoords(e);
      if (!pt) return;
      lastPt.current = pt;
      stroke(null, pt);
      if (!hasStrokes && tool === 'brush') {
        setHasStrokes(true);
        onMaskChange?.(true);
      }
    },
    [ready, toImageCoords, stroke, hasStrokes, tool, onMaskChange],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!drawing.current) return;
      e.preventDefault();
      const pt = toImageCoords(e);
      if (!pt) return;
      stroke(lastPt.current, pt);
      lastPt.current = pt;
    },
    [toImageCoords, stroke],
  );

  const onPointerUp = useCallback(() => {
    drawing.current = false;
    lastPt.current = null;
  }, []);

  const clear = useCallback(() => {
    const view = viewRef.current;
    const mask = maskRef.current;
    if (view) view.getContext('2d')?.clearRect(0, 0, view.width, view.height);
    if (mask) {
      const mctx = mask.getContext('2d');
      if (mctx) {
        mctx.fillStyle = '#000';
        mctx.fillRect(0, 0, mask.width, mask.height);
      }
    }
    setHasStrokes(false);
    onMaskChange?.(false);
  }, [onMaskChange]);

  useImperativeHandle(
    ref,
    () => ({
      getMask: () => {
        if (!hasStrokes || !maskRef.current) return null;
        return maskRef.current.toDataURL('image/png');
      },
      clear,
    }),
    [hasStrokes, clear],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-ink-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={imageSrc}
          alt="Фото для выделения"
          onLoad={initCanvases}
          className="block w-full h-auto max-h-[600px] object-contain select-none"
          draggable={false}
        />
        <canvas
          ref={viewRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          className="absolute inset-0 h-full w-full cursor-crosshair"
          style={{ touchAction: 'none' }}
        />
        <canvas ref={maskRef} className="hidden" />
        <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-ink-900/80 px-3 py-1 text-xs font-medium text-mist-100 backdrop-blur">
          {hasStrokes ? 'Участок выделен' : 'Закрасьте нужный участок'}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex overflow-hidden rounded-xl border border-white/10">
          <button
            type="button"
            onClick={() => setTool('brush')}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-2 text-sm transition cursor-pointer',
              tool === 'brush'
                ? 'bg-gold-500/15 text-gold-400'
                : 'text-mist-400 hover:text-mist-100',
            )}
          >
            <Brush size={15} /> Кисть
          </button>
          <button
            type="button"
            onClick={() => setTool('eraser')}
            className={cn(
              'inline-flex items-center gap-1.5 border-l border-white/10 px-3 py-2 text-sm transition cursor-pointer',
              tool === 'eraser'
                ? 'bg-gold-500/15 text-gold-400'
                : 'text-mist-400 hover:text-mist-100',
            )}
          >
            <Eraser size={15} /> Ластик
          </button>
        </div>

        <label className="flex flex-1 items-center gap-2 text-xs text-mist-400">
          Размер
          <input
            type="range"
            min={12}
            max={140}
            value={brush}
            onChange={(e) => setBrush(Number(e.target.value))}
            className="flex-1 accent-gold-500"
          />
        </label>

        <button
          type="button"
          onClick={clear}
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-sm text-mist-400 transition hover:text-mist-100 cursor-pointer"
        >
          <Trash2 size={15} /> Очистить
        </button>
      </div>
    </div>
  );
});

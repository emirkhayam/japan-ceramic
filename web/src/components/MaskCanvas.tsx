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
import { Brush, Square, Trash2 } from 'lucide-react';

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

type Tool = 'brush' | 'rect';

// Подсветка выделения для пользователя (золото бренда). Маска для AI строится отдельно — чисто белой.
const HIGHLIGHT = 'rgba(206, 173, 120, 0.55)';
const HIGHLIGHT_LINE = 'rgba(206, 173, 120, 0.95)';

export const MaskCanvas = forwardRef<MaskCanvasHandle, Props>(function MaskCanvas(
  { imageSrc, onMaskChange },
  ref,
) {
  const imgRef = useRef<HTMLImageElement>(null);
  // Видимый холст (подсветка поверх фото).
  const viewRef = useRef<HTMLCanvasElement>(null);
  // Скрытый холст-маска (чисто белое на чёрном) в натуральном разрешении.
  const maskRef = useRef<HTMLCanvasElement>(null);

  const [tool, setTool] = useState<Tool>('rect');
  const [brush, setBrush] = useState(48);
  const [ready, setReady] = useState(false);
  const [hasStrokes, setHasStrokes] = useState(false);

  const drawing = useRef(false);
  const lastPt = useRef<{ x: number; y: number } | null>(null);
  // Для прямоугольного выделения: старт перетаскивания + снимки холстов,
  // чтобы во время рисования показывать «резиновый» прямоугольник.
  const rectStart = useRef<{ x: number; y: number } | null>(null);
  const snapView = useRef<ImageData | null>(null);
  const snapMask = useRef<ImageData | null>(null);

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

  // Кисть: рисуем линию-мазок на обоих холстах.
  const stroke = useCallback(
    (from: { x: number; y: number } | null, to: { x: number; y: number }) => {
      const view = viewRef.current?.getContext('2d');
      const mask = maskRef.current?.getContext('2d');
      if (!view || !mask) return;
      for (const [ctx, color] of [
        [view, HIGHLIGHT] as const,
        [mask, '#fff'] as const,
      ]) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = brush;
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
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
      }
    },
    [brush],
  );

  // Прямоугольник: нормализуем углы в {x,y,w,h}.
  const rectFrom = (
    a: { x: number; y: number },
    b: { x: number; y: number },
  ) => ({
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(b.x - a.x),
    h: Math.abs(b.y - a.y),
  });

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!ready) return;
      e.preventDefault();
      try {
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      } catch {
        /* указатель мог уже отпуститься — не критично */
      }
      drawing.current = true;
      const pt = toImageCoords(e);
      if (!pt) return;

      if (tool === 'rect') {
        rectStart.current = pt;
        const v = viewRef.current?.getContext('2d');
        const m = maskRef.current?.getContext('2d');
        // Запоминаем текущее состояние, чтобы «резиновый» прямоугольник не затирал прежние выделения.
        if (v && viewRef.current)
          snapView.current = v.getImageData(0, 0, viewRef.current.width, viewRef.current.height);
        if (m && maskRef.current)
          snapMask.current = m.getImageData(0, 0, maskRef.current.width, maskRef.current.height);
        return;
      }

      lastPt.current = pt;
      stroke(null, pt);
      if (!hasStrokes) {
        setHasStrokes(true);
        onMaskChange?.(true);
      }
    },
    [ready, tool, toImageCoords, stroke, hasStrokes, onMaskChange],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!drawing.current) return;
      e.preventDefault();
      const pt = toImageCoords(e);
      if (!pt) return;

      if (tool === 'rect') {
        if (!rectStart.current) return;
        const v = viewRef.current?.getContext('2d');
        if (!v || !snapView.current) return;
        // Перерисовываем предпросмотр поверх сохранённого состояния.
        v.putImageData(snapView.current, 0, 0);
        const r = rectFrom(rectStart.current, pt);
        v.fillStyle = HIGHLIGHT;
        v.fillRect(r.x, r.y, r.w, r.h);
        v.strokeStyle = HIGHLIGHT_LINE;
        v.lineWidth = 2;
        v.strokeRect(r.x, r.y, r.w, r.h);
        return;
      }

      stroke(lastPt.current, pt);
      lastPt.current = pt;
    },
    [tool, toImageCoords, stroke],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (tool === 'rect' && drawing.current && rectStart.current) {
        const pt = toImageCoords(e);
        const v = viewRef.current?.getContext('2d');
        const m = maskRef.current?.getContext('2d');
        // Возвращаем сохранённое состояние, затем фиксируем прямоугольник на обоих холстах.
        if (v && snapView.current) v.putImageData(snapView.current, 0, 0);
        if (m && snapMask.current) m.putImageData(snapMask.current, 0, 0);
        if (pt && v && m) {
          const r = rectFrom(rectStart.current, pt);
          if (r.w > 3 && r.h > 3) {
            v.fillStyle = HIGHLIGHT;
            v.fillRect(r.x, r.y, r.w, r.h);
            m.fillStyle = '#fff';
            m.fillRect(r.x, r.y, r.w, r.h);
            if (!hasStrokes) {
              setHasStrokes(true);
              onMaskChange?.(true);
            }
          }
        }
        rectStart.current = null;
        snapView.current = null;
        snapMask.current = null;
      }
      drawing.current = false;
      lastPt.current = null;
    },
    [tool, toImageCoords, hasStrokes, onMaskChange],
  );

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
          {hasStrokes
            ? 'Участок выделен'
            : tool === 'rect'
              ? 'Обведите участок прямоугольником'
              : 'Закрасьте нужный участок'}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex overflow-hidden rounded-xl border border-white/10">
          <button
            type="button"
            onClick={() => setTool('rect')}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-2 text-sm transition cursor-pointer',
              tool === 'rect'
                ? 'bg-gold-500/15 text-gold-400'
                : 'text-mist-400 hover:text-mist-100',
            )}
          >
            <Square size={15} /> Прямоугольник
          </button>
          <button
            type="button"
            onClick={() => setTool('brush')}
            className={cn(
              'inline-flex items-center gap-1.5 border-l border-white/10 px-3 py-2 text-sm transition cursor-pointer',
              tool === 'brush'
                ? 'bg-gold-500/15 text-gold-400'
                : 'text-mist-400 hover:text-mist-100',
            )}
          >
            <Brush size={15} /> Кисть
          </button>
        </div>

        {tool === 'brush' && (
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
        )}

        <button
          type="button"
          onClick={clear}
          className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-sm text-mist-400 transition hover:text-mist-100 cursor-pointer"
        >
          <Trash2 size={15} /> Очистить
        </button>
      </div>
    </div>
  );
});

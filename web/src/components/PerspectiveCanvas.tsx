'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { renderClinkerPerspective } from '@/lib/clinker-render';
import type { Pt } from '@/lib/homography';

export type PerspectiveCanvasHandle = {
  /** Текущая укладка как data URL (jpeg). null если ещё не отрисовано. */
  getResultDataUrl: () => string | null;
};

type Props = {
  /** Фото фасада (data URL или http). */
  imageSrc: string;
  /** URL образца плитки из каталога. */
  tileUrl: string;
  /** Реальные размеры плитки, мм. */
  tileWmm: number;
  tileHmm: number;
  /** Реальные размеры выделенной плоскости, м. */
  planeWmeters: number;
  planeHmeters: number;
};

// Образец грузим через same-origin прокси /api/trimmed-image: иначе canvas «протухнет»
// (tainted) и toDataURL упадёт. Прокси заодно срезает студийный фон → чище текстура.
function proxiedTileUrl(url: string): string {
  if (/supabase\.(co|in)\/storage\/v1\/object\/public\/uploads\//.test(url)) {
    return `/api/trimmed-image?src=${encodeURIComponent(url)}`;
  }
  return url;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

const HANDLE = 'rgba(206, 173, 120, 0.95)'; // gold
const OUTLINE = 'rgba(206, 173, 120, 0.9)';

export const PerspectiveCanvas = forwardRef<PerspectiveCanvasHandle, Props>(
  function PerspectiveCanvas({ imageSrc, tileUrl, tileWmm, tileHmm, planeWmeters, planeHmeters }, ref) {
    const viewRef = useRef<HTMLCanvasElement>(null);
    const photoRef = useRef<HTMLImageElement | null>(null);
    const tileRef = useRef<HTMLImageElement | null>(null);
    // Готовый композит (без ручек) — источник для getResultDataUrl.
    const compositeRef = useRef<HTMLCanvasElement | null>(null);
    const cornersRef = useRef<Pt[]>([]);
    const [ready, setReady] = useState(false);

    const dragIdx = useRef<number>(-1);

    // Перевод координат указателя в пиксели натурального изображения.
    const toImageCoords = useCallback((e: React.PointerEvent): Pt | null => {
      const c = viewRef.current;
      if (!c) return null;
      const rect = c.getBoundingClientRect();
      return {
        x: ((e.clientX - rect.left) / rect.width) * c.width,
        y: ((e.clientY - rect.top) / rect.height) * c.height,
      };
    }, []);

    // Рисуем фото (или готовую укладку) + контур четырёхугольника + ручки углов.
    const drawDisplay = useCallback((withTiles: boolean) => {
      const view = viewRef.current;
      const photo = photoRef.current;
      if (!view || !photo) return;
      const ctx = view.getContext('2d');
      if (!ctx) return;
      const base = withTiles && compositeRef.current ? compositeRef.current : photo;
      ctx.clearRect(0, 0, view.width, view.height);
      ctx.drawImage(base, 0, 0, view.width, view.height);

      const corners = cornersRef.current;
      if (corners.length === 4) {
        // Контур
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(2, view.width / 400);
        ctx.beginPath();
        ctx.moveTo(corners[0].x, corners[0].y);
        for (let i = 1; i < 4; i++) ctx.lineTo(corners[i].x, corners[i].y);
        ctx.closePath();
        ctx.stroke();
        // Ручки
        const r = Math.max(8, view.width / 70);
        for (const p of corners) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.fillStyle = HANDLE;
          ctx.fill();
          ctx.strokeStyle = '#1a1830';
          ctx.lineWidth = Math.max(1.5, view.width / 600);
          ctx.stroke();
        }
      }
    }, []);

    // Полный пересчёт укладки (рендер реальной текстуры в перспективе).
    const renderFull = useCallback(() => {
      const photo = photoRef.current;
      const tile = tileRef.current;
      const view = viewRef.current;
      if (!photo || !view) return;
      if (tile && cornersRef.current.length === 4 && tileWmm > 0 && tileHmm > 0) {
        try {
          compositeRef.current = renderClinkerPerspective({
            photo,
            photoW: photo.naturalWidth,
            photoH: photo.naturalHeight,
            tile,
            tileImgW: tile.naturalWidth,
            tileImgH: tile.naturalHeight,
            corners: cornersRef.current,
            planeWmeters: Math.max(0.2, planeWmeters),
            planeHmeters: Math.max(0.2, planeHmeters),
            tileWmm,
            tileHmm,
          });
        } catch {
          compositeRef.current = null;
        }
      }
      drawDisplay(true);
    }, [tileWmm, tileHmm, planeWmeters, planeHmeters, drawDisplay]);

    // Загрузка фото + инициализация холста и углов (вписанный прямоугольник).
    useEffect(() => {
      let alive = true;
      setReady(false);
      compositeRef.current = null;
      loadImage(imageSrc)
        .then((img) => {
          if (!alive) return;
          photoRef.current = img;
          const view = viewRef.current;
          if (!view) return;
          view.width = img.naturalWidth;
          view.height = img.naturalHeight;
          const w = img.naturalWidth;
          const h = img.naturalHeight;
          cornersRef.current = [
            { x: w * 0.15, y: h * 0.2 },
            { x: w * 0.85, y: h * 0.2 },
            { x: w * 0.85, y: h * 0.8 },
            { x: w * 0.15, y: h * 0.8 },
          ];
          setReady(true);
          renderFull();
        })
        .catch(() => {});
      return () => {
        alive = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [imageSrc]);

    // Загрузка образца плитки.
    useEffect(() => {
      let alive = true;
      loadImage(proxiedTileUrl(tileUrl))
        .then((img) => {
          if (!alive) return;
          tileRef.current = img;
          if (ready) renderFull();
        })
        .catch(() => {});
      return () => {
        alive = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tileUrl, ready]);

    // Пересчёт при смене реальных размеров плоскости/плитки.
    useEffect(() => {
      if (ready) renderFull();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [planeWmeters, planeHmeters, tileWmm, tileHmm]);

    const onPointerDown = useCallback(
      (e: React.PointerEvent) => {
        if (!ready) return;
        const pt = toImageCoords(e);
        if (!pt) return;
        // Ближайший угол в пределах радиуса.
        const view = viewRef.current!;
        const thresh = Math.max(24, view.width / 25);
        let best = -1;
        let bestD = thresh;
        cornersRef.current.forEach((c, i) => {
          const d = Math.hypot(c.x - pt.x, c.y - pt.y);
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        });
        if (best >= 0) {
          dragIdx.current = best;
          try {
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          } catch {
            /* noop */
          }
          e.preventDefault();
        }
      },
      [ready, toImageCoords],
    );

    const onPointerMove = useCallback(
      (e: React.PointerEvent) => {
        if (dragIdx.current < 0) return;
        const pt = toImageCoords(e);
        if (!pt) return;
        const view = viewRef.current!;
        pt.x = Math.max(0, Math.min(view.width, pt.x));
        pt.y = Math.max(0, Math.min(view.height, pt.y));
        cornersRef.current[dragIdx.current] = pt;
        // Во время перетаскивания — лёгкая отрисовка (фото + контур), без пересчёта плитки.
        drawDisplay(false);
      },
      [toImageCoords, drawDisplay],
    );

    const onPointerUp = useCallback(() => {
      if (dragIdx.current < 0) return;
      dragIdx.current = -1;
      renderFull(); // на отпускании — полный пересчёт укладки
    }, [renderFull]);

    useImperativeHandle(
      ref,
      () => ({
        getResultDataUrl: () => compositeRef.current?.toDataURL('image/jpeg', 0.92) ?? null,
      }),
      [],
    );

    return (
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-ink-900">
        <canvas
          ref={viewRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          className="block h-auto max-h-[600px] w-full object-contain select-none touch-none"
          style={{ cursor: 'grab' }}
        />
        <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-ink-900/80 px-3 py-1 text-xs font-medium text-mist-100 backdrop-blur">
          Перетащите 4 угла по краям стены
        </div>
      </div>
    );
  },
);

"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface ProductImage {
  id: string;
  imageUrl: string;
}

const FALLBACK = "/placeholder-tile.svg";

// Кратность увеличения в лупе.
const ZOOM = 2.4;
// Длинная сторона картинки (фокус героя, но не гигантская).
const IMG_MAX = 520;
// Квадратная лупа, следующая за курсором.
const LOUPE = 240;
// Место под размерные линии (длина сверху, ширина справа).
const PAD_T = 30;
const PAD_R = 46;

function parseDims(raw?: string | null) {
  if (!raw) return null;
  const nums = raw.match(/\d+(?:[.,]\d+)?/g);
  if (!nums || nums.length < 2) return null;
  return {
    w: nums[0].replace(".", ","),
    h: nums[1].replace(".", ","),
    wn: parseFloat(nums[0].replace(",", ".")),
    hn: parseFloat(nums[1].replace(",", ".")),
  };
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

type ZoomState = {
  active: boolean;
  cx: number;
  cy: number;
  fw: number;
  fh: number;
};

const ZOOM_OFF: ZoomState = { active: false, cx: 0, cy: 0, fw: 0, fh: 0 };

export default function ProductGallery({
  images,
  productName,
  dimensions,
}: {
  images: ProductImage[];
  productName: string;
  dimensions?: string | null;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const dims = parseDims(dimensions);

  // Размер картинки в реальной пропорции плитки, длинная сторона = IMG_MAX.
  const ratio = dims ? Math.max(0.4, Math.min(3, dims.wn / dims.hn)) : 1;
  const imgW = ratio >= 1 ? IMG_MAX : Math.round(IMG_MAX * ratio);
  const imgH = ratio >= 1 ? Math.round(IMG_MAX / ratio) : IMG_MAX;

  const [canZoom, setCanZoom] = useState(false);
  const [z, setZ] = useState<ZoomState>(ZOOM_OFF);
  const frameRef = useRef<HTMLDivElement>(null);

  // Lightbox
  const [open, setOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const overlayRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const movedRef = useRef(false);
  const startRef = useRef({ x: 0, y: 0, ox: 0, oy: 0 });

  const heroImage = images[activeIndex]?.imageUrl || FALLBACK;
  const count = images.length;

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px) and (hover: hover) and (pointer: fine)");
    const update = () => setCanZoom(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const onFrameMove = useCallback(
    (e: React.MouseEvent) => {
      if (!canZoom) return;
      const f = frameRef.current?.getBoundingClientRect();
      if (!f) return;
      const cx = clamp(e.clientX - f.left, 0, f.width);
      const cy = clamp(e.clientY - f.top, 0, f.height);
      setZ({ active: true, cx, cy, fw: f.width, fh: f.height });
    },
    [canZoom]
  );

  const onFrameLeave = useCallback(() => setZ((s) => ({ ...s, active: false })), []);

  const resetZoom = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const go = useCallback(
    (dir: number) => {
      if (count < 2) return;
      setActiveIndex((i) => (i + dir + count) % count);
      resetZoom();
    },
    [count, resetZoom]
  );

  const closeLightbox = useCallback(() => {
    setOpen(false);
    resetZoom();
  }, [resetZoom]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, closeLightbox, go]);

  useEffect(() => {
    const el = overlayRef.current;
    if (!open || !el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setScale((s) => {
        const ns = Math.min(4, Math.max(1, s - e.deltaY * 0.0016));
        if (ns <= 1) setOffset({ x: 0, y: 0 });
        return ns;
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [open]);

  function onPointerDown(e: React.MouseEvent) {
    if (scale <= 1) return;
    draggingRef.current = true;
    movedRef.current = false;
    startRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  }
  function onPointerMove(e: React.MouseEvent) {
    if (!draggingRef.current) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) movedRef.current = true;
    setOffset({ x: startRef.current.ox + dx, y: startRef.current.oy + dy });
  }
  function onPointerUp() {
    draggingRef.current = false;
  }
  function onImageClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (movedRef.current) {
      movedRef.current = false;
      return;
    }
    setScale((s) => {
      const ns = s > 1 ? 1 : 2.5;
      if (ns <= 1) setOffset({ x: 0, y: 0 });
      return ns;
    });
  }

  return (
    <div>
      {/* Картинка с размерами по бокам; квадратная лупа следует за курсором (без обрезки рамкой) */}
      <div className="relative mx-auto" style={{ paddingTop: dims ? PAD_T : 0, paddingRight: dims ? PAD_R : 0, width: (dims ? imgW + PAD_R : imgW), maxWidth: "100%" }}>
        <div
          ref={frameRef}
          role="img"
          aria-label={productName}
          onClick={() => setOpen(true)}
          onMouseMove={onFrameMove}
          onMouseLeave={onFrameLeave}
          className="group relative overflow-hidden"
          style={{
            width: imgW,
            height: imgH,
            backgroundImage: `url(${heroImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            cursor: canZoom ? "crosshair" : "zoom-in",
          }}
        >
          {/* Иконка-лупа в углу */}
          <div
            className={`absolute bottom-3 right-3 flex items-center justify-center w-8 h-8 rounded-full bg-[rgba(0,0,0,.55)] backdrop-blur-sm border border-[rgba(255,255,255,.12)] text-[var(--ink-soft)] pointer-events-none transition-opacity duration-200 group-hover:text-[var(--ink)] ${
              z.active ? "opacity-0" : "opacity-100"
            }`}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="6.5" cy="6.5" r="5" />
              <path d="M14 14l-3.5-3.5" />
              <path d="M6.5 4.5v4M4.5 6.5h4" />
            </svg>
          </div>
        </div>

        {/* Размерные линии — длина сверху, ширина справа */}
        {dims && (
          <>
            <div
              className={`absolute left-0 top-0 flex items-center transition-opacity duration-200 ${z.active ? "opacity-0" : "opacity-100"}`}
              style={{ height: PAD_T, width: imgW }}
            >
              <div className="w-px h-2 bg-[var(--line-2)]" />
              <div className="flex-1 h-px bg-[var(--line-2)]" />
              <span className="px-2 text-[11px] tracking-[.08em] text-[var(--ink-mute)] tabular-nums whitespace-nowrap">{dims.w} мм</span>
              <div className="flex-1 h-px bg-[var(--line-2)]" />
              <div className="w-px h-2 bg-[var(--line-2)]" />
            </div>
            <div
              className={`absolute right-0 flex flex-col items-center transition-opacity duration-200 ${z.active ? "opacity-0" : "opacity-100"}`}
              style={{ top: PAD_T, height: imgH, width: PAD_R }}
            >
              <div className="h-px w-2 bg-[var(--line-2)]" />
              <div className="flex-1 w-px bg-[var(--line-2)]" />
              <span className="-rotate-90 my-1 text-[11px] tracking-[.08em] text-[var(--ink-mute)] tabular-nums whitespace-nowrap">{dims.h} мм</span>
              <div className="flex-1 w-px bg-[var(--line-2)]" />
              <div className="h-px w-2 bg-[var(--line-2)]" />
            </div>
          </>
        )}

        {/* Квадратная лупа — сосед рамки, не обрезается её краями (выходит за пределы) */}
        {z.active && (
          <div
            className="absolute z-40 pointer-events-none overflow-hidden rounded-md border border-white/30 shadow-[0_18px_50px_rgba(0,0,0,.6)] ring-1 ring-black/40"
            style={{ width: LOUPE, height: LOUPE, left: z.cx - LOUPE / 2, top: (dims ? PAD_T : 0) + z.cy - LOUPE / 2 }}
          >
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url(${heroImage})`,
                backgroundRepeat: "no-repeat",
                backgroundSize: `${z.fw * ZOOM}px ${z.fh * ZOOM}px`,
                backgroundPosition: `${LOUPE / 2 - z.cx * ZOOM}px ${LOUPE / 2 - z.cy * ZOOM}px`,
              }}
            />
            <div className="absolute inset-0 rounded-md ring-1 ring-inset ring-[var(--color-gold-400)]/20" />
          </div>
        )}
      </div>

      {/* Миниатюры */}
      {count > 1 && (
        <div className="flex gap-2 mt-4 overflow-x-auto" style={{ maxWidth: imgW + PAD_R }}>
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setActiveIndex(i)}
              className={`w-[68px] h-[68px] shrink-0 overflow-hidden rounded-md border cursor-pointer transition-all duration-200 ${
                i === activeIndex
                  ? "border-[var(--ink)] opacity-100 ring-1 ring-[var(--ink)]"
                  : "border-[var(--line)] opacity-50 hover:opacity-80 hover:border-[var(--ink-soft)]"
              }`}
            >
              <img src={img.imageUrl} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {open && (
        <div
          ref={overlayRef}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-[rgba(6,8,12,.94)] backdrop-blur-sm select-none"
          onClick={closeLightbox}
          onMouseMove={onPointerMove}
          onMouseUp={onPointerUp}
          onMouseLeave={onPointerUp}
        >
          <button
            type="button"
            onClick={closeLightbox}
            aria-label="Закрыть"
            className="absolute top-5 right-5 w-11 h-11 flex items-center justify-center rounded-full border border-[var(--line-2)] text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[rgba(255,255,255,.06)] transition-colors cursor-pointer z-10"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>

          <div className="absolute top-6 left-6 flex items-center gap-3 text-[12px] tracking-[.1em] text-[var(--ink-mute)] z-10">
            {count > 1 && <span>{activeIndex + 1} / {count}</span>}
            <span className="text-[var(--ink-faint)]">{scale > 1 ? "потяните, чтобы переместить" : "колесо или клик — приблизить"}</span>
          </div>

          {count > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); go(-1); }}
                aria-label="Предыдущее"
                className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center rounded-full border border-[var(--line-2)] text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[rgba(255,255,255,.06)] transition-colors cursor-pointer z-10"
              >
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M13 4l-7 7 7 7" /></svg>
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); go(1); }}
                aria-label="Следующее"
                className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center rounded-full border border-[var(--line-2)] text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[rgba(255,255,255,.06)] transition-colors cursor-pointer z-10"
              >
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 4l7 7-7 7" /></svg>
              </button>
            </>
          )}

          <img
            src={heroImage}
            alt={productName}
            draggable={false}
            onClick={onImageClick}
            onMouseDown={onPointerDown}
            className="max-w-[90vw] max-h-[86vh] object-contain"
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
              transition: draggingRef.current ? "none" : "transform .2s cubic-bezier(.22,.61,.36,1)",
              cursor: scale > 1 ? "grab" : "zoom-in",
              willChange: "transform",
            }}
          />

          {count > 1 && (
            <div
              className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2 max-w-[90vw] overflow-x-auto px-2"
              onClick={(e) => e.stopPropagation()}
            >
              {images.map((img, i) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => { setActiveIndex(i); resetZoom(); }}
                  className={`w-[60px] h-[60px] shrink-0 overflow-hidden rounded border cursor-pointer transition-all duration-200 ${
                    i === activeIndex ? "border-[var(--ink)] opacity-100" : "border-[var(--line)] opacity-45 hover:opacity-80"
                  }`}
                >
                  <img src={img.imageUrl} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

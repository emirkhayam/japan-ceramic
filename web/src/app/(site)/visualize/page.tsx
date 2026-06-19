'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PhotoUploader } from '@/components/PhotoUploader';
import { MaskCanvas, type MaskCanvasHandle } from '@/components/MaskCanvas';
import { CatalogTileSelector, type CatalogTile } from '@/components/CatalogTileSelector';
import { VisualizerLoader } from '@/components/VisualizerLoader';
import { Sparkles, Download, MessageCircle, ArrowLeft, AlertCircle, RotateCcw, Camera, Check, Brush, Layers } from 'lucide-react';
import { cn } from '@/lib/cn';

// Локальный (client-safe) аналог waHref — не импортируем из lib/settings,
// т.к. тот модуль тянет prisma (server-only).
function waLink(wa: string | null | undefined): string | null {
  if (!wa) return null;
  return wa.startsWith("http") ? wa : `https://wa.me/${wa.replace(/[^\d]/g, "")}`;
}

type Mode = 'floor' | 'wall' | 'mask';
type Stage = 'idle' | 'generating' | 'result' | 'error';

const MODES: { id: Mode; label: string }[] = [
  { id: 'mask', label: 'Выделить кистью' },
  { id: 'floor', label: 'Пол' },
  { id: 'wall', label: 'Стена' },
];

function VisualizePageInner() {
  const params = useSearchParams();
  const initialSlug = params.get('tile');

  const [photo, setPhoto] = useState<string | null>(null);
  const [selectedTile, setSelectedTile] = useState<CatalogTile | null>(null);
  const [mode, setMode] = useState<Mode>('mask');
  const [maskHasStrokes, setMaskHasStrokes] = useState(false);
  const maskRef = useRef<MaskCanvasHandle>(null);
  // Маска последней генерации — чтобы «Попробуйте другую» на экране результата
  // (где холст уже размонтирован) могла повторить запрос с той же областью.
  const lastMaskRef = useRef<string | null>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultMeta, setResultMeta] = useState<{ provider: string; durationMs: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [contacts, setContacts] = useState<{ whatsapp: string | null; mapLink: string | null; address: string | null } | null>(null);

  // Pre-select tile from URL param
  useEffect(() => {
    if (!initialSlug) return;
    fetch("/api/catalog/products")
      .then((r) => r.json())
      .then((data) => {
        const found = data.products.find((p: CatalogTile) => p.slug === initialSlug);
        if (found) setSelectedTile(found);
      })
      .catch(() => {});
  }, [initialSlug]);

  // Контакты сайта (WhatsApp/адрес/2ГИС) — из настроек, а не хардкод.
  useEffect(() => {
    fetch("/api/site-contacts")
      .then((r) => r.json())
      .then((data) => setContacts(data.settings))
      .catch(() => {});
  }, []);

  const maskReady = mode !== 'mask' || maskHasStrokes;
  const canGenerate = photo && selectedTile && maskReady && stage !== 'generating';

  // Опрос статуса асинхронного рендера до готовности (или ошибки/таймаута).
  async function pollVisualization(requestId: string): Promise<string> {
    const deadline = Date.now() + 4 * 60 * 1000; // ждём максимум 4 минуты
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 3000));
      const res = await fetch(`/api/visualize/status?requestId=${encodeURIComponent(requestId)}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `Сервер вернул ${res.status}`);
      }
      const data = await res.json();
      if (data.status === 'completed' && data.imageUrl) return data.imageUrl as string;
      if (data.status === 'failed') throw new Error(data.error || 'Генерация не удалась');
      // data.status === 'in_progress' → продолжаем опрос
    }
    throw new Error('Превышено время ожидания генерации');
  }

  // Генерация через gpt-image-1 (сервер): модель сама распознаёт сцену, перспективу,
  // окна/двери и накладывает плитку реалистично. Для режима кисти добавляем маску.
  async function generateFor(tile: CatalogTile) {
    if (!photo) return;

    let maskImage: string | undefined;
    if (mode === 'mask') {
      maskImage = maskRef.current?.getMask() ?? lastMaskRef.current ?? undefined;
      if (!maskImage) {
        setErrorMsg('Выделите участок кистью на фото перед генерацией');
        setStage('error');
        return;
      }
      lastMaskRef.current = maskImage;
    }

    setStage('generating');
    setErrorMsg(null);
    try {
      const res = await fetch('/api/visualize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomImage: photo,
          tileId: tile.slug,
          surface: mode,
          maskImage,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Сервер вернул ${res.status}`);
      }
      const data = await res.json();
      // Асинхронный путь (gpt-image-1 через очередь fal): сервер вернул requestId, рендер
      // идёт в фоне — опрашиваем статус, пока не будет готовой картинки. Так длинный рендер
      // (~60-90с) не упирается в таймаут прокси.
      if (data.async && data.requestId) {
        const startedAt = Date.now();
        let imageUrl = await pollVisualization(data.requestId);
        // gpt-image-1 не умеет нативную маску и перекладывает весь фасад. В режиме
        // выделения детерминированно обрезаем результат по маске (вне зоны — оригинал,
        // окна/двери внутри зоны исключаются) на сервере.
        if (mode === 'mask' && maskImage) {
          const cmp = await fetch('/api/visualize/composite', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resultUrl: imageUrl, roomImage: photo, maskImage, segRequestId: data.segRequestId ?? null }),
          });
          if (!cmp.ok) {
            const d = await cmp.json().catch(() => ({}));
            throw new Error(d.error || `Сервер вернул ${cmp.status}`);
          }
          const cmpData = await cmp.json();
          imageUrl = cmpData.imageUrl;
        }
        setResultUrl(imageUrl);
        setResultMeta({ provider: data.provider, durationMs: Date.now() - startedAt });
        setStage('result');
      } else {
        setResultUrl(data.imageUrl);
        setResultMeta({ provider: data.provider, durationMs: data.durationMs });
        setStage('result');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : 'Неизвестная ошибка');
      setStage('error');
    }
  }

  function handleGenerate() {
    if (!selectedTile || !photo) return;
    generateFor(selectedTile);
  }

  function handleReset() {
    setStage('idle');
    setResultUrl(null);
    setErrorMsg(null);
  }

  // Берём текущий результат как базу для следующего слоя — так комбинируем
  // несколько клинкеров по очереди (выделил участок → плитка → генерация → повтор).
  function handleContinue() {
    if (!resultUrl) return;
    setPhoto(resultUrl);
    setMode('mask');
    setMaskHasStrokes(false);
    lastMaskRef.current = null;
    maskRef.current?.clear();
    setResultUrl(null);
    setErrorMsg(null);
    setStage('idle');
  }

  async function handleSwapTile(tile: CatalogTile) {
    setSelectedTile(tile);
    generateFor(tile);
  }

  if (stage === 'generating') {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-8">
        <div className="card p-10 sm:p-16">
          <VisualizerLoader />
        </div>
      </div>
    );
  }

  if (stage === 'result' && resultUrl) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8 sm:py-12">
        <button
          onClick={handleReset}
          className="mb-4 inline-flex items-center gap-2 text-sm text-mist-400 hover:text-gold-400 cursor-pointer"
        >
          <ArrowLeft size={14} /> Назад к загрузке
        </button>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="card overflow-hidden">
            <div className="relative aspect-[16/10] w-full bg-ink-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resultUrl}
                alt="Результат визуализации"
                className="h-full w-full object-cover"
              />
              <div className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-gold-500 px-3 py-1 text-xs font-semibold text-ink-900">
                <Sparkles size={12} /> ИИ-визуализация
              </div>
              {resultMeta && resultMeta.durationMs > 0 && (
                <div className="absolute right-4 top-4 rounded-full bg-ink-900/80 px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-mist-200 backdrop-blur">
                  {(resultMeta.durationMs / 1000).toFixed(0)}s
                </div>
              )}
            </div>
          </div>

          <aside className="space-y-4">
            <button
              onClick={handleContinue}
              className="btn-gold w-full !py-3 text-sm cursor-pointer"
            >
              <Layers size={16} /> Продолжить — добавить ещё клинкер
            </button>
            <p className="-mt-2 px-1 text-xs text-mist-400">
              Возьмём этот результат за основу: выделите кистью другой участок и выберите второй материал.
            </p>

            <div className="card p-5">
              <div className="text-xs uppercase tracking-wider text-mist-400">
                Выбрано
              </div>
              <div className="mt-2 flex gap-3">
                {selectedTile && (
                  <>
                    {selectedTile.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={selectedTile.imageUrl}
                        alt={selectedTile.name}
                        className="h-16 w-16 rounded-lg object-cover"
                      />
                    )}
                    <div>
                      <div className="font-semibold">{selectedTile.name}</div>
                      <div className="text-xs text-mist-400">
                        {selectedTile.collection || ""}{selectedTile.dimensions ? ` · ${selectedTile.dimensions}` : ""}
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <a
                  href={resultUrl}
                  download="japan-ceramic-visualization.jpg"
                  className="btn-ghost !py-2 !px-3 text-sm"
                >
                  <Download size={14} /> Скачать
                </a>
                {(() => {
                  const wa = waLink(contacts?.whatsapp);
                  const text = encodeURIComponent(`Здравствуйте! Интересует плитка ${selectedTile?.name}. Можно образец?`);
                  const href = wa ? `${wa}${wa.includes("?") ? "&" : "?"}text=${text}` : "/#contacts";
                  return (
                    <a
                      href={href}
                      target={wa ? "_blank" : undefined}
                      rel={wa ? "noopener" : undefined}
                      className="btn-gold !py-2 !px-3 text-sm"
                    >
                      <MessageCircle size={14} /> Заявка
                    </a>
                  );
                })()}
              </div>
            </div>

            <div className="card p-5">
              <div className="text-xs uppercase tracking-wider text-mist-400">
                Попробуйте другую
              </div>
              <div className="mt-3 max-h-80 overflow-y-auto pr-1">
                <CatalogTileSelector
                  selectedSlug={selectedTile?.slug ?? null}
                  onSelect={handleSwapTile}
                  compact
                />
              </div>
            </div>

            <div className="card p-5">
              <div className="font-semibold">Бесплатный образец</div>
              <p className="mt-1 text-sm text-mist-400">
                Заберите образец этой плитки в шоуруме — почувствуете текстуру руками.
              </p>
              {contacts?.mapLink && (
                <a
                  href={contacts.mapLink}
                  target="_blank"
                  rel="noopener"
                  className="mt-3 inline-block text-sm text-gold-400 hover:underline"
                >
                  {contacts.address || "Шоурум на карте"} →
                </a>
              )}
            </div>
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-32 pt-8 sm:px-8 sm:pb-40 sm:pt-12">
      <div className="mb-8">
        <span className="label-pill">ИИ-визуализация</span>
        <h1 className="mt-3 font-display text-3xl font-bold sm:text-4xl">
          Примерьте плитку в своей комнате
        </h1>
        <p className="mt-2 text-mist-400">
          Загрузите фото комнаты, выберите плитку — и через 15-30 секунд увидите результат.
        </p>
      </div>

      {stage === 'error' && errorMsg && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm">
          <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-400" />
          <div className="flex-1">
            <div className="font-semibold text-red-400">Что-то пошло не так</div>
            <div className="mt-1 text-mist-400">{errorMsg}</div>
          </div>
          <button onClick={handleReset} className="text-mist-400 hover:text-mist-100 cursor-pointer">
            <RotateCcw size={16} />
          </button>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-6">
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-mist-400">
              {photo && mode === 'mask' ? 'Выделите участок' : 'Фото комнаты'}
            </h2>
            {photo && mode === 'mask' ? (
              <div className="space-y-3">
                <MaskCanvas
                  ref={maskRef}
                  imageSrc={photo}
                  onMaskChange={setMaskHasStrokes}
                />
                <p className="text-xs text-mist-400">
                  Обведите участок — ИИ распознает стену, окна и двери и наложит плитку по реальной
                  перспективе фасада, не задевая проёмы.
                </p>

                <button
                  onClick={() => {
                    setPhoto(null);
                    setMaskHasStrokes(false);
                    lastMaskRef.current = null;
                  }}
                  className="text-xs text-mist-400 hover:text-gold-400 cursor-pointer"
                >
                  ← Сменить фото
                </button>
              </div>
            ) : (
              <PhotoUploader value={photo} onChange={setPhoto} />
            )}
          </section>

          <section className="card p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gold-400">
              <Camera size={16} /> Как сфотографировать
            </h2>
            <ul className="space-y-2.5 text-sm text-mist-300">
              {[
                'Снимайте при дневном свете, без вспышки',
                'Держите камеру ровно, лицом к стене или полу',
                'Захватите поверхность целиком, без сильного наклона',
                'Уберите лишние предметы с пола или стены',
                'Следите за резкостью — без размытия и пересветов',
                'Чем выше разрешение, тем точнее результат',
              ].map((tip) => (
                <li key={tip} className="flex items-start gap-2.5">
                  <Check size={16} className="mt-0.5 shrink-0 text-gold-400" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </section>

          {photo && (
            <section className="animate-slide-up">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-mist-400">
                Что менять
              </h2>
              <div className="grid grid-cols-3 gap-2">
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMode(m.id)}
                    className={cn(
                      'inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-3 text-sm font-medium transition cursor-pointer',
                      mode === m.id
                        ? 'border-gold-500 bg-gold-500/10 text-gold-400'
                        : 'border-white/10 text-mist-400 hover:border-white/30',
                    )}
                  >
                    {m.id === 'mask' && <Brush size={15} />}
                    {m.label}
                  </button>
                ))}
              </div>
              {mode === 'mask' && (
                <p className="mt-2 text-xs text-mist-400">
                  Обведите участок прямоугольником (или закрасьте кистью), затем выберите клинкер. Несколько материалов комбинируйте по очереди.
                </p>
              )}
            </section>
          )}

        </div>

        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-mist-400">
            Выберите плитку
          </h2>
          <CatalogTileSelector
            selectedSlug={selectedTile?.slug ?? null}
            onSelect={setSelectedTile}
          />
        </div>
      </div>

      <div className="sticky bottom-4 z-30 mt-10 flex flex-col items-center gap-2 px-4">
        <button
          onClick={handleGenerate}
          disabled={!canGenerate}
          className="btn-gold w-full max-w-md !px-6 !py-4 text-base disabled:!bg-[rgba(255,255,255,.06)] disabled:!text-[var(--ink-soft)] disabled:!shadow-none disabled:cursor-not-allowed disabled:hover:!transform-none sm:w-auto cursor-pointer"
        >
          <Sparkles size={18} />
          {!photo
            ? 'Загрузите фото комнаты'
            : mode === 'mask' && !maskHasStrokes
              ? 'Выделите участок кистью'
              : !selectedTile
                ? 'Выберите плитку'
                : 'Сгенерировать визуализацию'}
        </button>
        {photo && selectedTile && (
          <p className="text-xs text-mist-400">~15–30 секунд</p>
        )}
      </div>
    </div>
  );
}

export default function VisualizePage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-7xl px-4 py-16 text-center text-mist-400">Загрузка…</div>}>
      <VisualizePageInner />
    </Suspense>
  );
}

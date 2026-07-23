'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PhotoUploader } from '@/components/PhotoUploader';
import { CatalogTileSelector, type CatalogTile } from '@/components/CatalogTileSelector';
import { VisualizerLoader } from '@/components/VisualizerLoader';
import {
  Sparkles,
  Download,
  MessageCircle,
  ArrowLeft,
  AlertCircle,
  RotateCcw,
  Camera,
  Check,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import type { FacadeBaseColor, FacadeZone, Surface } from '@/lib/ai';

// Локальный (client-safe) аналог waHref — не импортируем из lib/settings,
// т.к. тот модуль тянет prisma (server-only).
function waLink(wa: string | null | undefined): string | null {
  if (!wa) return null;
  return wa.startsWith("http") ? wa : `https://wa.me/${wa.replace(/[^\d]/g, "")}`;
}

type Stage = 'idle' | 'generating' | 'result' | 'error';
type Pattern = 'stack' | 'offset-half' | 'offset-third' | 'herringbone';
type Orientation = 'horizontal' | 'vertical';
type Grout = 'match' | 'contrast' | 'minimal';
type RefinementSettings = {
  pattern: Pattern;
  orientation: Orientation;
  grout: Grout;
  zones: FacadeZone[];
  baseColor: FacadeBaseColor;
  note: string;
};

const DEFAULT_REFINEMENT_SETTINGS: RefinementSettings = {
  pattern: 'stack',
  orientation: 'horizontal',
  grout: 'match',
  zones: ['full'],
  baseColor: 'white',
  note: '',
};

const SURFACE_OPTIONS: { value: Surface; label: string }[] = [
  { value: 'floor', label: 'Пол' },
  { value: 'wall', label: 'Стена' },
  { value: 'facade', label: 'Фасад' },
];

const FACADE_ZONE_OPTIONS: { value: FacadeZone; label: string }[] = [
  { value: 'full', label: 'Весь фасад' },
  { value: 'between-windows', label: 'Между окнами' },
  { value: 'around-windows', label: 'Вокруг окон' },
  { value: 'corners', label: 'Углы' },
  { value: 'plinth', label: 'Цоколь' },
  { value: 'columns', label: 'Колонны/тумбы' },
];

const FACADE_BASE_COLOR_OPTIONS: { value: FacadeBaseColor; label: string }[] = [
  { value: 'white', label: 'Белый' },
  { value: 'beige', label: 'Бежевый' },
  { value: 'grey', label: 'Серый' },
];

const PATTERN_OPTIONS: { value: Pattern; label: string }[] = [
  { value: 'stack', label: 'Стек' },
  { value: 'offset-half', label: 'Вразбежку ½' },
  { value: 'offset-third', label: 'Вразбежку ⅓' },
  { value: 'herringbone', label: 'Ёлочка' },
];

const ORIENTATION_OPTIONS: { value: Orientation; label: string }[] = [
  { value: 'horizontal', label: 'Горизонтально' },
  { value: 'vertical', label: 'Вертикально' },
];

const GROUT_OPTIONS: { value: Grout; label: string }[] = [
  { value: 'match', label: 'В тон' },
  { value: 'contrast', label: 'Контраст' },
  { value: 'minimal', label: 'Мин. шов' },
];

function VisualizePageInner() {
  const params = useSearchParams();
  const initialSlug = params.get('tile');

  const [photo, setPhoto] = useState<string | null>(null);
  const [selectedTile, setSelectedTile] = useState<CatalogTile | null>(null);
  const [surface, setSurface] = useState<Surface>('floor');
  const [stage, setStage] = useState<Stage>('idle');
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultMeta, setResultMeta] = useState<{ provider: string; durationMs: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [contacts, setContacts] = useState<{ whatsapp: string | null; mapLink: string | null; address: string | null } | null>(null);
  const [pattern, setPattern] = useState<Pattern>(DEFAULT_REFINEMENT_SETTINGS.pattern);
  const [orientation, setOrientation] = useState<Orientation>(DEFAULT_REFINEMENT_SETTINGS.orientation);
  const [grout, setGrout] = useState<Grout>(DEFAULT_REFINEMENT_SETTINGS.grout);
  const [zones, setZones] = useState<FacadeZone[]>(DEFAULT_REFINEMENT_SETTINGS.zones);
  const [baseColor, setBaseColor] = useState<FacadeBaseColor>(
    DEFAULT_REFINEMENT_SETTINGS.baseColor,
  );
  const [note, setNote] = useState(DEFAULT_REFINEMENT_SETTINGS.note);

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

  const canGenerate = photo && selectedTile && stage !== 'generating';

  async function generateFor(tile: CatalogTile, refinements?: RefinementSettings) {
    if (!photo) return;
    setStage('generating');
    setErrorMsg(null);
    try {
      const res = await fetch('/api/visualize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomImage: photo,
          tileId: tile.slug,
          surface,
          ...refinements,
          // Зоны и цвет штукатурки имеют смысл только для фасада — для пола/стены не шлём.
          ...(surface === 'facade'
            ? {
                zones: refinements?.zones ?? zones,
                baseColor: refinements?.baseColor ?? baseColor,
              }
            : { zones: undefined, baseColor: undefined }),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Сервер вернул ${res.status}`);
      }
      const data = await res.json();
      setResultUrl(data.imageUrl);
      setResultMeta({ provider: data.provider, durationMs: data.durationMs });
      if (data.settings) {
        setPattern(data.settings.pattern);
        setOrientation(data.settings.orientation);
        setGrout(data.settings.grout);
        if (Array.isArray(data.settings.zones) && data.settings.zones.length > 0) {
          setZones(data.settings.zones as FacadeZone[]);
        }
        if (
          FACADE_BASE_COLOR_OPTIONS.some(
            (option) => option.value === data.settings.baseColor,
          )
        ) {
          setBaseColor(data.settings.baseColor as FacadeBaseColor);
        }
        setNote(data.settings.note);
      }
      setStage('result');
    } catch (err) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : 'Неизвестная ошибка');
      setStage('error');
    }
  }

  function handleGenerate() {
    if (!selectedTile) return;
    generateFor(selectedTile);
  }

  function handleReset() {
    setStage('idle');
    setResultUrl(null);
    setResultMeta(null);
    setErrorMsg(null);
    // Фото, плитка, поверхность и настройки укладки/зон переживают возврат —
    // пользователь чаще всего возвращается сменить фото того же объекта.
    // Одноразовое пожелание из «Что поправить?» очищаем.
    setNote(DEFAULT_REFINEMENT_SETTINGS.note);
  }

  function handleSwapTile(tile: CatalogTile) {
    setSelectedTile(tile);
    generateFor(tile, { pattern, orientation, grout, zones, baseColor, note });
  }

  function handleRefine() {
    if (!selectedTile) return;
    generateFor(selectedTile, { pattern, orientation, grout, zones, baseColor, note });
  }

  function toggleFacadeZone(zone: FacadeZone) {
    setZones((current) => {
      if (zone === 'full') return ['full'];

      const partialZones = current.filter((currentZone) => currentZone !== 'full');
      if (partialZones.includes(zone)) {
        const nextZones = partialZones.filter((currentZone) => currentZone !== zone);
        return nextZones.length > 0 ? nextZones : ['full'];
      }
      return [...partialZones, zone];
    });
  }

  const facadeIsPartial = surface === 'facade' && !zones.includes('full');
  const photoTips =
    surface === 'facade'
      ? [
          'Снимайте дом целиком — прямо или под небольшим углом',
          'Оставьте в кадре весь фасад, включая линию крыши',
          'Фотографируйте при ровном дневном свете',
          'Держите камеру ровно, без сильного наклона и искажения перспективы',
        ]
      : [
          'Снимайте при дневном свете, без вспышки',
          'Держите камеру ровно, лицом к стене или полу',
          'Захватите поверхность целиком, без сильного наклона',
          'Уберите лишние предметы с пола или стены',
          'Следите за резкостью — без размытия и пересветов',
          'Чем выше разрешение, тем точнее результат',
        ];

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
              {resultMeta && (
                <div className="absolute right-4 top-4 rounded-full bg-ink-900/80 px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-mist-200 backdrop-blur">
                  {resultMeta.provider} · {(resultMeta.durationMs / 1000).toFixed(1)}s
                </div>
              )}
            </div>
          </div>

          <aside className="space-y-4">
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
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-mist-400">
                <SlidersHorizontal size={14} className="text-gold-400" /> Уточнить
              </div>

              <div className="mt-4 space-y-4">
                {surface === 'facade' && (
                  <>
                    <div>
                      <div className="mb-2 text-xs font-medium text-mist-300">
                        Зоны облицовки
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {FACADE_ZONE_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => toggleFacadeZone(option.value)}
                            className={cn(
                              'rounded-lg border px-2.5 py-2 text-xs font-medium transition cursor-pointer',
                              zones.includes(option.value)
                                ? 'border-gold-500 bg-gold-500/10 text-gold-400'
                                : 'border-white/10 text-mist-400 hover:border-white/30',
                            )}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {facadeIsPartial && (
                      <div>
                        <div className="mb-2 text-xs font-medium text-mist-300">
                          Цвет основного фасада
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {FACADE_BASE_COLOR_OPTIONS.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => setBaseColor(option.value)}
                              className={cn(
                                'rounded-lg border px-2 py-2 text-xs font-medium transition cursor-pointer',
                                baseColor === option.value
                                  ? 'border-gold-500 bg-gold-500/10 text-gold-400'
                                  : 'border-white/10 text-mist-400 hover:border-white/30',
                              )}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                <div>
                  <div className="mb-2 text-xs font-medium text-mist-300">Схема укладки</div>
                  <div className="grid grid-cols-2 gap-2">
                    {PATTERN_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setPattern(option.value)}
                        className={cn(
                          'rounded-lg border px-2.5 py-2 text-xs font-medium transition cursor-pointer',
                          pattern === option.value
                            ? 'border-gold-500 bg-gold-500/10 text-gold-400'
                            : 'border-white/10 text-mist-400 hover:border-white/30',
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-xs font-medium text-mist-300">Ориентация</div>
                  <div className="grid grid-cols-2 gap-2">
                    {ORIENTATION_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setOrientation(option.value)}
                        className={cn(
                          'rounded-lg border px-2.5 py-2 text-xs font-medium transition cursor-pointer',
                          orientation === option.value
                            ? 'border-gold-500 bg-gold-500/10 text-gold-400'
                            : 'border-white/10 text-mist-400 hover:border-white/30',
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-xs font-medium text-mist-300">Затирка</div>
                  <div className="grid grid-cols-3 gap-2">
                    {GROUT_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setGrout(option.value)}
                        className={cn(
                          'rounded-lg border px-2 py-2 text-xs font-medium transition cursor-pointer',
                          grout === option.value
                            ? 'border-gold-500 bg-gold-500/10 text-gold-400'
                            : 'border-white/10 text-mist-400 hover:border-white/30',
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="block">
                  <span className="mb-2 block text-xs font-medium text-mist-300">Что поправить?</span>
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    maxLength={300}
                    rows={3}
                    placeholder="например: сделай швы тоньше"
                    className="w-full resize-y rounded-xl border border-white/10 bg-white/[.04] px-3 py-2.5 text-sm text-mist-100 outline-none transition placeholder:text-mist-500 focus:border-gold-500/70"
                  />
                  <span className="mt-1 block text-right text-[10px] text-mist-500">
                    {note.length}/300
                  </span>
                </label>

                <button
                  type="button"
                  onClick={handleRefine}
                  className="btn-gold w-full !px-4 !py-3 text-sm"
                >
                  <RefreshCw size={15} /> Перегенерировать
                </button>
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
              Фото комнаты
            </h2>
            <PhotoUploader value={photo} onChange={setPhoto} />
          </section>

          <section className="card p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gold-400">
              <Camera size={16} /> Как сфотографировать
            </h2>
            <ul className="space-y-2.5 text-sm text-mist-300">
              {photoTips.map((tip) => (
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
                Поверхность
              </h2>
              <div className="grid grid-cols-3 gap-2">
                {SURFACE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSurface(option.value)}
                    className={cn(
                      'rounded-xl border px-4 py-3 text-sm font-medium transition cursor-pointer',
                      surface === option.value
                        ? 'border-gold-500 bg-gold-500/10 text-gold-400'
                        : 'border-white/10 text-mist-400 hover:border-white/30',
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {surface === 'facade' && (
                <div className="mt-5 space-y-5">
                  <div>
                    <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-mist-400">
                      Зоны облицовки
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {FACADE_ZONE_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => toggleFacadeZone(option.value)}
                          className={cn(
                            'rounded-xl border px-3 py-2 text-sm font-medium transition cursor-pointer',
                            zones.includes(option.value)
                              ? 'border-gold-500 bg-gold-500/10 text-gold-400'
                              : 'border-white/10 text-mist-400 hover:border-white/30',
                          )}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {facadeIsPartial && (
                    <div>
                      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-mist-400">
                        Цвет основного фасада
                      </h3>
                      <div className="grid grid-cols-3 gap-2">
                        {FACADE_BASE_COLOR_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setBaseColor(option.value)}
                            className={cn(
                              'rounded-xl border px-3 py-2 text-sm font-medium transition cursor-pointer',
                              baseColor === option.value
                                ? 'border-gold-500 bg-gold-500/10 text-gold-400'
                                : 'border-white/10 text-mist-400 hover:border-white/30',
                            )}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
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

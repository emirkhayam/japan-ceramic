'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  Brush,
  Camera,
  Check,
  Download,
  Layers,
  MessageCircle,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import { CatalogTileSelector, type CatalogTile } from '@/components/CatalogTileSelector';
import { MaskCanvas, type MaskCanvasHandle } from '@/components/MaskCanvas';
import { PhotoUploader } from '@/components/PhotoUploader';
import { VisualizerLoader } from '@/components/VisualizerLoader';
import type { FacadeBaseColor, FacadeZone, Surface } from '@/lib/ai';
import { cn } from '@/lib/cn';

function waLink(whatsapp: string | null | undefined): string | null {
  if (!whatsapp) return null;
  return whatsapp.startsWith('http')
    ? whatsapp
    : `https://wa.me/${whatsapp.replace(/[^\d]/g, '')}`;
}

function parsePositive(value: string): number | undefined {
  const number = Number.parseFloat(value.replace(',', '.'));
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function friendlyError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (/fetch failed|timeout|ETIMEDOUT|ECONN|network|502|503|504|UND_ERR/i.test(raw)) {
    return 'Сеть подвисла при обработке. Нажмите «Попробовать снова» — обычно со второго раза проходит.';
  }
  return raw || 'Неизвестная ошибка';
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

const MODES: { id: Surface; label: string }[] = [
  { id: 'mask', label: 'Выделить кистью' },
  { id: 'floor', label: 'Пол' },
  { id: 'wall', label: 'Стена' },
  { id: 'facade', label: 'Фасад' },
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
  const originalPhotoRef = useRef<string | null>(null);
  const [selectedTile, setSelectedTile] = useState<CatalogTile | null>(null);
  const [mode, setMode] = useState<Surface>('mask');
  const [widthM, setWidthM] = useState('');
  const [heightM, setHeightM] = useState('');
  const [areaM2, setAreaM2] = useState('');
  const [layerCount, setLayerCount] = useState(1);
  const [maskHasStrokes, setMaskHasStrokes] = useState(false);
  const maskRef = useRef<MaskCanvasHandle>(null);
  const lastMaskRef = useRef<string | null>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultMeta, setResultMeta] = useState<{
    provider: string;
    durationMs: number;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [contacts, setContacts] = useState<{
    whatsapp: string | null;
    mapLink: string | null;
    address: string | null;
  } | null>(null);
  const [allTiles, setAllTiles] = useState<CatalogTile[]>([]);
  const [tilesLoading, setTilesLoading] = useState(true);
  const [pattern, setPattern] = useState<Pattern>(DEFAULT_REFINEMENT_SETTINGS.pattern);
  const [orientation, setOrientation] = useState<Orientation>(
    DEFAULT_REFINEMENT_SETTINGS.orientation,
  );
  const [grout, setGrout] = useState<Grout>(DEFAULT_REFINEMENT_SETTINGS.grout);
  const [zones, setZones] = useState<FacadeZone[]>(DEFAULT_REFINEMENT_SETTINGS.zones);
  const [baseColor, setBaseColor] = useState<FacadeBaseColor>(
    DEFAULT_REFINEMENT_SETTINGS.baseColor,
  );
  const [note, setNote] = useState(DEFAULT_REFINEMENT_SETTINGS.note);
  const [settingsInitialized, setSettingsInitialized] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch('/api/catalog/products')
      .then((response) => response.json())
      .then((data) => {
        if (!alive) return;
        const products: CatalogTile[] = Array.isArray(data?.products) ? data.products : [];
        setAllTiles(products);
        if (initialSlug) {
          const initialTile = products.find((product) => product.slug === initialSlug);
          if (initialTile) setSelectedTile(initialTile);
        }
        setTilesLoading(false);
      })
      .catch(() => {
        if (alive) setTilesLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [initialSlug]);

  useEffect(() => {
    fetch('/api/site-contacts')
      .then((response) => response.json())
      .then((data) => setContacts(data.settings))
      .catch(() => {});
  }, []);

  const maskReady = mode !== 'mask' || maskHasStrokes;
  const canGenerate = Boolean(
    photo && selectedTile && maskReady && stage !== 'generating',
  );

  const savedUrlRef = useRef<string | null>(null);
  useEffect(() => {
    if (stage !== 'result' || !resultUrl || savedUrlRef.current === resultUrl) return;
    savedUrlRef.current = resultUrl;
    fetch('/api/visualize/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageUrl: resultUrl,
        tileSlug: selectedTile?.slug,
        tileName: selectedTile?.name,
        surface: mode,
      }),
    }).catch(() => {});
  }, [stage, resultUrl, selectedTile, mode]);

  async function pollVisualization(requestId: string): Promise<string> {
    const deadline = Date.now() + 4 * 60 * 1000;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const response = await fetch(
        `/api/visualize/status?requestId=${encodeURIComponent(requestId)}`,
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Сервер вернул ${response.status}`);
      }
      const data = await response.json();
      if (data.status === 'completed' && data.imageUrl) {
        return data.imageUrl as string;
      }
      if (data.status === 'failed') {
        throw new Error(data.error || 'Генерация не удалась');
      }
    }
    throw new Error('Превышено время ожидания генерации');
  }

  function currentRefinements(): RefinementSettings {
    return { pattern, orientation, grout, zones, baseColor, note };
  }

  function syncSettings(settings: unknown) {
    if (!settings || typeof settings !== 'object') return;
    const data = settings as Partial<RefinementSettings>;
    if (PATTERN_OPTIONS.some((option) => option.value === data.pattern)) {
      setPattern(data.pattern as Pattern);
    }
    if (ORIENTATION_OPTIONS.some((option) => option.value === data.orientation)) {
      setOrientation(data.orientation as Orientation);
    }
    if (GROUT_OPTIONS.some((option) => option.value === data.grout)) {
      setGrout(data.grout as Grout);
    }
    if (Array.isArray(data.zones) && data.zones.length > 0) {
      setZones(data.zones);
    }
    if (
      FACADE_BASE_COLOR_OPTIONS.some((option) => option.value === data.baseColor)
    ) {
      setBaseColor(data.baseColor as FacadeBaseColor);
    }
    setNote(typeof data.note === 'string' ? data.note : '');
    setSettingsInitialized(true);
  }

  async function generateFor(
    tile: CatalogTile,
    options?: {
      roomOverride?: string;
      refinements?: RefinementSettings;
    },
  ) {
    const roomImage = options?.roomOverride ?? photo;
    if (!roomImage) return;

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

    const refinements =
      options?.refinements ?? (settingsInitialized ? currentRefinements() : undefined);
    setStage('generating');
    setErrorMsg(null);
    try {
      const response = await fetch('/api/visualize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomImage,
          tileId: tile.slug,
          surface: mode,
          maskImage,
          regionWidthM: mode === 'floor' ? undefined : parsePositive(widthM),
          regionHeightM: mode === 'floor' ? undefined : parsePositive(heightM),
          floorAreaM2: mode === 'floor' ? parsePositive(areaM2) : undefined,
          pattern: refinements?.pattern,
          orientation: refinements?.orientation,
          grout: refinements?.grout,
          note: refinements?.note,
          ...(mode === 'facade'
            ? {
                zones: refinements?.zones ?? zones,
                baseColor: refinements?.baseColor ?? baseColor,
              }
            : {}),
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Сервер вернул ${response.status}`);
      }

      const data = await response.json();
      syncSettings(data.settings);
      if (data.async && data.requestId) {
        const startedAt = Date.now();
        let imageUrl = await pollVisualization(data.requestId);
        if (mode === 'mask' && maskImage) {
          const compositeResponse = await fetch('/api/visualize/composite', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              resultUrl: imageUrl,
              roomImage,
              maskImage,
              segRequestId: data.segRequestId ?? null,
            }),
          });
          if (!compositeResponse.ok) {
            const compositeData = await compositeResponse.json().catch(() => ({}));
            throw new Error(
              compositeData.error || `Сервер вернул ${compositeResponse.status}`,
            );
          }
          const compositeData = await compositeResponse.json();
          imageUrl = compositeData.imageUrl;
        }
        setResultUrl(imageUrl);
        setResultMeta({
          provider: data.provider,
          durationMs: Date.now() - startedAt,
        });
      } else {
        setResultUrl(data.imageUrl);
        setResultMeta({
          provider: data.provider,
          durationMs: data.durationMs,
        });
      }
      setStage('result');
    } catch (err) {
      console.error(err);
      setErrorMsg(friendlyError(err));
      setStage('error');
    }
  }

  function handleGenerate() {
    if (!selectedTile || !photo) return;
    void generateFor(selectedTile);
  }

  function handleReset() {
    setStage('idle');
    setResultUrl(null);
    setResultMeta(null);
    setErrorMsg(null);
    if (stage === 'result' && mode === 'mask') {
      setMaskHasStrokes(false);
      lastMaskRef.current = null;
    }
    // Фото, плитка, режим и постоянные настройки сохраняются; note одноразовый.
    setNote(DEFAULT_REFINEMENT_SETTINGS.note);
  }

  function handleModeChange(nextMode: Surface) {
    if (nextMode === mode) return;
    if (nextMode === 'mask' || mode === 'mask') {
      setMaskHasStrokes(false);
      lastMaskRef.current = null;
    }
    setMode(nextMode);
  }

  function handleContinue() {
    if (!resultUrl) return;
    setPhoto(resultUrl);
    setLayerCount((count) => count + 1);
    setMode('mask');
    setMaskHasStrokes(false);
    lastMaskRef.current = null;
    maskRef.current?.clear();
    setResultUrl(null);
    setResultMeta(null);
    setErrorMsg(null);
    setNote('');
    setStage('idle');
  }

  function handleSwapTile(tile: CatalogTile) {
    const originalPhoto = originalPhotoRef.current ?? photo;
    setSelectedTile(tile);
    if (originalPhoto) setPhoto(originalPhoto);
    setLayerCount(1);
    void generateFor(tile, {
      roomOverride: originalPhoto ?? undefined,
      refinements: currentRefinements(),
    });
  }

  function handlePhotoUpload(dataUrl: string | null) {
    setPhoto(dataUrl);
    originalPhotoRef.current = dataUrl;
    setLayerCount(1);
    setMaskHasStrokes(false);
    lastMaskRef.current = null;
  }

  function handleRefine() {
    if (!selectedTile) return;
    void generateFor(selectedTile, { refinements: currentRefinements() });
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

  const facadeIsPartial = mode === 'facade' && !zones.includes('full');
  const photoTips =
    mode === 'facade'
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
          type="button"
          onClick={handleReset}
          className="mb-4 inline-flex cursor-pointer items-center gap-2 text-sm text-mist-400 hover:text-gold-400"
        >
          <ArrowLeft size={14} /> Назад к загрузке
        </button>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="card overflow-hidden">
            <div className="relative flex w-full justify-center bg-ink-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resultUrl}
                alt="Результат визуализации"
                className="block h-auto max-h-[78vh] w-auto max-w-full object-contain"
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
            {layerCount > 1 && (
              <div className="inline-flex items-center gap-1.5 rounded-full border border-gold-500/40 bg-gold-500/10 px-3 py-1 text-xs font-medium text-gold-400">
                <Layers size={12} /> Наложено плиток: {layerCount}
              </div>
            )}
            <button
              type="button"
              onClick={handleContinue}
              className="btn-gold w-full cursor-pointer !py-3 text-sm"
            >
              <Layers size={16} /> Добавить плитку на другой участок
            </button>
            <p className="-mt-2 px-1 text-xs text-mist-400">
              Возьмём этот результат за основу: выделите кистью другой участок и выберите
              другую плитку — наложим поверх, не трогая уже облицованное.
            </p>

            <div className="card p-5">
              <div className="text-xs uppercase tracking-wider text-mist-400">Выбрано</div>
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
                        {selectedTile.collection || ''}
                        {selectedTile.dimensions ? ` · ${selectedTile.dimensions}` : ''}
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <a
                  href={resultUrl}
                  download="japan-ceramic-visualization.jpg"
                  className="btn-ghost !px-3 !py-2 text-sm"
                >
                  <Download size={14} /> Скачать
                </a>
                {(() => {
                  const whatsapp = waLink(contacts?.whatsapp);
                  const text = encodeURIComponent(
                    `Здравствуйте! Интересует плитка ${selectedTile?.name}. Можно образец?`,
                  );
                  const href = whatsapp
                    ? `${whatsapp}${whatsapp.includes('?') ? '&' : '?'}text=${text}`
                    : '/#contacts';
                  return (
                    <a
                      href={href}
                      target={whatsapp ? '_blank' : undefined}
                      rel={whatsapp ? 'noopener' : undefined}
                      className="btn-gold !px-3 !py-2 text-sm"
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
                {mode === 'facade' && (
                  <>
                    <FacadeZonePicker zones={zones} onToggle={toggleFacadeZone} compact />
                    {facadeIsPartial && (
                      <FacadeColorPicker
                        baseColor={baseColor}
                        onChange={setBaseColor}
                        compact
                      />
                    )}
                  </>
                )}

                <div>
                  <div className="mb-2 text-xs font-medium text-mist-300">
                    Схема укладки
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {PATTERN_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setPattern(option.value)}
                        className={cn(
                          'cursor-pointer rounded-lg border px-2.5 py-2 text-xs font-medium transition',
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
                          'cursor-pointer rounded-lg border px-2.5 py-2 text-xs font-medium transition',
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
                          'cursor-pointer rounded-lg border px-2 py-2 text-xs font-medium transition',
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
                  <span className="mb-2 block text-xs font-medium text-mist-300">
                    Что поправить?
                  </span>
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
                  tiles={allTiles}
                  loading={tilesLoading}
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
                  {contacts.address || 'Шоурум на карте'} →
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
          Примерьте плитку в своём пространстве
        </h1>
        <p className="mt-2 text-mist-400">
          Загрузите фото, выберите поверхность и плитку — визуализатор сохранит сцену и
          реальный характер материала.
        </p>
      </div>

      {stage === 'error' && errorMsg && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm">
          <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-400" />
          <div className="flex-1">
            <div className="font-semibold text-red-400">Что-то пошло не так</div>
            <div className="mt-1 text-mist-400">{errorMsg}</div>
            {selectedTile && photo && (
              <button
                type="button"
                onClick={() => {
                  setErrorMsg(null);
                  handleGenerate();
                }}
                className="btn-gold mt-3 cursor-pointer !px-4 !py-2 text-xs"
              >
                <RotateCcw size={14} /> Попробовать снова
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={handleReset}
            aria-label="Закрыть"
            className="cursor-pointer text-mist-400 hover:text-mist-100"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-6">
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-mist-400">
              {photo && mode === 'mask' ? 'Выделите участок' : 'Фото пространства'}
            </h2>
            {photo && mode === 'mask' ? (
              <div className="space-y-3">
                <MaskCanvas
                  ref={maskRef}
                  imageSrc={photo}
                  onMaskChange={setMaskHasStrokes}
                />
                <p className="text-xs text-mist-400">
                  Закрасьте участок: плитка появится только внутри белой маски, а окна,
                  двери и остальная сцена останутся без изменений.
                </p>
                <button
                  type="button"
                  onClick={() => handlePhotoUpload(null)}
                  className="cursor-pointer text-xs text-mist-400 hover:text-gold-400"
                >
                  ← Сменить фото
                </button>
              </div>
            ) : (
              <PhotoUploader value={photo} onChange={handlePhotoUpload} />
            )}
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
                Что менять
              </h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {MODES.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleModeChange(option.id)}
                    className={cn(
                      'inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3 py-3 text-sm font-medium transition',
                      mode === option.id
                        ? 'border-gold-500 bg-gold-500/10 text-gold-400'
                        : 'border-white/10 text-mist-400 hover:border-white/30',
                    )}
                  >
                    {option.id === 'mask' && <Brush size={15} />}
                    {option.label}
                  </button>
                ))}
              </div>
              {mode === 'mask' && (
                <p className="mt-2 text-xs text-mist-400">
                  Закрасьте нужный участок, затем выберите плитку. Несколько материалов
                  можно комбинировать по очереди.
                </p>
              )}

              {mode === 'facade' && (
                <div className="mt-5 space-y-5">
                  <FacadeZonePicker zones={zones} onToggle={toggleFacadeZone} />
                  {facadeIsPartial && (
                    <FacadeColorPicker
                      baseColor={baseColor}
                      onChange={setBaseColor}
                    />
                  )}
                </div>
              )}
            </section>
          )}

          {photo && (
            <section className="card animate-slide-up p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-mist-400">
                Реальные размеры поверхности
              </h2>
              <p className="mb-3 mt-1 text-xs text-mist-400">
                Необязательно, но помогает положить плитку в правильном масштабе.
              </p>
              {mode === 'floor' ? (
                <label className="block">
                  <span className="text-xs text-mist-400">Площадь пола, м²</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.1"
                    value={areaM2}
                    onChange={(event) => setAreaM2(event.target.value)}
                    placeholder="напр. 18"
                    className="mt-1 w-full rounded-xl border border-white/10 bg-white/[.04] px-3 py-2.5 text-sm outline-none transition focus:border-white/30"
                  />
                </label>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs text-mist-400">Ширина, м</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.1"
                      value={widthM}
                      onChange={(event) => setWidthM(event.target.value)}
                      placeholder="напр. 6"
                      className="mt-1 w-full rounded-xl border border-white/10 bg-white/[.04] px-3 py-2.5 text-sm outline-none transition focus:border-white/30"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-mist-400">Высота, м</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.1"
                      value={heightM}
                      onChange={(event) => setHeightM(event.target.value)}
                      placeholder="напр. 3"
                      className="mt-1 w-full rounded-xl border border-white/10 bg-white/[.04] px-3 py-2.5 text-sm outline-none transition focus:border-white/30"
                    />
                  </label>
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
            tiles={allTiles}
            loading={tilesLoading}
          />
        </div>
      </div>

      <div className="sticky bottom-4 z-30 mt-10 flex flex-col items-center gap-2 px-4">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!canGenerate}
          className="btn-gold w-full max-w-md cursor-pointer !px-6 !py-4 text-base disabled:cursor-not-allowed disabled:!bg-[rgba(255,255,255,.06)] disabled:!text-[var(--ink-soft)] disabled:!shadow-none disabled:hover:!transform-none sm:w-auto"
        >
          <Sparkles size={18} />
          {!photo
            ? 'Загрузите фото'
            : mode === 'mask' && !maskHasStrokes
              ? 'Выделите участок кистью'
              : !selectedTile
                ? 'Выберите плитку'
                : 'Сгенерировать визуализацию'}
        </button>
        {photo && selectedTile && <p className="text-xs text-mist-400">до 2 минут</p>}
      </div>
    </div>
  );
}

function FacadeZonePicker({
  zones,
  onToggle,
  compact = false,
}: {
  zones: FacadeZone[];
  onToggle: (zone: FacadeZone) => void;
  compact?: boolean;
}) {
  return (
    <div>
      <h3
        className={cn(
          'font-medium text-mist-300',
          compact
            ? 'mb-2 text-xs'
            : 'mb-3 text-sm font-semibold uppercase tracking-wider text-mist-400',
        )}
      >
        Зоны облицовки
      </h3>
      <div className="flex flex-wrap gap-2">
        {FACADE_ZONE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onToggle(option.value)}
            className={cn(
              'cursor-pointer border font-medium transition',
              compact
                ? 'rounded-lg px-2.5 py-2 text-xs'
                : 'rounded-xl px-3 py-2 text-sm',
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
  );
}

function FacadeColorPicker({
  baseColor,
  onChange,
  compact = false,
}: {
  baseColor: FacadeBaseColor;
  onChange: (color: FacadeBaseColor) => void;
  compact?: boolean;
}) {
  return (
    <div>
      <h3
        className={cn(
          'font-medium text-mist-300',
          compact
            ? 'mb-2 text-xs'
            : 'mb-3 text-sm font-semibold uppercase tracking-wider text-mist-400',
        )}
      >
        Цвет основного фасада
      </h3>
      <div className="grid grid-cols-3 gap-2">
        {FACADE_BASE_COLOR_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'cursor-pointer border font-medium transition',
              compact
                ? 'rounded-lg px-2 py-2 text-xs'
                : 'rounded-xl px-3 py-2 text-sm',
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
  );
}

export default function VisualizePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-16 text-center text-mist-400">
          Загрузка…
        </div>
      }
    >
      <VisualizePageInner />
    </Suspense>
  );
}

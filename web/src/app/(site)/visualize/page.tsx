'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PhotoUploader } from '@/components/PhotoUploader';
import { TileSelector } from '@/components/TileSelector';
import { VisualizerLoader } from '@/components/VisualizerLoader';
import { ProviderSelector } from '@/components/ProviderSelector';
import { tiles, getTileById, formatPrice, type Tile } from '@/lib/tiles';
import { Sparkles, Download, MessageCircle, ArrowLeft, AlertCircle, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/cn';

type Surface = 'floor' | 'wall';
type Stage = 'idle' | 'generating' | 'result' | 'error';
type Provider = 'fal' | 'replicate' | 'gemini' | 'mock';

function VisualizePageInner() {
  const params = useSearchParams();
  const initialTileId = params.get('tile');
  const initialTile = initialTileId ? getTileById(initialTileId) : undefined;

  const [photo, setPhoto] = useState<string | null>(null);
  const [selectedTile, setSelectedTile] = useState<Tile | null>(initialTile ?? null);
  const [surface, setSurface] = useState<Surface>('floor');
  const [provider, setProvider] = useState<Provider>('gemini');
  const [stage, setStage] = useState<Stage>('idle');
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultMeta, setResultMeta] = useState<{ provider: Provider; durationMs: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canGenerate = photo && selectedTile && stage !== 'generating';

  async function generateFor(tile: Tile) {
    if (!photo) return;
    setStage('generating');
    setErrorMsg(null);
    try {
      const res = await fetch('/api/visualize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomImage: photo,
          tileId: tile.id,
          surface,
          provider,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Сервер вернул ${res.status}`);
      }
      const data = await res.json();
      setResultUrl(data.imageUrl);
      setResultMeta({ provider: data.provider, durationMs: data.durationMs });
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
    setErrorMsg(null);
  }

  function handleSwapTile(tile: Tile) {
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
          className="mb-4 inline-flex items-center gap-2 text-sm text-mist-400 hover:text-gold-400"
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
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selectedTile.image}
                      alt={selectedTile.name}
                      className="h-16 w-16 rounded-lg object-cover"
                    />
                    <div>
                      <div className="font-semibold">{selectedTile.name}</div>
                      <div className="text-xs text-mist-400">
                        {selectedTile.sku} · {selectedTile.size}
                      </div>
                      <div className="mt-1 font-bold text-gold-400">
                        {formatPrice(selectedTile.pricePerM2)}
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
                <a
                  href={`https://wa.me/996503337733?text=${encodeURIComponent(`Здравствуйте! Интересует плитка ${selectedTile?.name} (${selectedTile?.sku}). Можно образец?`)}`}
                  target="_blank"
                  rel="noopener"
                  className="btn-gold !py-2 !px-3 text-sm"
                >
                  <MessageCircle size={14} /> Заявка
                </a>
              </div>
            </div>

            <div className="card p-5">
              <div className="text-xs uppercase tracking-wider text-mist-400">
                Попробуйте другую
              </div>
              <div className="mt-3 max-h-80 overflow-y-auto pr-1">
                <TileSelector
                  selectedId={selectedTile?.id ?? null}
                  onSelect={handleSwapTile}
                  compact
                />
              </div>
              <p className="mt-3 text-xs text-mist-400">
                Свайп — новая генерация. Часть результатов мгновенно из кэша.
              </p>
            </div>

            <div className="card p-5">
              <div className="font-semibold">Бесплатный образец</div>
              <p className="mt-1 text-sm text-mist-400">
                Заберите образец этой плитки в шоуруме — почувствуете текстуру руками.
              </p>
              <a
                href="https://2gis.kg/bishkek/firm/70000001028478923"
                target="_blank"
                rel="noopener"
                className="mt-3 inline-block text-sm text-gold-400 hover:underline"
              >
                Карасаева 64, Бишкек →
              </a>
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
          <button onClick={handleReset} className="text-mist-400 hover:text-mist-100">
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

          {photo && (
            <section className="animate-slide-up">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-mist-400">
                Поверхность
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {(['floor', 'wall'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSurface(s)}
                    className={cn(
                      'rounded-xl border px-4 py-3 text-sm font-medium transition',
                      surface === s
                        ? 'border-gold-500 bg-gold-500/10 text-gold-400'
                        : 'border-white/10 text-mist-400 hover:border-white/30',
                    )}
                  >
                    {s === 'floor' ? 'Пол' : 'Стена'}
                  </button>
                ))}
              </div>
            </section>
          )}

          {photo && (
            <section className="animate-slide-up">
              <ProviderSelector value={provider} onChange={setProvider} />
            </section>
          )}
        </div>

        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-mist-400">
            Выберите плитку
          </h2>
          <TileSelector
            selectedId={selectedTile?.id ?? null}
            onSelect={setSelectedTile}
          />
        </div>
      </div>

      <div className="sticky bottom-4 z-30 mt-10 flex flex-col items-center gap-2 px-4">
        <button
          onClick={handleGenerate}
          disabled={!canGenerate}
          className="btn-gold w-full max-w-md !px-6 !py-4 text-base shadow-2xl shadow-gold-500/20 disabled:!bg-mist-400/20 disabled:!text-mist-400 sm:w-auto"
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

'use client';

import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';
import { useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  Bot,
  Check,
  Download,
  ImagePlus,
  MessageCircle,
  Paperclip,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  Sparkles,
  X,
  ZoomIn,
} from 'lucide-react';
import {
  CatalogTileSelector,
  type CatalogTile,
} from '@/components/CatalogTileSelector';
import { normalizeImageFile } from '@/lib/image';

const SUGGESTIONS = [
  'Облицуй весь фасад этой плиткой',
  'Клинкер между окнами, основной фасад белый',
  'Колонны и цоколь тоже облицуй',
  'Положи плитку на пол',
  'На стену',
  'Уложи вертикально',
];

type Contacts = {
  whatsapp: string | null;
  mapLink: string | null;
  address: string | null;
};

type ChatHistoryMessage = {
  role: 'user' | 'assistant';
  text: string;
};

type TurnRequest = {
  baseImage?: string;
  message: string;
  tile: CatalogTile;
  tileChanged: boolean;
  history: ChatHistoryMessage[];
};

type TurnResult = {
  imageUrl: string;
  sourceUrl: string;
  durationMs: number;
  saving: boolean;
  saved: boolean;
  saveError?: string;
};

type ChatTurn = {
  id: string;
  request: TurnRequest;
  userImage?: string;
  status: 'thinking' | 'generating' | 'completed' | 'error';
  reply?: string;
  result?: TurnResult;
  error?: string;
};

function buildThreadHistory(turns: ChatTurn[]): ChatHistoryMessage[] {
  const history: ChatHistoryMessage[] = [];
  for (const turn of turns) {
    history.push({
      role: 'user',
      text: turn.request.message.slice(0, 600),
    });
    if (turn.reply?.trim()) {
      history.push({
        role: 'assistant',
        text: turn.reply.trim().slice(0, 600),
      });
    }
  }
  return history.slice(-12);
}

function waLink(whatsapp: string | null | undefined): string | null {
  if (!whatsapp) return null;
  return whatsapp.startsWith('http')
    ? whatsapp
    : `https://wa.me/${whatsapp.replace(/[^\d]/g, '')}`;
}

function waMessageLink(
  whatsapp: string | null | undefined,
  message: string,
): string {
  const base = waLink(whatsapp);
  if (!base) return '/#contacts';
  return `${base}${base.includes('?') ? '&' : '?'}text=${encodeURIComponent(message)}`;
}

function friendlyError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (/fetch failed|timeout|ETIMEDOUT|ECONN|network|502|503|504|UND_ERR/i.test(raw)) {
    return 'Сеть подвисла при обработке. Нажмите «Попробовать снова» — обычно со второго раза проходит.';
  }
  return raw || 'Неизвестная ошибка';
}

async function responseError(response: Response): Promise<string> {
  const data = (await response.json().catch(() => null)) as {
    error?: unknown;
  } | null;
  return typeof data?.error === 'string'
    ? data.error
    : `Сервер вернул ${response.status}`;
}

function VisualizeChat() {
  const params = useSearchParams();
  const initialSlug = params.get('tile');
  const [allTiles, setAllTiles] = useState<CatalogTile[]>([]);
  const [tilesLoading, setTilesLoading] = useState(true);
  const [selectedTile, setSelectedTile] = useState<CatalogTile | null>(null);
  const [tilePickerOpen, setTilePickerOpen] = useState(false);
  const [tileChangedPending, setTileChangedPending] = useState(false);
  const [contacts, setContacts] = useState<Contacts | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState('');
  const [attachment, setAttachment] = useState<string | null>(null);
  const [normalizingImage, setNormalizingImage] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const submissionLockRef = useRef(false);

  const isGenerating = turns.some(
    (turn) => turn.status === 'thinking' || turn.status === 'generating',
  );
  const lastResultTurn = useMemo(
    () => [...turns].reverse().find((turn) => turn.result),
    [turns],
  );
  const conversationBaseImage = useMemo(() => {
    const resultImage =
      lastResultTurn?.result?.sourceUrl || lastResultTurn?.result?.imageUrl;
    if (resultImage) return resultImage;
    return (
      [...turns]
        .reverse()
        .find((turn) => turn.request.baseImage)?.request.baseImage ?? null
    );
  }, [lastResultTurn, turns]);
  const isEmptyThread = turns.length === 0;
  const canSend = Boolean(
    selectedTile &&
      draft.trim() &&
      draft.trim().length <= 500 &&
      !isGenerating &&
      !normalizingImage,
  );

  useEffect(() => {
    let alive = true;
    fetch('/api/catalog/products')
      .then((response) => response.json())
      .then((data) => {
        if (!alive) return;
        const products: CatalogTile[] = Array.isArray(data?.products)
          ? data.products
          : [];
        setAllTiles(products);
        const initialTile = initialSlug
          ? products.find((product) => product.slug === initialSlug)
          : null;
        if (initialTile) {
          setSelectedTile(initialTile);
        } else {
          setTilePickerOpen(true);
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

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 104)}px`;
  }, [draft]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns.length, isGenerating]);

  useEffect(() => {
    if (!lightboxUrl) return;
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setLightboxUrl(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [lightboxUrl]);

  async function pollVisualization(
    requestId: string,
  ): Promise<{ imageUrl: string; sourceUrl: string }> {
    const deadline = Date.now() + 4 * 60 * 1000;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const response = await fetch(
        `/api/visualize/status?requestId=${encodeURIComponent(requestId)}`,
      );
      if (!response.ok) throw new Error(await responseError(response));
      const data = (await response.json()) as {
        status?: unknown;
        imageUrl?: unknown;
        sourceUrl?: unknown;
        error?: unknown;
      };
      if (data.status === 'completed' && typeof data.imageUrl === 'string') {
        return {
          imageUrl: data.imageUrl,
          sourceUrl:
            typeof data.sourceUrl === 'string' ? data.sourceUrl : data.imageUrl,
        };
      }
      if (data.status === 'failed') {
        throw new Error(
          typeof data.error === 'string' ? data.error : 'Генерация не удалась',
        );
      }
    }
    throw new Error('Превышено время ожидания генерации');
  }

  async function runTurn(turnId: string, request: TurnRequest) {
    const startedAt = Date.now();
    try {
      const response = await fetch('/api/visualize/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseImage: request.baseImage,
          tileId: request.tile.slug,
          message: request.message,
          tileChanged: request.tileChanged,
          history: request.history,
        }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      const data = (await response.json()) as {
        async?: unknown;
        requestId?: unknown;
        reply?: unknown;
      };
      const reply = typeof data.reply === 'string' ? data.reply.trim() : '';

      if (data.async !== true) {
        if (!reply) throw new Error('Сервер не вернул ответ ассистента');
        setTurns((current) =>
          current.map((turn) =>
            turn.id === turnId
              ? {
                  ...turn,
                  status: 'completed',
                  reply,
                  error: undefined,
                  result: undefined,
                }
              : turn,
          ),
        );
        return;
      }
      if (typeof data.requestId !== 'string') {
        throw new Error('Сервер не вернул номер задания');
      }

      setTurns((current) =>
        current.map((turn) =>
          turn.id === turnId
            ? {
                ...turn,
                status: 'generating',
                reply: reply || undefined,
                error: undefined,
              }
            : turn,
        ),
      );
      const result = await pollVisualization(data.requestId);
      setTurns((current) =>
        current.map((turn) =>
          turn.id === turnId
            ? {
                ...turn,
                status: 'completed',
                error: undefined,
                result: {
                  ...result,
                  durationMs: Date.now() - startedAt,
                  saving: false,
                  saved: false,
                },
              }
            : turn,
        ),
      );
      if (request.tileChanged) setTileChangedPending(false);
    } catch (err) {
      setTurns((current) =>
        current.map((turn) =>
          turn.id === turnId
            ? {
                ...turn,
                status: 'error',
                error: friendlyError(err),
                result: undefined,
              }
            : turn,
        ),
      );
    } finally {
      submissionLockRef.current = false;
    }
  }

  function sendMessage() {
    if (!canSend || submissionLockRef.current || !selectedTile) return;
    const message = draft.trim();
    const baseImage = conversationBaseImage || attachment || undefined;

    submissionLockRef.current = true;
    const id = crypto.randomUUID();
    const request: TurnRequest = {
      baseImage,
      message,
      tile: selectedTile,
      tileChanged: tileChangedPending,
      history: buildThreadHistory(turns),
    };
    const turn: ChatTurn = {
      id,
      request,
      userImage:
        !conversationBaseImage && attachment ? attachment : undefined,
      status: 'thinking',
    };
    setTurns((current) => [...current, turn]);
    setDraft('');
    setAttachment(null);
    setAttachmentError(null);
    void runTurn(id, request);
  }

  function retryTurn(turn: ChatTurn) {
    if (isGenerating || submissionLockRef.current) return;
    submissionLockRef.current = true;
    setTurns((current) =>
      current.map((item) =>
        item.id === turn.id
          ? {
              ...item,
              status: 'thinking',
              reply: undefined,
              error: undefined,
            }
          : item,
      ),
    );
    void runTurn(turn.id, turn.request);
  }

  async function saveTurn(turn: ChatTurn) {
    if (!turn.result || turn.result.saving || turn.result.saved) return;
    setTurns((current) =>
      current.map((item) =>
        item.id === turn.id && item.result
          ? {
              ...item,
              result: {
                ...item.result,
                saving: true,
                saveError: undefined,
              },
            }
          : item,
      ),
    );
    try {
      const response = await fetch('/api/visualize/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: turn.result.imageUrl,
          tileSlug: turn.request.tile.slug,
          tileName: turn.request.tile.name,
          surface: 'chat',
        }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      setTurns((current) =>
        current.map((item) =>
          item.id === turn.id && item.result
            ? {
                ...item,
                result: {
                  ...item.result,
                  saving: false,
                  saved: true,
                  saveError: undefined,
                },
              }
            : item,
        ),
      );
    } catch (err) {
      setTurns((current) =>
        current.map((item) =>
          item.id === turn.id && item.result
            ? {
                ...item,
                result: {
                  ...item.result,
                  saving: false,
                  saveError: friendlyError(err),
                },
              }
            : item,
        ),
      );
    }
  }

  async function handleAttachment(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || conversationBaseImage) return;
    if (!file.type.startsWith('image/')) {
      setAttachmentError('Загрузите изображение в формате JPG, PNG или WebP.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setAttachmentError('Файл больше 10 MB. Уменьшите его размер.');
      return;
    }
    setNormalizingImage(true);
    setAttachmentError(null);
    try {
      setAttachment(await normalizeImageFile(file));
    } catch {
      setAttachmentError('Не удалось обработать фото. Попробуйте другое.');
    } finally {
      setNormalizingImage(false);
    }
  }

  function handleTextareaKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  function selectTile(tile: CatalogTile) {
    const previousTileSlug = lastResultTurn?.request.tile.slug;
    setSelectedTile(tile);
    setTileChangedPending(
      Boolean(previousTileSlug && previousTileSlug !== tile.slug),
    );
    setTilePickerOpen(false);
  }

  function resetChat() {
    const hasWork = turns.length > 0 || Boolean(attachment) || Boolean(draft.trim());
    if (
      hasWork &&
      !window.confirm('Начать новый чат? Текущая переписка будет очищена.')
    ) {
      return;
    }
    setTurns([]);
    setDraft('');
    setAttachment(null);
    setAttachmentError(null);
    setTileChangedPending(false);
    setLightboxUrl(null);
    submissionLockRef.current = false;
  }

  const sendHint = isGenerating
    ? 'Ассистент обрабатывает сообщение'
    : !selectedTile
      ? 'Сначала выберите плитку'
      : !conversationBaseImage && !attachment
        ? 'Можно сначала написать — фото понадобится только для генерации'
        : !draft.trim()
          ? 'Напишите задачу или задайте вопрос о визуализации'
          : 'Enter — отправить · Shift+Enter — новая строка';

  return (
    <div className="min-h-[calc(100dvh-var(--site-header-h))] bg-ink-900">
      <header className="sticky top-[var(--site-header-h)] z-30 border-b border-white/10 bg-ink-900/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-3 py-3 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-ink-700">
              {selectedTile?.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selectedTile.imageUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-mist-400">
                  <ImagePlus size={18} />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <h1 className="truncate font-sans text-sm font-semibold sm:text-base">
                {selectedTile?.name ?? 'Плитка не выбрана'}
              </h1>
              <p className="truncate text-[11px] text-mist-400 sm:text-xs">
                {selectedTile
                  ? [selectedTile.collection, selectedTile.dimensions]
                      .filter(Boolean)
                      .join(' · ') || 'Japan Ceramic'
                  : 'Выберите товар из каталога'}
              </p>
            </div>
          </div>
          {tileChangedPending && (
            <span className="hidden rounded-full border border-gold-500/40 bg-gold-500/10 px-2.5 py-1 text-[10px] text-gold-400 lg:inline-flex">
              Заменим в следующем ходе
            </span>
          )}
          <button
            type="button"
            onClick={() => setTilePickerOpen(true)}
            disabled={isGenerating}
            className="shrink-0 cursor-pointer rounded-lg border border-white/15 px-3 py-2 text-xs font-medium text-mist-200 transition hover:border-white/30 hover:bg-white/[.04] disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
          >
            Сменить плитку
          </button>
          <button
            type="button"
            onClick={resetChat}
            disabled={isGenerating}
            className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-2 py-2 text-xs text-mist-400 transition hover:bg-white/[.04] hover:text-mist-100 disabled:cursor-not-allowed disabled:opacity-50 sm:px-3 sm:text-sm"
          >
            <RotateCcw size={15} />
            <span className="hidden sm:inline">Новый чат</span>
          </button>
        </div>
      </header>

      <div className="mx-auto flex min-h-[calc(100dvh-var(--site-header-h)-80px)] max-w-4xl flex-col">
        <main
          aria-live="polite"
          className="flex-1 space-y-7 px-3 pb-8 pt-7 sm:px-6 sm:pt-10"
        >
          <AssistantIntro contacts={contacts} tile={selectedTile} />

          {turns.map((turn) => (
            <div key={turn.id} className="space-y-4">
              <div className="flex justify-end">
                <div className="max-w-[88%] rounded-2xl rounded-br-md border border-gold-500/20 bg-gold-500/10 px-4 py-3 sm:max-w-[75%]">
                  {turn.userImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={turn.userImage}
                      alt="Прикреплённое фото"
                      className="mb-3 max-h-80 w-auto rounded-xl border border-white/10 object-contain"
                    />
                  )}
                  <p className="whitespace-pre-wrap text-sm leading-6 text-mist-100 sm:text-[15px]">
                    {turn.request.message}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <AssistantAvatar />
                <div className="min-w-0 flex-1">
                  {turn.status === 'thinking' && <ThinkingBubble />}
                  {turn.status === 'generating' && (
                    <GeneratingBubble reply={turn.reply} />
                  )}
                  {turn.status === 'error' && (
                    <ErrorBubble
                      message={turn.error ?? 'Генерация не удалась'}
                      reply={turn.reply}
                      onRetry={() => retryTurn(turn)}
                    />
                  )}
                  {turn.status === 'completed' && turn.result && (
                    <ResultBubble
                      turn={turn}
                      contacts={contacts}
                      onOpen={() => setLightboxUrl(turn.result?.imageUrl ?? null)}
                      onSave={() => void saveTurn(turn)}
                    />
                  )}
                  {turn.status === 'completed' &&
                    !turn.result &&
                    turn.reply && <TextReplyBubble reply={turn.reply} />}
                </div>
              </div>
            </div>
          ))}
          <div ref={threadEndRef} />
        </main>

        <div className="sticky bottom-0 z-20 border-t border-white/[.06] bg-ink-900/95 px-3 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl sm:px-6">
          {isEmptyThread && (
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => {
                    setDraft(suggestion);
                    textareaRef.current?.focus();
                  }}
                  className="shrink-0 cursor-pointer rounded-full border border-white/10 bg-white/[.03] px-3 py-1.5 text-xs text-mist-300 transition hover:border-gold-500/40 hover:text-gold-400"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          {attachment && !conversationBaseImage && (
            <div className="mb-2 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-ink-700 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={attachment}
                alt="Фото для первого сообщения"
                className="h-14 w-14 rounded-lg object-cover"
              />
              <div className="pr-2 text-xs text-mist-300">Фото готово к отправке</div>
              <button
                type="button"
                onClick={() => setAttachment(null)}
                className="cursor-pointer rounded-full p-1 text-mist-400 hover:bg-white/10 hover:text-mist-100"
                aria-label="Удалить фото"
              >
                <X size={15} />
              </button>
            </div>
          )}

          {attachmentError && (
            <p className="mb-2 text-xs text-red-300">{attachmentError}</p>
          )}

          <div className="flex items-end gap-2 rounded-2xl border border-white/15 bg-ink-700/70 p-2 shadow-2xl shadow-black/20 transition focus-within:border-gold-500/50">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAttachment}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={
                Boolean(conversationBaseImage) ||
                isGenerating ||
                normalizingImage
              }
              className="mb-0.5 inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl text-mist-400 transition hover:bg-white/[.06] hover:text-mist-100 disabled:cursor-not-allowed disabled:opacity-35"
              aria-label="Прикрепить фото"
              title={
                conversationBaseImage
                  ? 'Новое фото можно прикрепить в новом чате'
                  : 'Прикрепить фото'
              }
            >
              {normalizingImage ? (
                <RefreshCw size={19} className="animate-spin" />
              ) : (
                <Paperclip size={20} />
              )}
            </button>
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleTextareaKeyDown}
              maxLength={500}
              rows={1}
              placeholder={
                conversationBaseImage
                  ? 'Что изменить в результате?'
                  : 'Опишите задачу или задайте вопрос'
              }
              className="max-h-[104px] min-h-10 flex-1 resize-none bg-transparent px-1 py-2 text-sm leading-6 text-mist-100 outline-none placeholder:text-mist-400 sm:text-[15px]"
            />
            <button
              type="button"
              onClick={sendMessage}
              disabled={!canSend}
              className="mb-0.5 inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-gold-500 text-ink-900 transition hover:bg-gold-400 disabled:cursor-not-allowed disabled:bg-white/[.08] disabled:text-mist-400"
              aria-label="Отправить"
            >
              <Send size={18} />
            </button>
          </div>
          <p className="mt-1.5 px-2 text-[10px] text-mist-400 sm:text-xs">
            {sendHint}
          </p>
        </div>
      </div>

      {tilePickerOpen && (
        <div
          className="fixed inset-0 z-[var(--z-drawer)] flex items-end bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Выбор плитки"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && selectedTile) {
              setTilePickerOpen(false);
            }
          }}
        >
          <div className="max-h-[88dvh] w-full overflow-hidden rounded-t-2xl border border-white/10 bg-ink-800 sm:max-w-4xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-4 sm:px-6">
              <div>
                <h2 className="font-sans text-lg font-semibold">Выберите плитку</h2>
                <p className="mt-0.5 text-xs text-mist-400">
                  Она будет использоваться в следующем сообщении
                </p>
              </div>
              {selectedTile && (
                <button
                  type="button"
                  onClick={() => setTilePickerOpen(false)}
                  className="cursor-pointer rounded-full p-2 text-mist-400 hover:bg-white/[.06] hover:text-mist-100"
                  aria-label="Закрыть"
                >
                  <X size={20} />
                </button>
              )}
            </div>
            <div className="max-h-[calc(88dvh-82px)] overflow-y-auto p-4 sm:p-6">
              <CatalogTileSelector
                selectedSlug={selectedTile?.slug ?? null}
                onSelect={selectTile}
                tiles={allTiles}
                loading={tilesLoading}
              />
            </div>
          </div>
        </div>
      )}

      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[var(--z-menu)] flex items-center justify-center bg-black/95 p-3 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label="Результат на весь экран"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxUrl(null)}
            className="absolute right-4 top-4 z-10 cursor-pointer rounded-full bg-white/10 p-2.5 text-white backdrop-blur hover:bg-white/20"
            aria-label="Закрыть"
          >
            <X size={22} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt="Результат визуализации"
            className="max-h-full max-w-full object-contain"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

function AssistantAvatar() {
  return (
    <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gold-500/30 bg-gold-500/10 text-gold-400">
      <Bot size={16} />
    </div>
  );
}

function AssistantIntro({
  contacts,
  tile,
}: {
  contacts: Contacts | null;
  tile: CatalogTile | null;
}) {
  const message = tile
    ? `Здравствуйте! Хочу подобрать плитку ${tile.name} для своего проекта.`
    : 'Здравствуйте! Хочу подобрать плитку для своего проекта.';
  const href = waMessageLink(contacts?.whatsapp, message);
  const hasWhatsApp = Boolean(waLink(contacts?.whatsapp));

  return (
    <div className="flex items-start gap-2.5">
      <AssistantAvatar />
      <div className="max-w-2xl rounded-2xl rounded-tl-md border border-white/10 bg-white/[.035] px-4 py-4 sm:px-5">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.12em] text-gold-400">
          <Sparkles size={14} />
          AI-визуализатор
        </div>
        <p className="text-sm leading-6 text-mist-200 sm:text-[15px]">
          Опишите задачу или задайте вопрос. Когда будете готовы к визуализации,
          пришлите фото помещения или фасада — я примерю выбранную плитку. Дальше
          результат можно править текстом: «колонны тоже облицуй», «сделай
          светлее»…
        </p>
        <p className="mt-3 border-t border-white/[.08] pt-3 text-[11px] leading-5 text-mist-400">
          Визуализация создана ИИ и носит ориентировочный характер: реальные цвет,
          фактура, масштаб и укладка могут немного отличаться. Сверяйтесь с физическим
          образцом в шоуруме.
        </p>
        <a
          href={href}
          target={hasWhatsApp ? '_blank' : undefined}
          rel={hasWhatsApp ? 'noopener' : undefined}
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-gold-400 hover:text-gold-300"
        >
          <MessageCircle size={14} />
          Нужна помощь? Напишите в WhatsApp
        </a>
      </div>
    </div>
  );
}

function ThinkingBubble() {
  return (
    <div className="inline-flex max-w-2xl items-center gap-2 rounded-2xl rounded-tl-md border border-white/10 bg-white/[.035] px-4 py-3 text-sm text-mist-300">
      <RefreshCw size={15} className="animate-spin text-gold-400" />
      Обдумываю запрос…
    </div>
  );
}

function TextReplyBubble({ reply }: { reply: string }) {
  return (
    <div className="max-w-2xl rounded-2xl rounded-tl-md border border-white/10 bg-white/[.035] px-4 py-3 sm:px-5">
      <p className="whitespace-pre-wrap text-sm leading-6 text-mist-200 sm:text-[15px]">
        {reply}
      </p>
    </div>
  );
}

function GeneratingBubble({ reply }: { reply?: string }) {
  return (
    <div className="max-w-2xl overflow-hidden rounded-2xl rounded-tl-md border border-white/10 bg-white/[.035]">
      {reply && (
        <p className="whitespace-pre-wrap border-b border-white/[.08] px-4 py-3 text-sm leading-6 text-mist-200 sm:px-5 sm:text-[15px]">
          {reply}
        </p>
      )}
      <div className="shimmer aspect-[4/3] w-full max-w-xl" />
      <div className="flex items-center gap-2 px-4 py-3 text-sm text-mist-300">
        <RefreshCw size={15} className="animate-spin text-gold-400" />
        Генерирую ~30–60 сек
      </div>
    </div>
  );
}

function ErrorBubble({
  message,
  reply,
  onRetry,
}: {
  message: string;
  reply?: string;
  onRetry: () => void;
}) {
  return (
    <div className="max-w-2xl overflow-hidden rounded-2xl rounded-tl-md border border-red-500/25 bg-red-500/[.07]">
      {reply && (
        <p className="whitespace-pre-wrap border-b border-red-500/20 px-4 py-3 text-sm leading-6 text-mist-200 sm:px-5 sm:text-[15px]">
          {reply}
        </p>
      )}
      <div className="flex items-start gap-2.5 px-4 py-4">
        <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-300" />
        <div>
          <p className="text-sm leading-6 text-mist-200">{message}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-xs font-medium text-mist-100 transition hover:bg-white/[.06]"
          >
            <RotateCcw size={14} />
            Попробовать снова
          </button>
        </div>
      </div>
    </div>
  );
}

function ResultBubble({
  turn,
  contacts,
  onOpen,
  onSave,
}: {
  turn: ChatTurn;
  contacts: Contacts | null;
  onOpen: () => void;
  onSave: () => void;
}) {
  const result = turn.result;
  if (!result) return null;
  const href = waMessageLink(
    contacts?.whatsapp,
    `Здравствуйте! Интересует плитка ${turn.request.tile.name}. Можно образец?`,
  );
  const hasWhatsApp = Boolean(waLink(contacts?.whatsapp));

  return (
    <div className="max-w-2xl overflow-hidden rounded-2xl rounded-tl-md border border-white/10 bg-white/[.035]">
      {turn.reply && (
        <p className="whitespace-pre-wrap border-b border-white/[.08] px-4 py-3 text-sm leading-6 text-mist-200 sm:px-5 sm:text-[15px]">
          {turn.reply}
        </p>
      )}
      <button
        type="button"
        onClick={onOpen}
        className="group relative block w-full cursor-zoom-in overflow-hidden bg-black/20"
        aria-label="Открыть результат на весь экран"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={result.imageUrl}
          alt={`Визуализация с плиткой ${turn.request.tile.name}`}
          className="max-h-[72dvh] w-full object-contain"
        />
        <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/65 px-2.5 py-1 text-[10px] text-white opacity-0 backdrop-blur transition group-hover:opacity-100">
          <ZoomIn size={12} />
          На весь экран
        </span>
      </button>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-xs">
        <a
          href={result.imageUrl}
          download="japan-ceramic-visualization.jpg"
          className="inline-flex items-center gap-1.5 text-mist-300 transition hover:text-gold-400"
        >
          <Download size={14} />
          Скачать
        </a>
        <button
          type="button"
          onClick={onSave}
          disabled={result.saving || result.saved}
          className="inline-flex cursor-pointer items-center gap-1.5 text-mist-300 transition hover:text-gold-400 disabled:cursor-default disabled:text-gold-400"
        >
          {result.saved ? (
            <>
              <Check size={14} />
              Сохранено
            </>
          ) : result.saving ? (
            <>
              <RefreshCw size={14} className="animate-spin" />
              Сохраняю
            </>
          ) : (
            <>
              <Save size={14} />
              Сохранить в кабинет
            </>
          )}
        </button>
        <a
          href={href}
          target={hasWhatsApp ? '_blank' : undefined}
          rel={hasWhatsApp ? 'noopener' : undefined}
          className="inline-flex items-center gap-1.5 text-mist-300 transition hover:text-gold-400"
        >
          <MessageCircle size={14} />
          Заявка
        </a>
        <span className="ml-auto text-[10px] text-mist-400">
          {(result.durationMs / 1000).toFixed(0)} сек
        </span>
        {result.saveError && (
          <p className="basis-full text-[11px] text-red-300">
            Не удалось сохранить: {result.saveError}
          </p>
        )}
      </div>
    </div>
  );
}

export default function VisualizePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-4xl px-4 py-16 text-center text-mist-400">
          Загрузка чата…
        </div>
      }
    >
      <VisualizeChat />
    </Suspense>
  );
}

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
  BookImage,
  Bot,
  Check,
  Download,
  ImagePlus,
  Images,
  MessageCircle,
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

const MAX_SCENE_IMAGES = 4;
const MAX_TILE_IMAGES = 3;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ECHO_CANVAS_SIZE = 64;
// Эхо — менее 3% пикселей, у которых средняя RGB-разница больше 12/255.
const ECHO_CHANGED_PIXEL_RATIO = 0.03;
const ECHO_PIXEL_DIFF_THRESHOLD = 12;

type Contacts = {
  whatsapp: string | null;
  mapLink: string | null;
  address: string | null;
};

type ChatHistoryMessage = {
  role: 'user' | 'assistant';
  text: string;
};

type CustomTile = {
  images: string[];
  name?: string;
  wmm?: number;
  hmm?: number;
};

type TileSelection =
  | { kind: 'catalog'; tile: CatalogTile }
  | ({ kind: 'custom' } & CustomTile)
  | null;

type TurnRequest = {
  sceneImages: string[];
  message: string;
  tile: TileSelection;
  referenceImage?: string;
  tileChanged: boolean;
  history: ChatHistoryMessage[];
};

type TurnResult = {
  status: 'pending' | 'done' | 'failed';
  requestId: string;
  sceneIndex: number;
  imageUrl?: string;
  sourceUrl?: string;
  error?: string;
  echoRetried?: boolean;
  durationMs?: number;
  saving: boolean;
  saved: boolean;
  saveError?: string;
};

type ChatTurn = {
  id: string;
  request: TurnRequest;
  userImages: string[];
  userReference?: string;
  status: 'thinking' | 'generating' | 'completed' | 'error';
  reply?: string;
  results?: TurnResult[];
  activeSceneIndex?: number;
  activeResultSelected?: boolean;
  error?: string;
};

type ChatJob = {
  requestId: string;
  sceneIndex: number;
};

type ChatResponse = {
  async?: unknown;
  jobs?: unknown;
  reply?: unknown;
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
  if (/403|404|Не удалось загрузить изображение/i.test(raw)) {
    return 'Не удалось получить картинку. Нажмите «Попробовать снова».';
  }
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

function tileName(selection: TileSelection): string {
  if (!selection) return 'выбранная плитка';
  return selection.kind === 'catalog'
    ? selection.tile.name
    : selection.name?.trim() || 'Своя плитка';
}

function sameTile(
  first: Exclude<TileSelection, null>,
  second: Exclude<TileSelection, null>,
): boolean {
  if (first.kind !== second.kind) return false;
  if (first.kind === 'catalog' && second.kind === 'catalog') {
    return first.tile.slug === second.tile.slug;
  }
  if (first.kind === 'custom' && second.kind === 'custom') {
    return (
      first.name === second.name &&
      first.wmm === second.wmm &&
      first.hmm === second.hmm &&
      first.images.length === second.images.length &&
      first.images.every((image, index) => image === second.images[index])
    );
  }
  return false;
}

function tilePreview(selection: TileSelection): string | null {
  if (!selection) return null;
  return selection.kind === 'catalog'
    ? selection.tile.imageUrl
    : selection.images[0] ?? null;
}

function validJobs(value: unknown): ChatJob[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((job) => {
    if (
      job !== null &&
      typeof job === 'object' &&
      'requestId' in job &&
      'sceneIndex' in job &&
      typeof job.requestId === 'string' &&
      Number.isInteger(job.sceneIndex) &&
      Number(job.sceneIndex) >= 0
    ) {
      return [
        {
          requestId: job.requestId,
          sceneIndex: Number(job.sceneIndex),
        },
      ];
    }
    return [];
  });
}

function loadCanvasImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    if (!url.startsWith('data:') && !url.startsWith('blob:')) {
      image.crossOrigin = 'anonymous';
    }
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Не удалось загрузить изображение'));
    image.src = url;
  });
}

async function changedPixelRatio(
  sourceUrl: string,
  resultUrl: string,
): Promise<number | null> {
  try {
    const [source, result] = await Promise.all([
      loadCanvasImage(sourceUrl),
      loadCanvasImage(resultUrl),
    ]);
    // Canvas не вставляется в DOM: это дешёвая offscreen-проверка 64×64.
    const canvas = document.createElement('canvas');
    canvas.width = ECHO_CANVAS_SIZE;
    canvas.height = ECHO_CANVAS_SIZE;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;

    context.drawImage(source, 0, 0, ECHO_CANVAS_SIZE, ECHO_CANVAS_SIZE);
    const sourcePixels = context.getImageData(
      0,
      0,
      ECHO_CANVAS_SIZE,
      ECHO_CANVAS_SIZE,
    ).data;
    context.clearRect(0, 0, ECHO_CANVAS_SIZE, ECHO_CANVAS_SIZE);
    context.drawImage(result, 0, 0, ECHO_CANVAS_SIZE, ECHO_CANVAS_SIZE);
    const resultPixels = context.getImageData(
      0,
      0,
      ECHO_CANVAS_SIZE,
      ECHO_CANVAS_SIZE,
    ).data;

    let changedPixels = 0;
    for (let index = 0; index < sourcePixels.length; index += 4) {
      const pixelDiff =
        (Math.abs(sourcePixels[index] - resultPixels[index]) +
          Math.abs(sourcePixels[index + 1] - resultPixels[index + 1]) +
          Math.abs(sourcePixels[index + 2] - resultPixels[index + 2])) /
        3;
      if (pixelDiff > ECHO_PIXEL_DIFF_THRESHOLD) changedPixels += 1;
    }

    return changedPixels / (ECHO_CANVAS_SIZE * ECHO_CANVAS_SIZE);
  } catch {
    // CORS/tainted canvas не должен мешать готовому результату.
    return null;
  }
}

function VisualizeChat() {
  const params = useSearchParams();
  const initialSlug = params.get('tile');
  const [allTiles, setAllTiles] = useState<CatalogTile[]>([]);
  const [tilesLoading, setTilesLoading] = useState(true);
  const [tileSelection, setTileSelection] = useState<TileSelection>(null);
  const [lastCatalogTile, setLastCatalogTile] = useState<CatalogTile | null>(
    null,
  );
  const [customTile, setCustomTile] = useState<CustomTile>({ images: [] });
  const customTileRef = useRef<CustomTile>({ images: [] });
  const [tilePickerMode, setTilePickerMode] = useState<'catalog' | 'custom'>(
    'catalog',
  );
  const [tilePickerOpen, setTilePickerOpen] = useState(false);
  const [tileChangedPending, setTileChangedPending] = useState(false);
  const [contacts, setContacts] = useState<Contacts | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState('');
  const [sceneAttachments, setSceneAttachments] = useState<string[]>([]);
  const [referenceAttachment, setReferenceAttachment] = useState<string | null>(
    null,
  );
  const [normalizingScenes, setNormalizingScenes] = useState(false);
  const [normalizingReference, setNormalizingReference] = useState(false);
  const [normalizingTile, setNormalizingTile] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [tileAttachmentError, setTileAttachmentError] = useState<string | null>(
    null,
  );
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sceneInputRef = useRef<HTMLInputElement>(null);
  const referenceInputRef = useRef<HTMLInputElement>(null);
  const tileInputRef = useRef<HTMLInputElement>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const submissionLockRef = useRef(false);

  const isGenerating = turns.some(
    (turn) => turn.status === 'thinking' || turn.status === 'generating',
  );
  const lastResultTurn = useMemo(
    () =>
      [...turns]
        .reverse()
        .find((turn) => turn.results?.some((result) => result.status === 'done')),
    [turns],
  );
  const conversationBaseImage = useMemo(() => {
    if (!lastResultTurn?.results) return null;
    const activeResult = lastResultTurn.results.find(
      (result) =>
        result.sceneIndex === lastResultTurn.activeSceneIndex &&
        result.status === 'done',
    );
    const result =
      activeResult ??
      lastResultTurn.results.find((item) => item.status === 'done');
    return result?.imageUrl || result?.sourceUrl || null;
  }, [lastResultTurn]);
  const isEmptyThread = turns.length === 0;
  const isNormalizing =
    normalizingScenes || normalizingReference || normalizingTile;
  const hasValidTile = Boolean(
    tileSelection &&
      (tileSelection.kind === 'catalog' || tileSelection.images.length > 0),
  );
  // Плитка больше не обязательна для отправки: можно задать вопрос без неё,
  // а требование плитки для рендера проверяет бэкенд (мягкой подсказкой).
  const canSend = Boolean(
    draft.trim() &&
      draft.trim().length <= 500 &&
      !isGenerating &&
      !isNormalizing,
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
          setLastCatalogTile(initialTile);
          setTileSelection({ kind: 'catalog', tile: initialTile });
        }
        // Плитка опциональна: модалку сама не открываем — пользователь
        // вызывает её кнопкой «Выбрать плитку», когда захочет визуализацию.
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

  async function postChat(
    request: TurnRequest,
    sceneImages = request.sceneImages,
    strongEdit = false,
  ): Promise<ChatResponse> {
    const tileBody = !request.tile
      ? { tileId: null }
      : request.tile.kind === 'catalog'
        ? { tileId: request.tile.tile.slug }
        : {
            tileId: null,
            tileImages: request.tile.images,
            tileName: request.tile.name?.trim() || undefined,
            tileWmm: request.tile.wmm,
            tileHmm: request.tile.hmm,
          };
    const response = await fetch('/api/visualize/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sceneImages,
        ...tileBody,
        referenceImage: request.referenceImage,
        message: request.message,
        tileChanged: request.tileChanged,
        history: request.history,
        strongEdit: strongEdit || undefined,
      }),
    });
    if (!response.ok) throw new Error(await responseError(response));
    return (await response.json()) as ChatResponse;
  }

  function updateResult(
    turnId: string,
    sceneIndex: number,
    update: (result: TurnResult) => TurnResult,
  ) {
    setTurns((current) =>
      current.map((turn) => {
        if (turn.id !== turnId || !turn.results) return turn;
        const results = turn.results.map((result) =>
          result.sceneIndex === sceneIndex ? update(result) : result,
        );
        const firstDone = results.find((result) => result.status === 'done');
        const activeStillDone = results.some(
          (result) =>
            result.sceneIndex === turn.activeSceneIndex &&
            result.status === 'done',
        );
        const keepManualSelection =
          turn.activeResultSelected === true && activeStillDone;
        return {
          ...turn,
          results,
          activeSceneIndex: keepManualSelection
            ? turn.activeSceneIndex
            : firstDone?.sceneIndex,
          activeResultSelected: keepManualSelection,
        };
      }),
    );
  }

  async function submitSingleScene(
    turnId: string,
    request: TurnRequest,
    sceneIndex: number,
    strongEdit: boolean,
  ): Promise<ChatJob> {
    const sourceScene = request.sceneImages[sceneIndex];
    if (!sourceScene) throw new Error('Исходное фото для повтора не найдено');
    const data = await postChat(request, [sourceScene], strongEdit);
    const jobs = validJobs(data.jobs);
    if (data.async !== true || jobs.length === 0) {
      const reply = typeof data.reply === 'string' ? data.reply.trim() : '';
      throw new Error(reply || 'Сервер не вернул номер задания');
    }
    const job = { requestId: jobs[0].requestId, sceneIndex };
    updateResult(turnId, sceneIndex, (result) => ({
      ...result,
      status: 'pending',
      requestId: job.requestId,
      error: undefined,
      imageUrl: undefined,
      sourceUrl: undefined,
      saving: false,
      saved: false,
      saveError: undefined,
      echoRetried: result.echoRetried || strongEdit,
    }));
    return job;
  }

  async function processJob(
    turnId: string,
    request: TurnRequest,
    initialJob: ChatJob,
    startedAt: number,
    alreadyEchoRetried = false,
  ) {
    const sceneIndex = initialJob.sceneIndex;
    let job = initialJob;
    let echoRetried = alreadyEchoRetried;
    try {
      let result = await pollVisualization(job.requestId);
      const sourceScene = request.sceneImages[sceneIndex];
      if (sourceScene && !echoRetried) {
        const ratio = await changedPixelRatio(sourceScene, result.imageUrl);
        if (ratio !== null && ratio < ECHO_CHANGED_PIXEL_RATIO) {
          echoRetried = true;
          updateResult(turnId, sceneIndex, (slot) => ({
            ...slot,
            status: 'pending',
            echoRetried: true,
          }));
          job = await submitSingleScene(
            turnId,
            request,
            sceneIndex,
            true,
          );
          result = await pollVisualization(job.requestId);
        }
      }

      updateResult(turnId, sceneIndex, (slot) => ({
        ...slot,
        status: 'done',
        requestId: job.requestId,
        imageUrl: result.imageUrl,
        sourceUrl: result.sourceUrl,
        error: undefined,
        echoRetried,
        durationMs: Date.now() - startedAt,
      }));
    } catch (err) {
      updateResult(turnId, sceneIndex, (slot) => ({
        ...slot,
        status: 'failed',
        requestId: job.requestId,
        error: friendlyError(err),
        imageUrl: undefined,
        sourceUrl: undefined,
        echoRetried,
        durationMs: Date.now() - startedAt,
        saving: false,
        saved: false,
      }));
    }
  }

  async function runTurn(turnId: string, request: TurnRequest) {
    const startedAt = Date.now();
    try {
      const data = await postChat(request);
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
                  results: undefined,
                }
              : turn,
          ),
        );
        return;
      }

      const jobs = validJobs(data.jobs);
      if (jobs.length === 0) throw new Error('Сервер не вернул задания');
      const results: TurnResult[] = jobs.map((job) => ({
        ...job,
        status: 'pending',
        saving: false,
        saved: false,
      }));
      setTurns((current) =>
        current.map((turn) =>
          turn.id === turnId
            ? {
                ...turn,
                status: 'generating',
                reply: reply || undefined,
                error: undefined,
                results,
                activeSceneIndex: undefined,
                activeResultSelected: false,
              }
            : turn,
        ),
      );

      await Promise.all(
        jobs.map((job) => processJob(turnId, request, job, startedAt)),
      );
      setTurns((current) =>
        current.map((turn) =>
          turn.id === turnId ? { ...turn, status: 'completed' } : turn,
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
                results: undefined,
              }
            : turn,
        ),
      );
    } finally {
      submissionLockRef.current = false;
    }
  }

  function sendMessage() {
    if (!canSend || submissionLockRef.current) return;
    // Своя плитка без единого фото ещё не годна для рендера — но отправку не
    // блокируем: считаем её «плитка не выбрана», бэкенд подскажет при попытке.
    const activeTile =
      tileSelection &&
      tileSelection.kind === 'custom' &&
      tileSelection.images.length === 0
        ? null
        : tileSelection;
    const message = draft.trim();
    const newSceneImages = [...sceneAttachments];
    const sceneImages =
      newSceneImages.length > 0
        ? newSceneImages
        : conversationBaseImage
          ? [conversationBaseImage]
          : [];

    submissionLockRef.current = true;
    const id = crypto.randomUUID();
    const request: TurnRequest = {
      sceneImages,
      message,
      tile: activeTile,
      referenceImage: referenceAttachment || undefined,
      tileChanged: tileChangedPending,
      history: buildThreadHistory(turns),
    };
    const turn: ChatTurn = {
      id,
      request,
      userImages: newSceneImages,
      userReference: referenceAttachment || undefined,
      status: 'thinking',
    };
    setTurns((current) => [...current, turn]);
    setDraft('');
    setSceneAttachments([]);
    setReferenceAttachment(null);
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

  async function retryResult(turn: ChatTurn, result: TurnResult) {
    if (isGenerating || submissionLockRef.current) return;
    submissionLockRef.current = true;
    const startedAt = Date.now();
    setTurns((current) =>
      current.map((item) =>
        item.id === turn.id ? { ...item, status: 'generating' } : item,
      ),
    );
    updateResult(turn.id, result.sceneIndex, (slot) => ({
      ...slot,
      status: 'pending',
      error: undefined,
    }));
    try {
      const job = await submitSingleScene(
        turn.id,
        turn.request,
        result.sceneIndex,
        false,
      );
      await processJob(
        turn.id,
        turn.request,
        job,
        startedAt,
        Boolean(result.echoRetried),
      );
    } catch (err) {
      updateResult(turn.id, result.sceneIndex, (slot) => ({
        ...slot,
        status: 'failed',
        error: friendlyError(err),
        imageUrl: undefined,
        sourceUrl: undefined,
        durationMs: Date.now() - startedAt,
        saving: false,
        saved: false,
      }));
    } finally {
      setTurns((current) =>
        current.map((item) =>
          item.id === turn.id ? { ...item, status: 'completed' } : item,
        ),
      );
      submissionLockRef.current = false;
    }
  }

  async function saveResult(turn: ChatTurn, result: TurnResult) {
    if (
      result.status !== 'done' ||
      !result.imageUrl ||
      result.saving ||
      result.saved
    ) {
      return;
    }
    updateResult(turn.id, result.sceneIndex, (slot) => ({
      ...slot,
      saving: true,
      saveError: undefined,
    }));
    try {
      const response = await fetch('/api/visualize/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: result.imageUrl,
          tileSlug:
            turn.request.tile?.kind === 'catalog'
              ? turn.request.tile.tile.slug
              : 'custom',
          tileName: turn.request.tile
            ? tileName(turn.request.tile)
            : 'Своя визуализация',
          surface: 'chat',
        }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      updateResult(turn.id, result.sceneIndex, (slot) => ({
        ...slot,
        saving: false,
        saved: true,
        saveError: undefined,
      }));
    } catch (err) {
      updateResult(turn.id, result.sceneIndex, (slot) => ({
        ...slot,
        saving: false,
        saveError: friendlyError(err),
      }));
    }
  }

  function validateImageFile(file: File): string | null {
    if (!file.type.startsWith('image/')) {
      return 'Загрузите изображение в формате JPG, PNG или WebP.';
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'Файл больше 10 MB. Уменьшите его размер.';
    }
    return null;
  }

  async function handleSceneAttachments(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;
    const capacity = MAX_SCENE_IMAGES - sceneAttachments.length;
    if (capacity <= 0) {
      setAttachmentError('Можно прикрепить не больше 4 фото объекта.');
      return;
    }
    const selectedFiles = files.slice(0, capacity);
    const invalidMessage = selectedFiles
      .map(validateImageFile)
      .find((message): message is string => Boolean(message));
    if (invalidMessage) {
      setAttachmentError(invalidMessage);
      return;
    }
    setNormalizingScenes(true);
    setAttachmentError(
      files.length > capacity ? 'Добавлены первые 4 фото объекта.' : null,
    );
    try {
      const images: string[] = [];
      for (const file of selectedFiles) {
        images.push(await normalizeImageFile(file));
      }
      setSceneAttachments((current) => [
        ...current,
        ...images.slice(0, MAX_SCENE_IMAGES - current.length),
      ]);
    } catch {
      setAttachmentError('Не удалось обработать фото. Попробуйте другое.');
    } finally {
      setNormalizingScenes(false);
    }
  }

  async function handleReferenceAttachment(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const invalidMessage = validateImageFile(file);
    if (invalidMessage) {
      setAttachmentError(invalidMessage);
      return;
    }
    setNormalizingReference(true);
    setAttachmentError(null);
    try {
      setReferenceAttachment(await normalizeImageFile(file));
    } catch {
      setAttachmentError('Не удалось обработать референс. Попробуйте другой.');
    } finally {
      setNormalizingReference(false);
    }
  }

  async function handleTileAttachments(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;
    const capacity = MAX_TILE_IMAGES - customTile.images.length;
    if (capacity <= 0) {
      setTileAttachmentError('Можно загрузить не больше 3 фото плитки.');
      return;
    }
    const selectedFiles = files.slice(0, capacity);
    const invalidMessage = selectedFiles
      .map(validateImageFile)
      .find((message): message is string => Boolean(message));
    if (invalidMessage) {
      setTileAttachmentError(invalidMessage);
      return;
    }
    setNormalizingTile(true);
    setTileAttachmentError(
      files.length > capacity ? 'Добавлены первые 3 фото плитки.' : null,
    );
    try {
      const images: string[] = [];
      for (const file of selectedFiles) {
        images.push(await normalizeImageFile(file));
      }
      updateCustomTile((current) => ({
        ...current,
        images: [
          ...current.images,
          ...images.slice(0, MAX_TILE_IMAGES - current.images.length),
        ],
      }));
    } catch {
      setTileAttachmentError(
        'Не удалось обработать фото плитки. Попробуйте другое.',
      );
    } finally {
      setNormalizingTile(false);
    }
  }

  function handleTextareaKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  function markTileChanged(next: Exclude<TileSelection, null>) {
    const previousTile = lastResultTurn?.request.tile;
    if (previousTile) setTileChangedPending(!sameTile(previousTile, next));
  }

  function selectCatalogTile(tile: CatalogTile) {
    const next: Exclude<TileSelection, null> = { kind: 'catalog', tile };
    markTileChanged(next);
    setLastCatalogTile(tile);
    setTileSelection(next);
    setTilePickerMode('catalog');
    setTilePickerOpen(false);
  }

  function updateCustomTile(update: (current: CustomTile) => CustomTile) {
    const nextCustom = update(customTileRef.current);
    customTileRef.current = nextCustom;
    setCustomTile(nextCustom);
    const next: Exclude<TileSelection, null> = {
      kind: 'custom',
      ...nextCustom,
    };
    markTileChanged(next);
    setTileSelection(next);
  }

  function switchTilePickerMode(mode: 'catalog' | 'custom') {
    setTilePickerMode(mode);
    if (mode === 'catalog') {
      if (lastCatalogTile) {
        const next: Exclude<TileSelection, null> = {
          kind: 'catalog',
          tile: lastCatalogTile,
        };
        markTileChanged(next);
        setTileSelection(next);
      } else if (tileSelection?.kind === 'custom') {
        setTileSelection(null);
      }
      return;
    }
    const next: Exclude<TileSelection, null> = {
      kind: 'custom',
      ...customTileRef.current,
    };
    markTileChanged(next);
    setTileSelection(next);
  }

  function selectActiveResult(turnId: string, sceneIndex: number) {
    setTurns((current) =>
      current.map((turn) =>
        turn.id === turnId
          ? {
              ...turn,
              activeSceneIndex: sceneIndex,
              activeResultSelected: true,
            }
          : turn,
      ),
    );
  }

  function resetChat() {
    const hasWork =
      turns.length > 0 ||
      sceneAttachments.length > 0 ||
      Boolean(referenceAttachment) ||
      Boolean(draft.trim());
    if (
      hasWork &&
      !window.confirm('Начать новый чат? Текущая переписка будет очищена.')
    ) {
      return;
    }
    setTurns([]);
    setDraft('');
    setSceneAttachments([]);
    setReferenceAttachment(null);
    setAttachmentError(null);
    setTileChangedPending(false);
    setLightboxUrl(null);
    submissionLockRef.current = false;
  }

  const selectionName = tileSelection
    ? tileName(tileSelection)
    : 'Плитка не выбрана';
  const selectionPreview = tilePreview(tileSelection);
  const selectionDescription =
    tileSelection?.kind === 'catalog'
      ? [tileSelection.tile.collection, tileSelection.tile.dimensions]
          .filter(Boolean)
          .join(' · ') || 'Japan Ceramic'
      : tileSelection?.kind === 'custom'
        ? [
            `${tileSelection.images.length} фото`,
            tileSelection.wmm && tileSelection.hmm
              ? `${tileSelection.wmm}×${tileSelection.hmm} мм`
              : null,
          ]
            .filter(Boolean)
            .join(' · ')
        : 'Каталог или свои фото плитки';
  const sendHint = isGenerating
    ? 'Ассистент обрабатывает сообщение'
    : !draft.trim()
      ? 'Напишите задачу или задайте вопрос — плитку можно выбрать позже'
      : sceneAttachments.length > 0 && !hasValidTile
        ? 'Для визуализации выберите плитку — кнопка «Плитка» вверху'
        : sceneAttachments.length > 0
          ? `Будет создано до ${sceneAttachments.length} визуализаций`
          : conversationBaseImage
            ? 'Правки применятся к активному результату'
            : 'Enter — отправить · Shift+Enter — новая строка';

  return (
    <div className="min-h-[calc(100dvh-var(--site-header-h))] bg-ink-900">
      <header className="sticky top-[var(--site-header-h)] z-30 border-b border-white/10 bg-ink-900/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-3 py-3 sm:gap-3 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-ink-700">
              {selectionPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selectionPreview}
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
                {selectionName}
              </h1>
              <p className="truncate text-[11px] text-mist-400 sm:text-xs">
                {selectionDescription}
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
            onClick={() => {
              setTilePickerMode(tileSelection?.kind ?? 'catalog');
              setTilePickerOpen(true);
            }}
            disabled={isGenerating}
            className="shrink-0 cursor-pointer rounded-lg border border-white/15 px-2.5 py-2 text-xs font-medium text-mist-200 transition hover:border-white/30 hover:bg-white/[.04] disabled:cursor-not-allowed disabled:opacity-50 sm:px-3 sm:text-sm"
          >
            Плитка
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
          <AssistantIntro contacts={contacts} tile={tileSelection} />

          {turns.map((turn) => (
            <div key={turn.id} className="space-y-4">
              <div className="flex justify-end">
                <div className="max-w-[92%] rounded-2xl rounded-br-md border border-gold-500/20 bg-gold-500/10 px-4 py-3 sm:max-w-[75%]">
                  {turn.userImages.length > 0 && (
                    <div
                      className={`mb-3 grid gap-2 ${
                        turn.userImages.length > 1 ? 'grid-cols-2' : 'grid-cols-1'
                      }`}
                    >
                      {turn.userImages.map((image, index) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={`${turn.id}-scene-${index}`}
                          src={image}
                          alt={`Фото объекта ${index + 1}`}
                          className="max-h-64 w-full rounded-xl border border-white/10 object-cover"
                        />
                      ))}
                    </div>
                  )}
                  {turn.userReference && (
                    <div className="mb-3 flex items-center gap-2 rounded-xl border border-white/10 bg-black/10 p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={turn.userReference}
                        alt="Референс проекта"
                        className="h-12 w-12 rounded-lg object-cover"
                      />
                      <span className="text-xs text-mist-300">
                        Референс / пример
                      </span>
                    </div>
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
                  {turn.status === 'generating' && !turn.results && (
                    <GeneratingBubble reply={turn.reply} />
                  )}
                  {turn.status === 'error' && (
                    <ErrorBubble
                      message={turn.error ?? 'Генерация не удалась'}
                      reply={turn.reply}
                      onRetry={() => retryTurn(turn)}
                    />
                  )}
                  {turn.results && (
                    <ResultBubble
                      turn={turn}
                      contacts={contacts}
                      onOpen={setLightboxUrl}
                      onSave={(result) => void saveResult(turn, result)}
                      onRetry={(result) => void retryResult(turn, result)}
                      onSelect={(sceneIndex) =>
                        selectActiveResult(turn.id, sceneIndex)
                      }
                      retryDisabled={isGenerating}
                    />
                  )}
                  {turn.status === 'completed' &&
                    !turn.results &&
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

          {(sceneAttachments.length > 0 || referenceAttachment) && (
            <div className="mb-2 flex flex-wrap gap-2">
              {sceneAttachments.map((image, index) => (
                <div
                  key={`scene-attachment-${index}`}
                  className="relative h-16 w-16 overflow-hidden rounded-xl border border-white/10 bg-ink-700"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image}
                    alt={`Фото объекта ${index + 1}`}
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setSceneAttachments((current) =>
                        current.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                    className="absolute right-1 top-1 cursor-pointer rounded-full bg-black/70 p-1 text-white hover:bg-black/90"
                    aria-label={`Удалить фото объекта ${index + 1}`}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              {referenceAttachment && (
                <div className="relative flex h-16 items-center gap-2 rounded-xl border border-gold-500/25 bg-gold-500/[.06] p-1.5 pr-8">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={referenceAttachment}
                    alt="Референс проекта"
                    className="h-12 w-12 rounded-lg object-cover"
                  />
                  <span className="hidden text-[11px] text-gold-300 sm:inline">
                    Референс
                  </span>
                  <button
                    type="button"
                    onClick={() => setReferenceAttachment(null)}
                    className="absolute right-1.5 top-1.5 cursor-pointer rounded-full p-1 text-mist-300 hover:bg-white/10 hover:text-white"
                    aria-label="Удалить референс"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
            </div>
          )}

          {attachmentError && (
            <p className="mb-2 text-xs text-red-300">{attachmentError}</p>
          )}

          {!hasValidTile && (
            <button
              type="button"
              onClick={() => {
                setTilePickerMode(tileSelection?.kind ?? 'catalog');
                setTilePickerOpen(true);
              }}
              disabled={isGenerating}
              className="mb-2 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-gold-500/40 bg-gold-500/10 px-3 py-2.5 text-sm font-medium text-gold-300 transition hover:border-gold-500/60 hover:bg-gold-500/15 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              <ImagePlus size={16} />
              Выбрать плитку из каталога или загрузить свою
            </button>
          )}

          <div className="mb-2 flex flex-wrap gap-2">
            <input
              ref={sceneInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleSceneAttachments}
            />
            <button
              type="button"
              onClick={() => sceneInputRef.current?.click()}
              disabled={
                isGenerating ||
                normalizingScenes ||
                sceneAttachments.length >= MAX_SCENE_IMAGES
              }
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/10 bg-white/[.03] px-2.5 py-1.5 text-xs text-mist-300 transition hover:border-white/20 hover:text-mist-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {normalizingScenes ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <Images size={14} />
              )}
              Фото объекта
              {sceneAttachments.length > 0 && (
                <span className="text-gold-400">
                  {sceneAttachments.length}/{MAX_SCENE_IMAGES}
                </span>
              )}
            </button>
            <input
              ref={referenceInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleReferenceAttachment}
            />
            <button
              type="button"
              onClick={() => referenceInputRef.current?.click()}
              disabled={isGenerating || normalizingReference}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/10 bg-white/[.03] px-2.5 py-1.5 text-xs text-mist-300 transition hover:border-white/20 hover:text-mist-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {normalizingReference ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <BookImage size={14} />
              )}
              Референс / пример
            </button>
          </div>

          <div className="flex items-end gap-2 rounded-2xl border border-white/15 bg-ink-700/70 p-2 shadow-2xl shadow-black/20 transition focus-within:border-gold-500/50">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleTextareaKeyDown}
              maxLength={500}
              rows={1}
              placeholder={
                conversationBaseImage && sceneAttachments.length === 0
                  ? 'Что изменить в активном результате?'
                  : 'Опишите задачу или задайте вопрос'
              }
              className="max-h-[104px] min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-6 text-mist-100 outline-none placeholder:text-mist-400 sm:text-[15px]"
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
            if (event.target === event.currentTarget) setTilePickerOpen(false);
          }}
        >
          <div className="max-h-[90dvh] w-full overflow-hidden rounded-t-2xl border border-white/10 bg-ink-800 sm:max-w-4xl sm:rounded-2xl">
            <div className="border-b border-white/10 px-4 py-4 sm:px-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-sans text-lg font-semibold">
                    Выберите плитку
                  </h2>
                  <p className="mt-0.5 text-xs text-mist-400">
                    Каталог или фотографии вашего образца
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setTilePickerOpen(false)}
                  className="cursor-pointer rounded-full p-2 text-mist-400 hover:bg-white/[.06] hover:text-mist-100"
                  aria-label="Закрыть"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="mt-4 grid grid-cols-2 rounded-xl border border-white/10 bg-black/15 p-1">
                {(['catalog', 'custom'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => switchTilePickerMode(mode)}
                    className={`cursor-pointer rounded-lg px-3 py-2 text-sm font-medium transition ${
                      tilePickerMode === mode
                        ? 'bg-gold-500 text-ink-900'
                        : 'text-mist-300 hover:text-white'
                    }`}
                  >
                    {mode === 'catalog' ? 'Каталог' : 'Своя плитка'}
                  </button>
                ))}
              </div>
            </div>
            <div className="max-h-[calc(90dvh-154px)] overflow-y-auto p-4 sm:p-6">
              {tilePickerMode === 'catalog' ? (
                <CatalogTileSelector
                  selectedSlug={
                    tileSelection?.kind === 'catalog'
                      ? tileSelection.tile.slug
                      : null
                  }
                  onSelect={selectCatalogTile}
                  tiles={allTiles}
                  loading={tilesLoading}
                />
              ) : (
                <CustomTilePicker
                  tile={customTile}
                  inputRef={tileInputRef}
                  normalizing={normalizingTile}
                  error={tileAttachmentError}
                  onFiles={handleTileAttachments}
                  onChange={updateCustomTile}
                  onDone={() => setTilePickerOpen(false)}
                />
              )}
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

function CustomTilePicker({
  tile,
  inputRef,
  normalizing,
  error,
  onFiles,
  onChange,
  onDone,
}: {
  tile: CustomTile;
  inputRef: React.RefObject<HTMLInputElement | null>;
  normalizing: boolean;
  error: string | null;
  onFiles: (event: ChangeEvent<HTMLInputElement>) => void;
  onChange: (update: (current: CustomTile) => CustomTile) => void;
  onDone: () => void;
}) {
  function optionalPositiveNumber(value: string): number | undefined {
    if (!value) return undefined;
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : undefined;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-2xl border border-white/10 bg-white/[.025] p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-sans text-base font-semibold">
              Фото своей плитки
            </h3>
            <p className="mt-1 text-xs leading-5 text-mist-400">
              Добавьте 1–3 чётких фото при нейтральном освещении.
            </p>
          </div>
          <span className="shrink-0 text-xs text-mist-400">
            {tile.images.length}/{MAX_TILE_IMAGES}
          </span>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={onFiles}
        />
        <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
          {tile.images.map((image, index) => (
            <div
              key={`custom-tile-${index}`}
              className="relative aspect-square overflow-hidden rounded-xl border border-white/10 bg-ink-700"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image}
                alt={`Фото плитки ${index + 1}`}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() =>
                  onChange((current) => ({
                    ...current,
                    images: current.images.filter(
                      (_, itemIndex) => itemIndex !== index,
                    ),
                  }))
                }
                className="absolute right-1.5 top-1.5 cursor-pointer rounded-full bg-black/70 p-1.5 text-white hover:bg-black/90"
                aria-label={`Удалить фото плитки ${index + 1}`}
              >
                <X size={13} />
              </button>
            </div>
          ))}
          {tile.images.length < MAX_TILE_IMAGES && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={normalizing}
              className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-white/[.02] px-2 text-center text-xs text-mist-400 transition hover:border-gold-500/50 hover:text-gold-400 disabled:cursor-wait disabled:opacity-50"
            >
              {normalizing ? (
                <RefreshCw size={21} className="animate-spin" />
              ) : (
                <ImagePlus size={22} />
              )}
              Добавить фото
            </button>
          )}
        </div>
        {error && <p className="mt-3 text-xs text-red-300">{error}</p>}

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-mist-300 sm:col-span-2">
            Название <span className="text-mist-500">(необязательно)</span>
            <input
              type="text"
              maxLength={100}
              value={tile.name ?? ''}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  name: event.target.value || undefined,
                }))
              }
              placeholder="Например, японский клинкер"
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/15 px-3 py-2.5 text-sm text-mist-100 outline-none transition placeholder:text-mist-500 focus:border-gold-500/50"
            />
          </label>
          <label className="text-xs text-mist-300">
            Ширина, мм <span className="text-mist-500">(необязательно)</span>
            <input
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              value={tile.wmm ?? ''}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  wmm: optionalPositiveNumber(event.target.value),
                }))
              }
              placeholder="227"
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/15 px-3 py-2.5 text-sm text-mist-100 outline-none transition placeholder:text-mist-500 focus:border-gold-500/50"
            />
          </label>
          <label className="text-xs text-mist-300">
            Высота, мм <span className="text-mist-500">(необязательно)</span>
            <input
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              value={tile.hmm ?? ''}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  hmm: optionalPositiveNumber(event.target.value),
                }))
              }
              placeholder="60"
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/15 px-3 py-2.5 text-sm text-mist-100 outline-none transition placeholder:text-mist-500 focus:border-gold-500/50"
            />
          </label>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onDone}
            disabled={tile.images.length === 0 || normalizing}
            className="cursor-pointer rounded-xl bg-gold-500 px-4 py-2.5 text-sm font-semibold text-ink-900 transition hover:bg-gold-400 disabled:cursor-not-allowed disabled:bg-white/[.08] disabled:text-mist-400"
          >
            Использовать свою плитку
          </button>
        </div>
      </div>
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
  tile: TileSelection;
}) {
  const message = tile
    ? `Здравствуйте! Хочу подобрать плитку ${tileName(tile)} для своего проекта.`
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
          Опишите задачу или задайте вопрос — можно начать без выбора плитки. Для
          визуализации выберите плитку из каталога или загрузите свою и прикрепите
          до четырёх фото объекта: для каждого ракурса появится свой результат.
          Дальше правьте удачный вариант текстом.
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
  onRetry,
  onSelect,
  retryDisabled,
}: {
  turn: ChatTurn;
  contacts: Contacts | null;
  onOpen: (url: string) => void;
  onSave: (result: TurnResult) => void;
  onRetry: (result: TurnResult) => void;
  onSelect: (sceneIndex: number) => void;
  retryDisabled: boolean;
}) {
  const results = turn.results ?? [];
  if (results.length === 0) return null;
  const multiple = results.length > 1;
  const href = waMessageLink(
    contacts?.whatsapp,
    `Здравствуйте! Интересует плитка ${tileName(turn.request.tile)}. Можно образец?`,
  );
  const hasWhatsApp = Boolean(waLink(contacts?.whatsapp));

  return (
    <div className="max-w-2xl overflow-hidden rounded-2xl rounded-tl-md border border-white/10 bg-white/[.035]">
      {turn.reply && (
        <p className="whitespace-pre-wrap border-b border-white/[.08] px-4 py-3 text-sm leading-6 text-mist-200 sm:px-5 sm:text-[15px]">
          {turn.reply}
        </p>
      )}
      <div className={multiple ? 'grid grid-cols-2 gap-2 p-2 sm:gap-3 sm:p-3' : ''}>
        {results.map((result) => {
          const isActive =
            result.status === 'done' &&
            result.sceneIndex === turn.activeSceneIndex;
          if (result.status === 'pending') {
            return (
              <div
                key={`${turn.id}-${result.sceneIndex}`}
                className="overflow-hidden rounded-xl border border-white/10 bg-black/20"
              >
                <div className={`shimmer ${multiple ? 'aspect-square' : 'aspect-[4/3]'}`} />
                <div className="flex items-center gap-1.5 px-2.5 py-2 text-[11px] text-mist-300 sm:px-3 sm:text-xs">
                  <RefreshCw size={13} className="animate-spin text-gold-400" />
                  Ракурс {result.sceneIndex + 1}
                </div>
              </div>
            );
          }
          if (result.status === 'failed') {
            return (
              <div
                key={`${turn.id}-${result.sceneIndex}`}
                className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-red-500/25 bg-red-500/[.06] p-3 text-center"
              >
                <AlertCircle size={22} className="text-red-300" />
                <p className="mt-2 line-clamp-3 text-[11px] leading-4 text-mist-300 sm:text-xs">
                  {result.error ?? 'Ракурс не сгенерирован'}
                </p>
                <button
                  type="button"
                  onClick={() => onRetry(result)}
                  disabled={retryDisabled}
                  className="mt-3 inline-flex cursor-pointer items-center gap-1 rounded-lg border border-white/15 px-2.5 py-1.5 text-[11px] font-medium text-mist-100 transition hover:bg-white/[.06] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <RotateCcw size={13} />
                  Повторить
                </button>
              </div>
            );
          }

          return (
            <div
              key={`${turn.id}-${result.sceneIndex}`}
              className={`overflow-hidden border bg-black/20 transition ${
                multiple ? 'rounded-xl' : ''
              } ${
                isActive
                  ? 'border-gold-500 ring-2 ring-inset ring-gold-500/45'
                  : 'border-white/10'
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  onSelect(result.sceneIndex);
                  if (result.imageUrl) onOpen(result.imageUrl);
                }}
                className="group relative block w-full cursor-zoom-in overflow-hidden"
                aria-label={`Выбрать ракурс ${result.sceneIndex + 1} и открыть на весь экран`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={result.imageUrl}
                  alt={`Визуализация с плиткой ${tileName(turn.request.tile)}, ракурс ${result.sceneIndex + 1}`}
                  className={
                    multiple
                      ? 'aspect-square w-full object-cover'
                      : 'max-h-[72dvh] w-full object-contain'
                  }
                />
                <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-1 text-[10px] text-white backdrop-blur">
                  {isActive ? <Check size={11} /> : <ZoomIn size={11} />}
                  {isActive ? 'Активно' : `Ракурс ${result.sceneIndex + 1}`}
                </span>
              </button>
              <div className="flex flex-wrap items-center gap-2 px-2.5 py-2 text-[11px] sm:gap-3 sm:px-4 sm:py-3 sm:text-xs">
                <a
                  href={result.imageUrl}
                  download={`japan-ceramic-visualization-${result.sceneIndex + 1}.jpg`}
                  onClick={() => onSelect(result.sceneIndex)}
                  className="inline-flex items-center gap-1 text-mist-300 transition hover:text-gold-400"
                  aria-label={`Скачать ракурс ${result.sceneIndex + 1}`}
                >
                  <Download size={14} />
                  <span className={multiple ? 'hidden sm:inline' : ''}>
                    Скачать
                  </span>
                </a>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(result.sceneIndex);
                    onSave(result);
                  }}
                  disabled={result.saving || result.saved}
                  className="inline-flex cursor-pointer items-center gap-1 text-mist-300 transition hover:text-gold-400 disabled:cursor-default disabled:text-gold-400"
                  aria-label={`Сохранить ракурс ${result.sceneIndex + 1} в кабинет`}
                >
                  {result.saved ? (
                    <Check size={14} />
                  ) : result.saving ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <Save size={14} />
                  )}
                  <span className={multiple ? 'hidden sm:inline' : ''}>
                    {result.saved
                      ? 'Сохранено'
                      : result.saving
                        ? 'Сохраняю'
                        : 'Сохранить в кабинет'}
                  </span>
                </button>
                {result.durationMs !== undefined && (
                  <span className="ml-auto text-[10px] text-mist-400">
                    {(result.durationMs / 1000).toFixed(0)} сек
                  </span>
                )}
                {result.saveError && (
                  <p className="basis-full text-[10px] leading-4 text-red-300 sm:text-[11px]">
                    Не удалось сохранить: {result.saveError}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center border-t border-white/[.08] px-4 py-3 text-xs">
        <a
          href={href}
          target={hasWhatsApp ? '_blank' : undefined}
          rel={hasWhatsApp ? 'noopener' : undefined}
          className="inline-flex items-center gap-1.5 text-mist-300 transition hover:text-gold-400"
        >
          <MessageCircle size={14} />
          Заявка по плитке
        </a>
        {multiple && (
          <span className="ml-auto text-[10px] text-mist-400">
            Нажмите результат для правок
          </span>
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

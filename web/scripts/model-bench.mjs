// Бенч fal-моделей для визуализатора: один и тот же вход (фото дома + образец клинкера
// + единый material-locked промпт) прогоняется через шорт-лист мульти-референс моделей.
// Результаты сохраняются в web/bench-out/<model>.jpg + summary.json.
// Запуск: cd web && node --env-file=.env scripts/model-bench.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fal } from '@fal-ai/client';
import sharp from 'sharp';

const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const key = env.match(/^FAL_KEY=(.+)$/m)?.[1]?.trim();
if (!key) { console.error('FAL_KEY не найден'); process.exit(1); }
fal.config({ credentials: key });

const ROOM_PATH = 'C:\\Users\\alanb\\OneDrive\\Рабочий стол\\002-posle-1024x7682.jpg';
const TILE_URL = 'https://hhrvuxttpurfclubunvp.supabase.co/storage/v1/object/public/uploads/products/1780561832352-ub0j4a.webp';
const TILE_NAME = 'Клинкер NITTAI YS 290-OR';
const TILE_WMM = 290, TILE_HMM = 65; // типичный клинкерный брусок (в каталоге размер не задан)

// Единый промпт — facade wall, material-lock на клинкер, сохранить окна/двери/крышу/небо.
const ratio = (TILE_WMM / TILE_HMM).toFixed(2);
const PROMPT = `IMAGE 1 is a real photograph of a house. IMAGE 2 is a single CLINKER BRICK tile sample called "${TILE_NAME}" (a fired-clay brick, warm ochre/orange-brown colour with fine linear texture).
Re-clad ONLY the plain plaster wall areas of the house in IMAGE 1 with this clinker brick from IMAGE 2, laid as a real brick wall:
- The result MUST be CLINKER BRICK MASONRY — many small bricks in regular courses with grout joints. NEVER wood, planks, siding, panels or large slabs.
- Reproduce the EXACT colour, hue and surface texture of IMAGE 2 (warm ochre/orange-brown fired clay). Do not invent a different or generic brick, do not change the colour.
- Each brick is about ${TILE_WMM}×${TILE_HMM} mm (wide landscape, aspect ratio ${ratio}:1) — lay them at this real-world size with realistic brick coursing; do not enlarge into big slabs.
- Follow the TRUE perspective and angles of the walls, wrapping around corners.
- Do NOT cover or change windows, window frames, the door, the roof, chimney, stone plinth, sky, ground — keep all of them pixel-identical and lay bricks cleanly AROUND them.
- Match the original photo's daylight, shadows and reflections.
Output a single photorealistic edited photograph, nothing else.`;

// Шорт-лист мульти-референс edit-моделей (видят и фото, и образец).
const MODELS = [
  { id: 'seedream-v4',   endpoint: 'fal-ai/bytedance/seedream/v4/edit', price: '~$0.03', build: (room, tile) => ({ prompt: PROMPT, image_urls: [room, tile] }) },
  { id: 'nano-banana',   endpoint: 'fal-ai/nano-banana/edit',           price: '~$0.04', build: (room, tile) => ({ prompt: PROMPT, image_urls: [room, tile] }) },
  { id: 'nano-banana-2', endpoint: 'fal-ai/nano-banana-2/edit',         price: '~$0.08', build: (room, tile) => ({ prompt: PROMPT, image_urls: [room, tile] }) },
  { id: 'flux2-edit',    endpoint: 'fal-ai/flux-2/edit',                price: '~$0.02', build: (room, tile) => ({ prompt: PROMPT, image_urls: [room, tile] }) },
];

const POLL_TIMEOUT_MS = 180000;

async function toDataUrl(pathOrBuf, maxEdge = 1280) {
  const buf = typeof pathOrBuf === 'string' ? readFileSync(pathOrBuf) : pathOrBuf;
  const out = await sharp(buf).resize(maxEdge, maxEdge, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 92 }).toBuffer();
  return `data:image/jpeg;base64,${out.toString('base64')}`;
}

async function fetchBuf(url) { const r = await fetch(url); if (!r.ok) throw new Error('HTTP ' + r.status); return Buffer.from(await r.arrayBuffer()); }

async function runModel(m, roomUrl, tileUrl) {
  const t0 = Date.now();
  try {
    const input = m.build(roomUrl, tileUrl);
    const sub = await fal.queue.submit(m.endpoint, { input });
    const reqId = sub.request_id;
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    let status = 'IN_QUEUE';
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 3000));
      const st = await fal.queue.status(m.endpoint, { requestId: reqId, logs: false });
      status = st.status;
      if (status === 'COMPLETED') break;
      if (status === 'ERROR' || status === 'FAILED') throw new Error('queue status ' + status);
    }
    if (status !== 'COMPLETED') throw new Error('timeout, last status ' + status);
    const res = await fal.queue.result(m.endpoint, { requestId: reqId });
    const url = res?.data?.images?.[0]?.url ?? res?.images?.[0]?.url ?? res?.data?.image?.url ?? res?.image?.url;
    if (!url) throw new Error('no image url in result: ' + JSON.stringify(res).slice(0, 200));
    const buf = await fetchBuf(url);
    const file = `bench-out/${m.id}.jpg`;
    await sharp(buf).jpeg({ quality: 90 }).toFile(file);
    const ms = Date.now() - t0;
    console.log(`OK   ${m.id.padEnd(14)} ${(ms/1000).toFixed(0)}s  ${m.price}  -> ${file}`);
    return { id: m.id, endpoint: m.endpoint, price: m.price, ok: true, ms, file };
  } catch (e) {
    const ms = Date.now() - t0;
    const msg = e?.message + (e?.body ? ' | ' + JSON.stringify(e.body).slice(0, 300) : '');
    console.error(`FAIL ${m.id.padEnd(14)} ${(ms/1000).toFixed(0)}s  ${msg}`);
    return { id: m.id, endpoint: m.endpoint, price: m.price, ok: false, ms, error: msg };
  }
}

(async () => {
  console.log('Готовлю вход...');
  const roomUrl = await toDataUrl(ROOM_PATH, 1280);
  const tileUrl = await toDataUrl(await fetchBuf(TILE_URL), 1024);
  console.log(`room ${(roomUrl.length/1024/1024).toFixed(2)}MB, tile ${(tileUrl.length/1024/1024).toFixed(2)}MB`);
  // Сохраним нормализованные входы для контекста сравнения
  await sharp(Buffer.from(roomUrl.split(',')[1], 'base64')).toFile('bench-out/_room.jpg');

  const results = [];
  for (const m of MODELS) results.push(await runModel(m, roomUrl, tileUrl));

  writeFileSync('bench-out/summary.json', JSON.stringify({ tile: TILE_NAME, results }, null, 2));
  console.log('\n=== ИТОГ ===');
  for (const r of results) console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.id.padEnd(14)} ${r.price.padEnd(8)} ${r.ok ? r.file : r.error}`);
})();

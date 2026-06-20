// Прямой probe к fal gpt-image-1 — показывает РЕАЛЬНУЮ ошибку fal без сайта/авторизации.
// Запуск: node scripts/fal-probe.mjs
import { readFileSync } from 'node:fs';
import { fal } from '@fal-ai/client';

// Грузим FAL_KEY из .env.local
const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const key = env.match(/^FAL_KEY=(.+)$/m)?.[1]?.trim();
if (!key) { console.error('FAL_KEY не найден в .env.local'); process.exit(1); }
fal.config({ credentials: key });
console.log('FAL_KEY:', key.slice(0, 6) + '…(' + key.length + ' chars)');

const ENDPOINT = 'fal-ai/gpt-image-1/edit-image';
// Маленькие публичные картинки, чтобы fal смог их забрать (комната + «плитка»).
const room = 'https://picsum.photos/id/1018/1024/768';
const tile = 'https://picsum.photos/id/1080/512/512';

const input = {
  prompt: 'Re-clad the main facade walls with the tile from IMAGE 2, photorealistic.',
  image_urls: [room, tile],
  input_fidelity: 'high',
  quality: 'high',
  image_size: '1536x1024',
  output_format: 'jpeg',
};

try {
  console.log('--- submit ---');
  const sub = await fal.queue.submit(ENDPOINT, { input });
  console.log('request_id:', sub.request_id);

  console.log('--- poll status ---');
  let st, tries = 0;
  do {
    await new Promise((r) => setTimeout(r, 3000));
    st = await fal.queue.status(ENDPOINT, { requestId: sub.request_id, logs: true });
    console.log(`[${++tries}] status:`, st.status);
    if (tries > 40) { console.error('таймаут опроса (120с)'); break; }
  } while (st.status !== 'COMPLETED' && st.status !== 'ERROR' && st.status !== 'FAILED');

  console.log('--- final status object ---');
  console.log(JSON.stringify(st, null, 2));

  if (st.status === 'COMPLETED') {
    const res = await fal.queue.result(ENDPOINT, { requestId: sub.request_id });
    const url = res?.data?.images?.[0]?.url ?? res?.images?.[0]?.url;
    console.log('--- result OK ---  imageUrl:', url ? url.slice(0, 80) + '…' : '(нет URL)');
  }
} catch (err) {
  console.error('=== РЕАЛЬНАЯ ОШИБКА FAL ===');
  console.error('message:', err?.message);
  console.error('status:', err?.status);
  // fal кладёт детали валидации/квоты в body
  if (err?.body) console.error('body:', JSON.stringify(err.body, null, 2));
  console.error('full:', JSON.stringify(err, Object.getOwnPropertyNames(err || {}), 2));
}

'use client';

import { useState } from 'react';
import { Check, Loader2, Send } from 'lucide-react';

type Stage = 'idle' | 'sending' | 'done' | 'error';

// Форма заявки дизайнера → публичный POST /api/contacts (ContactLead, source=designers).
// Поля по образцу Tilda: Имя · Студия/направление · Телефон или Telegram · Email.
export function DesignerLeadForm() {
  const [name, setName] = useState('');
  const [studio, setStudio] = useState('');
  const [contact, setContact] = useState('');
  const [email, setEmail] = useState('');
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !contact.trim()) {
      setError('Укажите имя и телефон или Telegram');
      setStage('error');
      return;
    }
    setStage('sending');
    setError(null);
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: contact.trim(),
          email: email.trim() || undefined,
          message: studio.trim() ? `Студия / направление: ${studio.trim()}` : undefined,
          source: 'designers',
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `Сервер вернул ${res.status}`);
      }
      setStage('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить');
      setStage('error');
    }
  }

  if (stage === 'done') {
    return (
      <div className="card flex flex-col items-center justify-center p-10 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gold-500/15 text-gold-400">
          <Check size={28} />
        </div>
        <h3 className="mt-5 text-xl font-semibold text-mist-100">Заявка отправлена</h3>
        <p className="mt-2 max-w-sm text-sm text-mist-400">
          Мы свяжемся с вами и откроем доступ к библиотеке Japan Ceramic.
        </p>
      </div>
    );
  }

  const inputCls =
    'w-full rounded-xl border border-white/10 bg-ink-900/60 px-4 py-3 text-sm text-mist-100 placeholder:text-mist-400 outline-none transition focus:border-gold-500/60';

  return (
    <form onSubmit={submit} className="card p-6 sm:p-8">
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          className={inputCls}
          placeholder="Имя *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
        />
        <input
          className={inputCls}
          placeholder="Студия / направление"
          value={studio}
          onChange={(e) => setStudio(e.target.value)}
        />
        <input
          className={inputCls}
          placeholder="Телефон или Telegram *"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
        />
        <input
          className={inputCls}
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </div>

      {stage === 'error' && error && (
        <p className="mt-3 text-sm text-red-400">{error}</p>
      )}

      <button
        type="submit"
        disabled={stage === 'sending'}
        className="btn-gold mt-5 w-full !py-4 text-base disabled:opacity-60"
      >
        {stage === 'sending' ? (
          <><Loader2 size={18} className="animate-spin" /> Отправляем…</>
        ) : (
          <><Send size={18} /> Получить доступ бесплатно</>
        )}
      </button>
      <p className="mt-3 text-center text-xs text-mist-400">
        Откроем доступ к фото, 3D-текстурам и AI-визуализации после короткой проверки.
      </p>
    </form>
  );
}

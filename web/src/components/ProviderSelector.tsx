'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { Sparkles, Check, Lock } from 'lucide-react';

type Provider = 'fal' | 'mock';

type ProvidersStatus = {
  providers: Record<Provider, boolean>;
  default: Provider;
};

const META: Record<Provider, { label: string; price: string; badge?: string }> = {
  fal: {
    label: 'fal.ai · Nano Banana Pro (Gemini 3 Pro Image)',
    price: '≈13,12 сом / картинка',
  },
  mock: { label: 'Демо (без AI)', price: 'Возвращает картинку плитки' },
};

type Props = {
  value: Provider;
  onChange: (p: Provider) => void;
};

export function ProviderSelector({ value, onChange }: Props) {
  const [status, setStatus] = useState<ProvidersStatus | null>(null);

  useEffect(() => {
    fetch('/api/visualize')
      .then((r) => r.json())
      .then((s) => {
        setStatus(s);
        // Если выбранный провайдер не настроен — переключим на дефолтный
        if (!s.providers[value] && value !== 'mock') onChange(s.default);
      })
      .catch(() => {});
  }, []);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-mist-400">
          AI-провайдер
        </h3>
        {status?.default && (
          <span className="text-[10px] text-mist-400">
            по умолчанию: {META[status.default]?.label}
          </span>
        )}
      </div>
      <div className="grid gap-2">
        {(Object.keys(META) as Provider[]).map((p) => {
          const isConfigured = status?.providers[p] ?? false;
          const isSelected = value === p;
          const isFree = p === 'mock';
          return (
            <button
              key={p}
              onClick={() => onChange(p)}
              disabled={!isConfigured}
              className={cn(
                'flex items-center justify-between rounded-xl border px-3 py-2.5 text-left transition',
                isSelected
                  ? 'border-gold-500 bg-gold-500/10'
                  : 'border-white/10 hover:border-white/20',
                !isConfigured && 'cursor-not-allowed opacity-40',
              )}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={cn(
                    'flex h-5 w-5 items-center justify-center rounded-full border',
                    isSelected
                      ? 'border-gold-500 bg-gold-500 text-ink-900'
                      : 'border-white/20',
                  )}
                >
                  {isSelected && <Check size={12} />}
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    {META[p].label}
                    {META[p].badge && (
                      <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-400">
                        {META[p].badge}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-mist-400">{META[p].price}</div>
                </div>
              </div>
              {!isConfigured && (
                <Lock size={14} className="text-mist-400" />
              )}
              {isConfigured && isFree && !isSelected && (
                <Sparkles size={14} className="text-emerald-400" />
              )}
            </button>
          );
        })}
      </div>
      {status && !Object.values(status.providers).some(Boolean) && (
        <p className="mt-3 text-xs text-amber-400">
          ⚠ Ни один ключ не настроен в .env.local — работает только mock-режим.
        </p>
      )}
    </div>
  );
}

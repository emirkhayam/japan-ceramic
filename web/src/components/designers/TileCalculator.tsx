'use client';

import { useState } from 'react';
import { Calculator } from 'lucide-react';

// Калькулятор расхода плитки: площадь укладки + запас на подрез → м² к закупке.
// Опционально пересчёт в коробки, если дизайнер знает м² в коробке.
export function TileCalculator() {
  const [area, setArea] = useState('');
  const [reserve, setReserve] = useState(10);
  const [boxArea, setBoxArea] = useState('');

  const areaNum = parseFloat(area.replace(',', '.'));
  const boxNum = parseFloat(boxArea.replace(',', '.'));
  const valid = Number.isFinite(areaNum) && areaNum > 0;

  const totalArea = valid ? areaNum * (1 + reserve / 100) : 0;
  const boxes =
    valid && Number.isFinite(boxNum) && boxNum > 0
      ? Math.ceil(totalArea / boxNum)
      : null;

  const fmt = (n: number) =>
    new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(n);

  const inputCls =
    'w-full rounded-xl border border-white/10 bg-ink-900/60 px-4 py-3 text-sm text-mist-100 placeholder:text-mist-400 outline-none transition focus:border-gold-500/60';

  return (
    <div className="card p-6 sm:p-8">
      <div className="flex items-center gap-2 text-gold-400">
        <Calculator size={20} />
        <h3 className="text-lg font-semibold text-mist-100">Калькулятор расхода</h3>
      </div>
      <p className="mt-2 text-sm text-mist-400">
        Прикиньте объём закупки с запасом на подрез — за секунду.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs text-mist-400">Площадь укладки, м²</span>
          <input
            className={inputCls}
            inputMode="decimal"
            placeholder="например, 24"
            value={area}
            onChange={(e) => setArea(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs text-mist-400">М² в коробке (необязательно)</span>
          <input
            className={inputCls}
            inputMode="decimal"
            placeholder="например, 1.44"
            value={boxArea}
            onChange={(e) => setBoxArea(e.target.value)}
          />
        </label>
      </div>

      <div className="mt-4">
        <span className="mb-2 block text-xs text-mist-400">Запас на подрез</span>
        <div className="inline-flex overflow-hidden rounded-xl border border-white/10">
          {[5, 10, 15].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReserve(r)}
              className={`px-4 py-2 text-sm transition cursor-pointer ${
                reserve === r
                  ? 'bg-gold-500/15 text-gold-400'
                  : 'text-mist-400 hover:text-mist-100'
              } ${r !== 5 ? 'border-l border-white/10' : ''}`}
            >
              {r}%
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-gold-500/20 bg-gold-500/5 p-5">
        <div className="text-xs uppercase tracking-wider text-mist-400">К закупке</div>
        <div className="mt-1 font-display text-3xl text-gold-400">
          {valid ? `${fmt(totalArea)} м²` : '—'}
        </div>
        {boxes != null && (
          <div className="mt-1 text-sm text-mist-300">≈ {boxes} коробок</div>
        )}
        {valid && (
          <div className="mt-2 text-xs text-mist-400">
            {fmt(areaNum)} м² укладки + {reserve}% запас
          </div>
        )}
      </div>
    </div>
  );
}

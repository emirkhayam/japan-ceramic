'use client';

import { useEffect, useState } from 'react';

const STEPS = [
  'Анализируем освещение и тени...',
  'Распознаём поверхности комнаты...',
  'Рассчитываем перспективу...',
  'Подбираем масштаб плитки...',
  'Накладываем текстуру с швами...',
  'Финальная сборка изображения...',
];

export function VisualizerLoader() {
  const [stepIdx, setStepIdx] = useState(0);
  const [progress, setProgress] = useState(8);

  useEffect(() => {
    const stepTimer = setInterval(() => {
      setStepIdx((i) => (i + 1) % STEPS.length);
    }, 2800);
    const progressTimer = setInterval(() => {
      setProgress((p) => {
        if (p >= 92) return p;
        const inc = p < 50 ? 3 : p < 75 ? 1.5 : 0.6;
        return Math.min(92, p + inc);
      });
    }, 350);
    return () => {
      clearInterval(stepTimer);
      clearInterval(progressTimer);
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-10">
      <div className="relative h-32 w-32">
        <div className="absolute inset-0 rounded-full border-4 border-white/5" />
        <div
          className="absolute inset-0 rounded-full border-4 border-transparent border-t-gold-500 border-r-gold-500 animate-spin"
          style={{ animationDuration: '1.6s' }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-display text-2xl font-bold text-gold-400">
            {Math.floor(progress)}%
          </span>
        </div>
      </div>
      <div className="w-full max-w-md">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full bg-gradient-to-r from-gold-600 via-gold-400 to-gold-600 transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      <div className="text-center">
        <p className="font-display text-lg font-semibold text-mist-100 animate-fade-in" key={stepIdx}>
          {STEPS[stepIdx]}
        </p>
        <p className="mt-2 text-sm text-mist-400">Обычно занимает 15–30 секунд</p>
      </div>
    </div>
  );
}

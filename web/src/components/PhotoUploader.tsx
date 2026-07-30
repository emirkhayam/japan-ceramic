'use client';

import { useCallback, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { normalizeImageFile } from '@/lib/image';
import { Upload, Camera, Check, Image as ImageIcon } from 'lucide-react';

type Props = {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
};

export function PhotoUploader({ value, onChange }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(
    async (file: File | null) => {
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        alert('Загрузите изображение (JPG или PNG).');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        alert('Файл больше 10MB. Уменьшите размер.');
        return;
      }
      try {
        onChange(await normalizeImageFile(file));
      } catch {
        alert('Не удалось обработать изображение. Попробуйте другое фото.');
      }
    },
    [onChange],
  );

  if (value) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-ink-900">
        <div className="relative w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="Фото комнаты"
            className="w-full h-auto object-contain max-h-[600px]"
          />
        </div>
        <div className="absolute right-3 top-3 flex gap-2">
          <button
            onClick={() => onChange(null)}
            className="rounded-full bg-ink-900/80 px-3 py-1.5 text-xs font-medium text-mist-100 backdrop-blur hover:bg-ink-900"
          >
            Сменить фото
          </button>
        </div>
        <div className="absolute left-3 bottom-3 inline-flex items-center gap-1.5 rounded-full bg-gold-500/90 px-3 py-1 text-xs font-semibold text-ink-900">
          <Check size={12} /> Фото загружено
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFile(e.dataTransfer.files?.[0] ?? null);
        }}
        className={cn(
          'group relative flex aspect-[4/3] w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/15 bg-ink-800/40 text-center transition',
          dragOver && 'border-gold-500 bg-gold-500/5',
        )}
        onClick={() => fileInputRef.current?.click()}
      >
        {/* Основной выбор — без capture: на телефоне открывает галерею/файлы (не камеру) */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
        {/* Отдельный инпут для съёмки с камеры */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gold-500/10 text-gold-400 group-hover:bg-gold-500/20">
          <Upload size={26} />
        </div>
        <p className="mt-4 text-lg font-semibold">Перетащите фото сюда</p>
        <p className="mt-1 text-sm text-mist-400">или выберите из галереи / файлов</p>
        <p className="mt-4 text-xs text-mist-400">JPG / PNG · до 10 MB</p>

        {/* Мобильные кнопки: явный выбор из галереи и съёмка с камеры */}
        <div className="absolute inset-x-4 bottom-4 flex gap-2 sm:hidden">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-gold-500 px-4 py-2.5 text-sm font-semibold text-ink-900 whitespace-nowrap"
          >
            <ImageIcon size={16} /> Галерея
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              cameraInputRef.current?.click();
            }}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-white/15 bg-ink-900/60 px-4 py-2.5 text-sm font-medium text-mist-100 backdrop-blur whitespace-nowrap"
          >
            <Camera size={16} /> Камера
          </button>
        </div>
      </div>

    </div>
  );
}

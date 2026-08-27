// Запасной путь для браузеров без createImageBitmap/EXIF-ориентации.
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result;
      if (typeof result === 'string') {
        resolve(result);
      } else {
        reject(new Error('Не удалось прочитать изображение'));
      }
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error('Не удалось прочитать изображение'));
    reader.readAsDataURL(file);
  });
}

// Впечатываем EXIF Orientation в пиксели перед отправкой и ограничиваем длинную
// сторону, чтобы телефонные фото одинаково отображались в браузере и на fal.
const MAX_IMAGE_DIMENSION = 2048;

function drawToJpeg(
  source: CanvasImageSource,
  naturalWidth: number,
  naturalHeight: number,
): string | null {
  const scale = Math.min(
    1,
    MAX_IMAGE_DIMENSION / Math.max(naturalWidth, naturalHeight),
  );
  const width = Math.max(1, Math.round(naturalWidth * scale));
  const height = Math.max(1, Math.round(naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.drawImage(source, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', 0.92);
}

// Запасной декод через <img> + object URL. Safari умеет рисовать HEIC в <img>
// и сам применяет EXIF-ориентацию при отрисовке в canvas — так фото с айфона
// (HEIC) всё равно превращается в JPEG, понятный fal.
function normalizeViaImgElement(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      try {
        const jpeg = drawToJpeg(
          image,
          image.naturalWidth || image.width,
          image.naturalHeight || image.height,
        );
        if (jpeg) resolve(jpeg);
        else reject(new Error('Не удалось обработать изображение'));
      } catch (err) {
        reject(err instanceof Error ? err : new Error('decode failed'));
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Не удалось загрузить изображение'));
    };
    image.src = url;
  });
}

export async function normalizeImageFile(file: File): Promise<string> {
  // 1) Быстрый путь: createImageBitmap с EXIF-ориентацией.
  try {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: 'from-image',
    });
    try {
      const jpeg = drawToJpeg(bitmap, bitmap.width, bitmap.height);
      if (jpeg) return jpeg;
    } finally {
      bitmap.close();
    }
  } catch {
    // createImageBitmap отсутствует или не осилил формат (часто HEIC на iOS).
  }

  // 2) Запасной путь через <img> — покрывает HEIC/старый Safari, тоже даёт JPEG.
  try {
    return await normalizeViaImgElement(file);
  } catch {
    // 3) Совсем крайний случай — отдаём как есть (может быть HEIC).
    return fileToDataUrl(file);
  }
}

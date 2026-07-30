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

export async function normalizeImageFile(file: File): Promise<string> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return fileToDataUrl(file);
  }

  try {
    const scale = Math.min(
      1,
      MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height),
    );
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return fileToDataUrl(file);
    context.drawImage(bitmap, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', 0.92);
  } finally {
    bitmap.close();
  }
}

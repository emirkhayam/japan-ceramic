/**
 * Гомография — перспективное преобразование между двумя плоскостями.
 *
 * Зачем: фасад/стена на фото сняты под углом, поэтому реальный прямоугольник стены
 * выглядит трапецией. Гомография задаёт точное соответствие «точка реальной плоскости
 * ↔ пиксель фото». Зная её, мы раскладываем плитку ровной сеткой в реальных метрах,
 * затем «сгибаем» её в перспективу фото — и плитка сама становится мельче вдали и
 * крупнее вблизи, как на настоящем доме.
 *
 * Все функции чистые (без DOM) — их можно юнит-тестировать.
 */

export type Pt = { x: number; y: number };
/** Матрица гомографии 3×3 в строковом порядке (h11..h33). */
export type Matrix3 = number[]; // length 9

/**
 * Решает систему линейных уравнений A·x = b методом Гаусса с выбором ведущего
 * элемента. A — n×n (массив строк), b — длины n. Возвращает x или null, если
 * система вырождена.
 */
function solveLinear(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  // Расширенная матрица.
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    // Выбор ведущей строки (максимум по модулю) — для устойчивости.
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    }
    if (Math.abs(M[pivot][col]) < 1e-12) return null; // вырожденная
    [M[col], M[pivot]] = [M[pivot], M[col]];

    // Нормируем ведущую строку и обнуляем столбец у остальных.
    const pv = M[col][col];
    for (let c = col; c <= n; c++) M[col][c] /= pv;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = M[r][col];
      if (factor === 0) continue;
      for (let c = col; c <= n; c++) M[r][c] -= factor * M[col][c];
    }
  }
  return M.map((row) => row[n]);
}

/**
 * Строит гомографию, переводящую 4 точки src в 4 точки dst (DLT для 4 соответствий).
 * Порядок точек в src и dst должен совпадать. Возвращает Matrix3 или null, если
 * точки вырождены (коллинеарны и т.п.).
 */
export function computeHomography(src: Pt[], dst: Pt[]): Matrix3 | null {
  if (src.length < 4 || dst.length < 4) return null;
  // 8 неизвестных (h11..h32, h33=1). Для каждой пары точек — 2 уравнения.
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: X, y: Y } = dst[i];
    A.push([x, y, 1, 0, 0, 0, -x * X, -y * X]);
    b.push(X);
    A.push([0, 0, 0, x, y, 1, -x * Y, -y * Y]);
    b.push(Y);
  }
  const h = solveLinear(A, b);
  if (!h) return null;
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

/** Применяет гомографию к точке с перспективным делением. */
export function applyHomography(H: Matrix3, p: Pt): Pt {
  const x = H[0] * p.x + H[1] * p.y + H[2];
  const y = H[3] * p.x + H[4] * p.y + H[5];
  const w = H[6] * p.x + H[7] * p.y + H[8];
  const iw = w !== 0 ? 1 / w : 0;
  return { x: x * iw, y: y * iw };
}

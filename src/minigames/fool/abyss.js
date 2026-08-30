// Пропасть — едва заметный пиксельный градиент у НИЖНЕГО края экрана
// (BUILD-SPEC-03 задача 4; уточнено в чате 2026-08-29: «градиент внизу
// экрана, не близко к платформам; градиент = плавный едва заметный
// переход между цветами; большие пиксели, как появление предсказателя»).
//
// Не полосы, а СПЛОШНОЙ упорядоченный дизер крупными ячейками (как эффект
// проявления оракула, `core/pixelReveal.js`): цвет непрерывно ползёт
// через палитру пустоты сверху вниз, а матрица Bayer 4×4 решает для
// каждой КРУПНОЙ ячейки, какой из двух соседних тонов взять. Переход
// выходит плавным на глаз, но собран из больших пикселей. Антиалиаса нет.

// Сверху (сливается с воздухом #111111) вниз к самому светлому тону
// пустоты. Ярче #2E2E2E ничего — пропасть не спорит с дорогой и Шутом.
const PALETTE = ['#111111', '#161616', '#1C1C1C', '#212121', '#252525', '#2A2A2A', '#2E2E2E'];

// Крупная ячейка дизера — 8 экранных px (4 арт-px), заметно крупнее
// обычного пикселя, в духе проявления оракула (там cellSize 4 экранных).
const CELL = 8;

// Доля высоты экрана, с которой начинается градиент. Хорошо ниже дороги
// (камера держит текущую плиту на ~0.45h) — между ними заметный зазор
// чистого воздуха.
const TOP_FRAC = 0.62;

// Матрица Bayer 4×4, порог 0..15 → 0..1 после /16.
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

const BREATHE_AMP = 24;   // «дыхание» фазы градиента, экранных px
const BREATHE_PERIOD = 7; // секунд

/**
 * @param t     общее время сцены, сек — для «дыхания»
 * @param lure  0..1 — «манит вниз»: после обрушения плиты пропасть чуть
 *              светлеет и дышит чаще (правка в чате 2026-08-30).
 */
export function drawAbyss(ctx, w, h, t, lure = 0) {
  const L = lure < 0 ? 0 : lure > 1 ? 1 : lure;
  const topFrac = TOP_FRAC - L * 0.10;        // выше начало → пропасть больше, тона светлее
  const period = BREATHE_PERIOD / (1 + L * 1.5); // дышит чаще
  const amp = BREATHE_AMP * (1 + L * 0.7);       // и заметнее

  const top = Math.round(h * topFrac / CELL) * CELL;
  const span = h - top;
  if (span <= 0) return;

  // «Дыхание»: фаза градиента медленно ползёт вверх-вниз. Округляем до
  // целой ячейки, иначе край дрожит.
  const breathe = Math.round(Math.sin((t / period) * Math.PI * 2) * amp / CELL) * CELL;
  const last = PALETTE.length - 1;

  for (let cy = top, row = 0; cy < h; cy += CELL, row++) {
    let p = (cy - top + breathe + CELL / 2) / span + L * 0.14; // сдвиг к светлым тонам
    p = p < 0 ? 0 : p > 1 ? 1 : p;

    const idx = p * last;
    const lo = Math.floor(idx);
    const hi = lo < last ? lo + 1 : last;
    const frac = idx - lo;
    const bh = Math.min(CELL, h - cy);

    if (frac === 0 || lo === hi) {
      ctx.fillStyle = PALETTE[lo];
      ctx.fillRect(0, cy, w, bh);
      continue;
    }
    const brow = BAYER[row & 3];
    const loC = PALETTE[lo];
    const hiC = PALETTE[hi];
    for (let cx = 0, col = 0; cx < w; cx += CELL, col++) {
      ctx.fillStyle = brow[col & 3] / 16 < frac ? hiC : loC;
      ctx.fillRect(cx, cy, Math.min(CELL, w - cx), bh);
    }
  }
}

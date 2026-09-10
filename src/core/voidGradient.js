// Пиксельный градиент пустоты — ЕДИНЫЙ источник (правка в чате 2026-09-10:
// была копия в minigames/fool/abyss.js). Bayer-дизер крупными ячейками
// 8px, тона из «градаций пустоты» палитры, без сглаживания: цвет ползёт
// через палитру сверху вниз, матрица решает для каждой ячейки, какой из
// двух соседних тонов взять. На глаз плавно, собрано из больших пикселей.
//
// Пропасть в мини-игре (abyss.js) — тонкая обёртка над этой функцией.
// Экран 1 (question) и экран 2 (deck) зовут её напрямую с alpha для
// проявления/затухания.

const PALETTE = ['#111111', '#161616', '#1C1C1C', '#212121', '#252525', '#2A2A2A', '#2E2E2E'];
const CELL = 8; // крупная ячейка дизера, 4 арт-px
const BAYER = [
  [0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5],
];

/**
 * Рисует дизер-градиент пустоты снизу вверх.
 * @param opts.alpha         0..1 — общая прозрачность (анимацию ведёт вызывающий)
 * @param opts.t             сек — для «дыхания» фазы
 * @param opts.topFrac       с какой доли высоты начинается градиент
 * @param opts.breatheAmp    амплитуда «дыхания», экранных px (0 — выключить)
 * @param opts.breathePeriod период «дыхания», сек
 * @param opts.maxLevel      верхний индекс палитры (кламп яркости; по умолчанию весь диапазон)
 */
export function drawVoidGradient(ctx, w, h, {
  alpha = 1,
  t = 0,
  topFrac = 0.5,
  breatheAmp = 16,
  breathePeriod = 8,
  maxLevel = PALETTE.length - 1,
} = {}) {
  const a = alpha < 0 ? 0 : alpha > 1 ? 1 : alpha;
  if (a <= 0) return;
  const top = Math.round((h * topFrac) / CELL) * CELL;
  const span = h - top;
  if (span <= 0) return;

  const breathe = breatheAmp
    ? Math.round((Math.sin((t / breathePeriod) * Math.PI * 2) * breatheAmp) / CELL) * CELL
    : 0;
  const last = Math.max(1, Math.min(PALETTE.length - 1, maxLevel));

  ctx.save();
  ctx.globalAlpha = a;
  for (let cy = top, row = 0; cy < h; cy += CELL, row++) {
    let p = (cy - top + breathe + CELL / 2) / span;
    p = p < 0 ? 0 : p > 1 ? 1 : p;

    const gi = p * last;
    const lo = Math.floor(gi);
    const hi = lo < last ? lo + 1 : last;
    const frac = gi - lo;
    const bh = Math.min(CELL, h - cy);

    if (frac === 0 || lo === hi) {
      ctx.fillStyle = PALETTE[lo];
      ctx.fillRect(0, cy, w, bh);
      continue;
    }
    const brow = BAYER[row & 3];
    for (let cx = 0, col = 0; cx < w; cx += CELL, col++) {
      ctx.fillStyle = brow[col & 3] / 16 < frac ? PALETTE[hi] : PALETTE[lo];
      ctx.fillRect(cx, cy, Math.min(CELL, w - cx), bh);
    }
  }
  ctx.restore();
}

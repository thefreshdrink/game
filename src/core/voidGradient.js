// Пиксельный градиент пустоты — тот же графический язык, что пропасть в
// мини-игре Leap (`minigames/fool/abyss.js`): Bayer-дизер крупными
// ячейками 8px, тона из «градаций пустоты» палитры, без сглаживания.
//
// Отдельный модуль, потому что фон общий для экрана 1 (question) и
// экрана 2 (deck): он тянется между ними и медленно гаснет уже на deck,
// после того как Предсказатель ушёл (правка в чате 2026-08-31). Общая
// прозрачность (проявление / затухание) задаётся вызывающим через alpha.

const PALETTE = ['#111111', '#161616', '#1C1C1C', '#212121', '#252525', '#2A2A2A', '#2E2E2E'];
const CELL = 8;             // крупная ячейка дизера, как в abyss.js
const TOP_FRAC = 0.5;       // с какой доли высоты начинается градиент
const BAYER = [
  [0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5],
];

/**
 * Рисует дизер-градиент пустоты снизу вверх.
 * @param alpha 0..1 — общая прозрачность (анимацию появления/ухода ведёт вызывающий)
 * @param t     сек — для едва заметного «дыхания» фазы
 */
export function drawVoidGradient(ctx, w, h, alpha, t = 0) {
  const a = alpha < 0 ? 0 : alpha > 1 ? 1 : alpha;
  if (a <= 0) return;
  const top = Math.round((h * TOP_FRAC) / CELL) * CELL;
  const span = h - top;
  if (span <= 0) return;

  const breathe = Math.round((Math.sin((t / 8) * Math.PI * 2) * 16) / CELL) * CELL;
  const last = PALETTE.length - 1;

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

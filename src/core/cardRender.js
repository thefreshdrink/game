// Отрисовка карты — рубашка, пустая раскрытая (флип, экран 3) и целиком
// раскрытая (экран 4). Общее для обоих экранов, чтобы не держать одну и ту
// же композицию в двух местах.
//
// Готовый лик карты (рамка + медальон с номером + портрет + имя) — цельная
// иллюстрация художника (card_the_fool.png), не собирается руками из частей:
// пробовали рисовать медальон отдельным ctx.arc() поверх готового портрета —
// сглаженная векторная линия спорила с пиксельной графикой всего
// остального (правка в чате 2026-08-19: «я же дала норм фрейм, схуяли круг
// какой-то»). Раз карта одна (MVP, canon в CLAUDE.md), простая одна
// картинка надёжнее композита.
//
// Проступает пикселями целиком, тем же эффектом, что и силуэт оракула на
// экранах 1–2 (revealProgress 0→1, core/pixelReveal.js) — правка в чате:
// «появляй дурака так же, как силуэт».

import { drawPixelReveal } from './pixelReveal.js';

export function drawCardBack(ctx, images, x, y, w, h) {
  ctx.drawImage(images.cardBack, Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/** Пустая карта — только тонкая рамка, без лика. Момент флипа на экране 3,
 * пока сам портрет ещё не время открывать (материализуется на экране 4). */
export function drawCardBlank(ctx, images, x, y, w, h) {
  const rx = Math.round(x);
  const ry = Math.round(y);
  const rw = Math.round(w);
  const rh = Math.round(h);
  ctx.fillStyle = '#000000';
  ctx.fillRect(rx, ry, rw, rh);
  ctx.drawImage(images.cardFront, rx, ry, rw, rh);
}

export function drawCardFace(ctx, images, x, y, w, h, revealProgress = 1, cellSize = 4) {
  drawPixelReveal(ctx, images.cardFace, x, y, w, h, revealProgress, cellSize, 0.5, 0.25);
}

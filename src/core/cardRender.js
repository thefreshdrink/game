// Отрисовка карты — рубашка, пустая раскрытая (флип, экран 3) и целиком
// раскрытая (экран 4). Общее для обоих экранов, чтобы не держать одну и ту
// же композицию в двух местах.
//
// Рамка (`card_frame_fool.png`) — отдельный ассет без персонажа: место под
// номер и под имя уже размечено бирками художника, портрет
// (`fool_on_the_card.png`) кладётся отдельным слоем поверх и умеет
// проступать пикселями (revealProgress 0→1, core/pixelReveal.js) — тем же
// эффектом, что и силуэт оракула на экранах 1–2 (правка в чате 2026-08-19:
// «появляй дурака так же, как силуэт»). Раньше пробовали и цельную
// картинку с запечённым портретом, и рамку из старых деталей + номер через
// ctx.arc() — оба варианта не подошли (см. decisions-log): либо портрет было
// не отделить от рамки для отдельного проявления, либо нарисованный кружок
// спорил с пиксельной графикой. Номер по-прежнему текстом (тот же приём,
// что и у имени карты) — это не векторная фигура, а обычный шрифт, как
// везде в игре.

import { setFont } from './text.js';
import { drawPixelReveal } from './pixelReveal.js';

export function drawCardBack(ctx, images, x, y, w, h) {
  ctx.drawImage(images.cardBack, Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/** Пустая карта — только рамка, без лика. Момент флипа на экране 3, пока
 * сам портрет ещё не время открывать (материализуется на экране 4). */
export function drawCardBlank(ctx, images, x, y, w, h) {
  const rx = Math.round(x);
  const ry = Math.round(y);
  const rw = Math.round(w);
  const rh = Math.round(h);
  ctx.fillStyle = '#111111';
  ctx.fillRect(rx, ry, rw, rh);
  ctx.drawImage(images.cardFront, rx, ry, rw, rh);
}

export function drawCardFace(
  ctx, images, x, y, w, h, name, scale,
  { numeral = null, revealProgress = 1, cellSize = 4 } = {},
) {
  const s = w / 224; // локальный масштаб: 224 арт-px рамки → w экранных
  const rx = Math.round(x);
  const ry = Math.round(y);
  const rw = Math.round(w);
  const rh = Math.round(h);

  ctx.fillStyle = '#111111';
  ctx.fillRect(rx, ry, rw, rh);
  ctx.drawImage(images.cardFront, rx, ry, rw, rh);

  if (numeral !== null) {
    // Тот же кегль, что у имени (Figma: Alagard Medium 30, обоим).
    setFont(ctx, 'cardName', scale);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(numeral, Math.round(x + w / 2), Math.round(y + 37 * s));
    ctx.textBaseline = 'alphabetic';
  }

  if (revealProgress > 0) {
    const art = images.foolOnCard;
    const artW = 150 * s;
    const artH = artW * (art.height / art.width);
    const artX = x + (w - artW) / 2;
    const artY = y + 96 * s;
    drawPixelReveal(ctx, art, artX, artY, artW, artH, revealProgress, cellSize, 0.5, 0.3);
  }

  setFont(ctx, 'cardName', scale);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#EBA331';
  ctx.fillText(name, Math.round(x + w / 2), Math.round(y + 338 * s));
  ctx.textBaseline = 'alphabetic';
}

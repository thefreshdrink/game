// Отрисовка карты — рубашка и раскрытый лик. Общее для экранов 3 (флип)
// и 4 (раскрытие), чтобы не держать одну и ту же композицию в двух местах.
//
// Раскрытая карта — три слоя поверх области (x, y, w, h) в 224×384
// арт-пикселях рамки: front_side_card.png (рамка без нижнего бокса) →
// иллюстрация Шута, вписанная во внутреннее окно → card_frame.png
// (добавляет разделитель для бокса с именем) → имя картой поверх.

import { setFont } from './text.js';

export function drawCardBack(ctx, images, x, y, w, h) {
  ctx.drawImage(images.cardBack, Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

export function drawCardFace(ctx, images, x, y, w, h, name, scale) {
  const s = w / 224; // локальный масштаб: 224 арт-px рамки → w экранных

  ctx.drawImage(images.cardFront, Math.round(x), Math.round(y), Math.round(w), Math.round(h));

  const art = images.foolArt;
  const artW = 196 * s;
  const artH = artW * (art.height / art.width);
  const artX = x + (w - artW) / 2;
  const artY = y + 78 * s;
  ctx.drawImage(art, Math.round(artX), Math.round(artY), Math.round(artW), Math.round(artH));

  ctx.drawImage(images.cardFrame, Math.round(x), Math.round(y), Math.round(w), Math.round(h));

  setFont(ctx, 'cardName', scale);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#EBA331';
  ctx.fillText(name, Math.round(x + w / 2), Math.round(y + 344 * s));
}

// Отрисовка карты — рубашка, пустая раскрытая (флип, экран 3) и целиком
// раскрытая (экран 4). Общее для обоих экранов, чтобы не держать одну и ту
// же композицию в двух местах.
//
// Рамка (`card_frame_fool.png`) — отдельный ассет без персонажа и ОБЩИЙ для
// всех карт: имя файла историческое, ничего от Шута в нём нет. Место под
// номер и под имя размечено бирками художника, а сами номер и имя рисуются
// текстом из `cards.js`. Портрет у каждой карты свой (`card.art` — ключ
// IMAGE_MANIFEST) — кладётся отдельным слоем поверх и умеет
// проступать пикселями (revealProgress 0→1, core/pixelReveal.js) — тем же
// эффектом, что и силуэт оракула на экранах 1–2 (правка в чате 2026-08-19:
// «появляй дурака так же, как силуэт»). Раньше пробовали и цельную
// картинку с запечённым портретом, и рамку из старых деталей + номер через
// ctx.arc() — оба варианта не подошли (см. decisions-log): либо портрет было
// не отделить от рамки для отдельного проявления, либо нарисованный кружок
// спорил с пиксельной графикой. Номер по-прежнему текстом (тот же приём,
// что и у имени карты) — это не векторная фигура, а обычный шрифт, как
// везде в игре.

import { setFontFitted } from './text.js';
import { drawPixelReveal } from './pixelReveal.js';
import { ART_BY_NUMERAL } from '../data/cards.js';

// Карта — экранные пиксели, множитель ×1, фиксированный размер во всех
// сценах (BUILD-SPEC-03 задача 2): рамка `card_frame_fool.png` ровно
// 224×384, никакой зависимости от ширины экрана. Экраны 3 и 4 держат
// один и тот же размер, иначе карта прыгнет на переходе.
export const CARD_W = 224;
export const CARD_H = 384;

// Чистое нутро бирок рамки, замерено по card_frame_fool.png: верхняя
// (номер) — x 68…155, нижняя (имя) — x 18…205. Текст ужимается под эту
// ширину за вычетом отступа, чтобы длинное имя не уезжало под рамку
// («Wheel of Fortune» кеглем 30 шире бирки и обрезался с двух сторон).
const TAG_PAD = 6;
const NUM_TAG_W = 88;
const NAME_TAG_W = 188;

// Тело карты — подложка под рубашку и рамку, у которых прозрачный фон
// (только линии — ~83% пикселей PNG прозрачны), поэтому цвет подложки
// полностью определяет то, что видно. История: воздух #111111 (карта
// сливалась с фоном) → сплошной #000000, «дыра в воздухе», как плиты
// дороги (BUILD-SPEC-05 2a/3a) → шашечка в два тона, вариант B из того же
// мокапа (тоже не понравилась — «шашечка не оч»). Правка в чате
// 2026-09-11: назад к воздуху #111111, сознательно — на этот раз не
// забытый баг, а выбор. Раньше эта заливка была продублирована в трёх
// местах здесь плюс отдельно в deck.js — один общий хелпер на все четыре.
export function fillCardBody(ctx, x, y, w, h) {
  ctx.fillStyle = '#111111';
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

export function drawCardBack(ctx, images, x, y, w, h) {
  fillCardBody(ctx, x, y, w, h);
  ctx.drawImage(images.cardBack, Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/** Пустая карта — только рамка, без лика. Момент флипа на экране 3, пока
 * сам портрет ещё не время открывать (материализуется на экране 4). */
export function drawCardBlank(ctx, images, x, y, w, h) {
  fillCardBody(ctx, x, y, w, h);
  ctx.drawImage(images.cardFront, Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

export function drawCardFace(
  ctx, images, x, y, w, h, name, scale,
  { numeral = null, revealProgress = 1, cellSize = 4, art = null } = {},
) {
  const s = w / 224; // всегда 1 (карта фиксирована 224, см. CARD_W) — оставлен
  // для читаемости смещений внутри рамки в её собственных пикселях.
  const rx = Math.round(x);
  const ry = Math.round(y);
  const rw = Math.round(w);
  const rh = Math.round(h);

  fillCardBody(ctx, x, y, w, h);
  ctx.drawImage(images.cardFront, rx, ry, rw, rh);

  if (numeral !== null) {
    // Тот же кегль, что у имени (Figma: Alagard Medium 30, обоим).
    // 32 — геометрический центр верхней бирки: она лежит между сплошными
    // линиями рамки y 4…7 и y 56…59, то есть нутро y 8…55, центр 31.5.
    // Было 37 — номер сидел на 5.5 px ниже центра коробки.
    setFontFitted(ctx, 'cardName', scale, numeral, (NUM_TAG_W - TAG_PAD * 2) * s);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(numeral, Math.round(x + w / 2), Math.round(y + 32 * s));
    ctx.textBaseline = 'alphabetic';
  }

  if (revealProgress > 0) {
    // Портрет — экранные пиксели, множитель ×1 (BUILD-SPEC-03 задача 2):
    // рисуем в натуральном размере ассета, не 150-в-что-то. Свой у каждой
    // карты (ключ манифеста в `card.art`). Пока
    // экраны полируются параллельно и не передают `art`, ключ достаётся
    // мостом по номеру карты — номер уже приходит сюда и он данные, а не
    // отображаемая строка. Когда reveal.js освободится, туда добавляется
    // `art: card.art`, и мост с ART_BY_NUMERAL удаляется.
    const artKey = art ?? ART_BY_NUMERAL[numeral] ?? 'foolOnCard';
    const sprite = images[artKey] ?? images.foolOnCard;
    const artW = sprite.width;
    const artH = sprite.height;
    const artX = Math.round(x + (w - artW) / 2);
    const artY = Math.round(y + 96);
    drawPixelReveal(ctx, sprite, artX, artY, artW, artH, revealProgress, cellSize, 0.5, 0.3);
  }

  setFontFitted(ctx, 'cardName', scale, name, (NAME_TAG_W - TAG_PAD * 2) * s);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#EBA331';
  // Нижняя бирка — нутро y 312…365, геометрический центр 338.5. Имя опущено
  // на 2 px ниже центра по просьбе в чате: у Alagard прописные оптически
  // сидят выше середины em-бокса, и строго по центру читается как приподнятая.
  ctx.fillText(name, Math.round(x + w / 2), Math.round(y + 340 * s));
  ctx.textBaseline = 'alphabetic';
}

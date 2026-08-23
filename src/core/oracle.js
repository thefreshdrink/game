// Отрисовка фигуры оракула — общая для экрана 1 (проявление из темноты)
// и экрана 2 (уход обратно в темноту перед веером карт), чтобы позиция
// и слои не расходились между экранами.

import { drawPixelReveal } from './pixelReveal.js';

// Прямоугольник глаз внутри oracle_eyes.png (430×678, тот же холст, что
// и у oracle_body.png / oracle_sparks.png — три чистых слоя от
// художника, см. decisions-log 2026-08-17).
export const EYES_SRC = { sx: 172, sy: 277, sw: 86, sh: 18 };

// Проявление тела расходится от глаз (пиксельно, но волной, не равномерным
// шумом по всей фигуре) — доля ширины/высоты картинки, где центр глаз.
const BODY_REVEAL_ORIGIN_X = (EYES_SRC.sx + EYES_SRC.sw / 2) / 430;
const BODY_REVEAL_ORIGIN_Y = (EYES_SRC.sy + EYES_SRC.sh / 2) / 678;

// От низа шапки (меню/заголовок) до макушки фигуры — подобрано в чате.
export const ORACLE_TOP_GAP = 18;

// Число строк шапки для якоря оракула — ФИКСИРОВАННОЕ, не по фактическому
// переносу текста экрана. Баг, пойманный в чате («фигура немного скачет
// вверх при выборе категории»): на экране 1 реплики иногда переносятся на
// 3 строки («What is your / question / about?» на узких экранах), а
// заголовок экрана 2 — всегда 2 («The deck / offers itself…»); оракул
// стоял от числа строк СВОЕГО экрана, и на переходе 1→2 сдвигался на
// высоту одной строки. 3 — наихудший случай (самая длинная из реплик
// экрана 1 при переносе), чтобы фигура никогда не налезала на текст ни
// на одном из экранов, а якорь был одинаков независимо от контента.
export const HEADER_LINES = 3;

/** Единая точка отсчёта «низ шапки» — одна и та же на всех экранах с
 * оракулом, не зависит от фактического числа строк конкретной реплики. */
export function headerBottomY(ty, titleLH, scale) {
  return ty + HEADER_LINES * titleLH + Math.round(9 * scale);
}

/** Ширина, высота и позиция фигуры — во весь канвас, верх у ORACLE_TOP_GAP. */
export function computeOracleLayout(w, headerBottomY, scale, bodyImage) {
  const oracleW = w;
  const oracleH = oracleW * (bodyImage.height / bodyImage.width);
  const oracleX = (w - oracleW) / 2;
  const oracleY = headerBottomY + Math.round(ORACLE_TOP_GAP * scale);
  const oracleScale = oracleW / bodyImage.width;
  return { oracleX, oracleY, oracleW, oracleH, oracleScale };
}

/** Тело проявляется пикселями от глаз; progress 1→0 уводит его обратно в темноту. */
export function drawOracleBody(ctx, images, layout, progress, cellSize) {
  drawPixelReveal(
    ctx, images.futureTellerBody,
    layout.oracleX, layout.oracleY, layout.oracleW, layout.oracleH,
    progress, cellSize, BODY_REVEAL_ORIGIN_X, BODY_REVEAL_ORIGIN_Y,
  );
}

export function drawOracleEyes(ctx, images, layout, alpha) {
  if (alpha <= 0) return;
  ctx.globalAlpha = alpha;
  ctx.drawImage(
    images.futureTellerEyes,
    EYES_SRC.sx, EYES_SRC.sy, EYES_SRC.sw, EYES_SRC.sh,
    Math.round(layout.oracleX + EYES_SRC.sx * layout.oracleScale),
    Math.round(layout.oracleY + EYES_SRC.sy * layout.oracleScale),
    Math.round(EYES_SRC.sw * layout.oracleScale),
    Math.round(EYES_SRC.sh * layout.oracleScale),
  );
  ctx.globalAlpha = 1;
}

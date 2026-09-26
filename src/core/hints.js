// Подсказки жеста в мини-играх: акцентным цветом (их можно «тронуть» —
// это указание на действие), мигают как CTA на других экранах. Живут у
// фигуры, не в HUD (BUILD-SPEC-03 задача 8).

import { setFont } from './text.js';
import { blinkAlpha } from './textReveal.js';
import { clamp01 } from './juice.js';

/** Масштаб подсказок от ширины кадра; 430 — эталонный портрет. */
export function hintScale(w, max = 1.25) {
  return Math.min(Math.max(w / 430, 0.75), max);
}

/**
 * Строки столбиком над фигурой: центр по figX с клэмпом в поля кадра, низ
 * стека на 34px выше headTop. Возвращает геометрию — к ней крепят знак
 * жеста (стрелку свайпа, кольцо удержания).
 */
export function drawHintStack(ctx, words, { figX, headTop, w, t, fadeIn = 1, scale }) {
  const marginX = Math.round(53 * scale);
  const lineH = Math.round(24 * scale);
  setFont(ctx, 'menuOption', scale);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#EBA331';
  ctx.globalAlpha = clamp01(fadeIn) * blinkAlpha(t);
  const bottom = headTop - Math.round(34 * scale);
  let widest = 0;
  words.forEach((word, i) => {
    const wy = bottom - (words.length - 1 - i) * lineH;
    const halfW = ctx.measureText(word).width / 2;
    const cxw = Math.max(marginX + halfW, Math.min(figX, w - marginX - halfW));
    ctx.fillText(word, cxw, wy);
    widest = Math.max(widest, halfW * 2);
  });
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
  return { bottom, lineH, count: words.length, widest };
}

/** Одна строка сверху по центру — когда фигуры нет (кладка, поле). */
export function drawTopHint(ctx, text, { w, t, scale }) {
  setFont(ctx, 'caption', scale);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#EBA331';
  ctx.globalAlpha = blinkAlpha(t);
  ctx.fillText(text, w / 2, Math.round(74 * scale));
  ctx.globalAlpha = 1;
}

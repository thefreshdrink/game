// Тесты подсказок и текстовых кнопок: src/core/hints.js (подсказки жеста в
// мини-играх), src/core/textReveal.js (слово за словом, мигание CTA) и
// src/core/textButton.js (хит-зона текстовой кнопки). Ими пользуются все
// три сцены и экраны 1, 4, 6 — правка здесь меняет подсказки и кнопки везде.
// Без браузера: вместо canvas — заглушка, которая записывает вызовы, ширина
// строки = число знаков × кегль × 0.5. Запуск — `npm test`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawHintStack, drawTopHint } from '../src/core/hints.js';
import {
  WORD_INTERVAL, layoutWords, visibleWordCount, revealDuration, blinkAlpha,
} from '../src/core/textReveal.js';
import { textButtonZone, zoneHit } from '../src/core/textButton.js';

// заглушка ctx: пишет fillText вместе с цветом, прозрачностью и выравниванием
function fakeCtx() {
  const calls = [];
  return {
    calls,
    font: '', letterSpacing: '', textAlign: 'left', fillStyle: '#000000', globalAlpha: 1,
    measureText(s) {
      const px = Number(/(\d+)px/.exec(this.font)?.[1] ?? 10);
      return { width: s.length * px * 0.5 };
    },
    fillText(text, x, y) {
      calls.push({ text, x, y, fill: this.fillStyle, alpha: this.globalAlpha, align: this.textAlign });
    },
  };
}

test('blinkAlpha: резкое мигание 1 → 0.35, период 1.1 с, не гаснет до нуля', () => {
  assert.equal(blinkAlpha(0), 1);
  assert.equal(blinkAlpha(0.65), 1);   // 60% периода — полная яркость
  assert.equal(blinkAlpha(0.67), 0.35);
  assert.equal(blinkAlpha(1.09), 0.35);
  assert.equal(blinkAlpha(1.1 + 0.1), 1); // следующий период
  assert.equal(blinkAlpha(-0.3), 0.35);   // отрицательное время не ломает цикл
  for (let t = 0; t < 5; t += 0.013) {
    const a = blinkAlpha(t);
    assert.ok(a === 1 || a === 0.35, `t=${t}: только два уровня, без плавного fade`);
  }
});

test('слово за словом: первое сразу, дальше по одному через WORD_INTERVAL', () => {
  assert.equal(visibleWordCount(-0.01, 5), 0);
  assert.equal(visibleWordCount(0, 5), 1);
  assert.equal(visibleWordCount(WORD_INTERVAL * 2 + 1e-9, 5), 3);
  assert.equal(visibleWordCount(100, 5), 5); // не больше, чем слов
  assert.equal(revealDuration(1), 0);
  assert.ok(Math.abs(revealDuration(5) - 4 * WORD_INTERVAL) < 1e-12);
  // к концу revealDuration видны все слова
  assert.equal(visibleWordCount(revealDuration(7) + 1e-9, 7), 7);
});

test('layoutWords: слова встают по строкам с шагом line-height и шириной «слово + пробел»', () => {
  const ctx = fakeCtx();
  ctx.font = '400 10px x';
  const words = layoutWords(ctx, ['ab cde', 'f'], 20, 100, 30);
  assert.deepEqual(words, [
    { text: 'ab', x: 20, y: 100 },
    { text: 'cde', x: 20 + 3 * 5, y: 100 }, // «ab » — 3 знака по 5px
    { text: 'f', x: 20, y: 130 },
  ]);
});

test('textButtonZone: запас 12px по бокам, высота не меньше пальца (44px)', () => {
  const z = textButtonZone(100, 200, 80, 20);
  assert.deepEqual(z, { x0: 88, x1: 192, y0: 170, y1: 214, baselineY: 200 });
  // центр зоны — на 8px выше базовой линии
  assert.equal((z.y0 + z.y1) / 2, 192);
  // крупный кегль: высота по line-height, а не 44
  const big = textButtonZone(0, 100, 10, 60);
  assert.equal(big.y1 - big.y0, 60);
  // целые пиксели даже на дробном входе
  const fr = textButtonZone(10.3, 50.7, 33.3, 0);
  for (const k of ['x0', 'x1', 'y0', 'y1']) assert.ok(Number.isInteger(fr[k]), k);
});

test('zoneHit: края зоны включены, вне зоны и без зоны — мимо', () => {
  const z = textButtonZone(100, 200, 80, 20);
  assert.equal(zoneHit(z, 88, 170), true);
  assert.equal(zoneHit(z, 192, 214), true);
  assert.equal(zoneHit(z, 140, 192), true);
  assert.equal(zoneHit(z, 87, 192), false);
  assert.equal(zoneHit(z, 140, 215), false);
  assert.equal(zoneHit(null, 140, 192), false);
  assert.equal(zoneHit(undefined, 0, 0), false);
});

test('drawHintStack: столбик над головой, золотом, мигает, последняя строка ниже всех', () => {
  const ctx = fakeCtx();
  const g = drawHintStack(ctx, ['TAP', 'TO WALK'], { figX: 200, headTop: 400, w: 400, t: 0, scale: 1 });
  assert.equal(g.bottom, 400 - 34);
  assert.equal(g.lineH, 24);
  assert.equal(g.count, 2);
  const [a, b] = ctx.calls;
  assert.equal(a.text, 'TAP');
  assert.equal(a.y, 366 - 24);
  assert.equal(b.y, 366);
  for (const c of ctx.calls) {
    assert.equal(c.fill, '#EBA331'); // подсказку можно «тронуть» — акцент
    assert.equal(c.align, 'center');
    assert.equal(c.x, 200);
    assert.equal(c.alpha, 1); // t = 0 — полная яркость
  }
  assert.equal(g.widest, ctx.measureText('TO WALK').width);
  // после рисования состояние ctx возвращено
  assert.equal(ctx.globalAlpha, 1);
  assert.equal(ctx.textAlign, 'left');
});

test('drawHintStack: у края экрана строка прижимается внутрь, не обрезается', () => {
  const w = 390;
  for (const figX of [0, 20, w - 20, w]) {
    const ctx = fakeCtx();
    drawHintStack(ctx, ['HOLD', 'TO LEAN FORWARD'], { figX, headTop: 500, w, t: 0, scale: w / 430 });
    const margin = Math.round(53 * w / 430);
    for (const c of ctx.calls) {
      const half = ctx.measureText(c.text).width / 2;
      assert.ok(c.x - half >= margin - 1e-9, `figX=${figX} «${c.text}» вылез влево`);
      assert.ok(c.x + half <= w - margin + 1e-9, `figX=${figX} «${c.text}» вылез вправо`);
    }
  }
});

test('drawHintStack: fadeIn и мигание множатся, fadeIn зажат в 0…1', () => {
  const ctx = fakeCtx();
  drawHintStack(ctx, ['X'], { figX: 100, headTop: 300, w: 400, t: 0.8, fadeIn: 0.5, scale: 1 });
  assert.equal(ctx.calls[0].alpha, 0.5 * 0.35);
  const ctx2 = fakeCtx();
  drawHintStack(ctx2, ['X'], { figX: 100, headTop: 300, w: 400, t: 0, fadeIn: 3, scale: 1 });
  assert.equal(ctx2.calls[0].alpha, 1);
});

test('drawTopHint: одна строка по центру сверху, тем же кеглем, что у фигуры', () => {
  const ctx = fakeCtx();
  drawTopHint(ctx, 'HOLD A BLOCK', { w: 390, t: 0, scale: 0.9 });
  assert.equal(ctx.calls.length, 1);
  const c = ctx.calls[0];
  assert.equal(c.x, 195);
  assert.equal(c.y, Math.round(74 * 0.9));
  assert.equal(c.fill, '#EBA331');
  assert.equal(c.align, 'center');
  const font = ctx.font;
  const ctx2 = fakeCtx();
  drawHintStack(ctx2, ['A'], { figX: 100, headTop: 300, w: 390, t: 0, scale: 0.9 });
  assert.equal(ctx2.font, font);
  assert.equal(ctx.globalAlpha, 1);
  // Как и drawHintStack, после себя возвращает textAlign = 'left'
  // (задача 38).
  assert.equal(ctx.textAlign, 'left');
});

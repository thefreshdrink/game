// Тесты общей типографики src/core/text.js: масштаб uiScale, установка
// шрифта по роли, ужатие кегля под ширину и перенос строк. Ими пользуются
// все экраны ритуала, правка здесь двигает текст везде сразу.
// Без браузера: вместо canvas — заглушка, у которой ширина строки =
// число знаков × кегль × 0.5. Запуск — `npm test`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { uiScale, setFont, setFontFitted, wrapLines } from '../src/core/text.js';

// заглушка ctx: кегль берётся из ctx.font, ширина знака — полкегля
function fakeCtx() {
  return {
    font: '',
    letterSpacing: '',
    measureText(s) {
      const px = Number(/(\d+)px/.exec(this.font)?.[1] ?? 10);
      return { width: s.length * px * 0.5 };
    },
  };
}
const pxOf = (ctx) => Number(/(\d+)px/.exec(ctx.font)[1]);

test('uiScale: 430 — эталон, зажим снизу 0.75 и сверху max', () => {
  assert.equal(uiScale(430), 1);
  assert.equal(uiScale(390), 390 / 430);
  assert.equal(uiScale(100), 0.75);
  assert.equal(uiScale(1440), 1.25);
  assert.equal(uiScale(1440, 2), 2);
  assert.equal(uiScale(645, 2), 1.5);
  assert.equal(uiScale(860, 1.5), 1.5);
});

test('setFont: целый кегль, семейство и вес роли, line-height по масштабу', () => {
  const ctx = fakeCtx();
  const lh = setFont(ctx, 'title', 1);
  assert.equal(ctx.font, '400 46px Kingdom, serif');
  assert.equal(ctx.letterSpacing, '0px');
  assert.equal(lh, 46);

  const lh2 = setFont(ctx, 'body', 390 / 430);
  assert.equal(pxOf(ctx), Math.round(18 * 390 / 430));
  assert.ok(ctx.font.includes('"Pixelify Sans"'));
  assert.equal(lh2, Math.round(29 * 390 / 430));

  // у имени карты вес 500 и разрядка −4% от кегля
  setFont(ctx, 'cardName', 1);
  assert.equal(ctx.font, '500 26px Kingdom, serif');
  assert.equal(ctx.letterSpacing, `${(26 * -0.04).toFixed(2)}px`);

  // номер карты — единственная роль на Alagard
  setFont(ctx, 'cardNumeral', 1);
  assert.ok(ctx.font.includes('Alagard'));
});

test('setFontFitted: короткая строка остаётся на кегле роли', () => {
  const ctx = fakeCtx();
  const lh = setFontFitted(ctx, 'cardName', 1, 'The Fool', 1000);
  assert.equal(pxOf(ctx), 26);
  assert.equal(lh, 30);
});

test('setFontFitted: длинная строка ужимается по целому пикселю, пока не влезет', () => {
  const ctx = fakeCtx();
  const text = 'Wheel of Fortune'; // 16 знаков
  const maxWidth = 150; // влезает при кегле ≤ 18 (16 × 18 × 0.5 = 144)
  const lh = setFontFitted(ctx, 'cardName', 1, text, maxWidth);
  assert.equal(pxOf(ctx), 18);
  assert.ok(ctx.measureText(text).width <= maxWidth);
  // line-height в той же пропорции, что и кегль
  assert.equal(lh, Math.round(30 * 18 / 26));
  // разрядка пересчитана под новый кегль
  assert.equal(ctx.letterSpacing, `${(18 * -0.04).toFixed(2)}px`);
});

test('setFontFitted: не спускается ниже minSize, даже если не влезло', () => {
  const ctx = fakeCtx();
  setFontFitted(ctx, 'cardName', 1, 'Wheel of Fortune', 1);
  assert.equal(pxOf(ctx), 12);
  setFontFitted(ctx, 'cardName', 1, 'Wheel of Fortune', 1, 20);
  assert.equal(pxOf(ctx), 20);
  // minSize тоже масштабируется
  setFontFitted(ctx, 'cardName', 0.75, 'Wheel of Fortune', 1);
  assert.equal(pxOf(ctx), Math.round(12 * 0.75));
});

test('wrapLines: жадный перенос по словам, слова не теряются', () => {
  const ctx = fakeCtx();
  ctx.font = '400 10px x'; // знак = 5 px
  const text = 'the ground was under your foot every time';
  const lines = wrapLines(ctx, text, 60); // до 12 знаков в строке
  assert.deepEqual(lines, ['the ground', 'was under', 'your foot', 'every time']);
  for (const l of lines) assert.ok(ctx.measureText(l).width <= 60);
  assert.equal(lines.join(' '), text);
});

test('wrapLines: слово длиннее строки встаёт отдельной строкой, не режется', () => {
  const ctx = fakeCtx();
  ctx.font = '400 10px x';
  assert.deepEqual(wrapLines(ctx, 'a extraordinarily b', 30), ['a', 'extraordinarily', 'b']);
  assert.deepEqual(wrapLines(ctx, 'short', 1000), ['short']);
  assert.deepEqual(wrapLines(ctx, '', 100), []);
});

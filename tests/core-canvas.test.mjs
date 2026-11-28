// Тесты владельца канваса (src/core/canvas.js, бэклог 58): стейдж — портретная
// полоса не шире 480 px и не выше ширины × 2.3, по центру окна; плотность
// пикселей (DPR) не больше 2; рисуем в CSS-пикселях стейджа (setTransform на
// DPR); сглаживание выключено после каждого ресайза (правило CLAUDE.md:
// `imageSmoothingEnabled = false` везде, всегда); ресайз окна и поворот
// экрана пересчитывают размер. Без браузера: node:test, window и canvas —
// заглушки. Запуск — `npm test`.

import { test } from 'node:test';
import assert from 'node:assert/strict';

const listeners = {};
globalThis.window = {
  innerWidth: 390,
  innerHeight: 844,
  devicePixelRatio: 3,
  addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
};

function fakeCanvas() {
  const ctx = {
    imageSmoothingEnabled: true,
    transforms: [],
    setTransform(...a) { this.transforms.push(a); },
  };
  return {
    width: 0,
    height: 0,
    style: {},
    getContext(kind) { assert.equal(kind, '2d'); return ctx; },
    ctx,
  };
}

const { createCanvas } = await import('../src/core/canvas.js');

function make(w, h, dpr) {
  Object.assign(window, { innerWidth: w, innerHeight: h, devicePixelRatio: dpr });
  const el = fakeCanvas();
  return { el, c: createCanvas(el) };
}

test('телефон 390×844: стейдж совпадает с окном', () => {
  const { el, c } = make(390, 844, 1);
  assert.equal(c.width, 390);
  assert.equal(c.height, 844);
  assert.equal(el.width, 390);
  assert.equal(el.height, 844);
  assert.equal(el.style.width, '390px');
  assert.equal(el.style.height, '844px');
  assert.equal(c.ctx, el.ctx, 'отдаёт контекст этого канваса');
});

test('десктоп 1440×860: стейдж не шире 480 px, по высоте — окно', () => {
  const { c, el } = make(1440, 860, 1);
  assert.equal(c.width, 480);
  assert.equal(c.height, 860, '480 × 2.3 = 1104 > 860 — высота окна');
  assert.equal(el.style.width, '480px');
});

test('высокое окно: высота не больше ширины × 2.3 (округлённо)', () => {
  const { c } = make(390, 2000, 1);
  assert.equal(c.height, Math.round(390 * 2.3)); // 897
  const wide = make(1440, 3000, 1).c;
  assert.equal(wide.width, 480);
  assert.equal(wide.height, 1104);
});

test('DPR: буфер канваса умножен на DPR, но не больше чем на 2', () => {
  const two = make(390, 844, 2).el;
  assert.equal(two.width, 780);
  assert.equal(two.height, 1688);
  assert.deepEqual(two.ctx.transforms.at(-1), [2, 0, 0, 2, 0, 0]);

  const three = make(390, 844, 3).el;
  assert.equal(three.width, 780, 'DPR 3 обрезан до 2');
  assert.deepEqual(three.ctx.transforms.at(-1), [2, 0, 0, 2, 0, 0]);
  assert.equal(three.style.width, '390px', 'CSS-размер от DPR не зависит');
});

test('DPR дробный или не задан: буфер — целые пиксели, без DPR — 1', () => {
  const frac = make(375, 667, 1.5).el;
  assert.equal(frac.width, Math.floor(375 * 1.5)); // 562
  assert.equal(frac.height, Math.floor(667 * 1.5)); // 1000
  assert.ok(Number.isInteger(frac.width) && Number.isInteger(frac.height));
  const none = make(390, 844, undefined).el;
  assert.equal(none.width, 390);
  assert.deepEqual(none.ctx.transforms.at(-1), [1, 0, 0, 1, 0, 0]);
});

test('сглаживание выключено сразу и после каждого ресайза', () => {
  const { el, c } = make(390, 844, 2);
  assert.equal(el.ctx.imageSmoothingEnabled, false);
  // Браузер сбрасывает свойства контекста, когда меняется размер буфера.
  el.ctx.imageSmoothingEnabled = true;
  c.resize();
  assert.equal(el.ctx.imageSmoothingEnabled, false);
});

test('ресайз окна и поворот экрана пересчитывают размер', () => {
  const { el, c } = make(390, 844, 1);
  assert.ok(listeners.resize?.length, 'слушает resize');
  assert.ok(listeners.orientationchange?.length, 'слушает orientationchange');

  Object.assign(window, { innerWidth: 844, innerHeight: 390 });
  listeners.orientationchange.at(-1)();
  assert.equal(c.width, 480, 'в альбомной ориентации — та же полоса ≤480');
  assert.equal(c.height, 390);
  assert.equal(el.style.height, '390px');

  Object.assign(window, { innerWidth: 360, innerHeight: 740 });
  listeners.resize.at(-1)();
  assert.equal(c.width, 360);
  assert.equal(c.height, 740);
  assert.equal(el.width, 360);
});

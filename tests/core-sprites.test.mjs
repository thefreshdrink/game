// Тесты загрузки и нарезки спрайтов (src/core/sprites.js, бэклог 56):
// одна картинка грузится один раз (кэш по пути), к путям приклеивается
// версия сборки, чтобы после деплоя не показывалась старая картинка, ошибка
// загрузки называет файл, полоса кадров режется на отдельные canvas без
// сглаживания. Без браузера: node:test, Image и canvas — заглушки. Код не
// трогается — тест фиксирует то, что есть. Запуск — `npm test`.

import { test } from 'node:test';
import assert from 'node:assert/strict';

// Константа, которую vite подставляет при сборке (vite.config.js, define).
globalThis.__ASSET_VERSION__ = 'v123';

// Заглушка Image: «грузится» в следующем микротакте; путь с 'broken' — ошибка.
const made = [];
globalThis.Image = class {
  constructor() { made.push(this); }
  set src(v) {
    this._src = v;
    queueMicrotask(() => (v.includes('broken') ? this.onerror?.() : this.onload?.()));
  }
  get src() { return this._src; }
};

// Заглушка canvas: запоминает размеры, сглаживание и вызов drawImage.
const canvases = [];
globalThis.document = {
  createElement(tag) {
    assert.equal(tag, 'canvas');
    const c = { width: 0, height: 0, calls: [] };
    const ctx = { imageSmoothingEnabled: true, drawImage: (...a) => c.calls.push(a) };
    c.getContext = (kind) => { assert.equal(kind, '2d'); c.ctx = ctx; return ctx; };
    canvases.push(c);
    return c;
  },
};

const { loadImage, loadSprites, sliceStrip } = await import('../src/core/sprites.js');

test('loadImage: один путь — одна картинка и одно обещание', async () => {
  const before = made.length;
  const a = loadImage('assets/a.png');
  const b = loadImage('assets/a.png');
  assert.equal(a, b, 'второй вызов отдаёт то же обещание');
  assert.equal(made.length - before, 1, 'Image создан один раз');
  const img = await a;
  assert.equal(img.src, 'assets/a.png');
  assert.equal(await loadImage('assets/a.png'), img);
});

test('loadImage: ошибка загрузки называет файл', async () => {
  await assert.rejects(loadImage('assets/broken.png'), /Sprite failed to load: assets\/broken\.png/);
});

test('loadSprites: к путям приклеена версия сборки, имена сохранены', async () => {
  const res = await loadSprites({ fool: 'assets/fool.png', dog: 'assets/dog.png' });
  assert.deepEqual(Object.keys(res), ['fool', 'dog']);
  assert.equal(res.fool.src, 'assets/fool.png?v=v123');
  assert.equal(res.dog.src, 'assets/dog.png?v=v123');
});

test('loadSprites: путь со своим ? не трогается', async () => {
  const res = await loadSprites({ x: 'assets/x.png?raw=1' });
  assert.equal(res.x.src, 'assets/x.png?raw=1');
});

test('loadSprites: одна картинка под двумя именами грузится один раз', async () => {
  const before = made.length;
  const res = await loadSprites({ p: 'assets/same.png', q: 'assets/same.png' });
  assert.equal(made.length - before, 1);
  assert.equal(res.p, res.q);
});

test('loadSprites: битая картинка роняет всю загрузку', async () => {
  await assert.rejects(loadSprites({ ok: 'assets/ok.png', bad: 'assets/broken2.png' }), /broken2\.png\?v=v123/);
});

test('loadSprites: пустой список — пустой объект', async () => {
  assert.deepEqual(await loadSprites({}), {});
});

test('sliceStrip: полоса режется на кадры слева направо, без сглаживания', () => {
  canvases.length = 0;
  const img = { width: 96, height: 20 };
  const frames = sliceStrip(img, 32, 20);
  assert.equal(frames.length, 3);
  frames.forEach((f, i) => {
    assert.equal(f.width, 32);
    assert.equal(f.height, 20);
    assert.equal(f.ctx.imageSmoothingEnabled, false);
    assert.deepEqual(f.calls, [[img, i * 32, 0, 32, 20, 0, 0, 32, 20]]);
  });
});

test('sliceStrip: неполный хвост полосы отбрасывается, узкая полоса — ни одного кадра', () => {
  assert.equal(sliceStrip({ width: 100, height: 8 }, 32, 8).length, 3);
  assert.equal(sliceStrip({ width: 31, height: 8 }, 32, 8).length, 0);
});

test('sliceStrip: высота кадра берётся из аргумента, а не из картинки', () => {
  const [f] = sliceStrip({ width: 16, height: 40 }, 16, 24);
  assert.equal(f.height, 24);
  assert.deepEqual(f.calls[0].slice(1), [0, 0, 16, 24, 0, 0, 16, 24]);
});

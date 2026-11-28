// Тесты финального края дороги Шута (src/minigames/fool/ghostEdge.js,
// бэклог 51): за последней плитой видно призрачное продолжение дороги;
// когда Шут подходит к кромке ближе 120 px, оно за 1.2 с осыпается — дальние
// ячейки уходят первыми — и один раз вниз сыпятся осколки. Без браузера:
// node:test, canvas — заглушка. Код не трогается — тест фиксирует то, что
// есть. Запуск — `npm test`.

import { test } from 'node:test';
import assert from 'node:assert/strict';

// Заглушка document.createElement('canvas'): нужна полосе дороги
// (buildRoadStrip) и буферам pixelReveal. Последняя маска запоминается.
let created = 0;
let lastMask = null;
function fakeCtx(log = []) {
  return {
    log,
    imageSmoothingEnabled: true,
    globalCompositeOperation: 'source-over',
    fillStyle: '',
    clearRect() {}, fillRect() {},
    drawImage(...a) { log.push(a); },
    createImageData(w, h) { return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; },
    putImageData(d) { lastMask = { cols: d.width, rows: d.height, a: Array.from(d.data.filter((_, i) => i % 4 === 3)) }; },
  };
}
globalThis.document = {
  createElement() {
    created++;
    const ctx = fakeCtx();
    return { width: 0, height: 0, getContext: () => ctx };
  },
};

const { createGhostEdge } = await import('../src/minigames/fool/ghostEdge.js');
const { PLATE_H } = await import('../src/minigames/fool/platforms.js');

// Любая плита в картинках — 64×20 арт-px: полосе хватает, чтобы собраться.
const images = new Proxy({}, { get: () => ({ width: 64, height: 20 }) });
const LAST = { x: 1888, y: 32, w: 128 };   // последняя плита (кратно 32)
const GHOST_W = 160, NEAR = 120, CRUMBLE = 1.2;

function makeGhost() {
  const g = createGhostEdge(images);
  g.reset();
  const shards = { list: [], push(p) { this.list.push(p); } };
  return { g, shards };
}

/** Что ghost.draw положил на экран: null — ничего, иначе первый drawImage. */
function drawn(g, camX = 1700.4, camY = -10.6) {
  const ctx = fakeCtx();
  lastMask = null;
  g.draw(ctx, LAST, camX, camY);
  return ctx.log.length ? { args: ctx.log[0], mask: lastMask } : null;
}

test('пока Шут далеко от кромки — продолжение видно целиком, ничего не сыплется', () => {
  const { g, shards } = makeGhost();
  for (let i = 0; i < 300; i++) g.step(1 / 60, LAST, i < 150 ? Infinity : NEAR, shards);
  assert.equal(shards.list.length, 0);
  const d = drawn(g);
  assert.ok(d);
  const [strip, x, y, w] = d.args;
  assert.equal(strip.width, GHOST_W, 'та же плита шириной 160');
  assert.equal(w, GHOST_W);
  assert.equal(strip.height >= PLATE_H, true);
  assert.equal(d.mask, null, 'без маски — целиком');
  assert.deepEqual([x, y], [Math.round(LAST.x + LAST.w - 1700.4), Math.round(LAST.y + 10.6)], 'впритык к краю, по целым px');
});

test('у кромки осыпается за 1.2 с и больше не рисуется', () => {
  const { g, shards } = makeGhost();
  const dt = 1 / 60;
  let t = 0;
  let gone = null;
  while (t < 3) {
    g.step(dt, LAST, NEAR - 1, shards);
    t += dt;
    if (gone === null && !drawn(g)) gone = t;
  }
  assert.ok(gone !== null, 'так и не осыпалось');
  assert.ok(Math.abs(gone - CRUMBLE) < 2 * dt, `осыпалось за ${gone.toFixed(3)} с`);
});

test('осыпание идёт от дальнего конца к Шуту', () => {
  const { g, shards } = makeGhost();
  for (let i = 0; i < 36; i++) g.step(1 / 60, LAST, 10, shards); // половина пути
  const d = drawn(g);
  assert.ok(d && d.mask, 'на середине рисуется маской');
  const { cols, rows, a } = d.mask;
  const colOpen = (c) => { let n = 0; for (let r = 0; r < rows; r++) n += a[r * cols + c] ? 1 : 0; return n / rows; };
  assert.equal(colOpen(0), 1, 'у кромки (ближе к Шуту) ещё стоит');
  assert.equal(colOpen(cols - 1), 0, 'дальний конец уже ушёл');
  const left = [...Array(cols >> 1).keys()].reduce((s, c) => s + colOpen(c), 0);
  const right = [...Array(cols >> 1).keys()].reduce((s, c) => s + colOpen(cols - 1 - c), 0);
  assert.ok(left > right);
});

test('осколки сыплются один раз — 14 штук, вниз, из-под призрачной плиты', () => {
  const { g, shards } = makeGhost();
  for (let i = 0; i < 200; i++) g.step(1 / 60, LAST, 50, shards);
  assert.equal(shards.list.length, 14);
  const gx = LAST.x + LAST.w;
  for (const p of shards.list) {
    assert.ok(p.x >= gx && p.x <= gx + GHOST_W, `x=${p.x} вне плиты`);
    assert.ok(p.y >= LAST.y && p.y <= LAST.y + PLATE_H, `y=${p.y} вне плиты`);
    assert.ok(p.vy >= 20 && p.vy <= 130, 'летят вниз');
    assert.ok(Math.abs(p.vx) <= 12, 'почти без разлёта вбок');
    assert.ok(p.s === 4 || p.s === 8, 'крупные пиксели чётного размера');
    assert.ok(p.life >= 0.6 && p.life <= 1.1);
    assert.equal(p.t, 0);
  }
});

test('дальние осколки падают быстрее ближних', () => {
  // vy = 20 + rand·70 + f·40: у дальнего конца нижняя граница скорости выше.
  const rnd = Math.random;
  try {
    // Шесть Math.random на осколок: f, y, vx, vy, life, s. Первый — у кромки
    // (f=0), второй — у дальнего конца (f=1), случайная часть vy одинаковая.
    let i = 0;
    Math.random = () => { const v = [0.0, 0.5, 0.5, 0.0, 0.5, 0.2, 1.0, 0.5, 0.5, 0.0, 0.5, 0.2][i % 12]; i++; return v; };
    const { g, shards } = makeGhost();
    g.step(1 / 60, LAST, 0, shards);
    const [near, far] = shards.list;
    assert.ok(far.x > near.x);
    assert.ok(far.vy > near.vy);
  } finally { Math.random = rnd; }
});

test('Шут отошёл от кромки — осыпавшееся назад не вырастает', () => {
  const { g, shards } = makeGhost();
  for (let i = 0; i < 36; i++) g.step(1 / 60, LAST, 10, shards);
  const before = drawn(g).mask.a.join('');
  for (let i = 0; i < 120; i++) g.step(1 / 60, LAST, Infinity, shards);
  assert.equal(drawn(g).mask.a.join(''), before);
  assert.equal(shards.list.length, 14);
});

test('reset возвращает продолжение и даёт осколки снова; полоса строится один раз', () => {
  const { g, shards } = makeGhost();
  for (let i = 0; i < 120; i++) g.step(1 / 60, LAST, 0, shards);
  assert.equal(drawn(g), null);
  const n = created;
  g.reset();
  assert.equal(created, n, 'повторный reset не пересобирает полосу');
  assert.equal(drawn(g).mask, null, 'снова целиком');
  g.step(1 / 60, LAST, 0, shards);
  assert.equal(shards.list.length, 28, 'новый проход — новые 14 осколков');
});

test('длинный кадр не уводит осыпание в минус и не ломает рисование', () => {
  const { g, shards } = makeGhost();
  g.step(5, LAST, 0, shards);
  assert.equal(drawn(g), null);
  g.step(5, LAST, 0, shards);
  assert.equal(drawn(g), null);
  assert.equal(shards.list.length, 14);
});

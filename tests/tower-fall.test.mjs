// Тесты обвала Башни (src/minigames/tower/release/fall.js, бэклог 48):
// корона срывается первой и ложится на край пола со стороны крена, кладка
// уходит обломками в ту же сторону, обломки падают и ложатся в кучу, пыль
// гаснет. Код сцены не трогается — тест фиксирует то, что есть (правка
// 29.09). Запуск — `npm test`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRows, cellPos } from '../src/minigames/tower/release/masonry.js';
import { collapse, launchCrown, stepDebris, stepDust, puff } from '../src/minigames/tower/release/fall.js';
import { createPile } from '../src/minigames/tower/pile.js';
import { ROWS, COLS } from '../src/minigames/tower/blocks.js';

// Множители времени из release.js: корона — замедленно, здание — быстро.
const CROWN_SLOW = 0.55;
const FALL_FAST = 1.3;
const DT = 1 / 60;

function withRandom(v, fn) {
  const orig = Math.random;
  Math.random = () => v;
  try { return fn(); } finally { Math.random = orig; }
}

function tower(lean = 0.5, pivot = 3) {
  const rows = withRandom(0.9, buildRows); // без случайного выдвижения
  rows[pivot].lean = lean;
  return rows;
}

const newCrown = () => ({ x: 1.5, y: 1.5, z: ROWS + 0.5, vx: 0, vy: 0, vz: 0, live: false, rest: false, landed: false });
const blocksLeft = (rows) => rows.reduce((a, r) => a + r.slots.filter(Boolean).length, 0);

function cells(d) {
  const out = [];
  for (let a = 0; a < d.dx; a++) for (let b = 0; b < d.dy; b++) out.push(`${d.x + a},${d.y + b},${d.z}`);
  return out;
}

function runCrown(lean, crownSlow = CROWN_SLOW) {
  const crown = newCrown();
  launchCrown(crown, tower(lean), 3);
  let t = 0; let landedAt = null;
  while (!crown.rest && t < 10) {
    stepDebris([], crown, createPile(), [], DT, 1, crownSlow);
    t += DT;
    if (crown.landed && landedAt === null) landedAt = t;
  }
  return { crown, landedAt, restAt: t };
}

test('обвал забирает всё, что стоит: в кладке пусто, обломков столько же, у каждого пыль', () => {
  const rows = tower();
  rows[5].slots[0] = 0; rows[9].slots[2] = 0; // пара брусков уже вынута
  const n = blocksLeft(rows);
  const debris = []; const dust = [];
  collapse(rows, null, 3, false, debris, dust);
  assert.equal(blocksLeft(rows), 0);
  assert.equal(debris.length, n);
  assert.equal(dust.length, n * 6);
  assert.ok(debris.every((d) => d.rest === false));
});

test('крепость на крыше уходит вместе с кладкой тремя камнями', () => {
  const debris = []; const dust = [];
  collapse(tower(), null, 3, true, debris, dust);
  assert.equal(debris.length, ROWS * COLS + 3);
  assert.equal(dust.length, (ROWS * COLS + 3) * 6);
  const castle = debris.slice(-3);
  assert.deepEqual(castle.map((d) => d.tone), ['light', 'light', 'mid']);
  assert.ok(castle.every((d) => d.z === ROWS));
});

test('обломки стартуют с места своего бруска в кладке', () => {
  const rows = tower();
  const before = [];
  for (let r = 0; r < ROWS; r++) for (let i = 0; i < COLS; i++) before.push(cellPos(rows, null, r, i));
  const debris = [];
  withRandom(0.5, () => collapse(rows, null, 3, false, debris, []));
  debris.forEach((d, k) => {
    const o = before[k];
    assert.deepEqual([d.x, d.y, d.z, d.dx, d.dy, d.tone], [o.x, o.y, o.z, o.dx, o.dy, o.tone]);
  });
});

test('часть обломков разворачивается поперёк (Math.random < 0.45)', () => {
  const rows = tower();
  const before = rows.map((_, r) => cellPos(rows, null, r, 0));
  const debris = [];
  withRandom(0.3, () => collapse(rows, null, 3, false, debris, []));
  for (let r = 0; r < ROWS; r++) {
    const d = debris[r * COLS];
    assert.deepEqual([d.dx, d.dy], [before[r].dy, before[r].dx]);
  }
});

test('башня валится в сторону крена ряда-излома', () => {
  for (const [lean, dir] of [[0.5, 1], [-0.5, -1], [0, -1]]) {
    const debris = [];
    withRandom(0.5, () => collapse(tower(lean), null, 3, true, debris, []));
    assert.ok(debris.every((d) => Math.sign(d.vx) === dir && Math.sign(d.vy) === dir),
      `крен ${lean}: не все обломки летят в сторону ${dir}`);
  }
});

test('чем выше брусок над изломом, тем сильнее его выносит; крепость — с постоянной силой', () => {
  const speed = (d) => Math.hypot(d.vx, d.vy);
  const castleSpeeds = [];
  for (const pivot of [0, 3, 8]) {
    const debris = [];
    withRandom(0.5, () => collapse(tower(0.5, pivot), null, pivot, true, debris, []));
    const byRow = [];
    for (let r = 0; r < ROWS; r++) byRow.push(speed(debris[r * COLS]));
    for (let r = pivot + 2; r < ROWS; r++) assert.ok(byRow[r] > byRow[r - 1], `излом ${pivot}: ряд ${r} не дальше ряда ${r - 1}`);
    // ниже излома и сам излом — минимальный рычаг, одинаковый
    for (let r = 1; r <= pivot; r++) assert.ok(Math.abs(byRow[r] - byRow[0]) < 1e-9);
    castleSpeeds.push(...debris.slice(-3).map(speed));
  }
  // Крепость: скорость 2 по каждой оси, где бы ни был излом. Замечено:
  // комментарий в fall.js говорит «летит дальше всех», но при изломе в
  // рядах 0–3 верхний ряд кладки выносит дальше крепости (бэклог 48).
  assert.ok(castleSpeeds.every((s) => Math.abs(s - Math.hypot(2, 2)) < 1e-9));
});

test('обломки падают и ложатся в кучу: быстро, на целые клетки, без наложений', () => {
  const debris = []; let dust = [];
  collapse(tower(), null, 3, true, debris, dust);
  const pile = createPile();
  let t = 0;
  while (!debris.every((d) => d.rest) && t < 10) {
    stepDebris(debris, newCrown(), pile, dust, DT, FALL_FAST);
    dust = stepDust(dust, DT);
    t += DT;
  }
  assert.ok(t < 3, `обломки легли за ${t.toFixed(2)} с`);
  const seen = new Set();
  for (const d of debris) {
    assert.ok([d.x, d.y, d.z].every(Number.isInteger), `не на сетке: ${d.x},${d.y},${d.z}`);
    assert.deepEqual([d.vx, d.vy, d.vz], [0, 0, 0]);
    for (const k of cells(d)) { assert.ok(!seen.has(k), `клетка ${k} дважды`); seen.add(k); }
  }
});

test('лёгший обломок больше не двигается', () => {
  const debris = [];
  collapse(tower(), null, 3, false, debris, []);
  const pile = createPile();
  for (let i = 0; i < 600; i++) stepDebris(debris, newCrown(), pile, [], DT, FALL_FAST);
  const snap = JSON.stringify(debris);
  for (let i = 0; i < 120; i++) stepDebris(debris, newCrown(), pile, [], DT, FALL_FAST);
  assert.equal(JSON.stringify(debris), snap);
});

test('при неровном шаге кадра (до 0.033 с) обломки тоже ложатся все', () => {
  const debris = [];
  collapse(tower(), null, 3, true, debris, []);
  const pile = createPile();
  let t = 0; let k = 0;
  while (!debris.every((d) => d.rest) && t < 10) {
    const dt = [0.033, 0.008, 0.02][k++ % 3];
    stepDebris(debris, newCrown(), pile, [], dt, FALL_FAST);
    t += dt;
  }
  assert.ok(debris.every((d) => d.rest && d.z >= 0));
});

test('корона ложится ровно на край пола со стороны крена', () => {
  const right = runCrown(0.5).crown;
  assert.ok(Math.abs(right.x - 6.5) < 0.05 && Math.abs(right.y - 1.5) < 0.05, `${right.x},${right.y}`);
  const left = runCrown(-0.5).crown;
  assert.ok(Math.abs(left.x - 1.5) < 0.05 && Math.abs(left.y - 6.5) < 0.05, `${left.x},${left.y}`);
  for (const c of [right, left]) {
    assert.equal(c.z, 0.2);
    assert.ok(c.rest && c.landed);
    assert.deepEqual([c.vx, c.vy], [0, 0]);
  }
});

test('корона сначала касается пола, потом успокаивается; в замедлении — дольше', () => {
  const slow = runCrown(0.5, CROWN_SLOW);
  const fast = runCrown(0.5, 1);
  assert.ok(slow.landedAt < slow.restAt);
  assert.ok(Math.abs(fast.landedAt / slow.landedAt - CROWN_SLOW) < 0.02,
    `касание ${fast.landedAt.toFixed(2)} с против ${slow.landedAt.toFixed(2)} с`);
  assert.ok(slow.landedAt > 1.5 && slow.landedAt < 3, `корона летит ${slow.landedAt.toFixed(2)} с`);
});

test('корона не трогается, пока не сорвана (live = false)', () => {
  const crown = newCrown();
  for (let i = 0; i < 60; i++) stepDebris([], crown, createPile(), [], DT, 1);
  assert.deepEqual(crown, newCrown());
});

test('пыль поднимается, оседает и гаснет меньше чем за секунду', () => {
  let dust = [];
  puff(dust, { x: 1, y: 0, z: 3, dx: 3, dy: 1 });
  assert.equal(dust.length, 6);
  assert.ok(dust.every((d) => d.vz > 0 && d.life >= 0.5 && d.life <= 1 && (d.s === 2 || d.s === 4)));
  const vz0 = dust.map((d) => d.vz);
  dust = stepDust(dust, 0.25);
  dust.forEach((d, i) => assert.ok(Math.abs(d.vz - (vz0[i] - 0.5)) < 1e-9));
  let t = 0.25;
  while (dust.length && t < 5) { dust = stepDust(dust, DT); t += DT; }
  assert.equal(dust.length, 0);
  assert.ok(t <= 1 + DT, `пыль висит ${t.toFixed(2)} с`);
});

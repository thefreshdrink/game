// Тесты кладки Башни (src/minigames/tower/blocks/iso.js и tones.js): брусок
// садится на сетку зерна и ровно в размер своего спрайта, раскладка тонов
// держит правила из комментариев tones.js (золото не наверху, у пола нет
// тёмных, соседи по ряду разной семьи). Код сцены не трогается — тест
// только фиксирует то, что есть. Запуск — `npm test`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  project, cellsOf, blockRect, ROWS, COLS, U, HU, ZH, GRAIN,
} from '../src/minigames/tower/blocks/iso.js';
import { toneOf, TONES } from '../src/minigames/tower/blocks/tones.js';

const pub = (p) => fileURLToPath(new URL(`../public/${p}`, import.meta.url));

// Ширина и высота PNG из заголовка IHDR — без зависимостей.
function pngSize(path) {
  const b = readFileSync(path);
  assert.equal(b.toString('ascii', 12, 16), 'IHDR', `${path}: не PNG`);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

const FAMILY = { light: 'L', mid: 'M', dark: 'D', black: 'D', gold: 'G' };
const grid = Array.from({ length: ROWS }, (_, r) =>
  Array.from({ length: COLS }, (_, i) => toneOf(r, i)));

test('изометрия: шаги сетки кратны зерну, проекция 2:1', () => {
  for (const v of [U, HU, ZH]) assert.equal(v % GRAIN, 0, `шаг ${v}`);
  assert.equal(U, 2 * HU);
  assert.deepEqual(project(0, 0, 1, 0, 0), [U, HU]);
  assert.deepEqual(project(0, 0, 0, 1, 0), [-U, HU]);
  assert.deepEqual(project(0, 0, 0, 0, 1), [0, -ZH]);
});

test('ряды: по три бруска, чётные вдоль X, нечётные вдоль Y', () => {
  for (let r = 0; r < ROWS; r++) {
    const cells = cellsOf(r);
    assert.equal(cells.length, COLS);
    cells.forEach((c) => assert.equal(c.dx * c.dy, 3, `ряд ${r + 1}: брусок ${c.dx}×${c.dy}`));
    assert.ok(cells.every((c) => (r % 2 === 0 ? c.dx > c.dy : c.dy > c.dx)), `ряд ${r + 1}`);
  }
});

test('брусок встаёт на чётные px при дробном основании', () => {
  for (const [ox, oy] of [[0, 0], [101.7, 300.5], [195, 333.3]]) {
    for (let r = 0; r < ROWS; r++) {
      for (const c of cellsOf(r)) {
        const b = blockRect(ox, oy, { ...c, z: r });
        for (const k of ['x', 'y', 'w', 'h']) {
          assert.equal(Math.abs(b[k]) % GRAIN, 0, `ряд ${r + 1}, основание ${ox},${oy}: ${k} = ${b[k]}`);
        }
      }
    }
  }
});

test('прямоугольник бруска — ровно спрайт ×GRAIN, у каждого тона и поперечного', () => {
  const along = blockRect(0, 0, { x: 0, y: 0, z: 0, dx: 3, dy: 1 });
  const cross = blockRect(0, 0, { x: 0, y: 0, z: 0, dx: 1, dy: 3 });
  assert.deepEqual([cross.w, cross.h], [along.w, along.h]);
  for (const t of TONES) {
    for (const f of [`block_${t}.png`, `block_${t}_cross.png`]) {
      const s = pngSize(pub(`assets/tower/${f}`));
      assert.deepEqual([s.w * GRAIN, s.h * GRAIN], [along.w, along.h], `${f}: ${s.w}×${s.h}`);
    }
  }
});

test('тона: все в ходу, золото не на верхнем ряду и не чаще раза в ряд', () => {
  const used = new Set(grid.flat());
  for (const t of TONES) assert.ok(used.has(t), `тон ${t} не встречается`);
  assert.ok(!grid[ROWS - 1].includes('gold'), 'золото на верхнем ряду');
  grid.forEach((row, r) => assert.ok(row.filter((t) => t === 'gold').length <= 1, `ряд ${r + 1}: два золотых`));
});

test('тона: у пола нет тёмных, соседи по ряду разной семьи, раскладка одна и та же', () => {
  for (let r = 0; r < 2; r++) {
    grid[r].forEach((t, i) => assert.notEqual(FAMILY[t], 'D', `ряд ${r + 1}, место ${i + 1}: ${t}`));
  }
  grid.forEach((row, r) => {
    for (let i = 1; i < COLS; i++) {
      assert.notEqual(FAMILY[row[i]], FAMILY[row[i - 1]], `ряд ${r + 1}: ${row[i - 1]} рядом с ${row[i]}`);
    }
  });
  assert.equal(toneOf(0, 0), grid[0][0]);
  assert.equal(toneOf(ROWS + 5, 0), 'mid', 'за пределами кладки — запасной тон');
});

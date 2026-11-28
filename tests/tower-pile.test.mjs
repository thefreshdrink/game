// Тесты кучи обломков Башни (src/minigames/tower/pile.js, бэклог 47):
// упавший брусок ложится на ближайшее к центру основания свободное место с
// опорой — по спирали радиусом до 2 и слоями до 6-го («куча плотнее»,
// правка в чате). Код сцены не трогается — тест фиксирует то, что есть.
// Запуск — `npm test`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPile } from '../src/minigames/tower/pile.js';
import { ROWS, COLS } from '../src/minigames/tower/blocks.js';

// Брусок как в обломках: продольный (3×1) или поперечный (1×3), откуда-то
// сверху и не по сетке — куча сама кладёт его на целые клетки.
const along = (x = 0.3, y = 0.7, z = 4.6) => ({ x, y, z, dx: 3, dy: 1 });
const across = (x = 0.3, y = 0.7, z = 4.6) => ({ x, y, z, dx: 1, dy: 3 });
const mixed = (i) => (i % 2 ? along(i * 0.37, i * 0.11, 9) : across(-i * 0.21, i * 0.4, 9));

function cells(d) {
  const out = [];
  for (let a = 0; a < d.dx; a++) for (let b = 0; b < d.dy; b++) out.push(`${d.x + a},${d.y + b},${d.z}`);
  return out;
}

function drop(n, make = mixed) {
  const pile = createPile();
  const laid = [];
  for (let i = 0; i < n; i++) { const d = make(i); pile.settle(d); laid.push(d); }
  return { pile, laid };
}

test('первый брусок ложится на землю ровно по центру основания', () => {
  const a = along();
  createPile().settle(a);
  assert.deepEqual([a.x, a.y, a.z], [0, 1, 0]); // round(1.5 − 1.5), round(1.5 − 0.5)
  const b = across();
  createPile().settle(b);
  assert.deepEqual([b.x, b.y, b.z], [1, 0, 0]);
});

test('вся кладка (48 брусков) ложится на целые клетки и без наложений', () => {
  const { laid } = drop(ROWS * COLS);
  const seen = new Set();
  for (const d of laid) {
    assert.ok([d.x, d.y, d.z].every(Number.isInteger), `не на сетке: ${d.x},${d.y},${d.z}`);
    for (const k of cells(d)) {
      assert.ok(!seen.has(k), `клетка ${k} занята дважды`);
      seen.add(k);
    }
  }
});

test('на весу никто не висит: под каждым бруском выше земли есть опора', () => {
  const { laid } = drop(ROWS * COLS);
  const filled = new Set(laid.flatMap(cells));
  for (const d of laid) {
    if (d.z === 0) continue;
    const under = cells({ ...d, z: d.z - 1 });
    assert.ok(under.some((k) => filled.has(k)), `брусок ${d.x},${d.y},${d.z} без опоры`);
  }
});

test('куча плотная: не дальше двух клеток от центра и не выше 6-го слоя', () => {
  const { laid } = drop(ROWS * COLS);
  for (const d of laid) {
    const x0 = Math.round(1.5 - d.dx / 2);
    const y0 = Math.round(1.5 - d.dy / 2);
    assert.ok(Math.abs(d.x - x0) <= 2 && Math.abs(d.y - y0) <= 2, `далеко: ${d.x},${d.y}`);
    assert.ok(d.z >= 0 && d.z <= 6, `слой ${d.z}`);
  }
  // и растёт вверх, а не расползается: слоёв больше одного
  assert.ok(Math.max(...laid.map((d) => d.z)) >= 3);
});

test('сначала заполняется слой у земли, потом следующий', () => {
  const { laid } = drop(ROWS * COLS);
  laid.forEach((d, i) => {
    if (i === 0) return;
    assert.ok(d.z >= laid[i - 1].z - 1, `брусок ${i} ушёл вниз на ${laid[i - 1].z - d.z} слоя`);
  });
  assert.equal(laid[0].z, 0);
});

test('занятое стопкой сбоку (claim) куча обходит', () => {
  const pile = createPile();
  const stack = { x: 0, y: 1, z: 0, dx: 3, dy: 1 };
  pile.claim(stack);
  const d = along();
  pile.settle(d);
  const taken = new Set(cells(stack));
  assert.ok(cells(d).every((k) => !taken.has(k)), `лёг на стопку: ${d.x},${d.y},${d.z}`);
});

test('reset очищает кучу: следующий брусок снова ложится в центр', () => {
  const pile = createPile();
  for (let i = 0; i < 10; i++) pile.settle(mixed(i));
  pile.reset();
  const a = along();
  pile.settle(a);
  assert.deepEqual([a.x, a.y, a.z], [0, 1, 0]);
});

test('куча одинаковая каждый заход: место не зависит от того, откуда брусок упал', () => {
  const a = drop(20).laid.map((d) => [d.x, d.y, d.z]);
  const b = drop(20, (i) => ({ ...mixed(i), x: 100 - i, y: -50 + i })).laid.map((d) => [d.x, d.y, d.z]);
  assert.deepEqual(a, b);
});

test('когда места в куче нет, брусок ложится на землю там, где упал', () => {
  // Запас кучи больше кладки: при 48 брусках сюда не доходит. Фиксируем
  // запасной путь — брусок не теряется и не висит в воздухе.
  const { pile } = drop(200, () => along());
  const d = along(7.4, -3.6, 5);
  pile.settle(d);
  assert.deepEqual([d.x, d.y, d.z], [7, -4, 0]);
});

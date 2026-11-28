// Тесты устойчивости Башни (src/minigames/tower/release/masonry.js, бэклог
// 44): когда ряд проседает, когда башня ломается и на каком ряду, как
// просадка сдвигает верх, как выдвигается вытягиваемый брусок и как растёт
// напряжение (по нему нарастает дрожь). Код сцены не трогается — тест только
// фиксирует то, что есть. Запуск — `npm test`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildRows, shiftAt, cellPos, updateStability, tension,
} from '../src/minigames/tower/release/masonry.js';
import { cellsOf, ROWS, COLS } from '../src/minigames/tower/blocks.js';

// Насколько выезжает брусок под пальцем — PULL_DIST из release.js (не
// экспортируется, читаем из исходника, чтобы тест шёл за числом).
const PULL_DIST = Number(readFileSync(new URL('../src/minigames/tower/release.js', import.meta.url), 'utf8')
  .match(/const PULL_DIST = ([\d.]+)/)[1]);

// Ровная кладка без случайного выдвижения.
function freshRows() {
  return Array.from({ length: ROWS }, (_, r) => ({
    r, slots: [1, 1, 1], lean: 0, leanTo: 0, jitter: [0, 0, 0],
  }));
}

// Кладка из buildRows при заданном Math.random (выдвиг пары брусков).
function builtWith(rand) {
  const orig = Math.random;
  Math.random = () => rand;
  try { return buildRows(); } finally { Math.random = orig; }
}

// Шаг сцены, пока наклоны не дойдут до цели: как в release.js, dt 1/60.
// Возвращает первый ряд-излом или −1.
function settle(rows, pulling = null) {
  for (let k = 0; k < 600; k++) {
    const p = updateStability(rows, pulling);
    if (p >= 0) return p;
    rows.forEach((row) => { row.lean += (row.leanTo - row.lean) * Math.min(1, 4 / 60); });
  }
  return updateStability(rows, pulling);
}

const keepOnly = (keep) => [0, 1, 2].map((i) => (keep.includes(i) ? 1 : 0));

test('свежая кладка: 16 рядов по три, без наклона, выдвиг пары брусков до 0.22, стоит', () => {
  for (const rand of [0, 0.29, 0.3, 0.999]) {
    const rows = builtWith(rand);
    assert.equal(rows.length, ROWS);
    rows.forEach((row, r) => {
      assert.equal(row.r, r);
      assert.deepEqual(row.slots, [1, 1, 1]);
      assert.equal(row.lean, 0);
      assert.equal(row.leanTo, 0);
      assert.equal(row.jitter.length, COLS);
      for (const j of row.jitter) assert.ok(j >= 0 && j < 0.22, `ряд ${r}: выдвиг ${j}`);
    });
    assert.equal(settle(rows), -1, `Math.random=${rand}: свежая башня упала`);
    assert.equal(tension(rows), 0);
  }
});

test('два бруска в ряду держат: ряд не проседает, башня стоит', () => {
  for (const keep of [[0, 1], [0, 2], [1, 2]]) {
    for (let r = 0; r < ROWS; r++) {
      const rows = freshRows();
      rows[r].slots = keepOnly(keep);
      assert.equal(settle(rows), -1, `ряд ${r}, остались ${keep}`);
      assert.equal(rows[r].leanTo, 0);
    }
  }
  // Даже если так выбрать средний брусок у всех рядов сразу.
  const rows = freshRows();
  rows.forEach((row) => { row.slots = [1, 0, 1]; });
  assert.equal(settle(rows), -1);
});

test('один брусок в ряду: средний держит, крайний ломает башню на этом ряду', () => {
  for (let r = 0; r < ROWS; r++) {
    const mid = freshRows();
    mid[r].slots = keepOnly([1]);
    assert.equal(settle(mid), -1, `ряд ${r}: средний не удержал`);
    assert.equal(mid[r].leanTo, 0);

    for (const [i, side] of [[0, -0.5], [2, 0.5]]) {
      const rows = freshRows();
      rows[r].slots = keepOnly([i]);
      updateStability(rows, null);
      assert.equal(rows[r].leanTo, side, `ряд ${r}: проседает на сторону оставшегося`);
      // Верхнему ряду нечего ронять — над ним пусто.
      assert.equal(settle(rows), r === ROWS - 1 ? -1 : r, `ряд ${r}, остался ${i}`);
    }
  }
});

test('пустой ряд — излом на нём; из нескольких — нижний', () => {
  for (let r = 0; r < ROWS; r++) {
    const rows = freshRows();
    rows[r].slots = [0, 0, 0];
    assert.equal(updateStability(rows, null), r);
  }
  const rows = freshRows();
  rows[9].slots = [0, 0, 0];
  rows[4].slots = [0, 0, 0];
  assert.equal(updateStability(rows, null), 4);
});

test('просадка: чётный ряд сдвигает верх по y, нечётный по x, только то, что выше', () => {
  const rows = freshRows();
  rows[2].lean = 0.5;
  rows[3].lean = -0.25;
  rows[6].lean = 0.1;
  assert.deepEqual(shiftAt(rows, 0), [0, 0]);
  assert.deepEqual(shiftAt(rows, 2), [0, 0], 'свой наклон ряд не сдвигает');
  assert.deepEqual(shiftAt(rows, 3), [0, 0.5]);
  assert.deepEqual(shiftAt(rows, 4), [-0.25, 0.5]);
  assert.deepEqual(shiftAt(rows, 7), [-0.25, 0.6]);
  // cellPos несёт тот же сдвиг поверх места на сетке.
  const c = cellsOf(5)[1];
  const p = cellPos(rows, null, 5, 1);
  assert.deepEqual([p.x, p.y, p.z], [c.x - 0.25, c.y + 0.5, 5]);
});

test('выдвиг: брусок едет вдоль своего ряда — чётный по x, нечётный по y; только вытягиваемый', () => {
  const rows = freshRows();
  rows[4].jitter = [0, 0.15, 0];
  rows[5].jitter = [0.2, 0, 0];
  const at = (r, i, pulling = null) => cellPos(rows, pulling, r, i);
  const c4 = cellsOf(4)[1];
  const c5 = cellsOf(5)[0];
  assert.deepEqual([at(4, 1).x, at(4, 1).y], [c4.x + 0.15, c4.y]);
  assert.deepEqual([at(5, 0).x, at(5, 0).y], [c5.x, c5.y + 0.2]);
  const pull4 = { r: 4, i: 1, out: 1 };
  assert.deepEqual([at(4, 1, pull4).x, at(4, 1, pull4).y], [c4.x + 1.15, c4.y]);
  const pull5 = { r: 5, i: 0, out: 1 };
  assert.deepEqual([at(5, 0, pull5).x, at(5, 0, pull5).y], [c5.x, c5.y + 1.2]);
  // Соседи вытягиваемого стоят на месте.
  const c4n = cellsOf(4)[0];
  assert.deepEqual([at(4, 0, pull4).x, at(4, 0, pull4).y], [c4n.x, c4n.y]);
});

test('вытягивание из целой кладки само башню не роняет — ни один брусок, ни на какую длину', () => {
  assert.ok(PULL_DIST > 0, 'PULL_DIST не нашёлся в release.js');
  for (let r = 0; r < ROWS; r++) {
    for (let i = 0; i < COLS; i++) {
      for (const out of [0.5, PULL_DIST / 2, PULL_DIST]) {
        const rows = freshRows();
        assert.equal(updateStability(rows, { r, i, out }), -1, `ряд ${r}, брусок ${i}, выдвиг ${out}`);
      }
    }
  }
});

test('напряжение: 0 у целой, +1/16 за вынутый брусок, наклон добавляет, не больше 1', () => {
  const rows = freshRows();
  assert.equal(tension(rows), 0);
  rows[3].slots = [1, 0, 1];
  assert.equal(tension(rows), 1 / 16);
  rows[7].slots = [0, 1, 1];
  assert.equal(tension(rows), 2 / 16);
  rows[7].lean = 0.3;
  assert.ok(Math.abs(tension(rows) - (2 / 16 + 0.1)) < 1e-12);
  rows[7].lean = -0.3;
  assert.ok(Math.abs(tension(rows) - (2 / 16 + 0.1)) < 1e-12, 'наклон в любую сторону');
  const many = freshRows();
  many.forEach((row) => { row.slots = [1, 0, 1]; });
  assert.equal(tension(many), 1);
});

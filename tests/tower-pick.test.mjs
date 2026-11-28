// Тесты выбора бруска Башни под пальцем (src/minigames/tower/release/pick.js,
// бэклог 41). Выбирается тот брусок, что ВИДЕН в точке касания: правка 30.09
// исправила ошибку, когда касание передней грани бруска отдавалось верхней
// грани бруска под ним. Код сцены не трогается — тест фиксирует то, что есть.
// Запуск — `npm test`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickAt } from '../src/minigames/tower/release/pick.js';
import { cellPos } from '../src/minigames/tower/release/masonry.js';
import { facesOf, ROWS, COLS } from '../src/minigames/tower/blocks.js';

// Ровная кладка без случайного выдвижения (buildRows берёт Math.random).
function freshRows() {
  return Array.from({ length: ROWS }, (_, r) => ({
    r, slots: [1, 1, 1], lean: 0, leanTo: 0, jitter: [0, 0, 0],
  }));
}

// Основание — как в сцене: по центру экрана, на чётных px. Две ширины экрана.
const BASES = [[195, 640], [720, 700]];

const center = (pts) => [
  pts.reduce((a, p) => a + p[0], 0) / pts.length,
  pts.reduce((a, p) => a + p[1], 0) / pts.length,
];
const face = (rows, pulling, bx, by, r, i, name) =>
  center(facesOf(bx, by, cellPos(rows, pulling, r, i))[name]);

test('мимо башни — ничего не выбрано', () => {
  const rows = freshRows();
  for (const [bx, by] of BASES) {
    assert.equal(pickAt(rows, null, bx, by, bx, by + 200), null, 'под основанием');
    assert.equal(pickAt(rows, null, bx, by, bx - 300, by - 100), null, 'слева');
    assert.equal(pickAt(rows, null, bx, by, bx, by - ROWS * 24 - 200), null, 'над верхом');
  }
});

test('верхний ряд: касание верхней грани выбирает этот брусок', () => {
  const rows = freshRows();
  const r = ROWS - 1;
  for (const [bx, by] of BASES) {
    for (let i = 0; i < COLS; i++) {
      const [x, y] = face(rows, null, bx, by, r, i, 'top');
      assert.deepEqual(pickAt(rows, null, bx, by, x, y), { r, i }, `брусок ${i}`);
    }
  }
});

test('передняя и правая грани крайних брусков выбирают их самих', () => {
  const rows = freshRows();
  for (const [bx, by] of BASES) {
    for (let r = 0; r < ROWS; r++) {
      for (let i = 0; i < COLS; i++) {
        const o = cellPos(rows, null, r, i);
        if (o.y + o.dy === 3) {
          const [x, y] = face(rows, null, bx, by, r, i, 'front');
          assert.deepEqual(pickAt(rows, null, bx, by, x, y), { r, i }, `ряд ${r + 1}, брусок ${i}, перед`);
        }
        if (o.x + o.dx === 3) {
          const [x, y] = face(rows, null, bx, by, r, i, 'right');
          assert.deepEqual(pickAt(rows, null, bx, by, x, y), { r, i }, `ряд ${r + 1}, брусок ${i}, бок`);
        }
      }
    }
  }
});

test('правка 30.09: верх закрытого бруска отдаётся бруску, который его закрывает', () => {
  // В целой башне верх каждого ряда, кроме последнего, закрыт рядом выше.
  // Касание там — касание видимого бруска выше, а не того, что под ним.
  const rows = freshRows();
  for (const [bx, by] of BASES) {
    for (let r = 0; r < ROWS - 1; r++) {
      for (let i = 0; i < COLS; i++) {
        const [x, y] = face(rows, null, bx, by, r, i, 'top');
        const hit = pickAt(rows, null, bx, by, x, y);
        assert.ok(hit && hit.r > r, `ряд ${r + 1}, брусок ${i}: выбран ${JSON.stringify(hit)}`);
      }
    }
  }
});

test('вынутый брусок больше не выбирается', () => {
  const rows = freshRows();
  const [bx, by] = BASES[0];
  for (const [r, i] of [[0, 2], [5, 1], [8, 2], [ROWS - 1, 0]]) {
    const before = cellPos(rows, null, r, i);
    rows[r].slots[i] = 0;
    for (const name of ['top', 'front', 'right']) {
      const [x, y] = center(facesOf(bx, by, before)[name]);
      const hit = pickAt(rows, null, bx, by, x, y);
      assert.ok(!hit || !(hit.r === r && hit.i === i), `ряд ${r + 1}, брусок ${i}, ${name}`);
      if (hit) assert.equal(rows[hit.r].slots[hit.i], 1, 'выбран только стоящий брусок');
    }
    rows[r].slots[i] = 1;
  }
});

test('вытягиваемый брусок ловится там, куда он выдвинут', () => {
  const rows = freshRows();
  const [bx, by] = BASES[0];
  // Средний брусок: в целой башне спрятан, выдвинутый на 1.5 — торчит наружу.
  for (const r of [4, 7]) {
    const pulling = { r, i: 1, t: 0, out: 1.5 };
    const name = r % 2 === 0 ? 'right' : 'front';
    const [x, y] = face(rows, pulling, bx, by, r, 1, name);
    assert.deepEqual(pickAt(rows, pulling, bx, by, x, y), { r, i: 1 }, `ряд ${r + 1}`);
  }
});

test('любое попадание — стоящий брусок, и точка лежит на его гранях', () => {
  // Сетка точек по всей башне с шагом 6px: выбор согласован с геометрией.
  const rows = freshRows();
  rows[3].slots[0] = 0;
  rows[6].slots[2] = 0;
  rows[9].slots[1] = 0;
  const [bx, by] = BASES[1];
  let hits = 0;
  for (let y = by - ROWS * 24 - 60; y <= by + 120; y += 6) {
    for (let x = bx - 120; x <= bx + 120; x += 6) {
      const hit = pickAt(rows, null, bx, by, x, y);
      if (!hit) continue;
      hits++;
      assert.equal(rows[hit.r].slots[hit.i], 1);
      const f = facesOf(bx, by, cellPos(rows, null, hit.r, hit.i));
      const xs = [...f.top, ...f.front, ...f.right].map((p) => p[0]);
      const ys = [...f.top, ...f.front, ...f.right].map((p) => p[1]);
      assert.ok(x >= Math.min(...xs) && x <= Math.max(...xs) && y >= Math.min(...ys) && y <= Math.max(...ys),
        `(${x}, ${y}) вне бруска ${JSON.stringify(hit)}`);
    }
  }
  assert.ok(hits > 300, `попаданий ${hits}`);
});

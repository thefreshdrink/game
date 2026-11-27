// Тесты изометрии Башни (src/minigames/tower/blocks/iso.js, бэклог 66):
// проекция 2:1 (шаг U вправо, HU вниз, ZH вверх на ряд); ряды кладутся
// крест-накрест — чётный вдоль X, нечётный вдоль Y, по три бруска, без
// щелей и наложений; три видимые грани бруска сходятся в общих вершинах;
// экранный прямоугольник длинного бруска — ровно 128×88 (спрайт 64×44 ×2)
// и всегда на чётной сетке зерна, даже при дробном основании; палитра —
// только из таблицы CLAUDE.md. Без браузера: node:test, контекст канваса —
// заглушка-журнал. Код сцены не трогается — тест фиксирует то, что есть.
// Запуск — `npm test`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  U, HU, ZH, ROWS, COLS, GRAIN,
  BODY, LINE, LINE2, TEX, FAR, UI, ACCENT, GOLD_SHADE,
  project, cellsOf, facesOf, poly, edge, blockRect,
} from '../src/minigames/tower/blocks/iso.js';

const PALETTE = new Set([
  '#111111', '#000000', '#FFFFFF', '#B8B8B8', '#4A4A4A', '#808080',
  '#161616', '#1C1C1C', '#212121', '#252525', '#2A2A2A', '#2E2E2E',
  '#EBA331', '#B07A1C',
  '#232323', // исключение для кладки Башни (решение 2026-10-18)
]);

test('шаги сетки: изометрия 2:1, всё чётное, ×2 от сетки спрайта', () => {
  assert.equal(U, 2 * HU);
  for (const v of [U, HU, ZH, GRAIN]) assert.equal(v % 2, 0, `${v} нечётный`);
  assert.equal(GRAIN, 2);
  assert.equal(U, 16 * GRAIN);   // --unit 16
  assert.equal(ZH, 12 * GRAIN);  // --row 12
  assert.equal(COLS, 3);
  assert.ok(ROWS > 0 && Number.isInteger(ROWS));
});

test('палитра изометрии — только цвета из таблицы', () => {
  for (const c of [BODY, LINE, LINE2, TEX, FAR, UI, ACCENT, GOLD_SHADE]) {
    assert.ok(PALETTE.has(c.toUpperCase()), `${c} вне палитры`);
  }
  // оранжевый — только акцент, тень золота — только своя
  assert.equal(ACCENT, '#EBA331');
  assert.equal(GOLD_SHADE, '#B07A1C');
});

test('project: основание в (ox,oy), x вправо-вниз, y влево-вниз, z вверх', () => {
  assert.deepEqual(project(100, 200, 0, 0, 0), [100, 200]);
  assert.deepEqual(project(0, 0, 1, 0, 0), [U, HU]);
  assert.deepEqual(project(0, 0, 0, 1, 0), [-U, HU]);
  assert.deepEqual(project(0, 0, 0, 0, 1), [0, -ZH]);
  // линейность: сумма сдвигов
  const [x, y] = project(7, 9, 2, 3, 4);
  assert.deepEqual([x, y], [7 + (2 - 3) * U, 9 + (2 + 3) * HU - 4 * ZH]);
  // равные x и y — точка на вертикали основания
  assert.equal(project(50, 0, 3, 3, 0)[0], 50);
});

test('cellsOf: три бруска на ряд, чётный вдоль X, нечётный вдоль Y', () => {
  for (const r of [0, 2, ROWS - 2]) {
    const cells = cellsOf(r);
    assert.equal(cells.length, COLS);
    cells.forEach((c, i) => assert.deepEqual(c, { x: 0, y: i, dx: 3, dy: 1 }));
  }
  for (const r of [1, 3, ROWS - 1]) {
    const cells = cellsOf(r);
    assert.equal(cells.length, COLS);
    cells.forEach((c, i) => assert.deepEqual(c, { x: i, y: 0, dx: 1, dy: 3 }));
  }
});

test('cellsOf: ряд закрывает квадрат 3×3 целиком, без щелей и наложений', () => {
  for (const r of [0, 1]) {
    const seen = new Map();
    for (const c of cellsOf(r)) {
      for (let x = c.x; x < c.x + c.dx; x++) {
        for (let y = c.y; y < c.y + c.dy; y++) {
          const k = `${x},${y}`;
          seen.set(k, (seen.get(k) || 0) + 1);
        }
      }
    }
    assert.equal(seen.size, 9, `ряд ${r}: закрыто ${seen.size} клеток из 9`);
    for (const [k, n] of seen) assert.equal(n, 1, `ряд ${r}: клетка ${k} занята ${n} раз`);
    for (const k of seen.keys()) {
      const [x, y] = k.split(',').map(Number);
      assert.ok(x >= 0 && x < 3 && y >= 0 && y < 3, `ряд ${r}: ${k} за квадратом`);
    }
  }
});

test('cellsOf: новый массив на каждый вызов', () => {
  const a = cellsOf(0);
  a[0].x = 99;
  assert.equal(cellsOf(0)[0].x, 0);
});

test('facesOf: три грани по четыре вершины, верх на z+1, общие рёбра сходятся', () => {
  const o = { x: 1, y: 0, z: 2, dx: 1, dy: 3 };
  const f = facesOf(10, 20, o);
  for (const k of ['top', 'right', 'front']) assert.equal(f[k].length, 4);
  const P = (a, b, c) => project(10, 20, a, b, c);
  assert.deepEqual(f.top[0], P(1, 0, 3));
  assert.deepEqual(f.top[2], P(2, 3, 3));
  assert.deepEqual(f.right[2], P(2, 3, 2));
  assert.deepEqual(f.front[3], P(1, 3, 2));
  // ребро верх/право: (x1,y,z1)-(x1,y1,z1)
  assert.deepEqual(f.right[0], f.top[1]);
  assert.deepEqual(f.right[1], f.top[2]);
  // ребро верх/перед: (x,y1,z1)-(x1,y1,z1)
  assert.deepEqual(f.front[0], f.top[3]);
  assert.deepEqual(f.front[1], f.top[2]);
  // ребро право/перед — вертикаль в ближнем углу
  assert.deepEqual(f.front[2], f.right[2]);
  assert.equal(f.front[1][0], f.front[2][0]);
  assert.equal(f.front[2][1] - f.front[1][1], ZH);
});

test('blockRect: длинный брусок — ровно 128×88 в обоих направлениях', () => {
  for (const r of [0, 1]) {
    for (const c of cellsOf(r)) {
      const rect = blockRect(0, 0, { ...c, z: r });
      assert.equal(rect.w, (c.dx + c.dy) * U);
      assert.equal(rect.h, (c.dx + c.dy) * HU + ZH);
      assert.deepEqual([rect.w, rect.h], [128, 88]);
    }
  }
});

test('blockRect: всегда на чётной сетке зерна, даже при дробном основании', () => {
  const bases = [[0, 0], [0.5, 0.5], [101.3, 377.7], [-13.9, 2.49], [195, 421]];
  for (const [ox, oy] of bases) {
    for (let r = 0; r < ROWS; r++) {
      for (const c of cellsOf(r)) {
        const rect = blockRect(ox, oy, { ...c, z: r });
        for (const k of ['x', 'y', 'w', 'h']) {
          assert.ok(Number.isInteger(rect[k]), `${k}=${rect[k]} не целое`);
          assert.equal(Math.abs(rect[k]) % GRAIN, 0, `${k}=${rect[k]} не на сетке`);
        }
      }
    }
  }
});

test('blockRect: соседи в ряду и ряды друг над другом без щелей', () => {
  // соседи вдоль Y в чётном ряду сдвинуты ровно на (-U, HU)
  const [a, b] = cellsOf(0).map((c) => blockRect(200, 300, { ...c, z: 0 }));
  assert.equal(b.x - a.x, -U);
  assert.equal(b.y - a.y, HU);
  // тот же брусок рядом выше — ровно на ZH
  const c0 = cellsOf(0)[0];
  const lo = blockRect(200, 300, { ...c0, z: 0 });
  const hi = blockRect(200, 300, { ...c0, z: 2 });
  assert.equal(lo.y - hi.y, 2 * ZH);
  assert.equal(lo.x, hi.x);
});

// Заглушка контекста: пишет вызовы и цвет/ширину на момент вызова.
function logCtx() {
  const log = [];
  const ctx = {
    fillStyle: null, strokeStyle: null, lineWidth: null,
    beginPath: () => log.push(['beginPath']),
    moveTo: (x, y) => log.push(['moveTo', x, y]),
    lineTo: (x, y) => log.push(['lineTo', x, y]),
    closePath: () => log.push(['closePath']),
    fill: () => log.push(['fill', ctx.fillStyle]),
    stroke: () => log.push(['stroke', ctx.strokeStyle, ctx.lineWidth]),
  };
  return { ctx, log };
}

test('poly: замкнутый многоугольник из первой точки, залит своим цветом', () => {
  const { ctx, log } = logCtx();
  poly(ctx, [[0, 0], [4, 0], [4, 2]], BODY);
  assert.deepEqual(log, [
    ['beginPath'], ['moveTo', 0, 0], ['lineTo', 4, 0], ['lineTo', 4, 2],
    ['closePath'], ['fill', BODY],
  ]);
});

test('edge: одна линия, ширина по умолчанию 2 (двойной контур)', () => {
  const { ctx, log } = logCtx();
  edge(ctx, [0, 0], [6, 4], LINE);
  assert.deepEqual(log, [['beginPath'], ['moveTo', 0, 0], ['lineTo', 6, 4], ['stroke', LINE, 2]]);
  const second = logCtx();
  edge(second.ctx, [0, 0], [2, 0], LINE2, 1);
  assert.deepEqual(second.log.at(-1), ['stroke', LINE2, 1]);
});

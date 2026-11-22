// Тесты пиксельного градиента пустоты (src/core/voidGradient.js, бэклог 52):
// фон экранов 1 и 2 — полосы высотой в ячейку от topFrac до низа, тон ползёт
// по «градациям пустоты» сверху вниз, между двумя тонами решает матрица Bayer.
// Без браузера: node:test, canvas — заглушка. Код не трогается — тест
// фиксирует то, что есть. Запуск — `npm test`.

import { test } from 'node:test';
import assert from 'node:assert/strict';

const VOID = ['#111111', '#161616', '#1C1C1C', '#212121', '#252525', '#2A2A2A', '#2E2E2E'];

// Заглушка document.createElement('canvas'): узор ряда рисуется в маленький
// холст — запоминаем, какими цветами залиты его 4 ячейки.
let created = 0;
globalThis.document = {
  createElement() {
    created++;
    const cells = [];
    const g = {
      fillStyle: null,
      fillRect(x, y, w, h) { cells.push({ x, y, w, h, c: this.fillStyle }); },
    };
    return { width: 0, height: 0, cells, getContext: () => g };
  },
};

const { drawVoidGradient } = await import('../src/core/voidGradient.js');

/** Экранный контекст: полосы с цветом (или узором) и абсолютным y, баланс save/restore. */
function screen() {
  const log = { rows: [], depth: 0, maxDepth: 0, alpha: [], ty: 0 };
  const ctx = {
    fillStyle: null,
    globalAlpha: 1,
    save() { log.depth++; log.maxDepth = Math.max(log.maxDepth, log.depth); },
    restore() { log.depth--; },
    translate(x, y) { assert.equal(x, 0); log.ty += y; },
    createPattern(canvas, rep) { return { canvas, rep }; },
    fillRect(x, y, w, h) {
      log.alpha.push(this.globalAlpha);
      log.rows.push({ x, y: y + log.ty, w, h, fill: this.fillStyle });
    },
  };
  return { ctx, log };
}

/** Тона полосы: один цвет или пара цветов узора. */
function tones(row) {
  if (typeof row.fill === 'string') return [row.fill];
  return [...new Set(row.fill.canvas.cells.map((c) => c.c))];
}

test('alpha 0 и ниже — ничего не рисуется; выше 1 — как 1', () => {
  for (const alpha of [0, -0.5]) {
    const { ctx, log } = screen();
    drawVoidGradient(ctx, 100, 200, { alpha });
    assert.equal(log.rows.length, 0);
    assert.equal(log.maxDepth, 0);
  }
  const { ctx, log } = screen();
  drawVoidGradient(ctx, 100, 200, { alpha: 3, breatheAmp: 0 });
  assert.ok(log.rows.length > 0);
  assert.ok(log.alpha.every((a) => a === 1));
});

test('полосы во всю ширину от topFrac до низа, высотой в ячейку, последняя обрезана по низу', () => {
  const { ctx, log } = screen();
  drawVoidGradient(ctx, 390, 844, { breatheAmp: 0, topFrac: 0.5 });
  const top = Math.round(844 * 0.5 / 8) * 8; // 424
  assert.equal(log.rows[0].y, top);
  log.rows.forEach((r, i) => {
    assert.equal(r.x, 0);
    assert.equal(r.w, 390);
    assert.equal(r.y, top + i * 8);
  });
  const last = log.rows.at(-1);
  assert.equal(last.y + last.h, 844);
  assert.equal(last.h, 844 - last.y);
  assert.ok(log.rows.slice(0, -1).every((r) => r.h === 8));
  // начало градиента на сетке ячейки
  assert.equal(top % 8, 0);
});

test('сверху тон фона #111111, снизу самый светлый; в полосе два соседних тона, вниз светлеет', () => {
  const { ctx, log } = screen();
  drawVoidGradient(ctx, 100, 800, { breatheAmp: 0, topFrac: 0 });
  assert.ok(tones(log.rows[0]).includes('#111111'));
  assert.deepEqual(tones(log.rows.at(-1)), ['#2E2E2E']);
  const mean = [];
  for (const r of log.rows) {
    const idx = tones(r).map((c) => VOID.indexOf(c));
    assert.ok(idx.every((k) => k >= 0), `цвет вне градаций пустоты: ${tones(r)}`);
    assert.ok(Math.max(...idx) - Math.min(...idx) <= 1);
    const cells = typeof r.fill === 'string' ? [r.fill] : r.fill.canvas.cells.map((c) => c.c);
    mean.push(cells.reduce((s, c) => s + VOID.indexOf(c), 0) / cells.length);
  }
  // дизер шумит от ряда к ряду, но по четвертям экрана тон растёт
  const q = (i) => {
    const part = mean.slice(Math.floor(mean.length * i / 4), Math.floor(mean.length * (i + 1) / 4));
    return part.reduce((s, v) => s + v, 0) / part.length;
  };
  assert.ok(q(0) < q(1) && q(1) < q(2) && q(2) < q(3), [q(0), q(1), q(2), q(3)].join(' '));
});

test('maxLevel ограничивает яркость, но не ниже второго тона', () => {
  const at = (maxLevel) => {
    const { ctx, log } = screen();
    drawVoidGradient(ctx, 100, 800, { breatheAmp: 0, topFrac: 0, maxLevel });
    return Math.max(...log.rows.flatMap((r) => tones(r).map((c) => VOID.indexOf(c))));
  };
  assert.equal(at(3), 3);
  assert.equal(at(0), 1);
  assert.equal(at(99), 6);
});

test('узор ряда — 4 ячейки по матрице Bayer, repeat-x, полоса возвращается translate на место', () => {
  const { ctx, log } = screen();
  drawVoidGradient(ctx, 100, 800, { breatheAmp: 0, topFrac: 0, cell: 2 });
  const patterned = log.rows.filter((r) => typeof r.fill !== 'string');
  assert.ok(patterned.length > 0);
  for (const r of patterned) {
    assert.equal(r.fill.rep, 'repeat-x');
    const cells = r.fill.canvas.cells;
    assert.equal(cells.length, 4);
    cells.forEach((c, i) => assert.deepEqual([c.x, c.y, c.w, c.h], [i * 2, 0, 2, 2]));
  }
  assert.equal(log.ty, 0);
  assert.equal(log.depth, 0);
  assert.equal(log.maxDepth, 1);
});

test('узоры кешируются: второй кадр не создаёт холстов', () => {
  const draw = () => {
    const { ctx } = screen();
    drawVoidGradient(ctx, 390, 844, { breatheAmp: 0, cell: 6 });
  };
  draw();
  const after1 = created;
  assert.ok(after1 > 0);
  draw();
  assert.equal(created, after1);
});

test('дыхание сдвигает тона на целые ячейки и возвращается через период', () => {
  const rowsAt = (t) => {
    const { ctx, log } = screen();
    drawVoidGradient(ctx, 100, 800, { topFrac: 0.25, t, breatheAmp: 16, breathePeriod: 8 });
    return log.rows.map((r) => ({ y: r.y, solid: typeof r.fill === 'string', tones: tones(r).join() }));
  };
  const t0 = rowsAt(0);
  const t2 = rowsAt(2); // пик: sin = 1 → сдвиг 16 px = 2 ячейки
  // полосы стоят на месте, меняется только тон
  assert.deepEqual(t2.map((r) => r.y), t0.map((r) => r.y));
  assert.notDeepEqual(t2.map((r) => r.tones), t0.map((r) => r.tones));
  // сдвиг на 2 ячейки: каждая сплошная полоса в покое (тон ровно на ступени
  // палитры) на пике оказывается на 2 полосы выше с тем же тоном
  const solidAt0 = t0.map((r, k) => (r.solid ? k : -1)).filter((k) => k >= 2);
  assert.ok(solidAt0.length >= 2);
  for (const k of solidAt0) {
    assert.ok(t2[k - 2].solid, `полоса ${k - 2}`);
    assert.equal(t2[k - 2].tones, t0[k].tones);
  }
  assert.deepEqual(rowsAt(8), t0);
});

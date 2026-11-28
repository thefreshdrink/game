// Тесты жестовых знаков src/core/gestureGlyph.js: кольцо удержания (Шут на
// последнем краю, бутон Императрицы), стрелка свайпа (подсказка Шута у
// щели), искра и точка тапа. Знаки рисуются кодом по арт-пикселям, без
// ассетов — правка здесь меняет подсказки сразу в двух мини-играх.
// Без браузера: вместо canvas — заглушка, которая записывает fillRect вместе
// с цветом и прозрачностью. Запуск — `npm test`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  drawHoldRing, drawSwipeTick, drawTapStar, drawTapDot,
} from '../src/core/gestureGlyph.js';

const DIM = '#808080';
const FILL = '#EBA331';
const WHITE = '#FFFFFF';

function fakeCtx() {
  const rects = [];
  const stack = [];
  return {
    rects,
    fillStyle: '#000000',
    globalAlpha: 1,
    get depth() { return stack.length; },
    save() { stack.push({ fillStyle: this.fillStyle, globalAlpha: this.globalAlpha }); },
    restore() { Object.assign(this, stack.pop()); },
    fillRect(x, y, w, h) {
      rects.push({ x, y, w, h, c: this.fillStyle, a: this.globalAlpha });
    },
  };
}

// Ячейки в арт-пикселях относительно центра (cx, cy) в экранных px.
function cells(ctx, cx, cy) {
  const ax = Math.round(cx / 2), ay = Math.round(cy / 2);
  return ctx.rects.map((r) => ({ dx: r.x / 2 - ax, dy: r.y / 2 - ay, c: r.c, a: r.a }));
}
const key = (p) => `${p.dx},${p.dy}`;
function uniq(list) {
  const m = new Map();
  for (const p of list) m.set(key(p), p);
  return [...m.values()];
}

// Общие правила графического языка: ячейка 2×2 экранных px по чётной сетке,
// save/restore парные, цвет и прозрачность после вызова как до него.
function assertGrid(ctx) {
  assert.ok(ctx.rects.length > 0, 'что-то нарисовано');
  for (const r of ctx.rects) {
    assert.equal(r.w, 2); assert.equal(r.h, 2);
    assert.equal(r.x % 2, 0, `x=${r.x} на чётной сетке`);
    assert.equal(r.y % 2, 0, `y=${r.y} на чётной сетке`);
  }
  assert.equal(ctx.depth, 0, 'save/restore парные');
  assert.equal(ctx.fillStyle, '#000000');
  assert.equal(ctx.globalAlpha, 1);
}

test('кольцо: пиксельный круг радиуса R, симметричный на восемь сторон, без дыр', () => {
  for (const R of [8, 13, 16]) {
    const ctx = fakeCtx();
    drawHoldRing(ctx, 200, 300, 0, 1, R);
    assertGrid(ctx);
    const pts = uniq(cells(ctx, 200, 300));
    const set = new Set(pts.map(key));
    for (const { dx, dy } of pts) {
      assert.ok(Math.abs(Math.hypot(dx, dy) - R) < 1, `R=${R}: (${dx},${dy}) на окружности`);
      for (const [mx, my] of [[-dx, dy], [dx, -dy], [dy, dx]]) {
        assert.ok(set.has(`${mx},${my}`), `R=${R}: зеркало (${mx},${my}) есть`);
      }
      // замкнутый контур: у каждой точки ровно два-три соседа по 8 сторонам
      let nb = 0;
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
        if ((i || j) && set.has(`${dx + i},${dy + j}`)) nb++;
      }
      assert.ok(nb >= 2 && nb <= 3, `R=${R}: у (${dx},${dy}) соседей ${nb}`);
    }
    // крайние точки ровно на R по осям
    for (const p of [`${R},0`, `-${R},0`, `0,${R}`, `0,-${R}`]) assert.ok(set.has(p.replace('-0', '0')));
  }
});

test('кольцо: прогресс заливает обод золотом от верха по часовой, только растёт', () => {
  const lit = (p) => {
    const ctx = fakeCtx();
    drawHoldRing(ctx, 100, 100, p, 1, 13);
    const pts = uniq(cells(ctx, 100, 100));
    for (const q of pts) assert.ok(q.c === DIM || q.c === FILL, `цвет ${q.c}`);
    return { all: pts.length, on: new Set(pts.filter((q) => q.c === FILL).map(key)) };
  };
  assert.equal(lit(0).on.size, 0, 'progress 0 — тусклый обод без золота');
  assert.equal(lit(-1).on.size, 0, 'меньше нуля — как ноль');
  const full = lit(1);
  assert.equal(full.on.size, full.all, 'progress 1 — весь обод золотой');
  assert.equal(lit(5).on.size, full.all, 'больше единицы — как единица');

  // четверть — правый верхний сектор (по часовой от верха к правому краю)
  const q = lit(0.25);
  for (const k of q.on) {
    const [dx, dy] = k.split(',').map(Number);
    assert.ok(dx >= 0 && dy <= 0, `четверть: (${dx},${dy}) в правом верхнем секторе`);
  }
  assert.ok(Math.abs(q.on.size / full.all - 0.25) < 0.06, `четверть ≈ 25% обода (${q.on.size}/${full.all})`);
  assert.ok(q.on.has('0,-13'), 'начинается с верхней точки');

  let prev = new Set();
  for (let p = 0; p <= 1.0001; p += 0.05) {
    const cur = lit(p).on;
    for (const k of prev) assert.ok(cur.has(k), `p=${p.toFixed(2)}: залитое не гаснет (${k})`);
    assert.ok(cur.size >= prev.size);
    prev = cur;
  }
});

test('кольцо: центр округляется до арт-пикселя, прозрачность в 0..1', () => {
  const a = fakeCtx(); drawHoldRing(a, 101, 99, 0.5, 1, 8);
  const b = fakeCtx(); drawHoldRing(b, 102, 100, 0.5, 1, 8);
  assert.deepEqual(a.rects, b.rects, 'нечётный центр встаёт на сетку так же, как ближайший чётный');
  const c = fakeCtx(); drawHoldRing(c, 100, 100, 0.5, 3, 8);
  assert.ok(c.rects.every((r) => r.a === 1), 'alpha > 1 — как 1');
  const d = fakeCtx(); drawHoldRing(d, 100, 100, 0.5, -1, 8);
  assert.ok(d.rects.every((r) => r.a === 0), 'alpha < 0 — как 0');
  const e = fakeCtx(); drawHoldRing(e, 100, 100, 0.5, 0.4, 8);
  assert.ok(e.rects.every((r) => r.a === 0.4));
  assertGrid(e);
});

test('кольцо: второй вызов того же радиуса рисует то же (кеш точек не портится)', () => {
  const a = fakeCtx(); drawHoldRing(a, 50, 50, 0.7, 1, 16);
  const b = fakeCtx(); drawHoldRing(b, 50, 50, 0.7, 1, 16);
  assert.deepEqual(a.rects, b.rects);
  // другой радиус между ними не влияет
  drawHoldRing(fakeCtx(), 50, 50, 0.7, 1, 9);
  const c = fakeCtx(); drawHoldRing(c, 50, 50, 0.7, 1, 16);
  assert.deepEqual(a.rects, c.rects);
});

test('стрелка свайпа: остриё над стоячим пунктиром из пяти дэшей, бежит ровно один золотой шаг', () => {
  const frame = (phase) => {
    const ctx = fakeCtx();
    drawSwipeTick(ctx, 300, 400, 1, phase);
    assertGrid(ctx);
    return cells(ctx, 300, 400);
  };
  const base = frame(0);
  const head = base.filter((p) => p.dy <= -5);
  const tail = base.filter((p) => p.dy > -5);
  assert.equal(head.length, 16, 'остриё — 16 ячеек');
  assert.equal(tail.length, 10, 'хвост — 5 дэшей по 2 ячейки');
  const ys = [...new Set(tail.map((p) => p.dy))].sort((x, y) => x - y);
  assert.deepEqual(ys, [-4, 0, 4, 8, 12], 'дэши с шагом 4 арт-px, верхний ниже острия');
  assert.ok(Math.max(...head.map((p) => p.dy)) < Math.min(...ys), 'остриё над хвостом');

  // шаги по 0.12 с: дэш 0 (нижний) → … → дэш 4 → остриё → снова низ
  const order = [12, 8, 4, 0, -4];
  for (let s = 0; s <= 6; s++) {
    const f = frame(s * 0.12 + 0.01);
    assert.deepEqual(f.map(key), base.map(key), `шаг ${s}: ячейки стоят на месте`);
    for (const p of f) assert.ok(p.c === WHITE || p.c === FILL, `цвет ${p.c}`);
    const gold = f.filter((p) => p.c === FILL);
    const k = s % 6;
    if (k < 5) {
      assert.equal(gold.length, 2, `шаг ${s}: золотой — один дэш`);
      assert.ok(gold.every((p) => p.dy === order[k]), `шаг ${s}: золотой дэш на y=${order[k]}`);
    } else {
      assert.equal(gold.length, 16, `шаг ${s}: золотое — остриё целиком`);
      assert.ok(gold.every((p) => p.dy <= -5));
    }
  }
});

test('стрелка свайпа: прозрачность в 0..1 и центр на сетке', () => {
  const a = fakeCtx(); drawSwipeTick(a, 301, 401, 2, 0);
  const b = fakeCtx(); drawSwipeTick(b, 302, 402, 1, 0);
  assert.deepEqual(a.rects, b.rects);
  const c = fakeCtx(); drawSwipeTick(c, 300, 400, 0.3, 0);
  assert.ok(c.rects.every((r) => r.a === 0.3));
});

test('искра тапа: вся золотая, ядро 2×2, лучи симметричны, вертикальные длиннее', () => {
  const ctx = fakeCtx();
  drawTapStar(ctx, 200, 200);
  assertGrid(ctx);
  const pts = cells(ctx, 200, 200);
  assert.ok(pts.every((p) => p.c === FILL), 'только акцент');
  const set = new Set(pts.map(key));
  for (const k of ['0,0', '1,0', '0,1', '1,1']) assert.ok(set.has(k), `ядро ${k}`);
  // симметрия относительно середины ядра (0.5, 0.5)
  for (const p of pts) {
    assert.ok(set.has(`${1 - p.dx},${p.dy}`), `зеркало по x для (${p.dx},${p.dy})`);
    assert.ok(set.has(`${p.dx},${1 - p.dy}`), `зеркало по y для (${p.dx},${p.dy})`);
  }
  const up = Math.max(...pts.map((p) => -p.dy));
  const side = Math.max(...pts.map((p) => -p.dx));
  assert.equal(up, 9, 'вертикальный луч по умолчанию — 9');
  assert.equal(side, 5, 'горизонтальный по умолчанию reachH=6, но шаг 6 чётный и пропущен — конец на 5');
  // через один шаг к концу: после 3 чётные расстояния пропущены
  for (let d = 4; d <= 9; d++) assert.equal(set.has(`0,${-d}`), d % 2 === 1, `луч вверх, шаг ${d}`);
  assert.ok(set.has('0,-2') && set.has('0,-3'), 'у ядра луч сплошной');
});

test('искра тапа: длина лучей задаётся вызывающим (анимация «расходятся»)', () => {
  const reach = (v, h) => {
    const ctx = fakeCtx();
    drawTapStar(ctx, 100, 100, 1, v, h);
    const pts = cells(ctx, 100, 100);
    return { up: Math.max(0, ...pts.map((p) => -p.dy)), side: Math.max(0, ...pts.map((p) => -p.dx)), n: pts.length };
  };
  assert.deepEqual(reach(1, 1), { up: 0, side: 0, n: 4 }, 'лучей нет — одно ядро');
  assert.equal(reach(3, 2).up, 3);
  assert.equal(reach(3, 2).side, 2);
  assert.ok(reach(9, 6).n > reach(5, 3).n, 'длиннее лучи — больше ячеек');
});

test('точка тапа: золотой плюс из пяти ячеек', () => {
  const ctx = fakeCtx();
  drawTapDot(ctx, 81, 61, 0.5);
  assertGrid(ctx);
  const pts = cells(ctx, 81, 61);
  assert.deepEqual(pts.map(key).sort(), ['-1,0', '0,-1', '0,0', '0,1', '1,0']);
  assert.ok(pts.every((p) => p.c === FILL && p.a === 0.5));
});

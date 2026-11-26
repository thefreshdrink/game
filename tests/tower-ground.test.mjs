// Тесты пола под Башней (src/minigames/tower/blocks/ground.js, бэклог 61):
// плиты пола — шахматка двух тёмных тонов с дальними рёбрами в 1 px, по
// умолчанию радиус 4; тень башни — растр 2×2 чёрного на чётной сетке, через
// клетку, внутри своей полосы на полу, длиннее с высотой башни; без рядов
// тени нет. Без браузера: node:test, контекст канваса — заглушка. Код сцены
// не трогается — тест фиксирует то, что есть. Запуск — `npm test`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawGround } from '../src/minigames/tower/blocks.js';
import { project, BODY, FAR, UI } from '../src/minigames/tower/blocks/iso.js';

// Заглушка: заливки многоугольников (цвет + точки), штрихи (цвет, ширина,
// точки), прямоугольники, save/restore/clip.
function recorder() {
  const polys = [];
  const strokes = [];
  const rects = [];
  const calls = [];
  let path = [];
  const ctx = {
    fillStyle: '', strokeStyle: '', lineWidth: 1,
    save() { calls.push('save'); }, restore() { calls.push('restore'); },
    clip() { calls.push('clip'); }, closePath() {},
    beginPath() { path = []; },
    moveTo(x, y) { path.push([x, y]); },
    lineTo(x, y) { path.push([x, y]); },
    fill() { polys.push({ color: this.fillStyle, pts: path.slice() }); },
    stroke() { strokes.push({ color: this.strokeStyle, width: this.lineWidth, pts: path.slice() }); },
    fillRect(x, y, w, h) { rects.push({ x, y, w, h, color: this.fillStyle }); },
  };
  return { ctx, polys, strokes, rects, calls };
}

test('drawGround: шахматка плит от -r до r+2, по умолчанию r = 4', () => {
  const { ctx, polys } = recorder();
  drawGround(ctx, 200, 600);
  assert.equal(polys.length, 11 * 11, 'радиус 4 → 11×11 плит');
  let k = 0;
  for (let gx = -4; gx <= 6; gx++) {
    for (let gy = -4; gy <= 6; gy++) {
      const p = polys[k++];
      // (gx + gy) % 2 у отрицательных даёт -1 — тоже «нечётная» клетка.
      assert.equal(p.color, (gx + gy) % 2 ? UI : '#1C1C1C', `плита ${gx},${gy}`);
      assert.deepEqual(p.pts[0], project(200, 600, gx, gy, 0));
      assert.deepEqual(p.pts[2], project(200, 600, gx + 1, gy + 1, 0));
    }
  }
  const { ctx: c2, polys: p2 } = recorder();
  drawGround(c2, 0, 0, 1);
  assert.equal(p2.length, 5 * 5, 'радиус 1 → 5×5 плит');
});

test('drawGround: соседние плиты разного тона', () => {
  const { ctx, polys } = recorder();
  drawGround(ctx, 0, 0, 2);
  const n = 7;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const c = polys[i * n + j].color;
      if (j + 1 < n) assert.notEqual(c, polys[i * n + j + 1].color);
      if (i + 1 < n) assert.notEqual(c, polys[(i + 1) * n + j].color);
    }
  }
});

test('drawGround: у каждой плиты два дальних ребра тоном FAR в 1 px', () => {
  const { ctx, strokes } = recorder();
  drawGround(ctx, 100, 300, 1);
  assert.equal(strokes.length, 25 * 2);
  assert.ok(strokes.every((s) => s.color === FAR && s.width === 1));
  // Первая плита (-1,-1): рёбра от её дальнего угла к соседним.
  const a = project(100, 300, -1, -1, 0);
  assert.deepEqual(strokes[0].pts, [a, project(100, 300, 0, -1, 0)]);
  assert.deepEqual(strokes[1].pts, [a, project(100, 300, -1, 0, 0)]);
});

test('drawGround: без рядов тени нет — ни клипа, ни растра', () => {
  for (const rows of [undefined, 0, -3]) {
    const { ctx, rects, calls } = recorder();
    drawGround(ctx, 200, 600, 4, rows);
    assert.equal(rects.length, 0, `rows = ${rows}`);
    assert.deepEqual(calls, []);
  }
});

test('drawGround: тень — растр 2×2 чёрного через клетку на чётной сетке', () => {
  // ox нечётный нарочно: в сцене baseX = round(w / 2), на 390 это 195.
  for (const [ox, oy] of [[195, 600], [720, 517]]) {
    const { ctx, rects, calls } = recorder();
    drawGround(ctx, ox, oy, 4, 16);
    assert.ok(rects.length > 50, 'тень нарисована');
    assert.deepEqual(calls, ['save', 'clip', 'restore'], 'клип снят после тени');
    const seen = new Set();
    for (const r of rects) {
      assert.equal(r.color, BODY);
      assert.equal(r.w, 2);
      assert.equal(r.h, 2);
      assert.equal(r.x % 2, 0, 'x чётный');
      assert.equal(r.y % 2, 0, 'y чётный');
      seen.add(`${r.x},${r.y}`);
    }
    // Через клетку: ни соседа справа, ни соседа снизу — только по диагонали.
    for (const r of rects) {
      assert.ok(!seen.has(`${r.x + 2},${r.y}`), 'нет соседа справа');
      assert.ok(!seen.has(`${r.x},${r.y + 2}`), 'нет соседа снизу');
    }
    const diag = rects.filter((r) => seen.has(`${r.x + 2},${r.y + 2}`)).length;
    assert.ok(diag > rects.length / 2, 'точки идут по диагонали');
  }
});

test('drawGround: тень лежит в полосе справа от башни и растёт с высотой', () => {
  const ox = 200;
  const oy = 600;
  const span = (rows) => {
    const { ctx, rects } = recorder();
    drawGround(ctx, ox, oy, 4, rows);
    return {
      n: rects.length,
      minX: Math.min(...rects.map((r) => r.x)),
      maxX: Math.max(...rects.map((r) => r.x + r.w)),
      minY: Math.min(...rects.map((r) => r.y)),
      maxY: Math.max(...rects.map((r) => r.y + r.h)),
    };
  };
  const low = span(1);
  const high = span(16);
  assert.ok(high.n > low.n, 'выше башня — больше тени');
  assert.ok(high.maxX > low.maxX, 'тень длиннее вправо');
  // Полоса тени: от x = 3 до 3 + len, y от 0 до 3 (свет слева).
  const len = 3 + 16 * 0.35;
  const q = [[3, 0], [3 + len, 0], [3 + len, 3], [3, 3]].map(([x, y]) => project(ox, oy, x, y, 0));
  const xs = q.map((p) => p[0]);
  const ys = q.map((p) => p[1]);
  assert.ok(high.minX >= Math.floor(Math.min(...xs) / 2) * 2);
  assert.ok(high.maxX <= Math.max(...xs) + 2);
  assert.ok(high.minY >= Math.floor(Math.min(...ys) / 2) * 2);
  assert.ok(high.maxY <= Math.max(...ys) + 2);
});

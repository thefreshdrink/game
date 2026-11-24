// Тесты мороси дороги Шута (src/minigames/fool/weather.js, бэклог 55):
// 22 редких штриха тоном дальней детали, ячейками 2×2 по чётной сетке,
// зациклены по кадру, слегка сносятся ветром и камерой. Без браузера:
// node:test, canvas — заглушка, которая пишет каждый fillRect. Код не
// трогается — тест фиксирует то, что есть. Запуск — `npm test`.

import { test } from 'node:test';
import assert from 'node:assert/strict';

const { drawDrizzle } = await import('../src/minigames/fool/weather.js');

function fakeCtx() {
  const log = { rects: [], fills: new Set(), save: 0, restore: 0 };
  const ctx = {
    _fill: '',
    set fillStyle(v) { this._fill = v; },
    get fillStyle() { return this._fill; },
    save() { log.save++; },
    restore() { log.restore++; },
    fillRect(x, y, w, h) { log.rects.push([x, y, w, h]); log.fills.add(this._fill); },
  };
  return { ctx, log };
}

// Внутри штриха следующая ячейка ровно на 2 px ниже и на 0 или 2 px правее
// (наклон — полпикселя вправо на пиксель вниз).
const sameStroke = (a, b) => b[1] - a[1] === 2 && (b[0] - a[0] === 0 || b[0] - a[0] === 2);
const strokes = (rects) => {
  const out = [];
  rects.forEach((r, i) => { if (i === 0 || !sameStroke(rects[i - 1], r)) out.push([]); out.at(-1).push(r); });
  return out;
};

const draw = (w, h, t, camX) => { const f = fakeCtx(); drawDrizzle(f.ctx, w, h, t, camX); return f.log; };

test('только тон дальней детали #4A4A4A, save/restore парные', () => {
  const log = draw(390, 844, 3.7, 500);
  assert.deepEqual([...log.fills], ['#4A4A4A']);
  assert.equal(log.save, 1);
  assert.equal(log.restore, 1);
});

test('каждая ячейка 2×2 на чётной сетке', () => {
  for (const [w, h, t, camX] of [[390, 844, 0, 0], [1440, 860, 12.34, 1777], [391, 845, 0.017, -33]]) {
    const log = draw(w, h, t, camX);
    for (const [x, y, rw, rh] of log.rects) {
      assert.equal(rw, 2); assert.equal(rh, 2);
      assert.equal(x % 2, 0, `x=${x} нечётный`);
      assert.equal(y % 2, 0, `y=${y} нечётный`);
    }
  }
});

test('22 штриха по 2–5 ячеек, число ячеек не зависит от времени и экрана', () => {
  const st = strokes(draw(390, 844, 0, 0).rects);
  assert.equal(st.length, 22);
  for (const s of st) assert.ok(s.length >= 2 && s.length <= 5, `в штрихе ${s.length} ячеек`);
  const n0 = st.reduce((a, s) => a + s.length, 0);
  for (const t of [0.5, 7, 100]) assert.equal(draw(390, 844, t, t * 50).rects.length, n0);
  assert.equal(draw(1440, 860, 0, 0).rects.length, n0);
});

test('штрихи живут в пределах кадра: по x внутри ширины, по y от −20 до h+20 с хвостом', () => {
  for (let t = 0; t < 30; t += 0.37) {
    const W = 390, H = 844;
    for (const [x, y] of draw(W, H, t, t * 123).rects) {
      // старт штриха внутри [0, w); хвост 4 px по x уходит не дальше ширины+4
      assert.ok(x >= 0 && x <= W + 4, `x=${x} при t=${t.toFixed(2)}`);
      // старт по y в [−20, h+20); длина штриха до 9 px
      assert.ok(y >= -22 && y <= H + 30, `y=${y} при t=${t.toFixed(2)}`);
    }
  }
});

test('одинаковый вход — одинаковый кадр (раскладка капель постоянная)', () => {
  assert.deepEqual(draw(390, 844, 5.5, 300).rects, draw(390, 844, 5.5, 300).rects);
});

test('морось падает вниз и сносится вправо со временем', () => {
  // Первая ячейка каждого штриха — его начало; сравниваем малый шаг времени,
  // чтобы ни один штрих не успел перескочить по циклу.
  const heads = (t) => {
    const r = draw(1440, 860, t, 0).rects;
    const out = [];
    for (let i = 0; i < r.length; i++) {
      if (i === 0 || !sameStroke(r[i - 1], r[i])) out.push(r[i]);
    }
    return out;
  };
  const a = heads(1), b = heads(1.05);
  assert.equal(a.length, 22);
  assert.equal(b.length, 22);
  let down = 0, right = 0;
  for (let i = 0; i < 22; i++) {
    if (b[i][1] > a[i][1]) down++;
    if (b[i][0] >= a[i][0]) right++;
  }
  assert.ok(down >= 20, `вниз сдвинулось ${down} из 22`);
  assert.ok(right >= 20, `вправо или на месте ${right} из 22`);
});

test('камера сносит дождь медленно: 100 px камеры — не больше 8 px сдвига', () => {
  const a = draw(1440, 860, 2, 0).rects, b = draw(1440, 860, 2, 100).rects;
  assert.equal(a.length, b.length);
  for (let i = 0; i < a.length; i++) {
    const dx = Math.abs(a[i][0] - b[i][0]);
    // либо небольшой сдвиг влево (6 px ±округление), либо перенос через край кадра
    assert.ok(dx <= 8 || dx >= 1440 - 8, `ячейка ${i}: сдвиг ${dx}`);
    assert.equal(a[i][1], b[i][1], 'камера не двигает дождь по вертикали');
  }
});

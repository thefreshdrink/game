// Тесты каркаса мини-игр (src/core/minigame.js) и «сочности» (juice.js).
// Каркас — общий жизненный цикл всех трёх сцен и заготовки new-minigame:
// подписка на ввод после сброса, отписка на выходе, выход на предсказание.
// juice.js — частицы, вспышка и дрожь, ими пользуются все сцены.
// Без браузера: node:test, canvas — заглушка. Запуск — `npm test`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defineMinigame, MINIGAME_EXIT } from '../src/core/minigame.js';
import { createParticles, createFlash, applyShake } from '../src/core/juice.js';

// Заглушка ввода: input.on(type, h) возвращает отписку, как настоящий input.js.
function fakeInput() {
  const subs = new Map();
  return {
    subs,
    on(type, h) {
      if (!subs.has(type)) subs.set(type, new Set());
      subs.get(type).add(h);
      return () => subs.get(type).delete(h);
    },
    emit(type, e) { [...(subs.get(type) ?? [])].forEach((h) => h(e)); },
    count() { let n = 0; subs.forEach((s) => { n += s.size; }); return n; },
  };
}

// Заглушка контекста: запоминает вызовы, которые трогает juice.js.
function fakeCtx() {
  const calls = [];
  return {
    calls,
    globalAlpha: 1,
    fillStyle: null,
    fillRect(...a) { calls.push(['fillRect', this.fillStyle, this.globalAlpha, ...a]); },
    translate(...a) { calls.push(['translate', ...a]); },
  };
}

function withRandom(values, fn) {
  const orig = Math.random;
  let i = 0;
  Math.random = () => values[i++ % values.length];
  try { return fn(); } finally { Math.random = orig; }
}

test('каркас: выход мини-игры — экран предсказания', () => {
  assert.equal(MINIGAME_EXIT, 'prediction');
});

test('каркас: enter сначала сбрасывает сцену, потом подписывает ввод', () => {
  const input = fakeInput();
  const order = [];
  const scene = defineMinigame({ input, goto() {} }, {
    enter(prev) { order.push(['enter', prev, input.count()]); },
    input: { tap() {}, swipe() {} },
    draw() {},
  });
  scene.enter('reveal');
  // в момент сброса подписок ещё нет
  assert.deepEqual(order, [['enter', 'reveal', 0]]);
  assert.equal(input.count(), 2);
});

test('каркас: события ввода доходят до сцены, после exit — нет', () => {
  const input = fakeInput();
  const taps = [];
  let exited = 0;
  const scene = defineMinigame({ input, goto() {} }, {
    input: { tap(e) { taps.push(e); } },
    exit() { exited++; },
    draw() {},
  });
  scene.enter();
  input.emit('tap', 1);
  scene.exit();
  input.emit('tap', 2);
  assert.deepEqual(taps, [1]);
  assert.equal(input.count(), 0);
  assert.equal(exited, 1);
});

test('каркас: повторный круг не копит подписки', () => {
  const input = fakeInput();
  let taps = 0;
  const scene = defineMinigame({ input, goto() {} }, {
    input: { tap() { taps++; } },
    draw() {},
  });
  for (let i = 0; i < 3; i++) { scene.enter(); scene.exit(); }
  scene.enter();
  input.emit('tap');
  assert.equal(taps, 1);
  assert.equal(input.count(), 1);
});

test('каркас: finish из update уводит на предсказание; без enter/exit/input не падает', () => {
  const input = fakeInput();
  const went = [];
  const seen = [];
  const scene = defineMinigame({ input, goto: (n) => went.push(n) }, {
    update(dt, w, h, finish) { seen.push([dt, w, h]); if (dt > 1) finish(); },
    draw(ctx, w, h) { seen.push(['draw', ctx, w, h]); },
  });
  scene.enter();
  scene.update(0.016, 390, 844);
  assert.deepEqual(went, []);
  scene.update(2, 390, 844);
  assert.deepEqual(went, ['prediction']);
  scene.draw('ctx', 1440, 860);
  scene.exit();
  assert.deepEqual(seen, [[0.016, 390, 844], [2, 390, 844], ['draw', 'ctx', 1440, 860]]);
});

test('частицы: burst кладёт n частиц чётного размера, летящих вверх', () => {
  const p = createParticles();
  withRandom([0.1, 0.9, 0.3, 0.7], () => p.burst(100, 200, 6));
  assert.equal(p.list.length, 6);
  p.list.forEach((d) => {
    assert.ok(d.s === 2 || d.s === 4, 'размер — целые арт-пиксели');
    assert.ok(d.vy <= 0, 'пыль летит вверх');
    assert.ok(d.life >= 0.35 && d.life <= 0.55);
    assert.equal(d.x, 100);
    assert.equal(d.y, 200);
  });
});

test('частицы: живут свою жизнь и исчезают, гравитация тянет вниз', () => {
  const p = createParticles();
  p.push({ x: 0, y: 0, vx: 10, vy: 0, t: 0, life: 0.5, s: 2 });
  p.push({ x: 0, y: 0, vx: 0, vy: 0, t: 0, life: 0.5, s: 2, g: 0 });
  p.update(0.1);
  assert.equal(p.list.length, 2);
  assert.ok(Math.abs(p.list[0].x - 1) < 1e-9);
  assert.ok(Math.abs(p.list[0].vy - 22) < 1e-9, 'гравитация по умолчанию 220');
  assert.equal(p.list[1].vy, 0, 'своя g = 0');
  p.update(0.5);
  assert.equal(p.list.length, 0);
  p.push({ x: 0, y: 0, vx: 0, vy: 0, t: 0, life: 1, s: 2 });
  p.clear();
  assert.equal(p.list.length, 0);
});

test('частицы: рисуются по чётным координатам, тоны из палитры', () => {
  const p = createParticles();
  p.push({ x: 13.4, y: 27.7, vx: 0, vy: 0, t: 0.1, life: 1, s: 4 });
  p.push({ x: 5, y: 9, vx: 0, vy: 0, t: 0.9, life: 1, s: 2 });
  const ctx = fakeCtx();
  p.draw(ctx, 3, 1);
  const [a, b] = ctx.calls;
  assert.equal(a[1], '#808080');
  assert.equal(b[1], '#4A4A4A');
  ctx.calls.forEach(([, , , x, y]) => {
    assert.equal(x % 2, 0);
    assert.equal(y % 2, 0);
  });
});

test('вспышка: гаснет за duration и не рисуется после', () => {
  const f = createFlash(0.2);
  const ctx = fakeCtx();
  f.draw(ctx, 10, 10);
  assert.equal(ctx.calls.length, 0, 'до trigger не рисуется');
  f.trigger();
  f.update(0.1);
  f.draw(ctx, 10, 10);
  assert.equal(ctx.calls.length, 1);
  assert.equal(ctx.calls[0][1], '#000000');
  assert.ok(Math.abs(ctx.calls[0][2] - 0.5) < 1e-9);
  assert.equal(ctx.globalAlpha, 1, 'прозрачность возвращена');
  f.update(1);
  f.draw(ctx, 10, 10);
  assert.equal(ctx.calls.length, 1);
  f.trigger(); f.reset();
  f.draw(ctx, 10, 10);
  assert.equal(ctx.calls.length, 1, 'reset гасит сразу');
});

test('дрожь: сдвиг на целые пиксели в пределах amount, ноль — без сдвига', () => {
  const ctx = fakeCtx();
  applyShake(ctx, 0);
  assert.equal(ctx.calls.length, 0);
  withRandom([0, 0.999, 0.37, 0.61], () => {
    for (let i = 0; i < 4; i++) applyShake(ctx, 6);
  });
  ctx.calls.forEach(([, x, y]) => {
    assert.ok(Number.isInteger(x) && Number.isInteger(y));
    assert.ok(Math.abs(x) <= 6 && Math.abs(y) <= 6);
  });
});

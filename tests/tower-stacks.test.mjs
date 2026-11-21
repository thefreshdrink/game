// Тесты стопок Башни (src/minigames/tower/release/stacks.js, бэклог 46):
// вынутый брусок перелетает дугой в стопку сбоку — поперечный влево,
// продольный вправо, каждый на верх своей стопки. Код сцены не трогается —
// тест фиксирует то, что есть (правка 29.09). Запуск — `npm test`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sendToStack, stepFlying, flyingPos } from '../src/minigames/tower/release/stacks.js';

const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const along = { x: 1, y: 0, z: 5, dx: 3, dy: 1, tone: 'gold' };  // продольный
const across = { x: 0, y: 1, z: 4, dx: 1, dy: 3, tone: 'dark' }; // поперечный

test('продольный брусок — в правую стопку, поперечный — в левую', () => {
  const flying = [];
  const stackH = { left: 0, right: 0 };
  sendToStack(flying, stackH, along);
  sendToStack(flying, stackH, across);
  assert.equal(flying.length, 2);
  assert.deepEqual(flying[0].to, { x: 0, y: -2, dx: 3, dy: 1, z: 0 });
  assert.deepEqual(flying[1].to, { x: -2, y: 0, dx: 1, dy: 3, z: 0 });
  assert.deepEqual(stackH, { left: 1, right: 1 });
});

test('стопка растёт: каждый следующий брусок ложится на этаж выше', () => {
  const flying = [];
  const stackH = { left: 0, right: 0 };
  for (let i = 0; i < 4; i++) sendToStack(flying, stackH, along);
  assert.deepEqual(flying.map((f) => f.to.z), [0, 1, 2, 3]);
  assert.deepEqual(stackH, { left: 0, right: 4 });
});

test('перелёт стартует из места бруска в кладке и сохраняет его тон', () => {
  const flying = [];
  sendToStack(flying, { left: 0, right: 0 }, across);
  const p = flyingPos(flying[0]);
  assert.equal(flying[0].k, 0);
  assert.ok(near(p.x, across.x) && near(p.y, across.y) && near(p.z, across.z));
  assert.equal(p.tone, 'dark');
});

test('перелёт длится полсекунды, затем брусок ложится в стопку неподвижным', () => {
  const flying = [];
  sendToStack(flying, { left: 0, right: 3 }, along);
  const landed = [];
  let left = flying;
  let t = 0;
  while (left.length && t < 2) {
    left = stepFlying(left, 1 / 60, (d) => landed.push(d));
    t += 1 / 60;
  }
  assert.ok(t > 0.48 && t < 0.52, `перелёт ${t.toFixed(3)} с`);
  assert.equal(landed.length, 1);
  assert.deepEqual(landed[0], {
    x: 0, y: -2, dx: 3, dy: 1, z: 3, tone: 'gold', vx: 0, vy: 0, vz: 0, rest: true,
  });
});

test('длинный кадр не перелетает дальше цели и сажает брусок сразу', () => {
  const flying = [];
  sendToStack(flying, { left: 0, right: 0 }, along);
  const landed = [];
  const left = stepFlying(flying, 3, (d) => landed.push(d));
  assert.equal(left.length, 0);
  assert.equal(landed.length, 1);
  assert.equal(flying[0].k, 1);
});

test('дуга: в середине пути брусок выше прямой на 1.6 ряда, в конце — ровно в стопке', () => {
  const f = { from: { x: 2, y: 2, z: 6 }, to: { x: -2, y: 0, z: 1, dx: 1, dy: 3 }, tone: 't', k: 0.5 };
  const mid = flyingPos(f);
  assert.ok(near(mid.x, 0) && near(mid.y, 1));
  assert.ok(near(mid.z, 3.5 + 1.6));
  f.k = 1;
  const end = flyingPos(f);
  assert.ok(near(end.x, -2) && near(end.y, 0) && near(end.z, 1, 1e-12));
  assert.equal(end.dx, 1);
  assert.equal(end.dy, 3);
});

test('по пути брусок движется плавно и не уходит за цель', () => {
  const f = { from: { x: 1, y: 0, z: 5 }, to: { x: 0, y: -2, z: 0, dx: 3, dy: 1 }, tone: 't', k: 0 };
  let prevY = Infinity;
  for (let i = 0; i <= 20; i++) {
    f.k = i / 20;
    const p = flyingPos(f);
    assert.ok(p.y <= prevY + 1e-12, 'y идёт только к стопке');
    assert.ok(p.y >= -2 - 1e-12 && p.x >= 0 - 1e-12 && p.x <= 1 + 1e-12);
    assert.ok(p.z >= 0 - 1e-12, 'не проваливается ниже стопки');
    prevY = p.y;
  }
});

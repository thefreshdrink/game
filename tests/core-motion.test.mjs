// Тесты общих модулей движения из src/core/: кривые (ease.js) и камера
// мини-игры (camera.js). Ими пользуются все три сцены и заготовка
// new-minigame, поэтому правка здесь меняет ощущение сразу везде.
// Без браузера: node:test. Запуск — `npm test`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clamp01, easeInOutQuad } from '../src/core/ease.js';
import { createFollowCamera } from '../src/core/camera.js';

const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

test('clamp01: зажимает в [0, 1], внутри не трогает', () => {
  assert.equal(clamp01(-3), 0);
  assert.equal(clamp01(0), 0);
  assert.equal(clamp01(0.25), 0.25);
  assert.equal(clamp01(1), 1);
  assert.equal(clamp01(7), 1);
});

test('easeInOutQuad: концы 0 и 1, середина 0.5, без скачка на стыке', () => {
  assert.equal(easeInOutQuad(0), 0);
  assert.equal(easeInOutQuad(1), 1);
  assert.equal(easeInOutQuad(0.5), 0.5);
  // две половины формулы сходятся в 0.5 без разрыва
  assert.ok(near(easeInOutQuad(0.5 - 1e-9), easeInOutQuad(0.5 + 1e-9), 1e-6));
});

test('easeInOutQuad: растёт монотонно и симметрична относительно середины', () => {
  let prev = -Infinity;
  for (let i = 0; i <= 100; i++) {
    const x = i / 100;
    const y = easeInOutQuad(x);
    assert.ok(y >= prev, `падает при x=${x}`);
    assert.ok(y >= 0 && y <= 1, `вне [0, 1] при x=${x}`);
    assert.ok(near(y + easeInOutQuad(1 - x), 1, 1e-12), `несимметрична при x=${x}`);
    prev = y;
  }
  // разгон: в первой четверти медленнее прямой, в последней — быстрее
  assert.ok(easeInOutQuad(0.25) < 0.25);
  assert.ok(easeInOutQuad(0.75) > 0.75);
});

test('камера: snap ставит героя на долю кадра (leadX, leadY)', () => {
  const cam = createFollowCamera({ leadX: 0.3, leadY: 0.6 });
  cam.snap(1000, 500, 390, 844);
  assert.ok(near(cam.sx(1000), 390 * 0.3));
  assert.ok(near(cam.sy(500), 844 * 0.6));
});

test('камера: по умолчанию герой в центре кадра', () => {
  const cam = createFollowCamera();
  cam.snap(200, 100, 400, 800);
  assert.equal(cam.sx(200), 200);
  assert.equal(cam.sy(100), 400);
});

test('камера: follow догоняет цель долей rate·dt, не перелетает', () => {
  const cam = createFollowCamera({ leadX: 0, leadY: 0, rate: 6 });
  cam.follow(100, 50, 390, 844, 1 / 60); // k = 0.1
  assert.ok(near(cam.x, 10));
  assert.ok(near(cam.y, 5));
  // длинный кадр (k > 1 зажат до 1): ровно в цель, без перелёта
  cam.follow(100, 50, 390, 844, 1);
  assert.equal(cam.x, 100);
  assert.equal(cam.y, 50);
  // много мелких шагов сходятся к цели и не обгоняют её
  const c2 = createFollowCamera({ leadX: 0, leadY: 0, rate: 6 });
  for (let i = 0; i < 600; i++) {
    c2.follow(100, 0, 390, 844, 1 / 60);
    assert.ok(c2.x <= 100);
  }
  assert.ok(near(c2.x, 100, 1e-6));
});

test('камера: reset и перевод world → screen', () => {
  const cam = createFollowCamera();
  cam.reset(40, -20);
  assert.equal(cam.sx(40), 0);
  assert.equal(cam.sy(-20), 0);
  assert.equal(cam.sx(100), 60);
  cam.reset();
  assert.equal(cam.sx(5), 5);
  assert.equal(cam.sy(5), 5);
});

// Тесты чисел мини-игры Шута (src/minigames/fool/leap/tuning.js и
// leap/flick.js, бэклог 42): полоска удержания у последнего края, флик вверх
// на ходу и запас «упал мимо» (RESPAWN_DROP). Канон: упасть можно, падение
// возвращает на начало текущей плиты — но обычный прыжок или сход вниз на
// следующую плиту не должен считаться падением. Код сцены не трогается —
// тест фиксирует то, что есть. Запуск — `npm test`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPlatforms, platformAt } from '../src/minigames/fool/platforms.js';
import { PHYS, gravityFor, jumpVelocity } from '../src/minigames/fool/physics.js';
import { HOLD_TOTAL, RESPAWN_DROP, holdProgress } from '../src/minigames/fool/leap/tuning.js';
import { flickJump } from '../src/minigames/fool/leap/flick.js';

const DT = 1 / 60;
const platforms = buildPlatforms(0);

// Полёт с (x0, y0) со скоростью (vx, vy) — тот же шаг, что в leap.js
// (состояние 'air'), но без проверки респавна: возвращает плиту приземления
// и самую глубокую точку ниже y0 ДО кадра приземления.
function fall(x0, y0, vx, vy0) {
  let x = x0, y = y0, vy = vy0, deepest = 0;
  for (let k = 0; k < 900; k++) {
    const prevY = y;
    vy += gravityFor(vy) * DT;
    x += vx * DT;
    y += vy * DT;
    if (vy > 0) {
      const p = platformAt(platforms, x, prevY - 2, y + 2);
      if (p) return { p, deepest };
    }
    deepest = Math.max(deepest, y - y0);
  }
  return { p: null, deepest };
}

test('полоска удержания: 75% за первые 1.6 с, остальное медленнее, до 100%', () => {
  assert.equal(holdProgress(0), 0);
  assert.ok(Math.abs(holdProgress(1.6) - 0.75) < 1e-9);
  assert.ok(Math.abs(holdProgress(HOLD_TOTAL) - 1) < 1e-9);
  assert.ok(Math.abs(HOLD_TOTAL - 2.6) < 1e-9, `HOLD_TOTAL ${HOLD_TOTAL}`);
  assert.equal(holdProgress(HOLD_TOTAL + 5), 1, 'после конца не растёт');
  let prev = -1;
  for (let s = 0; s <= HOLD_TOTAL + 0.5; s += 0.01) {
    const v = holdProgress(s);
    assert.ok(v >= prev, `не убывает: ${s.toFixed(2)} с`);
    prev = v;
  }
  const early = holdProgress(0.5) - holdProgress(0.4);
  const late = holdProgress(2.1) - holdProgress(2.0);
  assert.ok(late < early, 'хвост полоски медленнее начала');
});

test('флик: медленный увод пальца и движение вниз — не прыжок', () => {
  assert.equal(flickJump(500, 16, { y: 495, dx: 0 }), null, '0.31 px/мс');
  assert.equal(flickJump(500, 16, { y: 510, dx: 40 }), null, 'вниз');
  assert.equal(flickJump(500, 16, { y: 500, dx: 200 }), null, 'вбок');
});

test('флик: резкий дёрг вверх — прыжок в пределах свайпа', () => {
  for (const [dy, dx] of [[6, 0], [12, 70], [40, 140], [200, 400]]) {
    const j = flickJump(500, 16, { y: 500 - dy, dx });
    assert.ok(j, `вверх ${dy}px за кадр`);
    assert.ok(j.up >= 0.2 && j.up <= 1.3, `вверх ${j.up}`);
    assert.ok(j.side >= 0.35 && j.side <= 1, `вбок ${j.side}`);
  }
  const weak = flickJump(500, 16, { y: 492, dx: 0 });
  const strong = flickJump(500, 16, { y: 470, dx: 0 });
  assert.ok(strong.up > weak.up, 'быстрее дёрг — выше прыжок');
  assert.equal(weak.side, 0.35, 'вертикальный дёрг — прыжок с разбега, не на месте');
});

test('прыжок с края на следующую плиту не считается падением', () => {
  // Любая сила свайпа: если долетает до плиты, по пути не опускается ниже
  // RESPAWN_DROP под плиту старта — респавн не перебьёт приземление.
  for (let i = 0; i < platforms.length - 1; i++) {
    const from = platforms[i];
    for (const u of [0.2, 0.5, 0.8, 1, 1.3]) {
      for (const s of [0.35, 0.5, 0.75, 1]) {
        const v = jumpVelocity(u, s);
        const r = fall(from.x + from.w, from.y, v.vx, v.vy);
        if (r.p) assert.ok(r.deepest <= RESPAWN_DROP,
          `с плиты ${i + 1} свайпом ${u}/${s}: ниже на ${r.deepest.toFixed(0)}px до посадки`);
      }
    }
  }
});

test('сход с края шагом: долетел — без респавна, мимо — респавн сработает', () => {
  for (let i = 0; i < platforms.length - 1; i++) {
    const from = platforms[i];
    for (const vx of [0, PHYS.walk]) {
      const r = fall(from.x + from.w + 1, from.y, vx, 0);
      if (r.p) {
        assert.ok(r.deepest <= RESPAWN_DROP, `с плиты ${i + 1}: ниже на ${r.deepest.toFixed(0)}px до посадки`);
      } else {
        assert.ok(r.deepest > RESPAWN_DROP, `с плиты ${i + 1}: мимо плит, а респавн не наступил`);
      }
    }
  }
});

test('запас падения больше любого спуска дороги', () => {
  let maxDrop = 0;
  for (let i = 0; i < platforms.length - 1; i++) {
    maxDrop = Math.max(maxDrop, platforms[i + 1].y - platforms[i].y);
  }
  assert.ok(RESPAWN_DROP > maxDrop, `RESPAWN_DROP ${RESPAWN_DROP}, спуск ${maxDrop}`);
});

// Тесты дороги Шута (src/minigames/fool/platforms.js) на правила сетки из
// CLAUDE.md: ширины и ступени кратны 32 экранным, у каждой ширины дороги
// своя целая плита, файлы плит на месте, дорога в сумме идёт вниз.
// Вопрос A1 (щели без прыжка) тест сознательно не трогает: это решение
// дизайна, а не сетки. Запуск — `npm test`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  buildPlatforms, platformAt, PLATE_H, P1_WIDTH, START_WALK,
  ROAD_PLATES, ROAD_PLATE_ASSETS, ARRIVE_MAIN_W,
} from '../src/minigames/fool/platforms.js';

const START_Y = 400;
const road = buildPlatforms(START_Y);
const pub = (p) => fileURLToPath(new URL(`../public/${p}`, import.meta.url));

test('дорога: старт первым, плиты идут слева направо без наложений', () => {
  assert.ok(road.length >= 2);
  assert.equal(road[0].x, 0);
  assert.equal(road[0].y, START_Y);
  assert.equal(road[0].w, P1_WIDTH);
  assert.ok(START_WALK < P1_WIDTH, 'точка старта лежит на первой плите');
  for (let i = 1; i < road.length; i++) {
    const gap = road[i].x - (road[i - 1].x + road[i - 1].w);
    assert.ok(gap > 0, `плита ${i + 1}: щель ${gap}`);
  }
});

test('сетка: ширины, ступени, щели и толщина — чётные; ширины и ступени кратны 32', () => {
  assert.equal(PLATE_H, 32);
  assert.equal(ARRIVE_MAIN_W % 32, 0, `плита прибытия ${ARRIVE_MAIN_W}`);
  road.forEach((p, i) => {
    assert.equal(p.w % 32, 0, `плита ${i + 1}: ширина ${p.w}`);
    assert.equal(p.x % 2, 0, `плита ${i + 1}: x ${p.x}`);
    if (i > 0) {
      const dy = p.y - road[i - 1].y;
      assert.equal(Math.abs(dy) % 32, 0, `плита ${i + 1}: ступень ${dy}`);
    }
  });
});

test('дорога в сумме идёт вниз: финал ниже старта (GDD §8.3)', () => {
  const last = road.at(-1);
  assert.ok(last.y > road[0].y, `финал ${last.y - road[0].y} относительно старта`);
});

test('у каждой ширины дороги своя целая плита (решение 2026-10-22)', () => {
  const own = new Set(Object.keys(ROAD_PLATES).map(Number));
  for (const [i, p] of road.entries()) {
    assert.ok(own.has(p.w / 2), `плита ${i + 1}: ширина ${p.w / 2} арт-px без своей плиты`);
  }
});

test('файлы плит на месте', () => {
  const missing = Object.values(ROAD_PLATE_ASSETS).filter((p) => !existsSync(pub(p)));
  assert.deepEqual(missing, []);
  assert.ok(existsSync(pub('assets/road/plat_tiles.png')), 'запасной тайлсет дороги');
});

test('platformAt: находит плиту под ногой, мимо щели — ничего', () => {
  const [a, b] = road;
  assert.equal(platformAt(road, a.x + 10, a.y - 5, a.y + 5), a);
  assert.equal(platformAt(road, b.x + b.w / 2, b.y - 1, b.y + 1), b);
  const midGap = (a.x + a.w + b.x) / 2;
  assert.equal(platformAt(road, midGap, START_Y - 200, START_Y + 200), null);
  assert.equal(platformAt(road, a.x + 10, a.y + 50, a.y + 60), null, 'ниже плиты — не она');
});

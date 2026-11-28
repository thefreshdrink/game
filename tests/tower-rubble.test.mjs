// Тесты кучи обломков Башни и её снимка для предсказания
// (src/minigames/tower/blocks/rubble.js, бэклог 59): куча рисуется от дальних
// обломков к ближним (по слою z, при равном слое — по x + y), исходный
// список не переставляется, ни один обломок не подсвечен акцентом; снимок
// копирует только нужные поля и не зависит от дальнейших изменений сцены;
// clearRubble убирает обломки и корону. Без браузера: node:test, контекст
// канваса — заглушка, спрайтов нет (брусок рисуется гранями). Код сцены не
// трогается — тест фиксирует то, что есть. Запуск — `npm test`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  drawRubble, saveRubble, clearRubble, rubbleSnapshot,
} from '../src/minigames/tower/blocks.js';
import { facesOf, FAR, ACCENT } from '../src/minigames/tower/blocks/iso.js';

// Контекст-заглушка: на каждый брусок первая заливка — верхняя грань тоном
// дальней детали, её первая точка — top[0] из facesOf. По этим точкам и
// восстанавливаем порядок, в котором бруски легли.
function recorder() {
  const tops = [];
  const strokes = new Set();
  let path = [];
  const ctx = {
    fillStyle: '', strokeStyle: '', lineWidth: 1,
    save() {}, restore() {}, translate() {}, scale() {}, drawImage() {},
    fillRect() {}, closePath() {}, lineTo() {},
    beginPath() { path = []; },
    moveTo(x, y) { path.push([x, y]); },
    fill() { if (this.fillStyle === FAR) tops.push(path[0]); },
    stroke() { strokes.add(this.strokeStyle); },
  };
  return { ctx, tops, strokes };
}

const ob = (x, y, z, extra = {}) => ({ x, y, z, dx: 3, dy: 1, tone: 'mid', ...extra });

test('drawRubble: от дальних к ближним — по слою z, потом по x + y', () => {
  const blocks = [
    ob(2, 2, 1, { id: 'верх' }),
    ob(3, 0, 0, { id: 'низ-ближе' }),   // x + y = 3
    ob(0, 1, 0, { id: 'низ-дальше' }),  // x + y = 1
    ob(-1, 0, 1, { id: 'верх-дальше' }),
    ob(0, 0, 2, { id: 'самый верх' }),
  ];
  const { ctx, tops } = recorder();
  drawRubble(ctx, 200, 600, blocks);
  const expected = ['низ-дальше', 'низ-ближе', 'верх-дальше', 'верх', 'самый верх']
    .map((id) => facesOf(200, 600, blocks.find((b) => b.id === id)).top[0]);
  assert.deepEqual(tops, expected);
});

test('drawRubble: исходный список не переставляется, акцента нет', () => {
  const blocks = [ob(0, 0, 3), ob(0, 0, 0), ob(1, 1, 1)];
  const order = blocks.slice();
  const { ctx, tops, strokes } = recorder();
  drawRubble(ctx, 0, 0, blocks);
  assert.deepEqual(blocks, order, 'порядок у сцены прежний');
  assert.ok(blocks.every((b, i) => b === order[i]));
  assert.equal(tops.length, 3, 'каждый обломок нарисован один раз');
  assert.ok(!strokes.has(ACCENT), 'обломки нельзя тронуть — без золотой обводки');
});

test('drawRubble: пустая куча — ничего не рисует', () => {
  const { ctx, tops, strokes } = recorder();
  drawRubble(ctx, 0, 0, []);
  assert.equal(tops.length, 0);
  assert.equal(strokes.size, 0);
});

test('saveRubble: копирует только нужные поля, сцена дальше снимок не меняет', () => {
  const debris = [
    { x: 1.5, y: 0, z: 0, dx: 3, dy: 1, tone: 'gold', vz: -4, rest: true, spin: 0.3 },
    { x: 0, y: 2, z: 1, dx: 1, dy: 3, tone: 'dark', vz: 0, rest: true },
  ];
  saveRubble(debris, 195, 140);
  assert.deepEqual(rubbleSnapshot.blocks, [
    { x: 1.5, y: 0, z: 0, dx: 3, dy: 1, tone: 'gold' },
    { x: 0, y: 2, z: 1, dx: 1, dy: 3, tone: 'dark' },
  ]);
  assert.equal(rubbleSnapshot.ox, 195);
  assert.equal(rubbleSnapshot.oyFromBottom, 140);
  assert.equal(rubbleSnapshot.crown, null, 'без короны — null');

  debris[0].x = 99;
  debris.push({ x: 5, y: 5, z: 5, dx: 3, dy: 1, tone: 'mid' });
  assert.equal(rubbleSnapshot.blocks[0].x, 1.5, 'это копия, а не ссылка');
  assert.equal(rubbleSnapshot.blocks.length, 2);
});

test('saveRubble: корона — только место (x, y, z), тоже копией', () => {
  const crown = { x: 1, y: 1, z: 0, vz: 2, lift: 0.4 };
  saveRubble([], 10, 20, crown);
  assert.deepEqual(rubbleSnapshot.crown, { x: 1, y: 1, z: 0 });
  crown.z = 7;
  assert.equal(rubbleSnapshot.crown.z, 0);
  saveRubble([], 10, 20, null);
  assert.equal(rubbleSnapshot.crown, null);
});

test('clearRubble: обломки и корона убраны, место кучи остаётся', () => {
  saveRubble([ob(0, 0, 0)], 240, 120, { x: 0, y: 0, z: 1 });
  clearRubble();
  assert.deepEqual(rubbleSnapshot.blocks, []);
  assert.equal(rubbleSnapshot.crown, null);
  assert.equal(rubbleSnapshot.ox, 240);
  assert.equal(rubbleSnapshot.oyFromBottom, 120);
});

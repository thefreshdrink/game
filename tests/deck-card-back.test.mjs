// Тесты рубашки карты веера (src/screens/deck/cardBack.js, бэклог 63):
// центр по целым пикселям, подложка #1C1C1C под картинкой, рамка выбора
// только с акцентом и чуть крупнее карты (228×388 к 224×384), сглаживание
// включается только внутри save/restore. Без браузера: node:test, контекст
// канваса — заглушка. Код экрана не трогается — тест фиксирует то, что есть.
// Запуск — `npm test`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawCardBack } from '../src/screens/deck/cardBack.js';

const images = { cardBack: { id: 'back' }, cardSelectFrame: { id: 'frame' } };

// Заглушка: журнал вызовов в порядке, с состоянием сглаживания на момент
// drawImage; save/restore сохраняют и возвращают флаг, как настоящий канвас.
function recorder() {
  const log = [];
  const stack = [];
  const ctx = {
    fillStyle: '',
    imageSmoothingEnabled: false,
    save() { stack.push(this.imageSmoothingEnabled); log.push(['save']); },
    restore() { this.imageSmoothingEnabled = stack.pop(); log.push(['restore']); },
    translate(x, y) { log.push(['translate', x, y]); },
    rotate(a) { log.push(['rotate', a]); },
    fillRect(x, y, w, h) { log.push(['fillRect', x, y, w, h, this.fillStyle]); },
    drawImage(img, x, y, w, h) { log.push(['drawImage', img.id, x, y, w, h, this.imageSmoothingEnabled]); },
  };
  return { ctx, log };
}

test('drawCardBack: центр округляется до целых, поворот как передан', () => {
  const { ctx, log } = recorder();
  drawCardBack(ctx, images, 100.4, 200.6, 224, 384, 0.3, false);
  assert.deepEqual(log[1], ['translate', 100, 201]);
  assert.deepEqual(log[2], ['rotate', 0.3]);
});

test('drawCardBack: подложка #1C1C1C, потом рубашка того же размера', () => {
  const { ctx, log } = recorder();
  drawCardBack(ctx, images, 0, 0, 224, 384, 0, false);
  const fill = log.find((c) => c[0] === 'fillRect');
  assert.deepEqual(fill, ['fillRect', -112, -192, 224, 384, '#1C1C1C']);
  const imgs = log.filter((c) => c[0] === 'drawImage');
  assert.equal(imgs.length, 1, 'без акцента рамки нет');
  assert.deepEqual(imgs[0].slice(0, 6), ['drawImage', 'back', -112, -192, 224, 384]);
  assert.ok(log.indexOf(fill) < log.indexOf(imgs[0]), 'подложка под картинкой');
});

test('drawCardBack: нечётный размер карты — углы всё равно целые', () => {
  const { ctx, log } = recorder();
  drawCardBack(ctx, images, 50, 50, 171, 293, 0, true);
  for (const c of log.filter((c) => c[0] === 'drawImage' || c[0] === 'fillRect')) {
    const from = c[0] === 'drawImage' ? 2 : 1;
    for (const v of c.slice(from, from + 4)) {
      assert.ok(Number.isInteger(v), `${c[0]}: ${v} не целое`);
    }
  }
});

test('drawCardBack: с акцентом рамка выбора поверх, 228×388 при карте 224×384', () => {
  const { ctx, log } = recorder();
  drawCardBack(ctx, images, 0, 0, 224, 384, 0, true);
  const imgs = log.filter((c) => c[0] === 'drawImage');
  assert.equal(imgs.length, 2);
  assert.equal(imgs[0][1], 'back');
  assert.deepEqual(imgs[1].slice(0, 6), ['drawImage', 'frame', -114, -194, 228, 388]);
  // При другой ширине рамка растёт в той же пропорции и стоит по центру.
  const { ctx: c2, log: l2 } = recorder();
  drawCardBack(c2, images, 0, 0, 112, 192, 0, true);
  const f2 = l2.filter((c) => c[0] === 'drawImage')[1];
  assert.deepEqual(f2.slice(2, 6), [-57, -97, 114, 194]);
});

test('drawCardBack: сглаживание только на время рисования, снаружи остаётся выключенным', () => {
  const { ctx, log } = recorder();
  drawCardBack(ctx, images, 0, 0, 224, 384, 1, true);
  for (const c of log.filter((c) => c[0] === 'drawImage')) assert.equal(c[6], true);
  assert.equal(log[0][0], 'save');
  assert.equal(log.at(-1)[0], 'restore');
  assert.equal(ctx.imageSmoothingEnabled, false);
});

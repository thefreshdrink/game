// Тесты экрана 3 «Вытягивание» (src/screens/draw.js, бэклог 67): карта
// 0.8 с лежит рубашкой вверх, потом сама переворачивается за 1.1 с и
// уводит на экран 4; заголовок — та же строка, что на экране 2; карта
// 224×384 по центру на целых пикселях; до середины переворота видна
// рубашка, после — пустая сторона; когда карта стоит ребром — белая
// вертикаль-вспышка. Без браузера: node:test, контекст канваса —
// заглушка. Код экрана не трогается — тест фиксирует то, что есть.
// Запуск — `npm test`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDrawScreen } from '../src/screens/draw.js';
import { t as str } from '../src/data/strings.js';
import { uiScale } from '../src/core/text.js';
import { CARD_W, CARD_H } from '../src/core/cardRender.js';

const images = { cardBack: { id: 'back' }, cardFront: { id: 'front' } };
const DT = 1 / 64; // точный в двоичной записи шаг — без накопления ошибки

// Заглушка канваса: журнал вызовов; save/restore хранят globalAlpha;
// measureText — 10 px на знак, чтобы перенос заголовка был предсказуем.
function recorder() {
  const log = [];
  const stack = [];
  const ctx = {
    fillStyle: '', font: '', letterSpacing: '0px', textAlign: 'start', globalAlpha: 1,
    save() { stack.push(this.globalAlpha); log.push(['save']); },
    restore() { this.globalAlpha = stack.pop(); log.push(['restore']); },
    translate(x, y) { log.push(['translate', x, y]); },
    scale(x, y) { log.push(['scale', x, y]); },
    fillRect(x, y, w, h) { log.push(['fillRect', x, y, w, h, this.fillStyle, this.globalAlpha]); },
    drawImage(img, x, y, w, h) { log.push(['drawImage', img.id, x, y, w, h]); },
    fillText(s, x, y) { log.push(['fillText', s, x, y, this.fillStyle, this.textAlign]); },
    measureText(s) { return { width: s.length * 10 }; },
  };
  return { ctx, log };
}

function makeScreen() {
  const calls = [];
  const s = createDrawScreen({ images, goto: (to) => calls.push(to) });
  s.enter();
  return { s, calls };
}

function run(s, steps) { for (let i = 0; i < steps; i++) s.update(DT); }

function frame(s, w = 390, h = 844) {
  const { ctx, log } = recorder();
  s.draw(ctx, w, h);
  return log;
}

const cards = (log) => log.filter((c) => c[0] === 'drawImage');
const scales = (log) => log.filter((c) => c[0] === 'scale');
const flash = (log) => log.filter((c) => c[0] === 'fillRect' && c[5] === '#FFFFFF');

test('draw: 0.8 с рубашкой вверх — карта не сжимается, экран не уходит', () => {
  const { s, calls } = makeScreen();
  run(s, 51); // 51/64 ≈ 0.797 с
  const log = frame(s);
  assert.deepEqual(cards(log).map((c) => c[1]), ['back']);
  assert.deepEqual(scales(log), [['scale', 1, 1]]);
  assert.equal(flash(log).length, 0);
  assert.deepEqual(calls, []);
});

test('draw: переворот 1.1 с после паузы, потом goto("reveal")', () => {
  const { s, calls } = makeScreen();
  // Пауза кончается на шаге 52 (0.8125 с), и этот же шаг уже идёт в
  // переворот; 1.1 с переворота — ещё 70 шагов: goto на шаге 122.
  run(s, 52);
  assert.ok(scales(frame(s))[0][1] < 1, 'на шаге 52 карта уже сжимается');
  run(s, 69);
  assert.deepEqual(calls, []);
  run(s, 1);
  assert.deepEqual(calls, ['reveal']);
});

test('draw: фон — воздух #111111 во весь экран, первым', () => {
  const { s } = makeScreen();
  const log = frame(s, 1440, 860);
  assert.deepEqual(log[0], ['fillRect', 0, 0, 1440, 860, '#111111', 1]);
});

test('draw: заголовок — строка экрана 2, белым, слева от поля 53·scale, на 70·scale', () => {
  for (const w of [390, 1440]) {
    const { s } = makeScreen();
    const log = frame(s, w, 844);
    const scale = uiScale(w);
    const texts = log.filter((c) => c[0] === 'fillText');
    assert.equal(texts.map((c) => c[1]).join(' '), str('deck.title'));
    assert.equal(texts[0][2], Math.round(53 * scale));
    assert.equal(texts[0][3], Math.round(70 * scale));
    for (const c of texts) { assert.equal(c[4], '#FFFFFF'); assert.equal(c[5], 'left'); }
  }
});

test('draw: длинный заголовок переносится по ширине поля, строки через lineHeight', () => {
  // Заглушка: 10 px на знак, «The deck offers itself…» — 230 px. На 300 px
  // (scale 0.75, поле 300 − 2·40 = 220 px) строка не влезает и переносится.
  const { s } = makeScreen();
  const log = frame(s, 300, 844);
  const texts = log.filter((c) => c[0] === 'fillText');
  const field = 300 - 2 * Math.round(53 * uiScale(300));
  assert.equal(field, 220);
  assert.ok(texts.length >= 2, 'перенос есть');
  for (const c of texts) assert.ok(c[1].length * 10 <= field, `«${c[1]}» шире поля`);
  const lh = Math.round(46 * uiScale(300));
  texts.forEach((c, i) => assert.equal(c[3], Math.round(70 * uiScale(300)) + i * lh));
});

test('draw: карта 224×384 по центру экрана, на целых пикселях, подложка #1C1C1C', () => {
  for (const [w, h] of [[390, 844], [1440, 860], [391, 845]]) {
    const { s } = makeScreen();
    const log = frame(s, w, h);
    const x = Math.round((w - CARD_W) / 2), y = Math.round((h - CARD_H) / 2);
    assert.deepEqual(cards(log)[0], ['drawImage', 'back', x, y, CARD_W, CARD_H]);
    const i = log.findIndex((c) => c[0] === 'drawImage');
    assert.deepEqual(log[i - 1], ['fillRect', x, y, CARD_W, CARD_H, '#1C1C1C', 1]);
    // сжатие — вокруг центра карты
    const tr = log.filter((c) => c[0] === 'translate');
    assert.deepEqual(tr, [['translate', x + CARD_W / 2, y + CARD_H / 2], ['translate', -(x + CARD_W / 2), -(y + CARD_H / 2)]]);
  }
});

test('draw: до середины переворота — рубашка, после — пустая сторона', () => {
  const { s } = makeScreen();
  run(s, 52);
  const seen = [];
  for (let i = 0; i < 69; i++) {
    seen.push(cards(frame(s))[0][1]);
    s.update(DT);
  }
  const firstFront = seen.indexOf('front');
  assert.ok(firstFront > 0, 'пустая сторона появляется не сразу');
  assert.ok(seen.slice(0, firstFront).every((c) => c === 'back'));
  assert.ok(seen.slice(firstFront).every((c) => c === 'front'), 'назад на рубашку не возвращается');
  // easeInOutQuad симметрична: середина по времени — середина переворота,
  // смена стороны около 0.55 с от начала (35 шагов из 70).
  assert.ok(Math.abs(firstFront + 1 - 35) <= 1, `смена на шаге ${firstFront + 1}`);
});

test('draw: ребром карта не сжимается меньше 0.02 — не пропадает совсем', () => {
  const { s } = makeScreen();
  run(s, 52);
  let min = 1;
  for (let i = 0; i < 69; i++) { min = Math.min(min, scales(frame(s))[0][1]); s.update(DT); }
  assert.ok(min >= 0.02);
  assert.ok(min < 0.1, 'но почти ребром');
});

test('draw: вспышка кромки — белая вертикаль 2 px, только когда карта почти ребром', () => {
  const { s } = makeScreen();
  run(s, 52);
  const x = Math.round((390 - CARD_W) / 2), y = Math.round((844 - CARD_H) / 2);
  let flashes = 0;
  for (let i = 0; i < 69; i++) {
    const log = frame(s);
    const sx = Math.max(scales(log)[0][1], 0.02);
    const f = flash(log);
    if (f.length) {
      flashes++;
      assert.deepEqual(f[0].slice(1, 5), [Math.round(x + CARD_W / 2 - 1), y - 6, 2, CARD_H + 12]);
      assert.ok(f[0][6] > 0 && f[0][6] <= 1);
      // вспышка рисуется вне сжатия карты: после её restore, в своём save
      const fi = log.indexOf(f[0]);
      assert.deepEqual(log[fi - 1], ['save']);
      assert.deepEqual(log[fi + 1], ['restore']);
      assert.ok(log.findIndex((c) => c[0] === 'drawImage') < fi);
    } else {
      assert.ok(sx >= 0.14, `без вспышки при scaleX ${sx}`);
    }
    s.update(DT);
  }
  assert.ok(flashes >= 2 && flashes <= 10, `кадров со вспышкой: ${flashes}`);
});

test('draw: после кадра globalAlpha снова 1', () => {
  const { s } = makeScreen();
  run(s, 52 + 34);
  const { ctx } = recorder();
  s.draw(ctx, 390, 844);
  assert.equal(ctx.globalAlpha, 1);
});

test('draw: enter() начинает заново — снова рубашка и пауза', () => {
  const { s, calls } = makeScreen();
  run(s, 100);
  s.enter();
  const log = frame(s);
  assert.deepEqual(cards(log).map((c) => c[1]), ['back']);
  assert.deepEqual(scales(log), [['scale', 1, 1]]);
  run(s, 51);
  assert.deepEqual(scales(frame(s)), [['scale', 1, 1]]);
  assert.deepEqual(calls, []);
});

test('draw: цвета кадра — только из палитры', () => {
  const PALETTE = new Set(['#111111', '#000000', '#FFFFFF', '#B8B8B8', '#4A4A4A', '#808080',
    '#161616', '#1C1C1C', '#212121', '#252525', '#2A2A2A', '#2E2E2E', '#EBA331', '#B07A1C']);
  const { s } = makeScreen();
  for (let i = 0; i < 130; i++) {
    for (const c of frame(s)) if (c[0] === 'fillRect' || c[0] === 'fillText') {
      const col = c[0] === 'fillRect' ? c[5] : c[4];
      assert.ok(PALETTE.has(col), col);
    }
    s.update(DT);
  }
});

test('draw: переворот с разгоном — на первой четверти карта сжата едва-едва', () => {
  // easeInOutQuad: на четверти времени пройдено ~13% переворота, scaleX
  // ≈ 0.92; без кривой было бы ≈ 0.69.
  const { s } = makeScreen();
  run(s, 52 + 17); // 18/64 с переворота ≈ четверть от 1.1 с
  const sx = scales(frame(s))[0][1];
  assert.ok(sx > 0.85 && sx < 0.95, `scaleX ${sx}`);
});

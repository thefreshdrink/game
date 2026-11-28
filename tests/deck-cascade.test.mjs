// Тесты входа карт на экране 2 (src/screens/deck/cascade.js, бэклог 45):
// карты падают с неба, отскакивают от пола и садятся в свои места веера.
// Проверяется инженерная сторона, не замысел: каждая карта садится ровно в
// свой слот и ровно один раз сообщает о финальном отскоке, вход
// одинаковый каждый заход, в полёте карта не уходит за края экрана и ниже
// пола, доворот угла идёт из 0 в свой. Скорость и дуги подбирались в чате
// (история в комментарии cascade.js) — тест их не оценивает, только держит
// верхнюю границу времени, чтобы вход не завис. Код экрана не трогается.
// Без браузера: node:test. Запуск — `npm test`.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CARD_COUNT, layoutFan, cardCenterAt } from '../src/screens/deck/fan.js';
import { stepCascade, placingAngle, CASCADE_STAGGER } from '../src/screens/deck/cascade.js';

const SCREENS = [[390, 844], [1440, 860]];

// Колода как в deck.js: раскладка веера и запуск карт друг за другом
// (deck.js прибавляет ещё CARDS_START — здесь отсчёт от первой карты).
function deck(w, h) {
  const cards = [];
  const pivot = layoutFan(cards, w, h);
  cards.forEach((c, i) => { c.delay = i * CASCADE_STAGGER; });
  return { cards, pivot };
}

// Прогон входа шагами dt (число или функция номера кадра), пока все не сели
// или не вышло время. watch(c, i, t) зовётся после каждого шага.
function run(w, h, { dt = 1 / 60, limit = 10, watch } = {}) {
  const { cards, pivot } = deck(w, h);
  const places = [];
  let t = 0;
  for (let k = 0; t < limit && !cards.every((c) => c.placed); k++) {
    const step = typeof dt === 'function' ? dt(k) : dt;
    t += step;
    stepCascade(cards, pivot, { t, dt: step, w, h, onPlace: (pt) => places.push(pt) });
    if (watch) cards.forEach((c, i) => watch(c, i, t));
  }
  return { cards, pivot, places, t };
}

for (const [w, h] of SCREENS) {
  test(`${w}×${h}: все 20 карт садятся ровно в свой слот, каждая сообщает о посадке один раз`, () => {
    const { cards, pivot, places, t } = run(w, h);
    assert.equal(cards.length, CARD_COUNT);
    assert.ok(cards.every((c) => c.placed), `за ${t.toFixed(2)} с сели не все`);
    cards.forEach((c, i) => {
      const home = cardCenterAt(pivot, c.angle, c.radius);
      assert.ok(Math.abs(c.cx - home.x) < 1e-9 && Math.abs(c.cy - home.y) < 1e-9, `карта ${i} не в слоте`);
      assert.equal(c.bounces, 3, `карта ${i}: финальный отскок — третий контакт с полом`);
    });
    assert.equal(places.length, CARD_COUNT);
    assert.ok(t < 5, `вход длится ${t.toFixed(2)} с`);
  });

  test(`${w}×${h}: до своей очереди карта не трогается, стартует над кадром`, () => {
    const { cards, pivot } = deck(w, h);
    const t = 3 * CASCADE_STAGGER + 0.001;
    stepCascade(cards, pivot, { t, dt: 1 / 60, w, h, onPlace: () => {} });
    cards.forEach((c, i) => {
      if (i <= 3) {
        assert.ok(c.cy < 0, `карта ${i}: старт ${c.cy} не над кадром`);
      } else {
        assert.equal(c.cx, undefined, `карта ${i} стартовала раньше очереди`);
      }
    });
  });

  test(`${w}×${h}: в полёте карта не выходит за края экрана и не опускается ниже пола`, () => {
    run(w, h, {
      watch(c, i) {
        if (c.cx === undefined || c.placing) return;
        assert.ok(c.cx - c.w / 2 >= 0 && c.cx + c.w / 2 <= w, `карта ${i}: x ${c.cx}`);
        assert.ok(c.cy <= h * 0.9, `карта ${i}: y ${c.cy} ниже пола`);
      },
    });
  });

  test(`${w}×${h}: неровный шаг кадра (до 0.033 с, как в deck.js) — всё равно садятся все`, () => {
    const steps = [1 / 120, 0.033, 1 / 60, 0.021, 1 / 90];
    const { cards, pivot } = run(w, h, { dt: (k) => steps[k % steps.length] });
    cards.forEach((c, i) => {
      const home = cardCenterAt(pivot, c.angle, c.radius);
      assert.ok(c.placed && Math.abs(c.cx - home.x) < 1e-9 && Math.abs(c.cy - home.y) < 1e-9, `карта ${i}`);
    });
  });
}

test('вход одинаковый каждый заход', () => {
  const a = run(390, 844);
  const b = run(390, 844);
  assert.deepEqual(a.places, b.places);
  a.cards.forEach((c, i) => {
    assert.equal(c.px, b.cards[i].px, `карта ${i}: точка финального отскока`);
    assert.equal(c.py, b.cards[i].py);
  });
});

test('доворот угла на финальном отскоке: из 0 в свой угол, дальше не крутится', () => {
  const { cards } = deck(390, 844);
  for (const c of cards) {
    c.placeT = 1;
    assert.equal(Math.abs(placingAngle(c, 1)), 0);
    assert.ok(Math.abs(placingAngle(c, 1 + 0.31) - c.angle / 2) < 1e-12, 'середина — половина угла');
    assert.equal(placingAngle(c, 1 + 0.62), c.angle);
    assert.equal(placingAngle(c, 5), c.angle);
  }
});

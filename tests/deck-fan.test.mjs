// Тесты геометрии веера на экране 2 (src/screens/deck/fan.js).
// Веер — единственная часть ритуала без своих тестов. Проверяется
// инженерная сторона, не замысел: два ряда по 10, передний рисуется
// поверх заднего, касание в центр любой карты выбирает именно её,
// верх центральной карты стоит на доле высоты экрана, задний ряд выше
// переднего, дуга симметрична. Срезание крайних карт краем экрана
// разрешено явно (комментарий в fan.js) — его тест не проверяет.
// Без браузера: node:test. Запуск — `npm test`.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CARD_COUNT, layoutFan, cardCenterAt, cardIndexAt } from '../src/screens/deck/fan.js';
import { CARD_W, CARD_H } from '../src/core/cardRender.js';

const SCREENS = [[390, 844], [1440, 860]];
const close = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

test('20 карт, два ряда по 10: сначала задний, потом передний', () => {
  const cards = [];
  layoutFan(cards, 390, 844);
  assert.equal(cards.length, CARD_COUNT);
  assert.equal(CARD_COUNT % 2, 0);
  const half = CARD_COUNT / 2;
  cards.forEach((c, i) => {
    // порядок отрисовки = индекс, поэтому передний ряд (1) должен идти вторым
    assert.equal(c.row, i < half ? 0 : 1, `карта ${i}`);
    assert.equal(c.slot, i % half);
    assert.equal(c.w, CARD_W);
    assert.equal(c.h, CARD_H);
  });
});

test('раскладка дописывает поля в те же объекты и не сбрасывает подъём', () => {
  const cards = [];
  layoutFan(cards, 390, 844);
  const first = cards[3];
  first.spreadR = 0.7;
  layoutFan(cards, 1440, 860); // поворот экрана — та же колода
  assert.equal(cards[3], first);
  assert.equal(first.spreadR, 0.7);
});

for (const [w, h] of SCREENS) {
  test(`${w}×${h}: касание в центр любой карты выбирает её`, () => {
    const cards = [];
    const pivot = layoutFan(cards, w, h);
    cards.forEach((c, i) => {
      const p = cardCenterAt(pivot, c.angle, c.radius);
      assert.equal(cardIndexAt(cards, pivot, p.x, p.y), i, `карта ${i}`);
    });
  });

  test(`${w}×${h}: верх веера на 0.58 высоты, задний ряд выше переднего`, () => {
    const cards = [];
    const pivot = layoutFan(cards, w, h);
    assert.equal(pivot.x, w / 2);
    const half = CARD_COUNT / 2;
    const front = cards.slice(half);
    const back = cards.slice(0, half);
    // верх самой высокой передней карты (угол 0 был бы ровно на 0.58h;
    // у чётного ряда центральной карты нет — ближайшие чуть ниже)
    const topFront = Math.min(...front.map((c) => cardCenterAt(pivot, c.angle, c.radius).y - CARD_H / 2));
    assert.ok(topFront >= h * 0.58 - 1e-6, `верх ${topFront}`);
    assert.ok(topFront - h * 0.58 < 8, `верх ${topFront} слишком низко`);
    back.forEach((c, i) => {
      const yb = cardCenterAt(pivot, c.angle, c.radius).y;
      const yf = cardCenterAt(pivot, front[i].angle, front[i].radius).y;
      assert.ok(yb < yf, `задняя ${i} не выше передней`);
      assert.ok(c.radius > front[i].radius);
    });
  });
}

test('передний ряд симметричен относительно центра, углы растут слева направо', () => {
  const cards = [];
  layoutFan(cards, 390, 844);
  const half = CARD_COUNT / 2;
  const front = cards.slice(half);
  for (let i = 0; i < half; i++) {
    assert.ok(close(front[i].angle, -front[half - 1 - i].angle), `пара ${i}`);
    if (i > 0) assert.ok(front[i].angle > front[i - 1].angle);
  }
  assert.equal(front[0].fx, 0);
  assert.equal(front[half - 1].fx, 1);
});

// Тесты подсказок Шута: src/minigames/fool/leapHints.js — какая подсказка
// видна в каком состоянии сцены. WALK — до первого шага; SWIPE — после
// первого шага на первых плитах (SWIPE_HINT_PLATES = 4, правка 2026-10-24)
// или пока держится «хвост» свайпа; HOLD TO JUMP — на последнем краю, с
// кольцом справа, только когда игрок уже наклоняется.
// Без браузера: вместо canvas — заглушка, которая пишет текст и ячейки,
// остальные вызовы (save/restore/…) пропускает. Запуск — `npm test`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawLeapHints } from '../src/minigames/fool/leapHints.js';
import { t as str } from '../src/data/strings.js';

function fakeCtx() {
  const texts = [];
  const cells = [];
  const base = {
    font: '', letterSpacing: '', textAlign: 'left', textBaseline: 'alphabetic',
    fillStyle: '#000000', globalAlpha: 1,
    measureText(s) {
      const px = Number(/(\d+)px/.exec(this.font)?.[1] ?? 10);
      return { width: s.length * px * 0.5 };
    },
    fillText(text, x, y) { texts.push({ text, x, y, alpha: this.globalAlpha }); },
    fillRect(x, y, w, h) { cells.push({ x, y, w, h, fill: String(this.fillStyle).toUpperCase() }); },
  };
  const ctx = new Proxy(base, {
    get(o, k) { return k in o ? o[k] : () => {}; },
    set(o, k, v) { o[k] = v; return true; },
  });
  return { ctx, texts, cells };
}

const W = 390;
const player = { x: 200, y: 600 };
function draw(over) {
  const f = fakeCtx();
  drawLeapHints(f.ctx, W, 0, 0, {
    state: 'walk', stateT: 1, t: 1, movedEver: false, idx: 0, lean: 0,
    player, swipeLinger: false, ...over,
  });
  return f;
}
const shown = (f) => f.texts.map((x) => x.text);
const lines = (key) => [].concat(str(key));
const gold = (f) => f.cells.filter((c) => c.fill === '#EBA331');

test('на старте, до первого шага — только WALK', () => {
  const f = draw({});
  assert.deepEqual(shown(f), lines('fool.walk'));
});

test('после первого шага на плитах 0–3 — SWIPE со знаком свайпа; с плиты 4 — пусто', () => {
  for (let idx = 0; idx < 4; idx++) {
    const f = draw({ movedEver: true, idx });
    assert.deepEqual(shown(f), lines('fool.swipe'), `плита ${idx}`);
    assert.ok(f.cells.length > 0, `плита ${idx}: знак свайпа нарисован`);
  }
  const f = draw({ movedEver: true, idx: 4 });
  assert.deepEqual(shown(f), []);
  assert.equal(f.cells.length, 0);
});

test('хвост свайпа держит SWIPE дальше 4-й плиты — и в ходьбе, и в полёте', () => {
  assert.deepEqual(shown(draw({ movedEver: true, idx: 6, swipeLinger: true })), lines('fool.swipe'));
  assert.deepEqual(shown(draw({ movedEver: true, idx: 6, swipeLinger: true, state: 'air' })), lines('fool.swipe'));
  // в полёте без хвоста — ничего
  assert.deepEqual(shown(draw({ movedEver: true, idx: 1, state: 'air' })), []);
});

test('на последнем краю — HOLD TO JUMP; кольцо только при наклоне больше 0.02', () => {
  for (const state of ['wait_leap', 'charge']) {
    const f = draw({ state, movedEver: true, idx: 8, swipeLinger: true });
    assert.deepEqual(shown(f), lines('fool.hold'), state);
    assert.equal(f.cells.length, 0, `${state}: без наклона кольца нет`);
  }
  const f = draw({ state: 'charge', movedEver: true, idx: 8, lean: 0.5 });
  assert.deepEqual(shown(f), lines('fool.hold'));
  assert.ok(f.cells.length > 0, 'кольцо нарисовано');
  assert.ok(gold(f).length > 0, 'прогресс кольца — золотом');
  // кольцо справа от надписи
  const textRight = Math.max(...f.texts.map((x) => x.x));
  assert.ok(f.cells.every((c) => c.x > textRight), 'кольцо правее середины надписи');
  // в ожидании (wait_leap) кольца нет даже при наклоне
  assert.equal(draw({ state: 'wait_leap', lean: 0.5 }).cells.length, 0);
});

test('прочие состояния (падение, прибытие, взгляд вниз, финал) — без подсказок', () => {
  for (const state of ['fall', 'arrive', 'lookdown', 'sit', 'brace']) {
    const f = draw({ state, movedEver: true, idx: 2 });
    assert.deepEqual(shown(f), [], state);
  }
});

test('ячейки знаков лежат на чётной сетке 2 px', () => {
  for (const f of [draw({ movedEver: true, idx: 1 }), draw({ state: 'charge', lean: 0.7 })]) {
    for (const c of f.cells) {
      assert.equal(c.x % 2, 0);
      assert.equal(c.y % 2, 0);
    }
  }
});

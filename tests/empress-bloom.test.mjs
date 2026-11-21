// Тесты хода сцены «Bloom» Императрицы (src/minigames/empress/bloom.js).
// Раскладка сада проверена в empress-garden.test.mjs; здесь — порядок трёх
// шагов, как он записан в шапке bloom.js: посадить все шесть клеток →
// коснуться Императрицы → удержать бутон до полного кольца и отпустить →
// после паузы предсказание. Проверяется инженерная сторона: ни шаг не
// пропускается, ни таймер не уводит сам (проиграть нельзя, темп у игрока).
// Без браузера: node:test, canvas — заглушка, draw не вызывается.
// Запуск — `npm test`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function pngSize(rel) {
  const b = readFileSync(join(root, 'public', rel));
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

const noopCtx = new Proxy({}, { get: (o, k) => (k in o ? o[k] : () => {}), set: (o, k, v) => { o[k] = v; return true; } });
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => noopCtx }) };

const { default: passport } = await import('../src/minigames/empress/index.js');
const { createGarden, HOLD_PLOT } = await import('../src/minigames/empress/garden.js');

const images = Object.fromEntries(Object.entries(passport.assets).map(([k, p]) => [k, pngSize(p)]));
const SIZES = [[390, 844], [1440, 860]];

function fakeInput() {
  const subs = new Map();
  return {
    on(type, h) {
      if (!subs.has(type)) subs.set(type, new Set());
      subs.get(type).add(h);
      return () => subs.get(type).delete(h);
    },
    emit(type, e) { [...(subs.get(type) ?? [])].forEach((h) => h(e)); },
  };
}

// Сцена с заглушками; раскладка — тот же createGarden на том же экране,
// он детерминирован, координаты совпадают со сценой.
function setup(w, h) {
  const input = fakeInput();
  const gotos = [];
  const scene = passport.createScene({ input, images, goto: (name) => gotos.push(name) });
  scene.enter('reveal');
  scene.update(0, w, h);
  const g = createGarden(images);
  g.place(w, h);
  const L = g.L;
  // Как менеджер экранов: после goto сцену больше не шагают.
  const run = (sec, step = 1 / 60) => { for (let s = 0; s < sec && !gotos.length; s += step) scene.update(step, w, h); };
  const tap = (x, y) => { input.emit('pressstart', { x, y }); input.emit('pressend', { x, y }); };
  const plantAll = () => L.spots.forEach((s) => tap(s.x, s.y));
  const empress = () => ({ x: L.ex + L.empW / 2, y: L.ey + L.empH / 2 });
  const bud = () => ({ x: L.spots[HOLD_PLOT].x, y: L.spots[HOLD_PLOT].y - 10 });
  return { input, gotos, scene, L, run, tap, plantAll, empress, bud };
}

// Шаги 1–2 и рост: после этого бутон ждёт удержания.
function toHold(c) {
  c.plantAll();
  const e = c.empress();
  c.tap(e.x, e.y);
  c.run(4); // рост: 1.4 + 0.9 + 6×0.12 ≈ 3 с
}

for (const [w, h] of SIZES) {
  test(`bloom ${w}×${h}: полный проход — посадка, касание, удержание, предсказание`, () => {
    const c = setup(w, h);
    toHold(c);
    const b = c.bud();
    c.input.emit('pressstart', b);
    c.run(2); // кольцо — 1.8 с
    c.input.emit('pressend', b);
    assert.deepEqual(c.gotos, [], 'сразу после отпускания ещё тишина');
    c.run(2.5); // пауза 2.2 с
    assert.deepEqual(c.gotos, ['prediction']);
  });

  test(`bloom ${w}×${h}: без касаний сцена никуда не уходит сама`, () => {
    const c = setup(w, h);
    c.run(30);
    assert.deepEqual(c.gotos, []);
    toHold(c);
    c.run(30);
    assert.deepEqual(c.gotos, [], 'бутон ждёт, сколько нужно');
  });

  test(`bloom ${w}×${h}: Императрица не отвечает, пока посажено не всё`, () => {
    const c = setup(w, h);
    c.L.spots.slice(0, 5).forEach((s) => c.tap(s.x, s.y));
    const e = c.empress();
    c.tap(e.x, e.y);
    c.run(4);
    const b = c.bud();
    c.input.emit('pressstart', b);
    c.run(2);
    c.input.emit('pressend', b);
    c.run(3);
    assert.deepEqual(c.gotos, [], 'рост не начался — удерживать нечего');
    // досадили шестую — дальше всё идёт как обычно
    const last = c.L.spots[5];
    c.tap(last.x, last.y);
    c.tap(e.x, e.y);
    c.run(4);
    c.input.emit('pressstart', b);
    c.run(2);
    c.input.emit('pressend', b);
    c.run(2.5);
    assert.deepEqual(c.gotos, ['prediction']);
  });

  test(`bloom ${w}×${h}: семечки сажаются и протягиванием пальца`, () => {
    const c = setup(w, h);
    const [first, ...rest] = c.L.spots;
    c.input.emit('pressstart', first);
    rest.forEach((s) => c.input.emit('pressmove', s));
    c.input.emit('pressend', rest[rest.length - 1]);
    const e = c.empress();
    c.tap(e.x, e.y);
    c.run(4);
    const b = c.bud();
    c.input.emit('pressstart', b);
    c.run(2);
    c.input.emit('pressend', b);
    c.run(2.5);
    assert.deepEqual(c.gotos, ['prediction'], 'одним мазком засажены все шесть');
  });

  test(`bloom ${w}×${h}: отпустил раньше полного кольца — бутон ждёт, кольцо гаснет`, () => {
    const c = setup(w, h);
    toHold(c);
    const b = c.bud();
    c.input.emit('pressstart', b);
    c.run(1); // кольцо чуть больше половины
    c.input.emit('pressend', b);
    c.run(5);
    assert.deepEqual(c.gotos, []);
    // кольцо погасло: снова 1 с — опять не хватает
    c.input.emit('pressstart', b);
    c.run(1);
    c.input.emit('pressend', b);
    c.run(5);
    assert.deepEqual(c.gotos, [], 'удержание не копится через отпускания');
    c.input.emit('pressstart', b);
    c.run(2);
    c.input.emit('pressend', b);
    c.run(2.5);
    assert.deepEqual(c.gotos, ['prediction']);
  });

  test(`bloom ${w}×${h}: удержание мимо бутона не считается`, () => {
    const c = setup(w, h);
    toHold(c);
    const e = c.empress();
    c.input.emit('pressstart', e);
    c.run(3);
    c.input.emit('pressend', e);
    c.run(3);
    assert.deepEqual(c.gotos, []);
  });
}

test('bloom: повторный вход сбрасывает посадку', () => {
  const [w, h] = SIZES[0];
  const c = setup(w, h);
  c.plantAll();
  c.scene.exit();
  c.scene.enter('reveal');
  // после сброса одно касание Императрицы ничего не запускает
  const e = c.empress();
  c.tap(e.x, e.y);
  c.run(4);
  const b = c.bud();
  c.input.emit('pressstart', b);
  c.run(2);
  c.input.emit('pressend', b);
  c.run(3);
  assert.deepEqual(c.gotos, []);
});

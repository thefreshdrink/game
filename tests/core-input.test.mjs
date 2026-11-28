// Тесты единого ввода (src/core/input.js): как касание становится тапом,
// свайпом или удержанием. На этом слое стоят все экраны и все три сцены —
// порог свайпа и задержка удержания меняют ощущение сразу везде.
// Без браузера: node:test, канвас и окно — заглушки, время — своё.
// Запуск — `npm test`.

import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

// input.js при создании слушает resize/orientationchange у окна.
globalThis.window ??= { addEventListener() {} };

const { createInput } = await import('../src/core/input.js');

// Своё время: performance.now и setTimeout двигаются вместе через tick().
let clock = 0;
const realNow = performance.now;

function setup({ left = 0, top = 0 } = {}) {
  clock = 0;
  performance.now = () => clock;
  mock.timers.enable({ apis: ['setTimeout'] });
  const listeners = {};
  const target = {
    getBoundingClientRect: () => ({ left, top }),
    addEventListener(type, h) { listeners[type] = h; },
    setPointerCapture() {},
  };
  const input = createInput(target);
  const log = [];
  for (const type of ['tap', 'swipe', 'holdstart', 'holdmove', 'holdend',
    'pressstart', 'pressmove', 'pressend', 'hover', 'hoverend']) {
    input.on(type, (e) => log.push([type, e]));
  }
  const fire = (type, x, y) => listeners[type]({ clientX: x, clientY: y, pointerId: 1 });
  return {
    input, log,
    types: () => log.map(([t]) => t),
    down: (x, y) => fire('pointerdown', x, y),
    move: (x, y) => fire('pointermove', x, y),
    up: (x, y) => fire('pointerup', x, y),
    cancel: (x, y) => fire('pointercancel', x, y),
    leave: () => listeners.pointerleave({}),
    tick(ms) { clock += ms; mock.timers.tick(ms); },
  };
}

function teardown() {
  mock.timers.reset();
  performance.now = realNow;
}

test('ввод: короткое касание на месте — тап', (t) => {
  t.after(teardown);
  const s = setup();
  s.down(100, 200);
  s.tick(100);
  s.up(103, 204);
  assert.deepEqual(s.types(), ['pressstart', 'pressend', 'tap']);
  assert.deepEqual(s.log.at(-1)[1], { x: 103, y: 204 });
});

test('ввод: координаты — от угла канваса, не окна', (t) => {
  t.after(teardown);
  const s = setup({ left: 500, top: 10 });
  s.down(520, 60);
  s.up(520, 60);
  assert.deepEqual(s.log[0][1], { x: 20, y: 50 });
  assert.deepEqual(s.log.at(-1)[1], { x: 20, y: 50 });
});

test('ввод: сдвиг от 16px — свайп, вверх и вбок нормированы по 120px', (t) => {
  t.after(teardown);
  const s = setup();
  s.down(100, 300);
  s.tick(120);
  s.up(160, 180); // вправо на 60, вверх на 120
  const [type, e] = s.log.at(-1);
  assert.equal(type, 'swipe');
  assert.equal(e.dx, 60);
  assert.equal(e.dy, -120);
  assert.equal(e.up, 1);
  assert.equal(e.side, 0.5);
  assert.equal(e.duration, 120);
  assert.ok(Math.abs(e.distance - Math.hypot(60, 120)) < 1e-9);
  assert.ok(!s.types().includes('tap'));
});

test('ввод: свайп вниз даёт up = 0, сторона влево — со знаком минус', (t) => {
  t.after(teardown);
  const s = setup();
  s.down(200, 100);
  s.up(140, 160);
  const e = s.log.at(-1)[1];
  assert.equal(e.up, 0);
  assert.equal(e.side, -0.5);
});

test('ввод: граница свайпа — 15px ещё не свайп, 16px уже свайп', (t) => {
  t.after(teardown);
  const s = setup();
  s.down(0, 0);
  s.up(15, 0);
  // 15px — больше допуска тапа (10px) и меньше порога свайпа: ничего
  assert.deepEqual(s.types(), ['pressstart', 'pressend']);
  s.down(0, 0);
  s.up(16, 0);
  assert.equal(s.types().at(-1), 'swipe');
});

test('ввод: тап — до 250 мс; дольше без удержания — ничего', (t) => {
  t.after(teardown);
  const s = setup();
  s.down(50, 50);
  s.tick(249); // удержание ещё не началось, 249 ≤ 250 — тап
  s.up(50, 50);
  assert.equal(s.types().at(-1), 'tap');
  // время ушло дальше 250, а таймер удержания не сработал (вкладка в
  // фоне) — касание не считается ни тапом, ни свайпом
  s.down(50, 50);
  clock += 400; // время прошло, таймер не тикал
  s.up(50, 50);
  assert.deepEqual(s.types().slice(-2), ['pressstart', 'pressend']);
});

test('ввод: палец держится 250 мс — удержание, движения несут сдвиг и длительность', (t) => {
  t.after(teardown);
  const s = setup();
  s.down(100, 100);
  s.tick(249);
  assert.ok(!s.types().includes('holdstart'));
  s.tick(1);
  assert.equal(s.types().at(-1), 'holdstart');
  assert.deepEqual(s.log.at(-1)[1], { x: 100, y: 100 });
  s.tick(100);
  s.move(110, 90);
  const hm = s.log.filter(([t]) => t === 'holdmove');
  assert.equal(hm.length, 1);
  assert.deepEqual(hm[0][1], { x: 110, y: 90, dx: 10, dy: -10, duration: 350 });
  s.tick(50);
  s.up(140, 100);
  // отпускание удержания — только holdend, даже если сдвиг как у свайпа
  assert.deepEqual(s.types().slice(-2), ['pressend', 'holdend']);
  assert.deepEqual(s.log.at(-1)[1], { x: 140, y: 100, dx: 40, dy: 0, duration: 400 });
  assert.ok(!s.types().includes('swipe'));
  assert.ok(!s.types().includes('tap'));
});

test('ввод: до начала удержания движение — только pressmove, без holdmove', (t) => {
  t.after(teardown);
  const s = setup();
  s.down(0, 0);
  s.tick(100);
  s.move(5, 5);
  assert.deepEqual(s.types(), ['pressstart', 'hover', 'pressmove']);
});

test('ввод: таймер удержания от прошлого касания не срабатывает после отпускания', (t) => {
  t.after(teardown);
  const s = setup();
  s.down(0, 0);
  s.tick(100);
  s.up(0, 0); // тап
  s.tick(1000);
  assert.ok(!s.types().includes('holdstart'));
  // быстрый второй тап не наследует таймер первого
  s.down(0, 0);
  s.tick(200);
  s.up(0, 0);
  s.tick(1000);
  assert.ok(!s.types().includes('holdstart'));
  assert.equal(s.types().filter((x) => x === 'tap').length, 2);
});

test('ввод: курсор без нажатия — hover, уход с канваса — hoverend', (t) => {
  t.after(teardown);
  const s = setup();
  s.move(30, 40);
  s.leave();
  assert.deepEqual(s.types(), ['hover', 'hoverend']);
  assert.deepEqual(s.log[0][1], { x: 30, y: 40 });
});

test('ввод: pointercancel завершает касание как отпускание, повторный up молчит', (t) => {
  t.after(teardown);
  const s = setup();
  s.down(0, 0);
  s.tick(300); // удержание началось
  s.cancel(0, 0);
  assert.deepEqual(s.types().slice(-2), ['pressend', 'holdend']);
  const n = s.log.length;
  s.up(0, 0); // палец уже не активен
  assert.equal(s.log.length, n);
});

test('ввод: отписка снимает только свой обработчик', (t) => {
  t.after(teardown);
  const s = setup();
  const got = [];
  const off = s.input.on('tap', () => got.push('a'));
  s.input.on('tap', () => got.push('b'));
  s.down(0, 0); s.up(0, 0);
  off();
  s.down(0, 0); s.up(0, 0);
  assert.deepEqual(got, ['a', 'b', 'b']);
});

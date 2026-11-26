// Тесты верха Башни (src/minigames/tower/blocks/top.js, бэклог 62): искры
// вокруг короны — только золото, тень золота и белое ядро, на чётной сетке,
// мерцают, не выходят выше SPARKLE_REACH; якорь крепости — середина самой
// широкой строки силуэта (при равной ширине — нижняя), высота — от неё до
// верха; от неё зависят парение короны и высота башни; крепость и корона
// садятся на свою точку крыши по сетке зерна. Без браузера: node:test,
// контекст канваса и document — заглушки, картинки — силуэты из функции.
// Код сцены не трогается — тест фиксирует то, что есть. Запуск — `npm test`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SPARKLE_REACH, drawSparkles, setTowerTop, crownLift, towerReach, drawCastle, drawCrown,
} from '../src/minigames/tower/blocks.js';
import {
  project, ROWS, ZH, GRAIN, LINE, ACCENT, GOLD_SHADE,
} from '../src/minigames/tower/blocks/iso.js';

// Картинка-силуэт: opaque(x, y) говорит, непрозрачен ли пиксель.
const img = (width, height, opaque) => ({ width, height, opaque });

// document для baseAnchor: канвас отдаёт альфу нарисованной на нём картинки.
globalThis.document = {
  createElement() {
    let drawn = null;
    return {
      width: 0, height: 0,
      getContext: () => ({
        drawImage(i) { drawn = i; },
        getImageData(x0, y0, w, h) {
          const data = new Uint8ClampedArray(w * h * 4);
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) data[(y * w + x) * 4 + 3] = drawn.opaque(x, y) ? 255 : 0;
          }
          return { data };
        },
      }),
    };
  },
};

function recorder() {
  const rects = [];
  const images = [];
  const ctx = {
    fillStyle: '',
    fillRect(x, y, w, h) { rects.push({ x, y, w, h, color: this.fillStyle }); },
    drawImage(i, x, y, w, h) { images.push({ i, x, y, w, h }); },
  };
  return { ctx, rects, images };
}

// Время с шагом 1/60 на 10 секунд — все фазы мерцания.
const TIMES = Array.from({ length: 600 }, (_, k) => k / 60);

test('drawSparkles: только золото, тень золота и белое ядро — на чётной сетке', () => {
  for (const t of TIMES) {
    const { ctx, rects } = recorder();
    drawSparkles(ctx, 200, 300, t);
    for (const r of rects) {
      assert.ok([ACCENT, GOLD_SHADE, LINE].includes(r.color), r.color);
      for (const v of [r.x, r.y, r.w, r.h]) assert.equal(v % 2, 0, `t = ${t}`);
    }
  }
});

test('drawSparkles: у каждой видимой искры ядро 2×2 белым рисуется последним', () => {
  const { ctx, rects } = recorder();
  drawSparkles(ctx, 200, 300, 1.3);
  const cores = rects.filter((r) => r.color === LINE);
  assert.ok(cores.length > 0);
  cores.forEach((c) => { assert.equal(c.w, 2); assert.equal(c.h, 2); });
  assert.equal(rects[rects.length - 1].color, LINE);
  // Каждое ядро закрывает свою искру: перед ним — 4 луча (+4 точки тени).
  let since = 0;
  for (const r of rects) {
    if (r.color === LINE) { assert.ok(since === 4 || since === 8, `${since}`); since = 0; } else since++;
  }
});

test('drawSparkles: мерцают — то гаснут, то вспыхивают с тенью', () => {
  const counts = new Set();
  const shaded = new Set();
  for (const t of TIMES) {
    const { ctx, rects } = recorder();
    drawSparkles(ctx, 200, 300, t);
    counts.add(rects.filter((r) => r.color === LINE).length);
    shaded.add(rects.filter((r) => r.color === GOLD_SHADE).length / 4);
  }
  assert.ok(Math.max(...counts) <= 6, 'искр шесть');
  assert.ok(Math.min(...counts) < Math.max(...counts), 'число видимых меняется');
  assert.ok(Math.max(...shaded) > 0, 'вспышка с тенью бывает');
  assert.ok(shaded.size > 1, 'число искр во вспышке меняется');
});

test('drawSparkles: выше SPARKLE_REACH над центром не выходят, а до него доходят', () => {
  const cx = 200;
  const cy = 300; // в сцене центр короны чётный: корона ставится на чётную точку
  let top = Infinity;
  for (const t of TIMES) {
    const { ctx, rects } = recorder();
    drawSparkles(ctx, cx, cy, t);
    for (const r of rects) top = Math.min(top, r.y);
  }
  assert.equal(SPARKLE_REACH, 64);
  assert.equal(cy - top, SPARKLE_REACH);
});

test('без крепости и короны: корона парит на полряда, высота — от крыши', () => {
  setTowerTop({});
  assert.equal(crownLift(), 0.5);
  const [, y] = project(0, 0, 1.5, 1.5, ROWS + 0.5);
  assert.equal(towerReach(), Math.round(-y + SPARKLE_REACH));
  const { ctx, images } = recorder();
  drawCastle(ctx, 0, 0, 1.5, 1.5, ROWS);
  drawCrown(ctx, 0, 0, { x: 1.5, y: 1.5, z: ROWS }, 0, true);
  assert.equal(images.length, 0, 'рисовать нечего');
});

// Ромб крепости: верх на строке 2, самая широкая строка — 6 (x 1..10),
// ниже снова уже. Якорь — середина строки 6: (1 + 10 + 1) / 2 = 6.
const castle = img(12, 10, (x, y) => {
  if (y < 2 || y > 8) return false;
  const half = 5 - Math.abs(6 - y);           // на строке 6 — 5
  return x >= 6 - half && x <= 5 + half;
});

test('setTowerTop: якорь крепости — середина самой широкой строки', () => {
  setTowerTop({ castle });
  // высота силуэта над якорем: 6 - 2 = 4 строки → корона парит на (4·2 + 10) / ZH
  assert.equal(crownLift(), (4 * GRAIN + 10) / ZH);
  const crown = img(24, 26, () => true);
  setTowerTop({ castle, crown });
  const [, y] = project(0, 0, 1.5, 1.5, ROWS + crownLift());
  assert.equal(towerReach(), Math.round(-y + (26 * GRAIN) / 2 + SPARKLE_REACH));
});

test('setTowerTop: при равной ширине якорь — на нижней из строк', () => {
  // Прямоугольник со строк 3..7 одной ширины: якорь на строке 7.
  setTowerTop({ castle: img(8, 10, (x, y) => y >= 3 && y <= 7 && x >= 2 && x <= 5) });
  assert.equal(crownLift(), (4 * GRAIN + 10) / ZH);
  // Прозрачная картинка не роняет расчёт.
  setTowerTop({ castle: img(4, 4, () => false) });
  assert.ok(Number.isFinite(crownLift()));
});

test('drawCastle: якорь крепости садится на точку крыши, размер ×2, на сетке зерна', () => {
  setTowerTop({ castle });
  for (const [ox, oy] of [[195, 600], [720, 517]]) {
    const { ctx, images } = recorder();
    drawCastle(ctx, ox, oy, 1.5, 1.5, ROWS);
    assert.equal(images.length, 1);
    const d = images[0];
    assert.equal(d.i, castle);
    assert.equal(d.w, 12 * GRAIN);
    assert.equal(d.h, 10 * GRAIN);
    assert.equal(d.x % GRAIN, 0);
    assert.equal(d.y % GRAIN, 0);
    const [px, py] = project(ox, oy, 1.5, 1.5, ROWS);
    assert.ok(Math.abs(d.x + 6 * GRAIN - px) <= GRAIN / 2, 'якорь по x');
    assert.ok(Math.abs(d.y + 6 * GRAIN - py) <= GRAIN / 2, 'якорь по y');
  }
});

test('drawCrown: низ короны по центру в точке, искры — только по флагу', () => {
  const crown = img(24, 26, () => true);
  setTowerTop({ castle, crown });
  const c = { x: 1.5, y: 1.5, z: ROWS + crownLift() };
  for (const [ox, oy] of [[195, 600], [720, 517]]) {
    const off = recorder();
    drawCrown(off.ctx, ox, oy, c, 1.3, false);
    assert.equal(off.images.length, 1);
    assert.equal(off.rects.length, 0, 'без флага искр нет');
    const d = off.images[0];
    assert.equal(d.i, crown);
    assert.equal(d.w, 48);
    assert.equal(d.h, 52);
    assert.equal(d.x % 2, 0);
    assert.equal(d.y % 2, 0);
    const [px, py] = project(ox, oy, c.x, c.y, c.z);
    assert.ok(Math.abs(d.x + d.w / 2 - px) <= 1, 'центр по x');
    assert.ok(Math.abs(d.y + d.h - py) <= 1, 'низ по y');

    const on = recorder();
    drawCrown(on.ctx, ox, oy, c, 1.3, true);
    const ref = recorder();
    drawSparkles(ref.ctx, d.x + d.w / 2, d.y + d.h / 2, 1.3);
    assert.deepEqual(on.rects, ref.rects, 'искры вокруг центра короны');
  }
  setTowerTop({});
});

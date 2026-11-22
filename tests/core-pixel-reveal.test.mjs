// Тесты пиксельного проявления (src/core/pixelReveal.js, бэклог 50): общая
// волна, которой проявляются оракул, портрет карты, рамка дороги Шута,
// грядки Императрицы и сцены под предсказанием. Ячейка открывается, когда
// progress дошёл до её порога = расстояние от origin + немного джиттера;
// тот же вызов с progress 1 → 0 стягивает картинку обратно в origin.
// Без браузера: node:test, canvas — заглушка. Код не трогается — тест
// фиксирует то, что есть. Запуск — `npm test`.

import { test } from 'node:test';
import assert from 'node:assert/strict';

// Заглушка document.createElement('canvas'): контекст запоминает вызовы,
// putImageData копирует маску — по ней видно, какие ячейки открыты.
let created = 0;
function fakeCtx(log) {
  return {
    imageSmoothingEnabled: true,
    globalCompositeOperation: 'source-over',
    clearRect() {},
    drawImage(...a) { log.push({ op: 'drawImage', comp: this.globalCompositeOperation, a }); },
    createImageData(w, h) { return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; },
    putImageData(d) { log.push({ op: 'put', w: d.width, h: d.height, alpha: Array.from(d.data.filter((_, i) => i % 4 === 3)) }); },
  };
}
const scratchLog = [];
globalThis.document = {
  createElement() {
    created++;
    const ctx = fakeCtx(scratchLog);
    return { width: 0, height: 0, getContext: () => ctx };
  },
};

const { drawPixelReveal } = await import('../src/core/pixelReveal.js');

const IMG = { tag: 'img' };

/** Один кадр: что легло на экран и какая маска (cols×rows, 0/1) вышла. */
function frame(progress, { x = 10.4, y = 20.6, w = 64, h = 40, cell = 4, ox = 0.5, oy = 0.4, j = 0.3 } = {}) {
  const out = [];
  const ctx = fakeCtx(out);
  scratchLog.length = 0;
  drawPixelReveal(ctx, IMG, x, y, w, h, progress, cell, ox, oy, j);
  const put = scratchLog.find((e) => e.op === 'put');
  return {
    out,
    scratch: [...scratchLog],
    mask: put ? put.alpha.map((v) => v / 255) : null,
    cols: put?.w, rows: put?.h,
  };
}
const open = (m) => m.reduce((s, v) => s + v, 0);

test('progress 0 и меньше — ничего не рисуется', () => {
  for (const p of [0, -0.5]) {
    const f = frame(p);
    assert.equal(f.out.length, 0);
    assert.equal(f.scratch.length, 0);
  }
});

test('progress 1 и больше — картинка целиком, одним drawImage по целым координатам', () => {
  for (const p of [1, 1.7]) {
    const f = frame(p, { x: 10.4, y: 20.6, w: 63.6, h: 40.2 });
    assert.equal(f.out.length, 1);
    assert.deepEqual(f.out[0].a, [IMG, 10, 21, 64, 40]);
    assert.equal(f.scratch.length, 0, 'без маски и буфера');
  }
});

test('маска — ячейки размером cellSize, каждая либо открыта, либо закрыта', () => {
  const f = frame(0.5, { w: 66, h: 41, cell: 4 });
  assert.equal(f.cols, Math.ceil(66 / 4));
  assert.equal(f.rows, Math.ceil(41 / 4));
  assert.ok(f.mask.every((v) => v === 0 || v === 1));
  assert.ok(open(f.mask) > 0 && open(f.mask) < f.mask.length, 'на середине открыта часть');
});

test('на экран ложится буфер по целым координатам, маска срезает его через destination-in', () => {
  const f = frame(0.5, { x: 10.4, y: 20.6 });
  assert.equal(f.out.length, 1);
  const [img, x, y] = f.out[0].a;
  assert.notEqual(img, IMG, 'на экран идёт буфер, не исходник');
  assert.deepEqual([x, y], [10, 21]);
  const masked = f.scratch.filter((e) => e.op === 'drawImage');
  assert.equal(masked[0].comp, 'source-over', 'сначала исходник в буфер');
  assert.equal(masked[0].a[0], IMG);
  assert.equal(masked.at(-1).comp, 'destination-in', 'потом маска поверх');
});

test('волна только растёт: что открыто раньше, остаётся открытым дальше', () => {
  let prev = null;
  for (let p = 0.02; p < 1; p += 0.02) {
    const { mask } = frame(p);
    if (prev) mask.forEach((v, i) => assert.ok(v >= prev[i], `ячейка ${i} закрылась на p=${p.toFixed(2)}`));
    prev = mask;
  }
});

test('обратный ход (1 → 0) стягивает ту же картинку назад — маски совпадают', () => {
  const ps = [0.15, 0.4, 0.75];
  const fwd = ps.map((p) => frame(p).mask);
  const back = [...ps].reverse().map((p) => frame(p).mask).reverse();
  assert.deepEqual(back, fwd);
});

test('без джиттера идёт ровным кругом от origin: ближние ячейки раньше дальних', () => {
  const cols = 16, rows = 10, ox = 0.5 * cols, oy = 0.4 * rows;
  for (const p of [0.2, 0.5, 0.8]) {
    const { mask } = frame(p, { j: 0 });
    let farOpen = 0, nearShut = Infinity;
    mask.forEach((v, i) => {
      const d = Math.hypot((i % cols) - ox, Math.floor(i / cols) - oy);
      if (v) farOpen = Math.max(farOpen, d); else nearShut = Math.min(nearShut, d);
    });
    assert.ok(farOpen <= nearShut, `p=${p}: открыта ячейка дальше закрытой`);
  }
});

test('с джиттером край неровный, но в своих границах', () => {
  // Порог = dist·(1−j) + rand·j, поэтому при progress p ячейка с dist ≤
  // (p − j)/(1 − j) открыта всегда, а с dist > p/(1 − j) — никогда.
  const cols = 16, rows = 10, ox = 0.5 * cols, oy = 0.4 * rows, j = 0.3;
  const maxD = Math.hypot(Math.max(ox, cols - ox), Math.max(oy, rows - oy));
  let ragged = false;
  for (const p of [0.35, 0.5, 0.65]) {
    const { mask } = frame(p, { j });
    const ring = new Map();
    mask.forEach((v, i) => {
      const d = Math.hypot((i % cols) - ox, Math.floor(i / cols) - oy) / maxD;
      if (d <= (p - j) / (1 - j)) assert.equal(v, 1, `p=${p}: ближняя ячейка закрыта`);
      if (d > p / (1 - j)) assert.equal(v, 0, `p=${p}: дальняя ячейка открыта`);
      const k = d.toFixed(3);
      ring.set(k, (ring.get(k) ?? new Set()).add(v));
    });
    if ([...ring.values()].some((s) => s.size > 1)) ragged = true;
  }
  assert.ok(ragged, 'на одном расстоянии от origin бывают и открытые, и закрытые ячейки');
});

test('первой открывается ячейка у origin — и в углу, и снизу по центру', () => {
  const a = frame(0.02, { ox: 0, oy: 0, j: 0 });
  assert.equal(a.mask[0], 1, 'origin (0,0) — верхний левый угол');
  assert.equal(open(a.mask), 1);
  const b = frame(0.1, { ox: 0.5, oy: 1, j: 0 }); // origin под нижним рядом — ближняя ячейка в 1 ряду от него
  const opened = b.mask.flatMap((v, i) => (v ? [[i % b.cols, Math.floor(i / b.cols)]] : []));
  assert.ok(opened.length > 0);
  assert.ok(opened.every(([, r]) => r === b.rows - 1), 'origin снизу — открывается нижний ряд');
});

test('почти в конце открыто почти всё', () => {
  const { mask } = frame(0.999);
  assert.ok(open(mask) >= mask.length - 1);
});

test('холсты переиспользуются: новый размер — новый буфер, тот же размер — без новых', () => {
  frame(0.5, { w: 50, h: 30 });
  const after = created;
  for (let i = 0; i < 20; i++) frame(0.1 + i * 0.04, { w: 50, h: 30 });
  assert.equal(created, after, 'кадры того же размера не создают холстов');
  frame(0.5, { w: 52, h: 30 });
  assert.equal(created, after + 2, 'новый размер — буфер и маска');
});

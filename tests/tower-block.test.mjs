// Тесты отрисовки одного бруска Башни (src/minigames/tower/blocks/block.js,
// бэклог 64): со спрайтом брусок садится в свой экранный прямоугольник,
// поперечный ряд берёт свой спрайт или тот же зеркально, под пальцем —
// обводка силуэта акцентом поверх; без спрайтов — три грани, две точки
// фактуры и восемь рёбер двойной линией, акцент только у `hot`. Тон без
// спрайта откатывается на mid → light → dark. Без браузера: node:test,
// контекст канваса — заглушка-самописец. Код сцены не трогается — тест
// фиксирует то, что есть. Запуск — `npm test`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawBlock, setBlockSprites, facesOf, blockRect } from '../src/minigames/tower/blocks.js';
import {
  BODY, LINE, LINE2, TEX, FAR, UI, ACCENT,
} from '../src/minigames/tower/blocks/iso.js';

// Самописец: каждый вызов канваса — запись по порядку, со снимком цветов.
function recorder() {
  const calls = [];
  let path = [];
  const ctx = {
    fillStyle: '', strokeStyle: '', lineWidth: 1,
    save() { calls.push({ op: 'save' }); },
    restore() { calls.push({ op: 'restore' }); },
    translate(x, y) { calls.push({ op: 'translate', x, y }); },
    scale(x, y) { calls.push({ op: 'scale', x, y }); },
    drawImage(i, x, y, w, h) { calls.push({ op: 'image', i, x, y, w, h }); },
    fillRect(x, y, w, h) { calls.push({ op: 'rect', x, y, w, h, color: this.fillStyle }); },
    beginPath() { path = []; },
    moveTo(x, y) { path.push([x, y]); },
    lineTo(x, y) { path.push([x, y]); },
    closePath() {},
    fill() { calls.push({ op: 'fill', pts: path, color: this.fillStyle }); },
    stroke() { calls.push({ op: 'stroke', pts: path, color: this.strokeStyle, width: this.lineWidth }); },
  };
  return { ctx, calls };
}

const img = (name) => ({ name, width: 64, height: 44 });
const OX = 195;
const OY = 611;
const LONG = { x: 0, y: 1, z: 4, dx: 3, dy: 1, tone: 'light' };   // ряд вдоль X
const CROSS = { x: 2, y: 0, z: 5, dx: 1, dy: 3, tone: 'dark' };   // поперечный ряд

// Ожидаемые рёбра силуэта/граней — в том порядке, в каком их рисует код.
function edgesOf(o) {
  const f = facesOf(OX, OY, o);
  return [
    [f.top[0], f.top[1]], [f.top[1], f.top[2]], [f.top[2], f.top[3]], [f.top[3], f.top[0]],
    [f.right[1], f.right[2]], [f.right[2], f.right[3]],
    [f.front[2], f.front[3]], [f.front[3], f.front[0]],
  ];
}

const strokes = (calls) => calls.filter((c) => c.op === 'stroke');

test('спрайт: длинный брусок садится ровно в blockRect, без поворотов', () => {
  const light = img('light');
  setBlockSprites({ light, mid: img('mid') });
  const { ctx, calls } = recorder();
  drawBlock(ctx, OX, OY, LONG, false);
  const r = blockRect(OX, OY, LONG);
  assert.deepEqual(calls, [{ op: 'image', i: light, x: r.x, y: r.y, w: r.w, h: r.h }]);
  assert.equal(r.w, 128);   // 64×44 ×2
  assert.equal(r.h, 88);
});

test('спрайт: поперечный ряд берёт свой Cross-спрайт, если он есть', () => {
  const dark = img('dark');
  const darkCross = img('darkCross');
  setBlockSprites({ dark, darkCross });
  const { ctx, calls } = recorder();
  drawBlock(ctx, OX, OY, CROSS, false);
  const r = blockRect(OX, OY, CROSS);
  assert.deepEqual(calls, [{ op: 'image', i: darkCross, x: r.x, y: r.y, w: r.w, h: r.h }]);
});

test('спрайт: поперечный ряд без Cross — тот же спрайт зеркально по правому краю', () => {
  const dark = img('dark');
  setBlockSprites({ dark });
  const { ctx, calls } = recorder();
  drawBlock(ctx, OX, OY, CROSS, false);
  const r = blockRect(OX, OY, CROSS);
  assert.deepEqual(calls, [
    { op: 'save' },
    { op: 'translate', x: r.x + r.w, y: r.y },
    { op: 'scale', x: -1, y: 1 },
    { op: 'image', i: dark, x: 0, y: 0, w: r.w, h: r.h },
    { op: 'restore' },
  ]);
});

test('спрайт: длинный ряд не берёт Cross-спрайт, даже если он есть', () => {
  const light = img('light');
  setBlockSprites({ light, lightCross: img('lightCross') });
  const { ctx, calls } = recorder();
  drawBlock(ctx, OX, OY, LONG, false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].i, light);
});

test('спрайт под пальцем: обводка силуэта акцентом — 8 рёбер поверх картинки', () => {
  setBlockSprites({ light: img('light') });
  for (const o of [LONG, { ...CROSS, tone: 'light' }]) {
    const { ctx, calls } = recorder();
    drawBlock(ctx, OX, OY, o, true);
    const iImg = calls.findIndex((c) => c.op === 'image');
    const s = strokes(calls);
    assert.equal(s.length, 8);
    assert.ok(calls.indexOf(s[0]) > iImg, 'обводка рисуется после спрайта');
    assert.deepEqual(s.map((c) => c.pts), edgesOf(o));
    for (const c of s) {
      assert.equal(c.color, ACCENT);
      assert.equal(c.width, 2);
    }
    assert.ok(!calls.some((c) => c.op === 'fill' || c.op === 'rect'), 'граней поверх спрайта нет');
  }
});

test('тон без своего спрайта: mid, потом light, потом dark; без тона — mid', () => {
  const mid = img('mid');
  const light = img('light');
  const dark = img('dark');
  const pick = (imgs, o) => {
    setBlockSprites(imgs);
    const { ctx, calls } = recorder();
    drawBlock(ctx, OX, OY, o, false);
    return calls.find((c) => c.op === 'image').i;
  };
  assert.equal(pick({ mid, light, dark }, { ...LONG, tone: 'gold' }), mid);
  assert.equal(pick({ light, dark }, { ...LONG, tone: 'gold' }), light);
  assert.equal(pick({ dark }, { ...LONG, tone: 'gold' }), dark);
  assert.equal(pick({ mid, light }, { ...LONG, tone: undefined }), mid);
  // Без тона и Cross берётся midCross.
  const midCross = img('midCross');
  setBlockSprites({ mid, midCross });
  const { ctx, calls } = recorder();
  drawBlock(ctx, OX, OY, { ...CROSS, tone: undefined }, false);
  assert.equal(calls[0].i, midCross);
});

test('без спрайтов: три грани (верх, лицо, бок), две точки фактуры, 8 рёбер', () => {
  setBlockSprites({});
  for (const o of [LONG, CROSS]) {
    const { ctx, calls } = recorder();
    drawBlock(ctx, OX, OY, o, false);
    const f = facesOf(OX, OY, o);
    const fills = calls.filter((c) => c.op === 'fill');
    assert.deepEqual(fills.map((c) => c.color), [FAR, UI, BODY]);
    assert.deepEqual(fills.map((c) => c.pts), [f.top, f.front, f.right]);
    assert.ok(!calls.some((c) => c.op === 'image'));

    const dots = calls.filter((c) => c.op === 'rect');
    assert.equal(dots.length, 2);
    const cx = (f.top[0][0] + f.top[2][0]) / 2;
    const cy = (f.top[0][1] + f.top[2][1]) / 2;
    assert.deepEqual(dots.map(({ x, y, w, h, color }) => ({ x, y, w, h, color })), [
      { x: Math.round(cx - 6), y: Math.round(cy), w: 2, h: 2, color: TEX },
      { x: Math.round(cx + 4), y: Math.round(cy - 4), w: 2, h: 2, color: TEX },
    ]);
    for (const d of dots) {
      assert.ok(Number.isInteger(d.x) && Number.isInteger(d.y));
    }

    const s = strokes(calls);
    assert.deepEqual(s.map((c) => c.pts), edgesOf(o));
    // Двойная линия: дальние рёбра — серые, остальные — белые.
    assert.deepEqual(s.map((c) => c.color),
      [LINE2, LINE, LINE, LINE2, LINE, LINE, LINE, LINE2]);
    // Порядок: грани → фактура → рёбра.
    const last = (op) => calls.map((c) => c.op).lastIndexOf(op);
    const first = (op) => calls.findIndex((c) => c.op === op);
    assert.ok(last('fill') < first('rect') && last('rect') < first('stroke'));
  }
});

test('без спрайтов под пальцем: все рёбра акцентом, грани и фактура без акцента', () => {
  setBlockSprites(null);
  const { ctx, calls } = recorder();
  drawBlock(ctx, OX, OY, LONG, true);
  const s = strokes(calls);
  assert.equal(s.length, 8);
  for (const c of s) assert.equal(c.color, ACCENT);
  for (const c of calls.filter((x) => x.op === 'fill' || x.op === 'rect')) {
    assert.notEqual(c.color, ACCENT);
  }
});

test('не под пальцем акцента нет нигде — ни со спрайтом, ни без', () => {
  for (const imgs of [{}, { light: img('light') }, { dark: img('dark') }]) {
    setBlockSprites(imgs);
    for (const o of [LONG, CROSS]) {
      const { ctx, calls } = recorder();
      drawBlock(ctx, OX, OY, o, false);
      assert.ok(!calls.some((c) => c.color === ACCENT));
      if (imgs.light || imgs.dark) assert.equal(strokes(calls).length, 0);
    }
  }
});

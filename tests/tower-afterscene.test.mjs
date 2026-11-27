// Тесты сцены под предсказанием Башни (src/minigames/tower/afterscene.js,
// бэклог 65): без снимка кучи ничего не рисуется; пол лежит всё время;
// куча снята в буфер и первые 1.4 с лежит целиком, следующие 1.6 с
// растворяется и пропадает; знак вопроса проступает с 70% растворения,
// акцентом, шрифтом Kingdom, рисуется в буфер один раз и только когда
// шрифт загружен; края знака срезаны до 0/255, он увеличен ×2 и стоит на
// чётной сетке по центру кучи; буферы пересобираются только при смене
// размера; exit() очищает снимок. Без браузера: node:test, document и
// канвас — заглушки-самописцы. Код сцены не трогается — тест фиксирует то,
// что есть. Запуск — `npm test`.

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createReleaseAfterscene } from '../src/minigames/tower/afterscene.js';
import {
  saveRubble, rubbleSnapshot, setBlockSprites, setTowerTop, blockRect, project,
} from '../src/minigames/tower/blocks.js';
import { GRAIN } from '../src/minigames/tower/blocks/iso.js';

// Глиф «?» в исходном буфере 16×20: непрозрачен прямоугольник 4..9 × 3..16,
// а полупрозрачная кайма вокруг (альфа 100) должна срезаться в ноль.
let glyph = (x, y) => (x >= 4 && x <= 9 && y >= 3 && y <= 16 ? 255 : (x === 3 || x === 10 ? 100 : 0));

const canvases = [];
let fontReady = true;
const fontCalls = { check: [], load: [] };

function makeCtx(owner) {
  const calls = [];
  let path = [];
  return {
    calls,
    owner,
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textBaseline: '',
    imageSmoothingEnabled: true, globalCompositeOperation: 'source-over',
    save() {}, restore() {}, clip() {}, closePath() {}, translate() {}, scale() {},
    beginPath() { path = []; },
    moveTo(x, y) { path.push([x, y]); },
    lineTo(x, y) { path.push([x, y]); },
    fill() { calls.push({ op: 'fill', pts: path, color: this.fillStyle }); },
    stroke() { calls.push({ op: 'stroke' }); },
    fillRect(x, y, w, h) { calls.push({ op: 'rect', x, y, w, h, color: this.fillStyle }); },
    clearRect() {},
    drawImage(i, ...a) { calls.push({ op: 'image', i, a }); },
    fillText(s, x, y) { calls.push({ op: 'text', s, x, y, font: this.font, color: this.fillStyle }); },
    createImageData(w, h) { return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; },
    getImageData(x0, y0, w, h) {
      const data = new Uint8ClampedArray(w * h * 4);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data[(y * w + x) * 4 + 3] = glyph(x, y);
      return { width: w, height: h, data };
    },
    putImageData(img) { calls.push({ op: 'put', img }); },
  };
}

globalThis.document = {
  createElement(tag) {
    assert.equal(tag, 'canvas');
    const c = { width: 0, height: 0 };
    c.ctx = makeCtx(c);
    c.getContext = () => c.ctx;
    canvases.push(c);
    return c;
  },
  fonts: {
    check(f) { fontCalls.check.push(f); return fontReady; },
    load(f) { fontCalls.load.push(f); return Promise.resolve(); },
  },
};

const W = 390;
const H = 844;
const OY_FROM_BOTTOM = 233;
const BLOCKS = [
  { x: 0, y: 0, z: 0, dx: 3, dy: 1, tone: 'light' },
  { x: 1, y: 2, z: 1, dx: 1, dy: 3, tone: 'dark' },
];
const CROWN_IMG = { name: 'crown', width: 24, height: 26 };
const LIGHT = { name: 'light' };
const DARK = { name: 'dark' };

function mainCtx() { return makeCtx(null); }

beforeEach(() => {
  canvases.length = 0;
  fontReady = true;
  fontCalls.check.length = 0;
  fontCalls.load.length = 0;
  setBlockSprites({ light: LIGHT, dark: DARK });
  setTowerTop({ castle: null, crown: CROWN_IMG });
  saveRubble(BLOCKS, 195, OY_FROM_BOTTOM, { x: 1, y: 1, z: 0 });
});

// Что за кадр: пол (заливки), картинки, какие буферы.
function frame(scene, t, w = W, h = H) {
  const ctx = mainCtx();
  scene.draw(ctx, w, h, t);
  return ctx.calls;
}
const images = (calls) => calls.filter((c) => c.op === 'image');
const groundFills = (calls) => calls.filter((c) => c.op === 'fill');

test('без снимка кучи кадр пустой и холстов не заводится', () => {
  saveRubble([], 0, 0);
  const scene = createReleaseAfterscene();
  for (const t of [0, 1, 2, 3, 5]) assert.deepEqual(frame(scene, t), []);
  assert.equal(canvases.length, 0);
  assert.equal(fontCalls.check.length, 0);
});

test('буфер кучи: ширина экрана, от baseY−280 до низа, обломки и корона внутри', () => {
  const scene = createReleaseAfterscene();
  frame(scene, 0);
  const buf = canvases[0];
  const baseX = Math.round(W / 2);
  const baseY = H - OY_FROM_BOTTOM;
  const top = baseY - 280;
  assert.equal(buf.width, W);
  assert.equal(buf.height, H - top);
  assert.equal(buf.top, top);
  assert.equal(buf.ctx.imageSmoothingEnabled, false);
  const imgs = images(buf.ctx.calls);
  // Обломки — от дальних к ближним, в координатах буфера (смещение на top).
  assert.deepEqual(imgs.slice(0, 2).map((c) => c.i), [LIGHT, DARK]);
  const r0 = blockRect(baseX, baseY - top, BLOCKS[0]);
  assert.deepEqual(imgs[0].a, [r0.x, r0.y, r0.w, r0.h]);
  // Корона — последней, без искр, на чётной сетке.
  const crown = imgs[2];
  assert.equal(crown.i, CROWN_IMG);
  assert.equal(imgs.length, 3);
  const [px, py] = project(baseX, baseY - top, 1, 1, 0);
  const cw = CROWN_IMG.width * GRAIN;
  const ch = CROWN_IMG.height * GRAIN;
  assert.deepEqual(crown.a, [Math.round((px - cw / 2) / 2) * 2, Math.round((py - ch) / 2) * 2, cw, ch]);
  assert.ok(!buf.ctx.calls.some((c) => c.op === 'rect'), 'искр в буфере нет');
});

test('без короны в снимке в буфер ложатся только обломки', () => {
  saveRubble(BLOCKS, 195, OY_FROM_BOTTOM, null);
  const scene = createReleaseAfterscene();
  frame(scene, 0);
  assert.deepEqual(images(canvases[0].ctx.calls).map((c) => c.i), [LIGHT, DARK]);
});

test('ход: 1.4 с куча целиком, до 3.0 с растворяется, потом её нет; пол всегда', () => {
  const scene = createReleaseAfterscene();
  const steps = Array.from({ length: 301 }, (_, k) => k / 60);   // 0..5 с
  let groundN = null;
  for (const t of steps) {
    const calls = frame(scene, t);
    const rubbleBuf = canvases[0];
    const g = groundFills(calls).length;
    groundN ??= g;
    assert.ok(g > 0 && g === groundN, `пол на месте при t=${t}`);
    // Пол рисуется первым.
    assert.equal(calls[0].op, 'fill');
    const imgs = images(calls);
    const whole = imgs.filter((c) => c.i === rubbleBuf);
    const dissolving = imgs.filter((c) => c.i !== rubbleBuf && c.i.width === rubbleBuf.width
      && c.i.height === rubbleBuf.height);
    if (t <= 1.4) {
      assert.equal(whole.length, 1, `куча целиком при t=${t}`);
      assert.deepEqual(whole[0].a, [0, rubbleBuf.top]);
      assert.equal(dissolving.length, 0);
    } else if (t < 3.0 - 1e-9) {
      assert.equal(whole.length, 0, `куча не целиком при t=${t}`);
      assert.equal(dissolving.length, 1, `куча растворяется при t=${t}`);
      assert.deepEqual(dissolving[0].a, [0, rubbleBuf.top]);
    } else {
      assert.equal(whole.length + dissolving.length, 0, `кучи нет при t=${t}`);
    }
  }
});

test('пол — по центру экрана, под точкой, где замерла куча', () => {
  const scene = createReleaseAfterscene();
  const calls = frame(scene, 0);
  const baseX = Math.round(W / 2);
  const baseY = H - OY_FROM_BOTTOM;
  // Первая плита пола — клетка (−4, −4) радиуса 4.
  assert.deepEqual(groundFills(calls)[0].pts[0], project(baseX, baseY, -4, -4, 0));
});

test('знак вопроса: до 70% растворения шрифт даже не спрашивается', () => {
  const scene = createReleaseAfterscene();
  const start = 1.4 + 1.6 * 0.7;
  for (let t = 0; t <= start; t += 1 / 60) frame(scene, t);
  assert.equal(fontCalls.check.length, 0);
  frame(scene, start + 0.01);
  assert.deepEqual(fontCalls.check, ['20px Kingdom']);
});

test('знак вопроса ждёт Kingdom: просит загрузить, не рисует, потом рисует', () => {
  fontReady = false;
  const scene = createReleaseAfterscene();
  frame(scene, 0);
  const before = canvases.length;
  for (const t of [3.6, 3.7]) {
    const calls = frame(scene, t);
    assert.equal(images(calls).length, 0, 'знака нет, пока шрифт не загружен');
  }
  assert.deepEqual(fontCalls.load, ['20px Kingdom', '20px Kingdom']);
  assert.equal(canvases.length, before, 'буфер знака не заводится без шрифта');
  fontReady = true;
  const calls = frame(scene, 3.8);
  assert.equal(images(calls).length, 1);
});

test('знак вопроса: акцент, Kingdom 20px, края срезаны, ×2, на чётной сетке по центру', () => {
  const scene = createReleaseAfterscene();
  frame(scene, 0);
  const calls = frame(scene, 10);
  const [src, mark] = canvases.slice(-2);
  assert.equal(src.width, 16);
  assert.equal(src.height, 20);
  const text = src.ctx.calls.find((c) => c.op === 'text');
  assert.deepEqual(text, { op: 'text', s: '?', x: 2, y: 17, font: '20px Kingdom', color: '#EBA331' });
  const put = src.ctx.calls.find((c) => c.op === 'put');
  for (let i = 3; i < put.img.data.length; i += 4) {
    assert.ok(put.img.data[i] === 0 || put.img.data[i] === 255, 'альфа только 0 или 255');
  }
  // Кайма с альфой 100 срезана: рамка знака — ровно непрозрачный прямоугольник.
  assert.equal(mark.width, 6 * 2);
  assert.equal(mark.height, 14 * 2);
  assert.equal(mark.ctx.imageSmoothingEnabled, false);
  assert.deepEqual(images(mark.ctx.calls)[0].a, [4, 3, 6, 14, 0, 0, 12, 28]);
  // На экране — целиком (проявление завершено), на чётной сетке, по центру.
  const m = images(calls).find((c) => c.i === mark);
  const baseY = H - OY_FROM_BOTTOM;
  const mx = Math.round((W / 2 - 6) / 2) * 2;
  const my = Math.round((baseY - 14) / 2) * 2;
  assert.deepEqual(m.a, [mx, my, 12, 28]);
  assert.equal(mx % 2, 0);
  assert.equal(my % 2, 0);
});

test('знак проявляется 1 с: в середине — через маску, потом целиком', () => {
  const scene = createReleaseAfterscene();
  frame(scene, 0);
  const markStart = 1.4 + 1.6 * 0.7;
  frame(scene, markStart + 0.5);
  const mark = canvases.find((c) => c.width === 12 && c.height === 28);
  const mid = frame(scene, markStart + 0.5);
  assert.ok(!images(mid).some((c) => c.i === mark), 'в середине рисуется не сам буфер, а маска');
  assert.equal(images(mid).filter((c) => c.i.width === 12 && c.i.height === 28).length, 1);
  const full = frame(scene, markStart + 1.01);
  assert.equal(images(full).filter((c) => c.i === mark).length, 1);
});

test('пустой глиф (шрифт подменился) — знака нет, попытка повторяется', () => {
  const keep = glyph;
  glyph = () => 90;   // всё полупрозрачное — после среза пусто
  try {
    const scene = createReleaseAfterscene();
    frame(scene, 0);
    assert.equal(images(frame(scene, 5)).length, 0);
    assert.equal(images(frame(scene, 5.1)).length, 0);
    assert.equal(fontCalls.check.length, 2, 'каждый кадр пробует снова');
  } finally {
    glyph = keep;
  }
});

test('буферы собираются один раз на размер; знак — один раз вообще', () => {
  const scene = createReleaseAfterscene();
  for (let k = 0; k < 120; k++) frame(scene, 0.5 + k / 120);
  const rubbleBufs = () => canvases.filter((c) => c.top !== undefined);
  assert.equal(rubbleBufs().length, 1);
  for (let k = 0; k < 60; k++) frame(scene, 4 + k / 60);
  const marks = canvases.filter((c) => c.width === 12 && c.height === 28 && c.top === undefined
    && c.ctx.calls.some((x) => x.op === 'image'));
  assert.equal(marks.length, 1);
  assert.ok(fontCalls.check.length <= 1, 'после сборки знака шрифт больше не спрашивается');
  // Другой размер экрана — куча пересобирается (а знак buildBuffers сбрасывает — соберётся заново).
  frame(scene, 0, 1440, 860);
  assert.equal(rubbleBufs().length, 2);
  assert.equal(rubbleBufs()[1].width, 1440);
});

test('exit() очищает снимок: следующий заход без Башни ничего не рисует', () => {
  const scene = createReleaseAfterscene();
  frame(scene, 0);
  scene.exit();
  assert.deepEqual(rubbleSnapshot.blocks, []);
  assert.equal(rubbleSnapshot.crown, null);
  assert.deepEqual(frame(scene, 0), []);
});

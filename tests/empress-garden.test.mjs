// Тесты раскладки сада Императрицы (src/minigames/empress/garden.js).
// Сцена «Bloom» — единственная из трёх без своих тестов. Проверяется
// инженерная сторона, не замысел: на экранах из CLAUDE.md (390×844 и
// 1440×860) Императрица, клетки и бутон удержания целиком в кадре, все
// координаты чётные (зерно 2), зона касания Императрицы прощает 16px.
// Размеры картинок читаются из PNG в public/ — тест следует за артом.
// Без браузера: node:test, canvas — заглушка. Запуск — `npm test`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Размер PNG — из заголовка IHDR (ширина и высота — байты 16..23).
function pngSize(rel) {
  const b = readFileSync(join(root, 'public', rel));
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

// Заглушка canvas: фон сада снимается в буфер через document.createElement.
const noopCtx = new Proxy({}, { get: (o, k) => (k in o ? o[k] : () => {}), set: (o, k, v) => { o[k] = v; return true; } });
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => noopCtx }) };

const { default: passport } = await import('../src/minigames/empress/index.js');
const { createGarden, CROP_OF, HOLD_PLOT, GRAIN } = await import('../src/minigames/empress/garden.js');

const images = Object.fromEntries(Object.entries(passport.assets).map(([k, p]) => [k, pngSize(p)]));
const SIZES = [[390, 844], [1440, 860]];
const isEven = (v) => Number.isInteger(v) && v % 2 === 0;

function layout(w, h) {
  const g = createGarden(images);
  g.place(w, h);
  return g;
}

test('сад: шесть клеток, у каждой своё растение, бутон — на одной из них', () => {
  for (const [w, h] of SIZES) assert.equal(layout(w, h).L.spots.length, 6);
  assert.equal(CROP_OF.length, 6);
  for (const n of CROP_OF) assert.ok(images[`empressCrop${n}`], `нет crop_${n} в паспорте`);
  assert.ok(Number.isInteger(HOLD_PLOT) && HOLD_PLOT >= 0 && HOLD_PLOT < 6);
  assert.equal(GRAIN, 2);
});

test('сад: все координаты раскладки чётные (1 арт-пиксель = 2 экранных)', () => {
  for (const [w, h] of SIZES) {
    const { L } = layout(w, h);
    const pts = { sx: L.sx, sy: L.sy, ex: L.ex, ey: L.ey, px: L.px, py: L.py, bx: L.bx, by: L.by,
      gax: L.groveA.x, gay: L.groveA.y, gbx: L.groveB.x, gby: L.groveB.y };
    L.spots.forEach((s, i) => { pts[`spot${i}x`] = s.x; pts[`spot${i}y`] = s.y; });
    for (const [k, v] of Object.entries(pts)) assert.ok(isEven(v), `${w}×${h}: ${k} = ${v}`);
  }
});

test('сад: Императрица целиком в кадре на 390×844 и 1440×860', () => {
  for (const [w, h] of SIZES) {
    const { L } = layout(w, h);
    assert.ok(L.ex >= 0 && L.ex + L.empW <= w, `${w}×${h}: по ширине ${L.ex}..${L.ex + L.empW}`);
    assert.ok(L.ey >= 0 && L.ey + L.empH <= h, `${w}×${h}: по высоте ${L.ey}..${L.ey + L.empH}`);
  }
});

test('сад: блок клеток по ширине в кадре, центры клеток на экране', () => {
  for (const [w, h] of SIZES) {
    const { L } = layout(w, h);
    const blockW = images.empressPlotsDry.width * GRAIN;
    const blockH = images.empressPlotsDry.height * GRAIN;
    assert.ok(L.sx >= 0 && L.sx + blockW <= w, `${w}×${h}: блок ${L.sx}..${L.sx + blockW}`);
    assert.ok(L.sy + blockH <= h, `${w}×${h}: низ блока ${L.sy + blockH}`);
    for (const s of L.spots) assert.ok(s.x > 0 && s.x < w && s.y > 0 && s.y < h, `${w}×${h}: клетка (${s.x}, ${s.y})`);
  }
});

test('сад: бутон удержания и растение над ним не вылезают за верх экрана', () => {
  for (const [w, h] of SIZES) {
    const { L } = layout(w, h);
    const s = L.spots[HOLD_PLOT];
    const crop = images[`empressCrop${CROP_OF[HOLD_PLOT]}`];
    const top = s.y - crop.height * GRAIN + 8;   // как в drawPlant
    assert.ok(top >= 0, `${w}×${h}: верх растения ${top}`);
    assert.ok(s.y < h, `${w}×${h}: бутон ниже экрана (${s.y})`);
  }
});

test('сад: касание Императрицы — по фигуре и с запасом 16px, не дальше', () => {
  const g = layout(390, 844);
  const { L } = g;
  const cx = L.ex + L.empW / 2, cy = L.ey + L.empH / 2;
  assert.ok(g.hitEmpress(cx, cy), 'центр фигуры');
  assert.ok(g.hitEmpress(L.ex - 14, cy), 'запас слева');
  assert.ok(g.hitEmpress(cx, L.ey + L.empH + 14), 'запас снизу');
  assert.ok(!g.hitEmpress(L.ex - 18, cy), 'дальше запаса слева');
  assert.ok(!g.hitEmpress(cx, L.ey - 18), 'дальше запаса сверху');
});

test('сад: фон снимается один раз на размер экрана', () => {
  let made = 0;
  const orig = globalThis.document.createElement;
  globalThis.document.createElement = (...a) => { made++; return orig(...a); };
  try {
    const g = createGarden(images);
    g.place(390, 844); g.place(390, 844);
    assert.equal(made, 1);
    g.place(1440, 860);
    assert.equal(made, 2);
  } finally { globalThis.document.createElement = orig; }
});

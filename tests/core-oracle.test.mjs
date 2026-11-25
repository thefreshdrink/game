// Тесты фигуры оракула (src/core/oracle.js, бэклог 60): общий якорь и
// раскладка для экранов 1 и 2, проявление тела от глаз, глаза отдельным
// слоем. Без браузера: node:test, canvas — заглушка. Код не трогается —
// тест фиксирует то, что есть. Запуск — `npm test`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// drawPixelReveal на промежуточном progress заводит буферы через document —
// здесь хватает заглушки, проверяем только крайние кадры.
globalThis.document = {
  createElement() {
    const ctx = {
      clearRect() {}, drawImage() {}, fillRect() {}, putImageData() {},
      createImageData(w, h) { return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; },
    };
    return { width: 0, height: 0, getContext: () => ctx };
  },
};

const {
  EYES_SRC, ORACLE_TOP_GAP, HEADER_LINES,
  headerBottomY, computeOracleLayout, drawOracleBody, drawOracleEyes,
} = await import('../src/core/oracle.js');

const BODY = { width: 430, height: 678 };

function fakeCtx() {
  const calls = [];
  const ctx = {
    globalAlpha: 1,
    drawImage(...a) { calls.push({ alpha: this.globalAlpha, a }); },
  };
  return { ctx, calls };
}

// Минимальный разбор PNG (8 бит RGBA, без чересстрочки): нужен только
// альфа-канал, чтобы найти, где на холсте глаз реально есть пиксели.
function readPngAlpha(file) {
  const buf = readFileSync(file);
  let pos = 8, w = 0, h = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      assert.equal(data[8], 8, 'ожидается 8 бит на канал');
      assert.equal(data[9], 6, 'ожидается RGBA');
      assert.equal(data[12], 0, 'без чересстрочки');
    }
    if (type === 'IDAT') idat.push(data);
    pos += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const bpp = 4, stride = w * bpp;
  const out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const v = raw[y * (stride + 1) + 1 + x];
      const a = x >= bpp ? out[y * stride + x - bpp] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? out[(y - 1) * stride + x - bpp] : 0;
      let p;
      if (f === 0) p = 0;
      else if (f === 1) p = a;
      else if (f === 2) p = b;
      else if (f === 3) p = (a + b) >> 1;
      else {
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        p = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      out[y * stride + x] = (v + p) & 0xff;
    }
  }
  return { w, h, alpha: (x, y) => out[y * stride + x * bpp + 3] };
}

test('низ шапки — от фиксированных трёх строк, не от текста экрана', () => {
  assert.equal(HEADER_LINES, 3);
  assert.equal(headerBottomY(40, 30, 1), 40 + 3 * 30 + 9);
  // 9 px отступа растут с масштабом и округляются до целого
  assert.equal(headerBottomY(40, 30, 1.5), 40 + 90 + 14);
  assert.ok(Number.isInteger(headerBottomY(17, 23, 1.37)));
});

test('раскладка: фигура ×1, по центру ширины, на ORACLE_TOP_GAP ниже шапки', () => {
  for (const w of [390, 1440, 480]) {
    const l = computeOracleLayout(w, 120, 1, BODY);
    assert.equal(l.oracleW, 430);
    assert.equal(l.oracleH, 678);
    assert.equal(l.oracleScale, 1);
    assert.equal(l.oracleX, Math.round((w - 430) / 2));
    assert.equal(l.oracleY, 120 + ORACLE_TOP_GAP);
  }
  // узкий экран: края уходят за кадр, фигура не сжимается
  const narrow = computeOracleLayout(320, 120, 1, BODY);
  assert.equal(narrow.oracleX, -55);
  assert.equal(narrow.oracleW, 430);
  // отступ растёт с масштабом и остаётся целым
  const l = computeOracleLayout(391, 101, 1.37, BODY);
  assert.ok(Number.isInteger(l.oracleX) && Number.isInteger(l.oracleY));
  assert.equal(l.oracleY, 101 + Math.round(ORACLE_TOP_GAP * 1.37));
});

test('один и тот же якорь даёт одну и ту же фигуру на экранах 1 и 2', () => {
  const y = headerBottomY(48, 32, 1.2);
  assert.deepEqual(computeOracleLayout(390, y, 1.2, BODY), computeOracleLayout(390, y, 1.2, BODY));
});

test('глаза: вырез EYES_SRC ложится на своё место, по целым координатам', () => {
  const { ctx, calls } = fakeCtx();
  const images = { futureTellerEyes: { tag: 'eyes' } };
  const layout = computeOracleLayout(390, 133, 1, BODY);
  drawOracleEyes(ctx, images, layout, 0.6);
  assert.equal(calls.length, 1);
  const [img, sx, sy, sw, sh, dx, dy, dw, dh] = calls[0].a;
  assert.equal(img, images.futureTellerEyes);
  assert.deepEqual([sx, sy, sw, sh], [EYES_SRC.sx, EYES_SRC.sy, EYES_SRC.sw, EYES_SRC.sh]);
  assert.deepEqual([dx, dy, dw, dh], [layout.oracleX + EYES_SRC.sx, layout.oracleY + EYES_SRC.sy, EYES_SRC.sw, EYES_SRC.sh]);
  for (const v of [dx, dy, dw, dh]) assert.ok(Number.isInteger(v));
  assert.equal(calls[0].alpha, 0.6);
  assert.equal(ctx.globalAlpha, 1, 'прозрачность возвращается');
});

test('глаза при alpha 0 и ниже не рисуются и прозрачность не трогают', () => {
  const { ctx, calls } = fakeCtx();
  ctx.globalAlpha = 0.8;
  const layout = computeOracleLayout(390, 133, 1, BODY);
  drawOracleEyes(ctx, { futureTellerEyes: {} }, layout, 0);
  drawOracleEyes(ctx, { futureTellerEyes: {} }, layout, -0.1);
  assert.equal(calls.length, 0);
  assert.equal(ctx.globalAlpha, 0.8);
});

test('тело: progress 1 — картинка целиком на месте раскладки, 0 — ничего', () => {
  const images = { futureTellerBody: { tag: 'body' } };
  const layout = computeOracleLayout(390, 133, 1, BODY);
  const full = fakeCtx();
  drawOracleBody(full.ctx, images, layout, 1, 4);
  assert.equal(full.calls.length, 1);
  assert.deepEqual(full.calls[0].a, [images.futureTellerBody, layout.oracleX, layout.oracleY, 430, 678]);
  const none = fakeCtx();
  drawOracleBody(none.ctx, images, layout, 0, 4);
  assert.equal(none.calls.length, 0);
});

test('в oracle_eyes.png все видимые пиксели внутри выреза EYES_SRC', () => {
  const png = readPngAlpha(join(root, 'public/assets/future_teller/oracle_eyes.png'));
  assert.deepEqual([png.w, png.h], [430, 678], 'тот же холст, что у тела');
  let inside = 0, outside = 0;
  for (let y = 0; y < png.h; y++) {
    for (let x = 0; x < png.w; x++) {
      if (!png.alpha(x, y)) continue;
      const inRect = x >= EYES_SRC.sx && x < EYES_SRC.sx + EYES_SRC.sw
        && y >= EYES_SRC.sy && y < EYES_SRC.sy + EYES_SRC.sh;
      if (inRect) inside++; else outside++;
    }
  }
  assert.ok(inside > 0, 'глаза есть');
  assert.equal(outside, 0, 'ни одного пикселя глаз за вырезом — иначе они обрежутся');
});

test('холст тела совпадает с холстом глаз (слои от одного художника)', () => {
  const buf = readFileSync(join(root, 'public/assets/future_teller/oracle_body.png'));
  assert.deepEqual([buf.readUInt32BE(16), buf.readUInt32BE(20)], [430, 678]);
});

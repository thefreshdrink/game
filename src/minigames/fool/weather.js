// Погода дороги Шута (правка в чате 2026-09-10): дождевые облака наверху и
// морось всю дорогу до финального прыжка. Экранное пространство.

// Дождевые облака НАВЕРХУ (правка в чате 2026-09-10: «там же дождь идёт»).
// Крупные блочные силуэты группами, тон #4A4A4A с более тёмным низом и
// светлой кромкой сверху — объёмнее прежних; медленный параллакс.
const RAIN_CELL = 8;
const RAIN_CLOUDS = [
  // group A
  { bx: 40,   y: 40,  blocks: [[0, 0, 7, 3], [5, -1, 6, 3], [10, 1, 5, 2]] },
  { bx: 150,  y: 96,  blocks: [[0, 0, 5, 2], [3, -1, 5, 3]] },
  // group B
  { bx: 620,  y: 30,  blocks: [[0, 0, 8, 3], [6, 1, 6, 2], [11, -1, 5, 3]] },
  { bx: 760,  y: 110, blocks: [[0, 0, 5, 2], [4, 0, 6, 3]] },
  // group C
  { bx: 1180, y: 56,  blocks: [[0, 0, 7, 3], [5, -1, 6, 2]] },
];
const RAIN_PERIOD = 1500;

export function drawRainClouds(ctx, w, h, camX, t) {
  for (const c of RAIN_CLOUDS) {
    const drift = c.bx - camX * 0.18 - t * 3;
    const base = ((drift % RAIN_PERIOD) + RAIN_PERIOD) % RAIN_PERIOD;
    for (let sx = base - RAIN_PERIOD; sx < w + 160; sx += RAIN_PERIOD) {
      if (sx < -160) continue;
      for (const [ox, oy, bw, bh] of c.blocks) {
        const x = Math.round(sx + ox * RAIN_CELL);
        const y = Math.round(c.y + oy * RAIN_CELL);
        ctx.fillStyle = '#4A4A4A';
        ctx.fillRect(x, y, bw * RAIN_CELL, bh * RAIN_CELL);
        ctx.fillStyle = '#2E2E2E';                       // тёмный низ
        ctx.fillRect(x, y + (bh - 1) * RAIN_CELL, bw * RAIN_CELL, RAIN_CELL);
        ctx.fillStyle = '#808080';                       // светлая кромка сверху
        ctx.fillRect(x + RAIN_CELL, y, (bw - 2) * RAIN_CELL, 2);
      }
    }
  }
}

// Моросящий дождик (правка в чате 2026-09-10) — редкие короткие
// диагональные штрихи тоном дальней детали, низкий контраст, падают с
// лёгким ветром и зациклены по кадру. Экранное пространство, не world:
// лёгкий снос по camX, чтобы дождь не «ехал» с камерой намертво.
const DRIZZLE_N = 46;
const DRIZZLE = [];
for (let i = 0; i < DRIZZLE_N; i++) {
  const r = (i * 2246822519 + 0x9e37) >>> 0;
  DRIZZLE.push({
    x: (r % 1000) / 1000,
    y: ((r >>> 10) % 1000) / 1000,
    v: 0.8 + ((r >>> 20) % 100) / 100 * 0.7, // разброс скорости
    len: 5 + ((r >>> 5) & 3) * 3,
  });
}

export function drawDrizzle(ctx, w, h, t, camX) {
  ctx.save();
  // Тон пустоты сплошным, а не #4A4A4A на половине прозрачности: полупрозрачный
  // даёт цвет вне палитры. Штрих — ячейками 2×2, по сетке сцены.
  ctx.fillStyle = '#2E2E2E';
  const span = h + 40;
  const wind = 2; // наклон штриха, px вправо на каждый px вниз... мягко
  for (const d of DRIZZLE) {
    let y = (d.y * span + t * 260 * d.v) % span - 20;
    let x = (d.x * w - camX * 0.06 + t * 24) % w;
    if (x < 0) x += w;
    for (let s = 0; s < d.len; s += 2) {
      ctx.fillRect(Math.round((x + s / wind) / 2) * 2, Math.round((y + s) / 2) * 2, 2, 2);
    }
  }
  ctx.restore();
}

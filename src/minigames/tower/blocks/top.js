// Верх башни: золотые искры, крепость и корона на крыше (общий вход —
// ../blocks.js).

import { ROWS, ZH, GRAIN, LINE, ACCENT, GOLD_SHADE, project } from './iso.js';

/** Золотые искры вокруг короны — четырёхлучевые звёздочки. Правка 29.09:
 * дальше от короны, мельче, с белым ядром 2×2 и тенью золота по диагоналям
 * — лёгкое свечение в середине, а не плоский крест. Процедурно: мерцание
 * спрайтом не запечёшь. Акцент законен — корону игрок отпускает первой. */
const SPARKLE_SPOTS = [[-38, -18, 2], [32, -28, 1], [-20, -50, 1], [44, 4, 1], [-48, 6, 1], [10, -58, 2]];
export const SPARKLE_REACH = 64;   // верх самой высокой искры над центром короны

export function drawSparkles(ctx, cx, cy, t) {
  SPARKLE_SPOTS.forEach(([dx, dy, arm], k) => {
    const blink = 0.5 + 0.5 * Math.sin(t * 2.2 + k * 1.7);
    if (blink < 0.35) return;
    const x = Math.round((cx + dx) / 2) * 2;
    const y = Math.round((cy + dy) / 2) * 2;
    const a = (blink > 0.75 ? arm + 1 : arm) * 2;
    ctx.fillStyle = ACCENT;
    ctx.fillRect(x - a, y, a, 2);
    ctx.fillRect(x + 2, y, a, 2);
    ctx.fillRect(x, y - a, 2, a);
    ctx.fillRect(x, y + 2, 2, a);
    if (blink > 0.75) {
      ctx.fillStyle = GOLD_SHADE;
      [[-2, -2], [2, -2], [-2, 2], [2, 2]].forEach(([ox, oy]) => ctx.fillRect(x + ox, y + oy, 2, 2));
    }
    ctx.fillStyle = LINE;
    ctx.fillRect(x, y, 2, 2);
  });
}

// --- крепость и корона на крыше ---------------------------------------
// Спрайты — генерация (pixflux), приведённая к палитре. Крепость сажается
// ЦЕНТРОМ СВОЕГО ОСНОВАНИЯ на точку крыши: центр основания — середина
// самой широкой строки силуэта (углы изометрического ромба), считается по
// самому спрайту, поэтому замена картинки не требует новых чисел.
const top = { castle: null, crown: null, anchor: [0, 0], height: 0 };

function baseAnchor(img) {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const a = g.getImageData(0, 0, img.width, img.height).data;
  let best = { w: -1, y: 0, x: 0 };
  let topY = img.height;
  for (let y = 0; y < img.height; y++) {
    let x0 = -1;
    let x1 = -1;
    for (let x = 0; x < img.width; x++) {
      if (a[(y * img.width + x) * 4 + 3] > 127) { if (x0 < 0) x0 = x; x1 = x; }
    }
    if (x0 < 0) continue;
    topY = Math.min(topY, y);
    if (x1 - x0 >= best.w) best = { w: x1 - x0, y, x: (x0 + x1 + 1) / 2 };
  }
  return { anchor: [best.x, best.y], height: best.y - topY };
}

export function setTowerTop({ castle, crown }) {
  top.castle = castle ?? null;
  top.crown = crown ?? null;
  if (castle) Object.assign(top, baseAnchor(castle));
}

/** Где над крышей парит корона — в рядах (единицы z), от крыши. */
export function crownLift() {
  return top.castle ? (top.height * GRAIN + 10) / ZH : 0.5;
}

/** Сколько экранных px башня с крепостью, короной и искрами занимает над
 * основанием — по ней сцена опускает башню под подсказку. */
export function towerReach() {
  const crownH = top.crown ? top.crown.height * GRAIN : 0;
  const [, y] = project(0, 0, 1.5, 1.5, ROWS + crownLift());
  return Math.round(-y + crownH / 2 + SPARKLE_REACH);
}

/** Крепость на крыше: (x, y) — центр крыши в единицах бруска, z — её уровень. */
export function drawCastle(ctx, ox, oy, x, y, z) {
  if (!top.castle) return;
  const [px, py] = project(ox, oy, x, y, z);
  const w = top.castle.width * GRAIN;
  const h = top.castle.height * GRAIN;
  const sx = Math.round((px - top.anchor[0] * GRAIN) / GRAIN) * GRAIN;
  const sy = Math.round((py - top.anchor[1] * GRAIN) / GRAIN) * GRAIN;
  ctx.drawImage(top.castle, sx, sy, w, h);
}

/** Корона: нижний край — в точке (x, y, z). sparkle — искры вокруг (пока
 * она на крепости). */
export function drawCrown(ctx, ox, oy, c, t, sparkle) {
  if (!top.crown) return;
  const [px, py] = project(ox, oy, c.x, c.y, c.z);
  const w = top.crown.width * GRAIN;
  const h = top.crown.height * GRAIN;
  const x = Math.round((px - w / 2) / 2) * 2;
  const y = Math.round((py - h) / 2) * 2;
  ctx.drawImage(top.crown, x, y, w, h);
  if (sparkle) drawSparkles(ctx, x + w / 2, y + h / 2, t);
}

// Сад Императрицы: грядка, три куста, плоды на них, корзина. Раскладка,
// состояния плодов и их отрисовка — без ввода и без погоды (bloom.js).
//
// Плод проходит погоду, только пока висит: дождь делает его мокрым, луна —
// серебряным, последним один становится золотым (docs/empress-proposal.md,
// «Погода Императрицы»). Сорванный плод улетает в корзину, на его месте
// завязывается новый — простой, без погоды.

import { drawPixelReveal } from '../../core/pixelReveal.js';

export const GRAIN = 2;
const even = (v) => Math.round(v / 2) * 2;

// Состояния плода по порядку погоды. Золото — «можно тронуть» (CLAUDE.md).
export const PLAIN = 0;
export const WET = 1;
export const MOON = 2;
export const GOLD = 3;
const FRUIT_IMG = ['empressFruitPlain', 'empressFruitWet', 'empressFruitMoon', 'empressFruitGold'];

const REGROW_DELAY = 3.5;  // с — пустая ветка, потом завязь
const GROW_TIME = 1.2;     // с — завязь проявляется до спелого плода
export const SOAK_TIME = 3; // с под дождём / луной, чтобы плод сменил вид

// Кусты от центра грядки, экранных px; у каждого места для плодов —
// смещения от основания куста. Верхний плод среднего куста — запасной:
// к нему приходит золото, если сорвали всё (страховка из предложения).
// Куст 112 экранных px; кроны крайних свисают за грядку, стволы — на ней.
const BUSHES = [
  { dx: -100, img: 'empressBush1', slots: [[-26, -50], [24, -70], [-4, -88]] },
  { dx: 0, img: 'empressBush2', slots: [[-28, -60], [28, -50], [0, -96]] },
  { dx: 100, img: 'empressBush1', slots: [[-24, -70], [26, -50], [4, -88]], flip: true },
];
const CROWN_SLOT = { bush: 1, slot: 2 };

export function createGarden() {
  const fruits = [];
  let basket = 0;   // сколько собрано — рисуется горкой в корзине
  const layout = { cx: 0, gy: 0 };

  function reset() {
    fruits.length = 0;
    basket = 0;
    BUSHES.forEach((b, bi) => b.slots.forEach(([sx, sy], si) => {
      fruits.push({
        bush: bi, slot: si, ox: b.dx + sx, oy: sy,
        state: PLAIN, grow: 1, gone: false, regrow: 0, soak: 0, age: 0, sway: 0, kept: false,
      });
    }));
  }

  /** cx — центр грядки, gy — верх грядки (линия, на которой стоят кусты). */
  function place(w, h) {
    layout.cx = even(w / 2);
    layout.gy = even(h * 0.62);
  }

  const ripe = (f) => !f.gone && f.grow >= 1;
  const pos = (f) => ({ x: layout.cx + f.ox, y: layout.gy + f.oy });

  function step(dt) {
    fruits.forEach((f) => {
      f.sway *= Math.max(0, 1 - dt * 5);
      if (f.gone) {
        f.regrow -= dt;
        if (f.regrow <= 0) { f.gone = false; f.grow = 0; f.state = PLAIN; f.soak = 0; f.age = 0; }
        return;
      }
      if (f.grow < 1) f.grow = Math.min(1, f.grow + dt / GROW_TIME);
      else f.age += dt;
    });
  }

  /** Погода вызывает каждый кадр: from — какое состояние она меняет. */
  function weather(dt, from) {
    const changed = [];
    fruits.forEach((f) => {
      if (!ripe(f) || f.state !== from) return;
      f.soak += dt;
      if (f.soak >= SOAK_TIME) { f.state = from + 1; f.soak = 0; changed.push(f); }
    });
    return changed;
  }

  /** Сорвать плод (свайп или тап по нему). Золото не срывается — качается. */
  function pick(f) {
    if (!ripe(f)) return false;
    if (f.state === GOLD || f.kept) { f.sway = 1; return false; }
    f.gone = true;
    f.regrow = REGROW_DELAY;
    return true;
  }

  /** Кому достаётся золото: самый «проживший» висящий плод. Если не висит
   * ни одного, верхний плод среднего куста завязывается сразу спелым. */
  function crownGold() {
    let best = null;
    fruits.forEach((f) => {
      if (!ripe(f)) return;
      if (!best || f.state > best.state || (f.state === best.state && f.age > best.age)) best = f;
    });
    if (!best) {
      best = fruits.find((f) => f.bush === CROWN_SLOT.bush && f.slot === CROWN_SLOT.slot);
      best.gone = false; best.grow = 1; best.state = MOON;
    }
    best.state = GOLD;
    return best;
  }

  /** Плоды, которых коснулся отрезок пальца (a → b), с запасом r. */
  function hitSegment(ax, ay, bx, by, r) {
    const out = [];
    fruits.forEach((f) => {
      if (!ripe(f)) return;
      const p = pos(f);
      const vx = bx - ax, vy = by - ay;
      const len2 = vx * vx + vy * vy || 1;
      const k = Math.max(0, Math.min(1, ((p.x - ax) * vx + (p.y - ay) * vy) / len2));
      if (Math.hypot(ax + vx * k - p.x, ay + vy * k - p.y) <= r) out.push(f);
    });
    return out;
  }

  // Корзина стоит на земле справа от грядки.
  const basketPos = (images) => ({
    x: layout.cx + 136,
    y: layout.gy + 46 - images.empressBasket.height * GRAIN,
  });
  // Горка в корзине: плоды выглядывают над краем, до шести.
  const PILE = [[4, -8], [18, -8], [11, -18], [-2, -16], [24, -18], [11, -28]];

  function drawBed(ctx, images) {
    const bed = images.empressBed;
    ctx.drawImage(bed, layout.cx - bed.width, layout.gy, bed.width * GRAIN, bed.height * GRAIN);
  }

  function drawBushes(ctx, images) {
    BUSHES.forEach((b) => {
      const img = images[b.img];
      const bw = img.width * GRAIN, bh = img.height * GRAIN;
      const x = layout.cx + b.dx - bw / 2, y = layout.gy + 4 - bh;
      if (b.flip) {
        ctx.save(); ctx.translate(x + bw, y); ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0, bw, bh); ctx.restore();
      } else ctx.drawImage(img, x, y, bw, bh);
    });
  }

  function drawFruit(ctx, images, f, t, droop = 0) {
    if (f.gone) return;
    const img = images[FRUIT_IMG[f.kept ? MOON : f.state]];
    const fw = img.width * GRAIN, fh = img.height * GRAIN;
    const p = pos(f);
    const sx = even(Math.sin(t * 14) * f.sway * 4);
    const x = p.x - fw / 2 + sx, y = p.y - fh / 2 + droop;
    if (f.grow < 1) drawPixelReveal(ctx, img, x, y, fw, fh, f.grow, 2, 0.5, 0.2, 0.2);
    else ctx.drawImage(img, x, y, fw, fh);
  }

  function drawFruits(ctx, images, t, droopOf) {
    fruits.forEach((f) => drawFruit(ctx, images, f, t, droopOf(f)));
  }

  function drawBasket(ctx, images) {
    const b = basketPos(images);
    const fr = images.empressFruitPlain;
    PILE.slice(0, Math.min(PILE.length, basket)).forEach(([dx, dy]) => {
      ctx.drawImage(fr, b.x + dx - 6, b.y + dy, fr.width * GRAIN, fr.height * GRAIN);
    });
    const img = images.empressBasket;
    ctx.drawImage(img, b.x, b.y, img.width * GRAIN, img.height * GRAIN);
  }

  return {
    fruits, layout, reset, place, step, weather, pick, crownGold, hitSegment, pos,
    basketPos, addToBasket() { basket++; },
    drawBed, drawBushes, drawFruits, drawFruit, drawBasket,
  };
}

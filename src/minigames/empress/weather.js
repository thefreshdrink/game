// Небо Императрицы: фон-поля кодом (tools/backdrop-hills.py), дождь каплями
// и луна. Погода идёт сама по кругу ясно → дождь → луна; игрок ею не
// управляет — как в Grow a Garden, только меняет она не цену, а вид плода.

import { drawPixelReveal } from '../../core/pixelReveal.js';
import { clamp01 } from '../../core/ease.js';
import { GRAIN } from './garden.js';

const even = (v) => Math.round(v / 2) * 2;

// Длительности кругов погоды, с. Сумма ≈ 36 с до золота — вместе со
// сбором и удержанием мини-игра укладывается в 45–75 с (GDD §8.1).
export const CLEAR = 10;
export const RAIN = 13;
export const MOON = 13;

const RAIN_RATE = 12;      // капель в секунду
const RAIN_FALL = 300;     // экранных px/с
const SPLASH_LIFE = 0.16;  // всплеск на грядке
const MOON_REVEAL = 2.4;   // луна проступает медленно

// Гребень дальних холмов на картинке фона — арт-px от её верха (как
// --top у backdrop-hills.py); его ставим на RIDGE_ABOVE над грядкой.
const RIDGE_ART = 196;
const RIDGE_ABOVE = 150;

export function weatherAt(tW) {
  if (tW < CLEAR) return 'clear';
  if (tW < CLEAR + RAIN) return 'rain';
  if (tW < CLEAR + RAIN + MOON) return 'moon';
  return 'gold';
}

export function createSky() {
  let drops = [];
  let spawn = 0;
  let moonT = 0;

  return {
    reset() { drops = []; spawn = 0; moonT = 0; },

    /** raining — идёт ли дождь сейчас; quiet — мир стих (удержание). */
    update(dt, w, gy, { raining, moonUp }) {
      if (raining) {
        spawn += dt * RAIN_RATE;
        while (spawn >= 1) {
          spawn -= 1;
          drops.push({ x: even(Math.random() * w), y: -20 - Math.random() * 40, k: 3, splash: -1 });
        }
      }
      drops.forEach((d) => {
        if (d.splash >= 0) { d.splash += dt; return; }
        d.y += RAIN_FALL * dt;
        if (d.y >= gy + 8) { d.y = gy + 8; d.splash = 0; }
      });
      drops = drops.filter((d) => d.splash < SPLASH_LIFE);
      if (moonUp) moonT += dt;
    },

    drawBackdrop(ctx, images, w, h, gy) {
      const bd = images.empressBackdrop;
      const bw = bd.width * GRAIN, bh = bd.height * GRAIN;
      const top = even(gy - RIDGE_ABOVE - RIDGE_ART * GRAIN);
      ctx.drawImage(bd, even((w - bw) / 2), top, bw, bh);
      if (top + bh < h) {
        ctx.fillStyle = images.empressBackdropBottom;
        ctx.fillRect(0, top + bh, w, h - top - bh);
      }
    },

    drawMoon(ctx, images, w, h) {
      if (moonT <= 0) return;
      const m = images.empressMoon;
      const mw = m.width * GRAIN, mh = m.height * GRAIN;
      drawPixelReveal(ctx, m, even(w * 0.72 - mw / 2), even(h * 0.17), mw, mh, clamp01(moonT / MOON_REVEAL), 2, 0.5, 0.5, 0.3);
    },

    drawRain(ctx, images) {
      drops.forEach((d) => {
        const img = d.splash >= 0 ? images.empressDrop4 : images[`empressDrop${d.k}`];
        const dw = img.width * GRAIN, dh = img.height * GRAIN;
        ctx.drawImage(img, even(d.x - dw / 2), even(d.y - dh), dw, dh);
      });
    },
  };
}

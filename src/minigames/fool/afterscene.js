// Под предсказанием Шута — та же композиция, что в такте 3 падения: Шут с
// псом на плите у нижней кромки (правка в чате 2026-08-30: «размести сцену
// внизу экрана, предсказание проявляй поверх фона верхней части») — экраны
// 5→6 склеиваются без скачка. Ступенька справа убрана 2026-10-24 — по ней
// пытались идти.
//
// «Другой мир» (решение 2026-10-25, после пробы трёх вариантов): фон холмов
// как в игре, но ниже; мягкое солнце медленно встаёт из-за дальнего гребня
// и замирает наполовину; на плите рядом с Шутом вырастает белая роза —
// символ карты Шута в колоде Райдера–Уэйта.

import { buildRoadStrip, ARRIVE_GROUND_FRAC, ARRIVE_MAIN_W } from './platforms.js';
import { drawBackdrop, BACKDROP_DROP } from './scenery.js';
import { drawPixelReveal } from '../../core/pixelReveal.js';
import { clamp01 } from '../../core/ease.js';
import { PLAYER_W, PLAYER_H, DOG_W, DOG_H, IDLE_FPS } from './actors.js';

const RISE_DELAY = 0.6;  // с, после входа на экран
const RISE_TIME = 5;     // с, круг выходит из-за гребня целиком
const RISE_R = 26;       // радиус круга, экранных px
// На экране предсказания холмы ниже, чем в игре (правка 2026-10-24).
const AFTER_DROP = 60;
const ROSE_DELAY = 1.6;  // с — роза проступает, когда текст уже пошёл
const ROSE_TIME = 2.2;  // медленно — растёт, а не вспыхивает

const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
// От центра к краю и дальше в свечение: тоны палитры, переход — дизером.
const SUN_RAMP = ['#808080', '#4A4A4A', '#2E2E2E', '#252525', '#212121'];

/** Мягкое солнце (правка 2026-10-24: «мягче, градиентно»): круг ячейками
 * 2×2, тон по расстоянию от центра, между тонами — Байер 4×4, снаружи —
 * редкое свечение до 1.7 R. Без лучей. */
function drawSoftSun(ctx, cx, cy, r) {
  const outer = r * 1.7;
  for (let dy = -outer; dy <= outer; dy += 2) {
    for (let dx = -outer; dx <= outer; dx += 2) {
      const d = Math.hypot(dx, dy);
      if (d > outer) continue;
      // 0..1 внутри круга, 1..2 — свечение
      const g = d <= r ? (d / r) * 1.5 : 1.5 + ((d - r) / (outer - r)) * 2.5;
      const lo = Math.min(SUN_RAMP.length - 1, Math.floor(g));
      const frac = g - lo;
      const bx = ((cx + dx) / 2) & 3;
      const by = ((cy + dy) / 2) & 3;
      let idx = frac * 16 > BAYER[by][bx] + 0.5 ? lo + 1 : lo;
      if (idx >= SUN_RAMP.length) continue; // за краем свечения — небо
      if (d > r && BAYER[by][bx] < 8 + (d - r) / (outer - r) * 8) continue; // свечение редкое
      ctx.fillStyle = SUN_RAMP[idx];
      ctx.fillRect(cx + dx, cy + dy, 2, 2);
    }
  }
}

/** Высота гребня переднего плана холмов в экранной колонке x: первая
 * непрозрачная строка картинки foolBackdropFront (кешируется). */
let ridgeCache = null;
function ridgeScreenY(images, w, x) {
  const img = images.foolBackdropFront;
  if (!ridgeCache) {
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, img.width, img.height).data;
    ridgeCache = new Array(img.width).fill(img.height);
    for (let ix = 0; ix < img.width; ix++) {
      for (let iy = 0; iy < img.height; iy++) {
        if (d[(iy * img.width + ix) * 4 + 3]) { ridgeCache[ix] = iy; break; }
      }
    }
  }
  // фон шире экрана кладётся по центру (scenery.js drawBackdrop)
  const bw = img.width * 2;
  const ix = Math.max(0, Math.min(img.width - 1, Math.floor((x - (w - bw) / 2) / 2)));
  return BACKDROP_DROP + AFTER_DROP + ridgeCache[ix] * 2;
}

export function createLeapAfterscene({ images }) {
  let ground = null;

  return {
    enter() {
      if (!ground) ground = buildRoadStrip(images, ARRIVE_MAIN_W);
    },

    /** t — секунды с входа на экран предсказания. */
    draw(ctx, w, h, t) {
      const gy = Math.round(h * ARRIVE_GROUND_FRAC);
      const gw = ground.width;
      const gx = Math.round(w / 2 - gw / 2 - 28);
      const fcx = gx + Math.round(gw * 0.44);

      drawBackdrop(ctx, images, w, h, 0, 0, images.foolBackdrop, true, AFTER_DROP);
      // Солнце встаёт из-за гребня и останавливается НАПОЛОВИНУ — центр
      // ровно на линии холма, нижняя половина срезана передним планом.
      const sx = Math.round((w * 0.72) / 2) * 2;
      const ridgeY = ridgeScreenY(images, w, sx);
      const k = clamp01((t - RISE_DELAY) / RISE_TIME);
      const e = 1 - (1 - k) * (1 - k);
      const cy = Math.round((ridgeY + RISE_R * 1.8 - e * RISE_R * 1.8) / 2) * 2;
      drawSoftSun(ctx, sx, cy, RISE_R);
      drawBackdrop(ctx, images, w, h, 0, 0, images.foolBackdropFront, false, AFTER_DROP);

      ctx.drawImage(ground, gx, gy);

      // Роза растёт на той же плите, справа от Шута: проявление идёт от
      // основания стебля вверх — «как растение».
      const r = images.foolRose;
      const rw = r.width * 2;
      const rh = r.height * 2;
      drawPixelReveal(ctx, r, fcx + 44, gy - rh, rw, rh, clamp01((t - ROSE_DELAY) / ROSE_TIME), 2, 0.5, 1, 0.15);

      const dogImg = images.dogSitFrames[Math.floor(t * 4) % images.dogSitFrames.length];
      ctx.drawImage(dogImg, fcx - PLAYER_W / 2 - DOG_W - 2, gy - DOG_H, DOG_W, DOG_H);
      const fr = images.foolIdleFrames;
      ctx.drawImage(fr[Math.floor(t * IDLE_FPS) % fr.length], fcx - PLAYER_W / 2, gy - PLAYER_H, PLAYER_W, PLAYER_H);
    },
  };
}

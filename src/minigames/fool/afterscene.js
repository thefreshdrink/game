// Под предсказанием Шута — та же композиция, что в такте 3 падения: Шут с
// псом на дороге у нижней кромки (правка в чате 2026-08-30: «размести сцену
// внизу экрана, предсказание проявляй поверх фона верхней части») — экраны
// 5→6 склеиваются без скачка. «Другой мир»: солнце в верхнем углу. Ступенька
// справа убрана 2026-10-24 — по ней пытались идти. Статична: прибытие уже
// отыграно.
//
// ПРОБА 2026-10-24 — что проступает над плитой, адрес ?above=:
//   sun  — (по умолчанию) солнце с лучами низко над плитой, как было;
//   rise — фон холмов как в игре, солнце простым кругом медленно выходит
//          из-за дальнего гребня;
//   rose — фон холмов, над плитой с задержкой проступает белая роза
//          (символ карты Шута в колоде Райдера–Уэйта).
// После выбора оставить один путь.

import { buildRoadStrip, ARRIVE_GROUND_FRAC, ARRIVE_MAIN_W } from './platforms.js';
import { drawArrivalSun, arrivalSunPlace } from './arrivalScene.js';
import { drawBackdrop, BACKDROP_DROP } from './scenery.js';
import { drawPixelReveal } from '../../core/pixelReveal.js';
import { clamp01 } from '../../core/ease.js';
import { PLAYER_W, PLAYER_H, DOG_W, DOG_H, IDLE_FPS } from './actors.js';

const ABOVE = (() => {
  try { return new URLSearchParams(location.search).get('above') || 'sun'; } catch { return 'sun'; }
})();

const RISE_DELAY = 0.6;  // с, после входа на экран
const RISE_TIME = 5;     // с, круг выходит из-за гребня целиком
const RISE_R = 22;       // радиус круга, экранных px
const ROSE_DELAY = 1.6;  // с — роза проступает, когда текст уже пошёл
const ROSE_TIME = 1.4;

/** Простой пиксельный круг ячейками 2×2 — без лучей и бликов. */
function drawDisc(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  for (let dy = -r; dy <= r; dy += 2) {
    const hw = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)) / 2) * 2;
    ctx.fillRect(cx - hw, cy + dy, hw * 2, 2);
  }
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

      if (ABOVE === 'sun') {
        // Солнце проступает вместе с заголовком.
        const sun = arrivalSunPlace(w, h, gy);
        drawArrivalSun(ctx, sun.cx, sun.cy, t, Math.min(1, t / 0.3), sun);
      } else {
        drawBackdrop(ctx, images, w, h, 0, 0);
        if (ABOVE === 'rise') {
          // Круг встаёт из-за самого дальнего гребня (слой 0, ≈ 200 арт-px
          // картинки фона): за всеми холмами, ease-out, и останавливается
          // над гребнем.
          const ridgeY = BACKDROP_DROP + 200 * 2;
          const k = clamp01((t - RISE_DELAY) / RISE_TIME);
          const e = 1 - (1 - k) * (1 - k);
          const cy = Math.round((ridgeY + RISE_R + 4 - e * (RISE_R * 2 + 60)) / 2) * 2;
          drawDisc(ctx, Math.round((w * 0.7) / 2) * 2, cy, RISE_R, '#808080');
          drawBackdrop(ctx, images, w, h, 0, 0, images.foolBackdropFront, false);
        }
      }

      ctx.drawImage(ground, gx, gy); // ступеньки справа нет (решение 2026-10-24)

      if (ABOVE === 'rose' && images.foolRose) {
        const r = images.foolRose;
        const rw = r.width * 2;
        const rh = r.height * 2;
        const p = clamp01((t - ROSE_DELAY) / ROSE_TIME);
        // над плитой справа от Шута, на уровне его головы
        drawPixelReveal(ctx, r, gx + gw - rw - 8, gy - PLAYER_H - 24, rw, rh, p, 2, 0.5, 1, 0.35);
      }

      const dogImg = images.dogSitFrames[Math.floor(t * 4) % images.dogSitFrames.length];
      ctx.drawImage(dogImg, fcx - PLAYER_W / 2 - DOG_W - 2, gy - DOG_H, DOG_W, DOG_H);
      const fr = images.foolIdleFrames;
      ctx.drawImage(fr[Math.floor(t * IDLE_FPS) % fr.length], fcx - PLAYER_W / 2, gy - PLAYER_H, PLAYER_W, PLAYER_H);
    },
  };
}

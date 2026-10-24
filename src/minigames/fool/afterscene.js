// Под предсказанием Шута — та же композиция, что в такте 3 падения: Шут с
// псом на дороге у нижней кромки (правка в чате 2026-08-30: «размести сцену
// внизу экрана, предсказание проявляй поверх фона верхней части») — экраны
// 5→6 склеиваются без скачка. «Другой мир»: солнце в верхнем углу. Ступенька
// справа убрана 2026-10-24 — по ней пытались идти. Статична: прибытие уже
// отыграно.

import { buildRoadStrip, ARRIVE_GROUND_FRAC, ARRIVE_MAIN_W } from './platforms.js';
import { drawArrivalSun, arrivalSunPlace } from './arrivalScene.js';
import { PLAYER_W, PLAYER_H, DOG_W, DOG_H, IDLE_FPS } from './actors.js';

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
      // Солнце проступает вместе с заголовком.
      const sun = arrivalSunPlace(w, h, gy);
      drawArrivalSun(ctx, sun.cx, sun.cy, t, Math.min(1, t / 0.3), sun);
      ctx.drawImage(ground, gx, gy); // ступеньки справа нет (решение 2026-10-24)
      const dogImg = images.dogSitFrames[Math.floor(t * 4) % images.dogSitFrames.length];
      ctx.drawImage(dogImg, fcx - PLAYER_W / 2 - DOG_W - 2, gy - DOG_H, DOG_W, DOG_H);
      const fr = images.foolIdleFrames;
      ctx.drawImage(fr[Math.floor(t * IDLE_FPS) % fr.length], fcx - PLAYER_W / 2, gy - PLAYER_H, PLAYER_W, PLAYER_H);
    },
  };
}

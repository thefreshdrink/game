// Под предсказанием Шута — та же композиция, что в такте 3 падения: Шут с
// псом на дороге у нижней кромки (правка в чате 2026-08-30: «размести сцену
// внизу экрана, предсказание проявляй поверх фона верхней части») — экраны
// 5→6 склеиваются без скачка. «Другой мир»: солнце в верхнем углу и кусок
// дороги на ступень выше справа (правка 29.09). Статична: прибытие уже
// отыграно.

import { buildRoadStrip, ARRIVE_GROUND_FRAC, ARRIVE_MAIN_W } from './platforms.js';
import { drawArrivalSun, arrivalStep, ARRIVE_VARIANT, ARRIVE_HAS_STEP } from './arrivalScene.js';
import { drawPixelReveal } from '../../core/pixelReveal.js';
import { PLAYER_W, PLAYER_H, PAIR_W, DOG_W, DOG_H, IDLE_FPS } from './actors.js';

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
      drawArrivalSun(ctx, w - 6, 22, t, Math.min(1, t / 0.3));
      // Проба вариантов прибытия (arrivalScene.js, ARRIVE_VARIANT).
      const plateP = ARRIVE_VARIANT === 'b' ? Math.min(1, t / 1.0) : ARRIVE_VARIANT === 'c' ? 0 : 1;
      if (plateP > 0) drawPixelReveal(ctx, ground, gx, gy, gw, ground.height, plateP, 4, 0.42, 0.4);
      if (ARRIVE_HAS_STEP) {
        const step = arrivalStep(images, gx, gw, gy);
        ctx.drawImage(step.img, step.x, step.y);
      }
      if (plateP < 0.6) {
        // Плиты под ногами ещё (или вовсе) нет — пара парит.
        const bob = Math.round(Math.sin(t * 1.3) * 2) * 2;
        ctx.drawImage(images.foolDogFall, Math.round(fcx - PAIR_W / 2), gy - PLAYER_H + bob, PAIR_W, PLAYER_H);
        return;
      }
      const dogImg = images.dogSitFrames[Math.floor(t * 4) % images.dogSitFrames.length];
      ctx.drawImage(dogImg, fcx - PLAYER_W / 2 - DOG_W - 2, gy - DOG_H, DOG_W, DOG_H);
      const fr = images.foolIdleFrames;
      ctx.drawImage(fr[Math.floor(t * IDLE_FPS) % fr.length], fcx - PLAYER_W / 2, gy - PLAYER_H, PLAYER_W, PLAYER_H);
    },
  };
}

// Финальный край (BUILD-SPEC-03 задача 5): за последней плитой видно
// призрачное продолжение дороги — ТА ЖЕ плита (тайлсет), впритык к краю
// (правка 2026-08-29). Когда Шут подходит к кромке, оно растворяется
// пиксельным проявлением оракула, дальние ячейки уходят первыми — «осыпается
// от тебя в пропасть», — и вниз разово сыпятся осколки.

import { drawPixelReveal } from '../../core/pixelReveal.js';
import { buildRoadStrip, PLATE_H } from './platforms.js';

const GHOST_W = 160;     // ширина призрачной плиты (кратно 32)
const NEAR_EDGE = 120;   // с какого расстояния до кромки начинается осыпание
const CRUMBLE_TIME = 1.2;

export function createGhostEdge(images) {
  let strip = null;
  let reveal = 1;          // проявлена (1) → осыпалась (0)
  let crumbled = false;    // осколки уже сыпанули — один раз

  return {
    reset() {
      reveal = 1;
      crumbled = false;
      if (!strip) strip = buildRoadStrip(images, GHOST_W);
    },

    /** toFinalEdge — сколько Шуту до кромки последней плиты (Infinity, если
     * он ещё не на ней). Осколки идут в общий поток частиц сцены. */
    step(dt, last, toFinalEdge, particles) {
      if (toFinalEdge >= NEAR_EDGE) return;
      reveal = Math.max(0, reveal - dt / CRUMBLE_TIME);
      if (crumbled) return;
      crumbled = true;
      // Те же «крупные пиксели», 4–8 px, по всей ширине, гуще у дальнего конца.
      const gx = last.x + last.w;
      for (let i = 0; i < 14; i++) {
        const f = Math.random();
        particles.push({
          x: gx + f * GHOST_W, y: last.y + Math.random() * PLATE_H,
          vx: (Math.random() - 0.5) * 24, vy: 20 + Math.random() * 70 + f * 40,
          t: 0, life: 0.6 + Math.random() * 0.5, s: Math.random() < 0.5 ? 4 : 8,
        });
      }
    },

    draw(ctx, last, camX, camY) {
      if (reveal <= 0) return;
      drawPixelReveal(
        ctx,
        strip,
        Math.round(last.x + last.w - camX),
        Math.round(last.y - camY),
        strip.width, PLATE_H,
        reveal, 4, 0, 0.35,
      );
    },
  };
}

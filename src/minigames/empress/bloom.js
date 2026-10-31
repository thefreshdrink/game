// Экран 5 для карты The Empress — мини-игра «Bloom» (глагол карты, GDD §8.2).
//
// Макет `incoming/empress/td/flow_iso7.png`, решение Алисы 25.10
// (docs/empress-proposal.md): огород в изометрии, Императрица с карты
// сидит под зонтиком. Три шага, без счёта и таймера:
//   1. plant — тянешь семечко по шести клеткам (пузырь у пальца, как в Hay Day);
//   2. call  — касаешься Императрицы: земля темнеет, встают ростки;
//   3. grow  — всё вырастает само, на передней средней клетке остаётся
//      бутон с кольцом — единственное удержание (GDD §8.1a). Отпустил —
//      бутон раскрывается, как есть, и через паузу — предсказание.

import { defineMinigame } from '../../core/minigame.js';
import { drawTopHint } from '../../core/hints.js';
import { drawHoldRing } from '../../core/gestureGlyph.js';
import { createParticles } from '../../core/juice.js';
import { uiScale } from '../../core/text.js';
import { clamp01 } from '../../core/ease.js';
import { blinkAlpha } from '../../core/textReveal.js';
import { t as str } from '../../data/strings.js';
import { createGarden, CROP_OF, HOLD_PLOT } from './garden.js';

const PLANT_R = 40;       // экранных px — клетка ловит палец с запасом
const SPROUT_STEP = 0.12; // с между ростками, волной по клеткам
const SPROUT_TIME = 0.5;  // росток проявляется
const GROW_DELAY = 1.4;   // с после касания — ростки стоят, потом растут
const GROW_TIME = 0.9;    // каждое растение проявляется
const HOLD_TIME = 1.8;    // с, кольцо удержания
const HOLD_DECAY = 1.5;
const HOLD_R = 44;        // зона касания бутона
const END_HOLD = 2.2;     // тишина перед предсказанием

const GOLD = '#EBA331';

/** Угловые скобки (графический язык проекта) — «это можно тронуть». */
function brackets(ctx, x, y, w, h, arm = 8) {
  ctx.fillStyle = GOLD;
  for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + w - 2, y, -1, 1], [x, y + h - 2, 1, -1], [x + w - 2, y + h - 2, -1, -1]]) {
    for (let k = 0; k < arm; k += 2) {
      ctx.fillRect(cx + sx * k, cy, 2, 2);
      ctx.fillRect(cx, cy + sy * k, 2, 2);
    }
  }
}

/** Пузырь с семечком у пальца: чёрное тело, золотые скобки, три зерна. */
function seedBubble(ctx, cx, cy) {
  const s = 36, x = Math.round((cx - s / 2) / 2) * 2, y = Math.round((cy - s / 2) / 2) * 2;
  ctx.fillStyle = '#000000';
  ctx.fillRect(x, y, s, s);
  brackets(ctx, x - 4, y - 4, s + 8, s + 8, 10);
  ctx.fillStyle = GOLD;
  for (const [dx, dy] of [[-4, 2], [4, 2], [0, -4]]) ctx.fillRect(x + s / 2 + dx - 2, y + s / 2 + dy - 2, 4, 4);
  for (let k = 0; k < 3; k++) ctx.fillRect(x + s / 2, y + s + 4 + k * 4, 2, 2);
}

export function createBloomScene({ input, images, goto }) {
  const garden = createGarden(images);
  const sparks = createParticles();
  let phase = 'plant';
  let tPhase = 0;
  let t = 0;
  let planted = [];   // время посадки по клеткам, -1 — пусто
  let finger = null;  // где палец — для пузыря
  let holding = false;
  let hold = 0;

  function plantAt(x, y) {
    garden.L.spots.forEach((s, i) => {
      if (planted[i] >= 0) return;
      if (Math.hypot(x - s.x, y - s.y) <= PLANT_R) {
        planted[i] = t;
        sparks.burst(s.x, s.y, 4, { spreadX: 50, liftY: 40, life: 0.3 });
      }
    });
    if (planted.every((v) => v >= 0) && phase === 'plant') { phase = 'call'; tPhase = 0; finger = null; }
  }

  const holdSpot = () => garden.L.spots[HOLD_PLOT];

  return defineMinigame({ input, goto }, {
    enter() {
      phase = 'plant'; tPhase = 0; t = 0;
      planted = Array(6).fill(-1);
      finger = null; holding = false; hold = 0;
      sparks.clear();
    },

    input: {
      pressstart(e) {
        if (phase === 'plant') { finger = e; plantAt(e.x, e.y); return; }
        if (phase === 'call' && garden.hitEmpress(e.x, e.y)) {
          phase = 'grow'; tPhase = 0;
          const L = garden.L;
          sparks.burst(L.ex + L.empW / 2, L.ey + 10, 10, { spreadX: 90, liftY: 70, life: 0.6 });
          return;
        }
        if (phase === 'hold') {
          const s = holdSpot();
          if (Math.hypot(e.x - s.x, e.y - (s.y - 10)) <= HOLD_R) holding = true;
        }
      },
      pressmove(e) {
        if (phase === 'plant' && finger) { finger = e; plantAt(e.x, e.y); }
      },
      pressend() {
        finger = null;
        if (!holding) return;
        holding = false;
        // Решение: кольцо полное — отпустил, и бутон раскрывается как есть.
        if (phase === 'hold' && hold >= 1) {
          phase = 'end'; tPhase = 0;
          const s = holdSpot();
          sparks.burst(s.x, s.y - 30, 12, { spreadX: 110, liftY: 90, life: 0.6 });
        }
      },
    },

    update(dt, w, h, finish) {
      garden.place(w, h);
      t += dt; tPhase += dt;
      if (phase === 'grow' && tPhase > GROW_DELAY + GROW_TIME + 6 * SPROUT_STEP) { phase = 'hold'; tPhase = 0; }
      if (phase === 'hold') {
        hold = holding ? Math.min(1, hold + dt / HOLD_TIME) : Math.max(0, hold - dt * HOLD_DECAY);
      }
      if (phase === 'end' && tPhase > END_HOLD) finish();
      sparks.update(dt);
    },

    draw(ctx, w, h) {
      const L = garden.L;
      if (!L.spots) return;
      const watered = phase !== 'plant' && phase !== 'call';
      ctx.fillStyle = '#111111';
      ctx.fillRect(0, 0, w, h);
      garden.drawBack(ctx, watered);

      // Растения — сзади наперёд (по y), чтобы передние закрывали задние.
      L.spots.map((s, i) => ({ s, i })).sort((a, b) => a.s.y - b.s.y).forEach(({ s, i }) => {
        if (phase === 'plant' || phase === 'call') {
          if (planted[i] >= 0) garden.drawPlant(ctx, images.empressStage1, s.x, s.y);
          return;
        }
        const sproutP = clamp01((tPhase - i * SPROUT_STEP) / SPROUT_TIME);
        const growP = clamp01((tPhase - GROW_DELAY - i * SPROUT_STEP) / GROW_TIME);
        if (phase === 'grow' && growP <= 0) { garden.drawPlant(ctx, images.empressStage3, s.x, s.y, sproutP); return; }
        if (i === HOLD_PLOT && phase !== 'end') { garden.drawPlant(ctx, images.empressStage4, s.x, s.y, phase === 'grow' ? growP : 1); return; }
        const crop = images[`empressCrop${CROP_OF[i]}`];
        const p = i === HOLD_PLOT ? clamp01(tPhase / GROW_TIME) : (phase === 'grow' ? growP : 1);
        garden.drawPlant(ctx, crop, s.x, s.y, p);
      });

      garden.drawFront(ctx);

      // Золото — только то, что можно тронуть сейчас.
      if (phase === 'plant') {
        ctx.globalAlpha = blinkAlpha(t);
        L.spots.forEach((s, i) => { if (planted[i] < 0) brackets(ctx, s.x - 16, s.y - 14, 32, 24, 6); });
        ctx.globalAlpha = 1;
        if (finger) seedBubble(ctx, finger.x, finger.y - 56);
      }
      if (phase === 'call') {
        ctx.globalAlpha = blinkAlpha(t);
        brackets(ctx, L.ex - 8, L.ey - 8, L.empW + 16, L.empH + 16, 10);
        ctx.globalAlpha = 1;
      }

      sparks.draw(ctx, 0, 0);

      const scale = uiScale(w, 1.15);
      if (phase === 'plant') drawTopHint(ctx, str('empress.plant'), { w, t, scale });
      if (phase === 'call') drawTopHint(ctx, str('empress.touch'), { w, t: tPhase, scale });
      if (phase === 'hold') {
        const s = holdSpot();
        drawHoldRing(ctx, s.x, s.y - 10, hold, 1, 16);
        // Наверху, как подсказки прошлых шагов: над бутоном стоят растения.
        if (!holding) drawTopHint(ctx, str('empress.hold'), { w, t: tPhase, scale });
      }
    },
  });
}

// Пропасть под дорогой — дизер-градиент у нижней кромки кадра + пиксельные
// ОБЛАКА В ПРОПАСТИ (BUILD-SPEC-05 задача 4.4: облака внизу, не над
// дорогой — «облака внизу, медленно плывущие, говорят „ты очень высоко“»).
//
// Сам градиент — единый `core/voidGradient.js` (правка в чате 2026-09-10:
// была копия здесь). Здесь только параметры пропасти и слои облаков.

import { drawVoidGradient } from '../../core/voidGradient.js';

// Доля высоты экрана, с которой начинается градиент. НИЗКО — камера ведёт
// плиту на ~0.45h, между дорогой и пропастью нужен широкий зазор воздуха.
const ABYSS_TOP_FRAC = 0.80;

// Слои облаков в полосе пропасти: доля высоты, скорость сноса (px/с),
// тон (внутри «градаций пустоты», очень близко к фону — глубина, не
// рисунок), блок-карта рядов, период повтора, фазовый сдвиг.
const PIT_CELL = 8;
const PIT_CLOUDS = [
  { yFrac: 0.85, speed: 6,  tone: '#212121', period: 540, phase: 0,   rows: [4, 8, 5] },
  { yFrac: 0.91, speed: 11, tone: '#252525', period: 470, phase: 220, rows: [3, 6, 9, 4] },
  { yFrac: 0.96, speed: 17, tone: '#2A2A2A', period: 400, phase: 90,  rows: [2, 5, 3] },
];

export function drawAbyss(ctx, w, h, t) {
  drawVoidGradient(ctx, w, h, {
    t,
    topFrac: ABYSS_TOP_FRAC,
    breatheAmp: 24,
    breathePeriod: 7,
  });

  // Облака поверх градиента, внутри полосы пропасти. Разная скорость =
  // параллакс; тон близок к фону = очень низкий контраст.
  for (const L of PIT_CLOUDS) {
    ctx.fillStyle = L.tone;
    const y0 = Math.round(h * L.yFrac);
    const base = (((L.phase - t * L.speed) % L.period) + L.period) % L.period;
    for (let sx = base - L.period; sx < w + 100; sx += L.period) {
      if (sx < -100) continue;
      L.rows.forEach((cells, r) => {
        const rowW = cells * PIT_CELL;
        ctx.fillRect(Math.round(sx - rowW / 2), y0 + r * PIT_CELL, rowW, PIT_CELL);
      });
    }
  }
}

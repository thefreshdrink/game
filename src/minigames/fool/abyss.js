// Пропасть под дорогой — туман: дизер-градиент у нижней кромки кадра.
// Облака в пропасти (BUILD-SPEC-05 задача 4.4: «облака внизу говорят „ты
// очень высоко“») — ассетами в scenery.js. Градиент — `core/voidGradient.js`.

import { drawVoidGradient } from '../../core/voidGradient.js';

// Доля высоты экрана, с которой начинается градиент. НИЗКО — камера ведёт
// плиту на ~0.45h, между дорогой и пропастью нужен широкий зазор воздуха.
const ABYSS_TOP_FRAC = 0.80;

export function drawAbyss(ctx, w, h, t) {
  drawVoidGradient(ctx, w, h, {
    t,
    topFrac: ABYSS_TOP_FRAC,
    breatheAmp: 24,
    breathePeriod: 7,
    cell: 2,   // сетка сцены Шута — 2 экранных на арт-пиксель
  });
}

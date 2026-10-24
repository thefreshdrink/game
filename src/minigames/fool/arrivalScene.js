// Плита прибытия — «другой мир»: большое пиксельное солнце с лучами и
// кусок дороги на ступень выше справа (правка 29.09 — вместо травы,
// кустика и лесенки).
//
// Общее для такта 'arrive' мини-игры (leap.js) и экрана предсказания
// (prediction.js) — одна композиция в двух местах. Всё из графического
// языка проекта, целыми пикселями, тонами палитры.

import { buildRoadStrip } from './platforms.js';

const C = 4; // ячейка рисунка, 2 арт-px

/** Большое солнце с лучами «в стиле персонажа»: пиксельный диск + 16
 * спиц через одну — длинная / короткая, к концу разрежаются (искристость),
 * медленно вращаются. Центр (cx, cy) в экранных px. `a` 0..1 — прозрачность. */
export function drawArrivalSun(ctx, cx, cy, t, a = 1) {
  if (a <= 0) return;
  const acx = Math.round(cx / C) * C;
  const acy = Math.round(cy / C) * C;
  const R = 28;
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, a));

  // диск
  for (let dy = -R; dy <= R; dy += C) {
    const hw = Math.floor(Math.sqrt(Math.max(0, R * R - dy * dy)) / C) * C;
    ctx.fillStyle = '#B8B8B8';
    ctx.fillRect(acx - hw, acy + dy, hw * 2 + C, C);
    if (dy < 0 && dy > -R + C) {            // блик слева-сверху
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(acx - hw + C, acy + dy, C * 2, C);
    }
  }

  // лучи — длинные / короткие через один, к концу разрежаются (правка в
  // чате 2026-09-10: длиннее)
  const rot = t * 0.15;
  ctx.fillStyle = '#808080';
  for (let k = 0; k < 16; k++) {
    const ang = rot + (k * Math.PI) / 8;
    const long = k % 2 === 0;
    const start = R + C * 2;
    const len = long ? C * 12 : C * 4;
    for (let rr = start, step = 0; rr < start + len; rr += C, step++) {
      if (rr > start + len * 0.45 && step % 2 === 1) continue; // к концу через одну
      const px = acx + Math.round((Math.cos(ang) * rr) / C) * C;
      const py = acy + Math.round((Math.sin(ang) * rr) / C) * C;
      ctx.fillRect(px, py, C, C);
    }
  }
  ctx.restore();
}

/** Кусок той же дороги на ступень выше, справа за плитой прибытия —
 * вместо лесенки (правка 29.09: трава, кустик и лесенка убраны, «такой же
 * маленький кусочек, как тот, где стоит Шут, на одну ступеньку выше»).
 * Два тайла — торец + торец; ступень и зазор по 32, как дельты уровня. */
// ПРОБА 2026-10-24 (задача «плита прибытия появляется сразу — игроки
// пытаются идти»): три варианта на выбор Алисе, переключаются адресом
// ?arrive=a|b|c, без параметра — как было.
//   a — плита есть, ступеньки справа нет: дорога не «продолжается»;
//   b — пара приземляется в пустоту и парит, плита проступает под ней
//       только вместе с предсказанием;
//   c — плиты нет совсем: пара парит под предсказанием.
// После выбора оставить один путь, остальные убрать.
export const ARRIVE_VARIANT = (() => {
  try { return new URLSearchParams(location.search).get('arrive') || 'now'; } catch { return 'now'; }
})();
export const ARRIVE_HAS_STEP = ARRIVE_VARIANT === 'now';
export const ARRIVE_PLATE_IN_FALL = ARRIVE_VARIANT === 'now' || ARRIVE_VARIANT === 'a';

export const ARRIVE_STEP_W = 64;
const STEP_GAP = 32;
const STEP_UP = 32;
let stepStrip = null;

export function arrivalStep(images, plateX, plateW, groundY) {
  if (!stepStrip) stepStrip = buildRoadStrip(images, ARRIVE_STEP_W);
  return { img: stepStrip, x: plateX + plateW + STEP_GAP, y: groundY - STEP_UP };
}

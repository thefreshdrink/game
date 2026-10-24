// Плита прибытия — «другой мир»: большое пиксельное солнце с лучами и
// кусок дороги на ступень выше справа (правка 29.09 — вместо травы,
// кустика и лесенки).
//
// Общее для такта 'arrive' мини-игры (leap.js) и экрана предсказания
// (prediction.js) — одна композиция в двух местах. Всё из графического
// языка проекта, целыми пикселями, тонами палитры.


const C = 4; // ячейка рисунка, 2 арт-px

/** Большое солнце с лучами «в стиле персонажа»: пиксельный диск + 16
 * спиц через одну — длинная / короткая, к концу разрежаются (искристость),
 * медленно вращаются. Центр (cx, cy) в экранных px. `a` 0..1 — прозрачность. */
export function drawArrivalSun(ctx, cx, cy, t, a = 1, { R = 28, longRay = 12 } = {}) {
  if (a <= 0) return;
  const acx = Math.round(cx / C) * C;
  const acy = Math.round(cy / C) * C;
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
    const len = long ? C * longRay : C * 4;
    for (let rr = start, step = 0; rr < start + len; rr += C, step++) {
      if (rr > start + len * 0.45 && step % 2 === 1) continue; // к концу через одну
      const px = acx + Math.round((Math.cos(ang) * rr) / C) * C;
      const py = acy + Math.round((Math.sin(ang) * rr) / C) * C;
      ctx.fillRect(px, py, C, C);
    }
  }
  ctx.restore();
}

// ПРОБА 2026-10-24 (задача «солнце срезано краем поля»): варианты места
// солнца на экране предсказания, переключаются адресом ?sun=a|b|c, без
// параметра — вариант c (выбран 24.10), ?sun=now — прежнее срезанное.
// После окончательного выбора оставить один.
//   a — то же солнце целиком в правом верхнем углу;
//   b — солнце поменьше, целиком, чуть ниже заголовка;
//   c — низкое солнце над плитой справа, «встаёт» за Шутом.
const SUN_VARIANT = (() => {
  try { return new URLSearchParams(location.search).get('sun') || 'c'; } catch { return 'c'; }
})();

/** Где и какое солнце рисовать на экране предсказания. gy — верх плиты. */
export function arrivalSunPlace(w, h, gy) {
  switch (SUN_VARIANT) {
    case 'a': return { cx: w - 90, cy: 94, R: 28, longRay: 12 };
    case 'b': return { cx: w - 56, cy: 62, R: 18, longRay: 7 };
    case 'now': return { cx: w - 6, cy: 22, R: 28, longRay: 12 };
    // По умолчанию — низко над плитой (выбор 2026-10-24, «наверное»;
    // на месте солнца может появиться другой знак — обсуждается).
    default: return { cx: w - 92, cy: gy - 150, R: 28, longRay: 10 };
  }
}

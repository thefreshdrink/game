// «Жизнь» на плите прибытия (правка в чате 2026-09-10). После того как
// вторая плита над Шутом убрана, между миром до прыжка и после нет
// видимой разницы. Здесь — трава, кустик и большое пиксельное солнце с
// изящными лучами: единственная плита прибытия становится «другим миром».
//
// Общее для такта 'arrive' мини-игры (leap.js) и экрана предсказания
// (prediction.js) — одна композиция в двух местах. Всё из графического
// языка проекта, целыми пикселями, тонами палитры.

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

/** Кустики травы вдоль верхней кромки плиты. Тон дальней детали. */
export function drawArrivalGrass(ctx, plateX, plateW, groundY, a = 1) {
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, a));
  ctx.fillStyle = '#4A4A4A';
  for (let g = plateX + 10; g < plateX + plateW - 10; g += 18) {
    const j = (g * 37) % 4;                 // стабильный джиттер высоты
    ctx.fillRect(g, groundY - 6 - j, 2, 6 + j);
    ctx.fillRect(g + 3, groundY - 4, 2, 4);
    ctx.fillRect(g - 3, groundY - 3, 2, 3);
    ctx.fillRect(g + 5, groundY - 2, 2, 2);
  }
  ctx.restore();
}

/** Кустик — три перекрытые доли + тонкий ствол + пара бликов. Стоит
 * вплотную на плите, вписан в пространство, не отдельным блоком. */
export function drawArrivalBush(ctx, x, groundY, a = 1) {
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, a));
  ctx.fillStyle = '#4A4A4A';
  ctx.fillRect(x + 10, groundY - 6, 3, 6); // ствол
  const lobes = [
    [x, groundY - 16, 12, 12],
    [x + 8, groundY - 21, 13, 15],
    [x + 16, groundY - 15, 11, 11],
  ];
  lobes.forEach(([lx, ly, lw, lh]) => {
    ctx.fillRect(lx, ly + 2, lw, lh - 2);
    ctx.fillRect(lx + 2, ly, lw - 4, lh);   // скруглённая макушка
  });
  ctx.fillStyle = '#808080';                // блики
  ctx.fillRect(x + 3, groundY - 14, 3, 2);
  ctx.fillRect(x + 12, groundY - 20, 3, 2);
  ctx.fillRect(x + 20, groundY - 12, 2, 2);
  ctx.restore();
}

/** Лесенка из блоков вверх-вправо за правым краем плиты — «дальше будет
 * рост» (правка в чате 2026-09-10). Каменные тона тайлсета дороги. */
export function drawArrivalStairs(ctx, x0, groundY, a = 1) {
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, a));
  const sw = 26;
  for (let i = 0; i < 3; i++) {
    const sx = Math.round(x0 + 4 + i * 22);
    const sy = Math.round(groundY - (i + 1) * 14);
    ctx.fillStyle = '#232323';
    ctx.fillRect(sx, sy, sw, groundY - sy);
    ctx.fillStyle = '#A0A0A0';
    ctx.fillRect(sx + 2, sy + 2, sw - 4, 2);
    ctx.fillRect(sx + 2, sy + 2, 2, 8);
  }
  ctx.restore();
}

/** Трава + кустик на плите, и лесенка-рост за её правым краем. Цветочки
 * были здесь (BUILD-SPEC-05/2026-09-10) — убраны правкой в чате 2026-09-11. */
export function drawArrivalLife(ctx, plateX, plateW, groundY, a = 1) {
  drawArrivalGrass(ctx, plateX, plateW, groundY, a);
  drawArrivalBush(ctx, plateX + plateW - 44, groundY, a);
  drawArrivalStairs(ctx, plateX + plateW, groundY, a);
}

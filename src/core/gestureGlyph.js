// Жестовые знаки для мини-игр (BUILD-SPEC-03 задача 8). Рисуются кодом из
// графического языка проекта — точка, точка с хвостом, кольцо с дугой, —
// без новых ассетов. Живут РЯДОМ С ФИГУРОЙ, не в HUD.
//
// В Leap используются кольцо (удержание — индикатор наклона у финального
// края и знак-подсказка «здесь удерживай») и точка с хвостом (свайп —
// подсказка у щели). Точка (тап) — задел под другие мини-игры, в Leap
// тапа нет.
//
// Всё рисуется по целым АРТ-пикселям (ячейка 2 экранных px), сетка не
// плывёт. Кольцо — честный пиксельный круг (алгоритм средней точки), не
// набор редких точек по синусу.

const DIM = '#808080';   // незалитый обод — виден на воздухе #111111, но тускл
const FILL = '#EBA331';  // дуга прогресса — «держи, вот сколько осталось»

// R — радиус в АРТ-пикселях. Возвращает список точек контура круга в
// первом октанте, зеркалит на все восемь. Кэш по радиусу.
const ringCache = new Map();
function ringPoints(R) {
  let pts = ringCache.get(R);
  if (pts) return pts;
  pts = [];
  let x = R, y = 0, err = 1 - R;
  while (x >= y) {
    for (const [sx, sy] of [
      [x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y],
    ]) pts.push([sx, sy]);
    y++;
    if (err < 0) err += 2 * y + 1;
    else { x--; err += 2 * (y - x) + 1; }
  }
  ringCache.set(R, pts);
  return pts;
}

function cell(ctx, ax, ay, c) {
  ctx.fillStyle = c;
  ctx.fillRect(ax * 2, ay * 2, 2, 2);
}

/** Кольцо удержания. Центр (cx, cy) в экранных px. progress 0..1 — доля
 * обода, залитая ярким от верхней точки по часовой. progress 0 = чистый
 * тусклый обод: знак «здесь удерживай», ещё без прогресса. alpha — для
 * проявления/дыхания знака-подсказки. */
export function drawHoldRing(ctx, cx, cy, progress, alpha = 1, R = 13) {
  const acx = Math.round(cx / 2);
  const acy = Math.round(cy / 2);
  const p = Math.max(0, Math.min(1, progress));

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  for (const [dx, dy] of ringPoints(R)) {
    // угол точки, 0 = верх (−Y), по часовой
    const ang = (Math.atan2(dx, -dy) + Math.PI * 2) % (Math.PI * 2);
    const lit = p > 0 && ang <= p * Math.PI * 2;
    cell(ctx, acx + dx, acy + dy, lit ? FILL : DIM);
  }
  ctx.restore();
}

/** Точка с хвостом — знак свайпа. Голова (куда ведёт жест) яркая, хвост —
 * пунктир в сторону, ОТКУДА палец идёт (шаг 3, тускло). По умолчанию
 * свайп вверх: хвост тянется вниз. Центр головы — (cx, cy) в экранных px. */
export function drawSwipeTick(ctx, cx, cy, alpha = 1) {
  const acx = Math.round(cx / 2);
  const acy = Math.round(cy / 2);
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  // Стрелка вверх — куда ведёт жест: плотная скоба-остриё + короткий стержень.
  const head = [
    [0, -6], [1, -6],
    [-1, -5], [0, -5], [1, -5], [2, -5],
    [-2, -4], [-1, -4], [0, -4], [1, -4], [2, -4], [3, -4],
    [0, -3], [1, -3],
    [0, -2], [1, -2],
  ];
  for (const [dx, dy] of head) cell(ctx, acx + dx, acy + dy, FILL);
  // Хвост вниз — откуда палец идёт: пунктир, шаг 2 арт-px, тускло.
  for (let i = 0; i < 4; i++) {
    cell(ctx, acx, acy + 1 + i * 2, DIM);
    cell(ctx, acx + 1, acy + 1 + i * 2, DIM);
  }
  ctx.restore();
}

/** Точка — знак тапа (для других мини-игр; в Leap тапа нет). Центр
 * (cx, cy) в экранных px. */
export function drawTapDot(ctx, cx, cy, alpha = 1) {
  const acx = Math.round(cx / 2);
  const acy = Math.round(cy / 2);
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  for (const [dx, dy] of [[0, -1], [-1, 0], [0, 0], [1, 0], [0, 1]]) {
    cell(ctx, acx + dx, acy + dy, FILL);
  }
  ctx.restore();
}

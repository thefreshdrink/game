// Жестовые знаки для мини-игр (BUILD-SPEC-03 задача 8). Рисуются кодом из
// графического языка проекта — точка, точка с хвостом, кольцо с дугой, —
// без новых ассетов. Живут РЯДОМ С ФИГУРОЙ, не в HUD.
//
// Пока подключён только знак удержания (кольцо) — как индикатор наклона у
// финального края (правка в чате 2026-08-29). Точка (тап) и точка с
// хвостом (свайп) — задел под остальную задачу 8.
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
 * обода, залитая ярким от верхней точки по часовой. */
export function drawHoldRing(ctx, cx, cy, progress) {
  const R = 13;                 // арт-px (26 экранных)
  const acx = Math.round(cx / 2);
  const acy = Math.round(cy / 2);
  const p = Math.max(0, Math.min(1, progress));

  for (const [dx, dy] of ringPoints(R)) {
    // угол точки, 0 = верх (−Y), по часовой
    const ang = (Math.atan2(dx, -dy) + Math.PI * 2) % (Math.PI * 2);
    const lit = ang <= p * Math.PI * 2;
    cell(ctx, acx + dx, acy + dy, lit ? FILL : DIM);
  }
}

/** Точка — знак тапа (задел под задачу 8). Центр (cx, cy) в экранных px. */
export function drawTapDot(ctx, cx, cy) {
  const acx = Math.round(cx / 2);
  const acy = Math.round(cy / 2);
  for (const [dx, dy] of [[0, -1], [-1, 0], [0, 0], [1, 0], [0, 1]]) {
    cell(ctx, acx + dx, acy + dy, '#FFFFFF');
  }
}

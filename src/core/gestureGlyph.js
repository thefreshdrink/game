// Жестовые знаки для мини-игр (BUILD-SPEC-03 задача 8). Рисуются кодом из
// графического языка проекта — точка, точка с хвостом, кольцо с дугой, —
// без новых ассетов. Живут РЯДОМ С ФИГУРОЙ, не в HUD.
//
// В Leap используются кольцо (удержание — индикатор наклона у финального
// края) и стрелка вверх с бегущим акцентным пунктиром (свайп — рядом с
// текстовой подсказкой у щели, правка в чате 2026-08-30). `drawTapDot` —
// задел под другие мини-игры.
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

// Пунктир свайпа меняет цвет по мере подъёма: входит белым внизу, у
// острия становится акцентным (правка в чате 2026-08-30: «пусть меняет
// цвет анимации с белого на акцентный»).
const SWIPE_TAIL = ['#FFFFFF', '#FFFFFF', '#B8B8B8', '#EBA331', '#EBA331'];

/** Знак свайпа вверх — стрелка с БЕГУЩИМ вверх пунктиром, который
 * перекрашивается из белого в акцент по ходу подъёма. Остриё пульсирует
 * белый↔акцент. `phase` — секунды. Центр острия — (cx, cy) в экранных px. */
export function drawSwipeTick(ctx, cx, cy, alpha = 1, phase = 0) {
  const acx = Math.round(cx / 2);
  const acy = Math.round(cy / 2);
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  // Остриё вверх — плотная скоба + короткий стержень; пульс цвета.
  const headC = Math.sin(phase * 4) > 0 ? FILL : '#FFFFFF';
  const head = [
    [0, -9], [1, -9],
    [-1, -8], [0, -8], [1, -8], [2, -8],
    [-2, -7], [-1, -7], [0, -7], [1, -7], [2, -7], [3, -7],
    [0, -6], [1, -6],
    [0, -5], [1, -5],
  ];
  for (const [dx, dy] of head) cell(ctx, acx + dx, acy + dy, headC);
  // Хвост: дэши 2×2, шаг 4 арт-px, ползут вверх по фазе. Цвет дэша — по
  // его позиции в потоке (снизу белый → к острию акцентный).
  const scroll = Math.round(((phase * 12) % 4 + 4) % 4);
  const n = SWIPE_TAIL.length;
  for (let k = 0; k < n; k++) {
    const y = acy + 12 - k * 4 - scroll;
    if (y > acy + 13 || y < acy - 4) continue;
    cell(ctx, acx, y, SWIPE_TAIL[k]);
    cell(ctx, acx + 1, y, SWIPE_TAIL[k]);
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

// Жестовые знаки для мини-игр (BUILD-SPEC-03 задача 8). Рисуются кодом из
// графического языка проекта — точка, точка с хвостом, кольцо с дугой, —
// без новых ассетов. Живут РЯДОМ С ФИГУРОЙ, не в HUD.
//
// Пока подключён только знак удержания (кольцо) — как индикатор наклона у
// финального края (правка в чате 2026-08-29). Точка (тап) и точка с
// хвостом (свайп) — задел под остальную задачу 8.
//
// Всё рисуется по целым координатам ячейкой 2 экранных px (1 арт-px),
// чтобы держать пиксельную сетку.

const DOT = '#808080';   // пунктир, дальняя деталь
const LINE = '#FFFFFF';  // главный контур
const FILL = '#EBA331';   // «сделай этот жест сейчас» — та же роль, что у
                          // акцентной кромки: место/действие, которого касаешься

function px(ctx, x, y, c) {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x / 2) * 2, Math.round(y / 2) * 2, 2, 2);
}

/** Кольцо удержания: тусклый пунктирный обод по кругу + яркая дуга,
 * заполняющаяся по часовой от верха на progress (0..1). Центр (cx, cy). */
export function drawHoldRing(ctx, cx, cy, progress) {
  const R = 22;                 // радиус, экранных px (11 арт-px)
  const start = -Math.PI / 2;   // верх
  const end = start + Math.PI * 2 * Math.max(0, Math.min(1, progress));
  const step = 0.18;            // шаг по дуге, рад
  for (let a = -Math.PI / 2; a < Math.PI * 1.5; a += step) {
    const x = cx + Math.cos(a) * R;
    const y = cy + Math.sin(a) * R;
    // пунктир — через одну
    if (Math.round(a / step) % 2 === 0) px(ctx, x, y, DOT);
  }
  for (let a = start; a <= end; a += step / 2) {
    const x = cx + Math.cos(a) * R;
    const y = cy + Math.sin(a) * R;
    px(ctx, x, y, FILL);
    // вторая нить контура внутрь — двойная линия дизайн-системы
    px(ctx, cx + Math.cos(a) * (R - 2), cy + Math.sin(a) * (R - 2), a < end - step ? LINE : FILL);
  }
}

/** Точка — знак тапа (задел под задачу 8). */
export function drawTapDot(ctx, cx, cy) {
  for (let dx = -2; dx <= 2; dx += 2) {
    for (let dy = -2; dy <= 2; dy += 2) {
      if (Math.abs(dx) + Math.abs(dy) <= 2) px(ctx, cx + dx, cy + dy, LINE);
    }
  }
}

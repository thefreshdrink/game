// Дорога мини-игры «Leap» — восемь тактов из BUILD-SPEC (раздел «Дорога»),
// последний такт (7 «последнее усилие» + 8 «край, дальше ничего») слит в
// одну широкую плиту: прыжок приводит на неё же, а «восьмой такт» — это
// просто ходьба до её правого края, где начинается hold-to-leap.
//
// dy — высота ПЛОЩАДКИ относительно старта в экранных px (вверх = меньше
// dy), кратна тайлу 32 как требует CLAUDE.md. jump=true — щель нужно
// перепрыгивать свайпом; jump=false — «сходит с края», щель настолько
// узкая, что обычная ходьба сама переносит через неё под гравитацией.

export const TILE = 32;
export const PLATE_H = 24; // 12 арт-px × 2

// Размеры щелей подобраны так, чтобы минимальный ввод (голый тап) гарантированно
// перекрывал прыжковую щель, а обычная ходьба — «шаговую»: «Промахнуться
// нельзя» (BUILD-SPEC) — это гарантия физики и подбора чисел, а не отдельный
// код-костыль. Проверено расчётом под константы core/leapPhysics.js, потом
// точно подогнано вживую.
const GAP_JUMP = 64; // перепрыгивается даже при минимальной силе свайпа
const GAP_JUMP_FAR = 80; // «дальше» — щель побольше, но всё ещё безопасна
const GAP_STEP = 36; // «сходит с края» — переносится ходьбой без прыжка

const DATA = [
  { dy: 0, w: 176 }, // P1 — старт
  { dy: -64, w: 108, gap: GAP_JUMP, jump: true },
  { dy: 32, w: 108, gap: GAP_STEP, jump: false },
  { dy: -32, w: 108, gap: GAP_JUMP, jump: true },
  { dy: -64, w: 108, gap: GAP_JUMP_FAR, jump: true },
  { dy: 64, w: 108, gap: GAP_STEP, jump: false },
  { dy: 0, w: 220, gap: GAP_JUMP, jump: true }, // «последнее усилие» + финальный край
];

/** Строит список плит с абсолютными x/y (world-координаты, y растёт вниз). */
export function buildPlatforms(startY) {
  const platforms = [];
  let x = 0;
  DATA.forEach((d, i) => {
    if (i > 0) x += platforms[i - 1].w + d.gap;
    platforms.push({ x, y: startY + d.dy, w: d.w, jumpIn: d.jump ?? null });
  });
  return platforms;
}

/** Плита, на которую в данный момент можно приземлиться (под точкой x, диапазон y). */
export function platformAt(platforms, x, yMin, yMax) {
  for (const p of platforms) {
    if (x >= p.x - 2 && x <= p.x + p.w + 2 && p.y >= yMin - 2 && p.y <= yMax + 2) return p;
  }
  return null;
}

/** Рисует плиту: чёрная подложка (design-system) + брус попиксельно + скобы по краям. */
export function drawPlatform(ctx, images, p, camX, camY, scale) {
  const x = Math.round(p.x - camX);
  const y = Math.round(p.y - camY);
  const w = Math.round(p.w * scale);
  const h = Math.round(PLATE_H * scale);
  if (x + w < -40 || x > 2000) return; // грубый culling

  ctx.fillStyle = '#000000';
  ctx.fillRect(x, y, w, h);

  const bar = images.roadBarMid;
  const colW = Math.max(1, Math.round(bar.width * scale));
  for (let cx = x; cx < x + w; cx += colW) {
    const cw = Math.min(colW, x + w - cx);
    ctx.drawImage(bar, 0, 0, Math.round(cw / scale), bar.height, cx, y, cw, h);
  }

  const capW = Math.round(images.roadCapLeft.width * scale);
  const capInset = Math.round(4 * scale); // 2 арт-px от торцов
  ctx.drawImage(images.roadCapLeft, x + capInset, y, capW, h);
  ctx.drawImage(images.roadCapRight, x + w - capInset - capW, y, capW, h);
}

/** Полупрозрачная, тусклая дорога за пропастью — видна, но недостижима (BUILD-SPEC). */
export function drawGhostRoad(ctx, x, y, w, camX, camY, scale) {
  const rx = Math.round(x - camX);
  const ry = Math.round(y - camY);
  const rw = Math.round(w * scale);
  const rh = Math.round(PLATE_H * scale);
  ctx.fillStyle = '#000000';
  ctx.fillRect(rx, ry, rw, rh);
  ctx.strokeStyle = '#4A4A4A';
  ctx.setLineDash([Math.round(3 * scale), Math.round(3 * scale)]);
  ctx.strokeRect(rx + 0.5, ry + 0.5, rw - 1, rh - 1);
  ctx.setLineDash([]);
}

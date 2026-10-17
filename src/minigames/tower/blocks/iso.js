// Изометрия башни: шаги сетки, палитра, проекция точки мира на экран,
// грани и экранный прямоугольник бруска. Лист без зависимостей — на него
// опираются остальные части blocks/ (общий вход — ../blocks.js).

// Спрайт бруска — 64×48 арт-пикселей, в игре рисуется ×2: зерно Башни 2
// экранных на арт-пиксель, как у референса в нашем масштабе (решение
// 2026-09-28). Шаги ниже — ровно ×2 от сетки спрайта (tools/iso-block.py
// --unit 16 --row 12), поэтому брусок садится пиксель в пиксель и ряды
// сходятся без щелей. Бруски тонкие и рядов много — как на референсе.
export const U = 32;    // шаг вправо на единицу глубины
export const HU = 16;   // он же вниз — изометрия 2:1
export const ZH = 24;   // высота ряда
export const ROWS = 16;
export const GRAIN = 2;        // экранных px на арт-пиксель у спрайтов Башни
export const COLS = 3;

// Палитра — только из таблицы CLAUDE.md.
export const BODY = '#000000';
export const LINE = '#FFFFFF';
export const LINE2 = '#B8B8B8';
export const TEX = '#808080';
export const FAR = '#4A4A4A';
export const UI = '#232323';
export const ACCENT = '#EBA331';
export const GOLD_SHADE = '#B07A1C';

/** Точка мира (x,y,z) в экранные координаты относительно основания (ox,oy). */
export function project(ox, oy, x, y, z) {
  return [ox + (x - y) * U, oy + (x + y) * HU - z * ZH];
}

/** Чётный ряд: три бруска лежат вдоль X и стоят рядом по Y. Нечётный — наоборот. */
export function cellsOf(r) {
  const out = [];
  for (let i = 0; i < COLS; i++) {
    out.push(r % 2 === 0 ? { x: 0, y: i, dx: 3, dy: 1 } : { x: i, y: 0, dx: 1, dy: 3 });
  }
  return out;
}

export function facesOf(ox, oy, o) {
  const { x, y, z, dx, dy } = o;
  const x1 = x + dx;
  const y1 = y + dy;
  const z1 = z + 1;
  const P = (a, b, c) => project(ox, oy, a, b, c);
  return {
    top: [P(x, y, z1), P(x1, y, z1), P(x1, y1, z1), P(x, y1, z1)],
    right: [P(x1, y, z1), P(x1, y1, z1), P(x1, y1, z), P(x1, y, z)],
    front: [P(x, y1, z1), P(x1, y1, z1), P(x1, y1, z), P(x, y1, z)],
  };
}

export function poly(ctx, pts, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  ctx.closePath();
  ctx.fill();
}

export function edge(ctx, a, b, color, width = 2) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.stroke();
}

/** Экранный прямоугольник бруска: по нему сажается спрайт. Ширина
 * (dx+dy)·U, высота (dx+dy)·HU + ZH — то есть длинный брусок это ровно
 * 104×72 экранных. */
export function blockRect(ox, oy, o) {
  const f = facesOf(ox, oy, o);
  const pts = [...f.top, ...f.front, ...f.right];
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  // На сетку зерна: крен рядов дробный, и без этого брусок встаёт на
  // нечётный px — между соседями вылезает белая щель в 1 px (скрин 29.09).
  const g = (v) => Math.round(v / GRAIN) * GRAIN;
  const x = g(Math.min(...xs));
  const y = g(Math.min(...ys));
  return { x, y, w: g(Math.max(...xs)) - x, h: g(Math.max(...ys)) - y };
}

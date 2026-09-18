// Геометрия и отрисовка изометрической башни-дженги. Общее для сцены
// мини-игры (release.js) и экрана предсказания (screens/prediction.js):
// после обвала на предсказании лежит ТА ЖЕ куча, в тех же координатах —
// иначе на склейке 5→6 композиция прыгает.
//
// Ракурс изометрический, а не сбоку, как у Шута — решение в чате: в лоб
// кладка крест-накрест читается кирпичной стеной, дженга узнаётся только
// под углом.
//
// Всё в единицах бруска: короткая сторона 1, длинная 3, высота ряда 1.
// Экранные шаги чётные (CLAUDE.md: 1 арт-пиксель = 2 экранных).

export const U = 26;    // шаг вправо на единицу глубины
export const HU = 13;   // он же вниз — изометрия 2:1
export const ZH = 20;   // высота ряда
export const ROWS = 12;
export const COLS = 3;

// Палитра — только из таблицы CLAUDE.md.
const BODY = '#000000';
const LINE = '#FFFFFF';
const LINE2 = '#B8B8B8';
const TEX = '#808080';
const FAR = '#4A4A4A';
const UI = '#232323';
const ACCENT = '#EBA331';

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

function poly(ctx, pts, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  ctx.closePath();
  ctx.fill();
}

function edge(ctx, a, b, color, width = 2) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.stroke();
}

/** Брусок: верхняя грань светлее — по ней читается глубина; тело темнее
 * воздуха (design-system §2). `hot` — брусок под пальцем, акцент значит
 * ровно «это можно тронуть». */
export function drawBlock(ctx, ox, oy, o, hot) {
  const f = facesOf(ox, oy, o);
  poly(ctx, f.top, FAR);
  poly(ctx, f.front, UI);
  poly(ctx, f.right, BODY);

  const cx = (f.top[0][0] + f.top[2][0]) / 2;
  const cy = (f.top[0][1] + f.top[2][1]) / 2;
  ctx.fillStyle = TEX;                       // пунктирная фактура, §1
  ctx.fillRect(Math.round(cx - 6), Math.round(cy), 2, 2);
  ctx.fillRect(Math.round(cx + 4), Math.round(cy - 4), 2, 2);

  const L = hot ? ACCENT : LINE;
  const L2 = hot ? ACCENT : LINE2;
  edge(ctx, f.top[0], f.top[1], L2);
  edge(ctx, f.top[1], f.top[2], L);
  edge(ctx, f.top[2], f.top[3], L);
  edge(ctx, f.top[3], f.top[0], L2);
  edge(ctx, f.right[1], f.right[2], L);
  edge(ctx, f.right[2], f.right[3], L);
  edge(ctx, f.front[2], f.front[3], L);
  edge(ctx, f.front[3], f.front[0], L2);
}

/** Земля — те же каменные плиты дороги Шута, только в изометрии (решение
 * в чате: не заводить под Башню свою землю, а связать карты одним миром). */
export function drawGround(ctx, ox, oy, radius = 4) {
  for (let gx = -radius; gx <= radius + 2; gx++) {
    for (let gy = -radius; gy <= radius + 2; gy++) {
      const q = [
        project(ox, oy, gx, gy, 0), project(ox, oy, gx + 1, gy, 0),
        project(ox, oy, gx + 1, gy + 1, 0), project(ox, oy, gx, gy + 1, 0),
      ];
      poly(ctx, q, (gx + gy) % 2 ? UI : '#1C1C1C');
      edge(ctx, q[0], q[1], FAR, 1);
      edge(ctx, q[0], q[3], FAR, 1);
    }
  }
}

/** Куча лежащих обломков — от дальних к ближним, иначе ближние уходят под
 * дальние. Тот же порядок и на сцене, и на предсказании. */
export function drawRubble(ctx, ox, oy, blocks) {
  [...blocks]
    .sort((a, b) => (a.z - b.z) || ((a.x + a.y) - (b.x + b.y)))
    .forEach((b) => drawBlock(ctx, ox, oy, b, false));
}

/** Габариты кучи в экранных координатах — нужны предсказанию, чтобы снять
 * её в буфер под пиксельное растворение. */
export function rubbleBounds(ox, oy, blocks) {
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  blocks.forEach((b) => {
    const f = facesOf(ox, oy, b);
    [...f.top, ...f.front, ...f.right].forEach(([px, py]) => {
      x0 = Math.min(x0, px); y0 = Math.min(y0, py);
      x1 = Math.max(x1, px); y1 = Math.max(y1, py);
    });
  });
  if (!blocks.length) return { x: 0, y: 0, w: 0, h: 0 };
  return { x: Math.floor(x0) - 2, y: Math.floor(y0) - 2, w: Math.ceil(x1 - x0) + 4, h: Math.ceil(y1 - y0) + 4 };
}

// Снимок последней кучи: сцена кладёт сюда обломки и точку, где они
// замерли, предсказание читает. Пусто — Башню в этой сессии не играли.
export const rubbleSnapshot = { blocks: [], ox: 0, oyFromBottom: 0 };

export function saveRubble(blocks, ox, oyFromBottom) {
  rubbleSnapshot.blocks = blocks.map((b) => ({ x: b.x, y: b.y, z: b.z, dx: b.dx, dy: b.dy }));
  rubbleSnapshot.ox = ox;
  rubbleSnapshot.oyFromBottom = oyFromBottom;
}

export function clearRubble() {
  rubbleSnapshot.blocks = [];
}

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

// Спрайт бруска — 64×48 арт-пикселей, в игре рисуется ×2: зерно Башни 2
// экранных на арт-пиксель, как у референса в нашем масштабе (решение
// 2026-09-28). Шаги ниже — ровно ×2 от сетки спрайта (tools/iso-block.py
// --unit 16 --row 12), поэтому брусок садится пиксель в пиксель и ряды
// сходятся без щелей. Бруски тонкие и рядов много — как на референсе.
export const U = 32;    // шаг вправо на единицу глубины
export const HU = 16;   // он же вниз — изометрия 2:1
export const ZH = 24;   // высота ряда
export const ROWS = 16;
const GRAIN = 2;        // экранных px на арт-пиксель у спрайтов Башни
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

/** Силуэт бруска — обводка поверх спрайта, когда он под пальцем. */
function strokeSilhouette(ctx, ox, oy, o, color) {
  const f = facesOf(ox, oy, o);
  edge(ctx, f.top[0], f.top[1], color);
  edge(ctx, f.top[1], f.top[2], color);
  edge(ctx, f.top[2], f.top[3], color);
  edge(ctx, f.top[3], f.top[0], color);
  edge(ctx, f.right[1], f.right[2], color);
  edge(ctx, f.right[2], f.right[3], color);
  edge(ctx, f.front[2], f.front[3], color);
  edge(ctx, f.front[3], f.front[0], color);
}

// Спрайты брусков: три тона камня (светлый / серый / тёмный). Кладка
// набирается ими по фиксированному узору — так она читается как кладка, а
// не рябит случайностью; ровно этим живёт референс, присланный в чате.
// Поперечный ряд — свой спрайт (`<тон>Cross`): свет на референсе идёт слева,
// и у зеркального бруска он перевернулся бы. Нет своего — тот же спрайт
// зеркально: в изометрии 2:1 это поворот на 90°.
//
// Золотые бруски есть в кладке — решение 2026-09-28 (референс из чата):
// в Башне золото — это ценность, которую держит кладка, а не знак «можно
// тронуть». Брусок под пальцем по-прежнему обводится акцентом.
export const TONES = ['light', 'mid', 'dark', 'black', 'gold'];

// Доли тонов — как на референсе из чата (2026-09-28): белых и тёмных
// больше, серых меньше, контраст между соседями сильный.
const TONE_WEIGHTS = { light: 8, mid: 3, dark: 9, black: 5, gold: 3 };
const sprites = {};

export function setBlockSprites(imgs) {
  TONES.forEach((t) => {
    sprites[t] = imgs?.[t] ?? null;
    sprites[`${t}Cross`] = imgs?.[`${t}Cross`] ?? null;
  });
}

/** Золото — равномерно по высоте, не на верхнем ряду: ряды через равный
 * шаг, место в ряду по кругу (внешнее, среднее, заднее). */
function goldSpots(rows, cols, count) {
  const spots = new Map();
  const usable = rows - 1;
  const order = [cols - 1, 1, 0];
  for (let k = 0; k < count; k++) {
    const r = Math.floor(((k + 0.5) * usable) / count);
    spots.set(r, order[k % order.length] % cols);
  }
  return spots;
}

/** Раскладка тонов на всю башню, считается один раз: точные доли
 * TONE_WEIGHTS, золото — по goldSpots, у остальных другой тон, чем у соседа
 * по ряду и у бруска на том же месте рядом ниже и через ряд (там лежит
 * брусок той же ориентации, одинаковые тона выстраивались бы столбиком).
 * Порядок кандидатов крутится постоянным шагом — башня одинаковая при
 * каждом заходе. */
function buildToneGrid(rows, cols) {
  const total = rows * cols;
  const sum = Object.values(TONE_WEIGHTS).reduce((a, n) => a + n, 0);
  const left = {};
  TONES.forEach((t) => { left[t] = Math.round((TONE_WEIGHTS[t] / sum) * total); });
  const gold = goldSpots(rows, cols, left.gold);
  left.gold = 0;
  const grid = [];
  let step = 0;
  for (let r = 0; r < rows; r++) {
    grid.push([]);
    for (let i = 0; i < cols; i++) {
      if (gold.get(r) === i) { grid[r].push('gold'); continue; }
      const banned = new Set([grid[r][i - 1], grid[r - 1]?.[i], grid[r - 2]?.[i], 'gold']);
      const order = TONES.map((_, k) => TONES[(k + step) % TONES.length]);
      step += 3;
      const pick = order
        .filter((t) => !banned.has(t))
        .sort((x, y) => left[y] - left[x])[0] ?? order[0];
      left[pick] = Math.max(0, left[pick] - 1);
      grid[r].push(pick);
    }
  }
  return grid;
}

const TONE_GRID = buildToneGrid(ROWS, COLS);

/** Тон бруска по его месту в кладке. */
export function toneOf(r, i) {
  return TONE_GRID[r]?.[i] ?? 'mid';
}

function spriteFor(o) {
  return sprites[o.tone ?? 'mid'] ?? sprites.mid ?? sprites.light ?? sprites.dark;
}

function crossSpriteFor(o) {
  return sprites[`${o.tone ?? 'mid'}Cross`] ?? null;
}

/** Брусок: верхняя грань светлее — по ней читается глубина; тело темнее
 * воздуха (design-system §2). `hot` — брусок под пальцем, акцент значит
 * ровно «это можно тронуть». */
export function drawBlock(ctx, ox, oy, o, hot) {
  const blockSprite = spriteFor(o);
  if (blockSprite) {
    const r = blockRect(ox, oy, o);
    const cross = o.dy > o.dx ? crossSpriteFor(o) : null;
    if (cross) {
      ctx.drawImage(cross, r.x, r.y, r.w, r.h);
    } else if (o.dy > o.dx) {          // поперечный ряд — тот же спрайт зеркально
      ctx.save();
      ctx.translate(r.x + r.w, r.y);
      ctx.scale(-1, 1);
      ctx.drawImage(blockSprite, 0, 0, r.w, r.h);
      ctx.restore();
    } else {
      ctx.drawImage(blockSprite, r.x, r.y, r.w, r.h);
    }
    if (hot) strokeSilhouette(ctx, ox, oy, o, ACCENT);
    return;
  }
  drawBlockFaces(ctx, ox, oy, o, hot);
}

function drawBlockFaces(ctx, ox, oy, o, hot) {
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

/** Золотые искры вокруг короны — четырёхлучевые звёздочки, как на
 * референсе из чата. Процедурно: своя картинка им не нужна, а мерцание
 * спрайтом не запечёшь. Акцентом их красить законно — корона и есть то,
 * что игрок отпускает первым. */
export function drawSparkles(ctx, cx, cy, t) {
  const spots = [[-26, -14, 3], [22, -20, 2], [-14, -34, 2], [30, 2, 2], [-34, 4, 2], [8, -40, 3]];
  ctx.fillStyle = ACCENT;
  spots.forEach(([dx, dy, arm], k) => {
    const blink = 0.5 + 0.5 * Math.sin(t * 2.2 + k * 1.7);
    if (blink < 0.35) return;
    const x = Math.round(cx + dx);
    const y = Math.round(cy + dy);
    const a = Math.round(arm * (0.6 + blink * 0.4)) * 2;
    ctx.fillRect(x - a, y - 1, a * 2 + 2, 2);
    ctx.fillRect(x - 1, y - a, 2, a * 2 + 2);
  });
}

// --- крепость и корона на крыше ---------------------------------------
// Спрайты — генерация (pixflux), приведённая к палитре. Крепость сажается
// ЦЕНТРОМ СВОЕГО ОСНОВАНИЯ на точку крыши: центр основания — середина
// самой широкой строки силуэта (углы изометрического ромба), считается по
// самому спрайту, поэтому замена картинки не требует новых чисел.
const top = { castle: null, crown: null, anchor: [0, 0], height: 0 };

function baseAnchor(img) {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const a = g.getImageData(0, 0, img.width, img.height).data;
  let best = { w: -1, y: 0, x: 0 };
  let topY = img.height;
  for (let y = 0; y < img.height; y++) {
    let x0 = -1;
    let x1 = -1;
    for (let x = 0; x < img.width; x++) {
      if (a[(y * img.width + x) * 4 + 3] > 127) { if (x0 < 0) x0 = x; x1 = x; }
    }
    if (x0 < 0) continue;
    topY = Math.min(topY, y);
    if (x1 - x0 >= best.w) best = { w: x1 - x0, y, x: (x0 + x1 + 1) / 2 };
  }
  return { anchor: [best.x, best.y], height: best.y - topY };
}

export function setTowerTop({ castle, crown }) {
  top.castle = castle ?? null;
  top.crown = crown ?? null;
  if (castle) Object.assign(top, baseAnchor(castle));
}

/** Где над крышей парит корона — в рядах (единицы z), от крыши. */
export function crownLift() {
  return top.castle ? (top.height * GRAIN + 10) / ZH : 0.5;
}

/** Сколько экранных px башня с крепостью, короной и искрами занимает над
 * основанием — по ней сцена опускает башню под подсказку. */
export function towerReach() {
  const crownH = top.crown ? top.crown.height * GRAIN : 0;
  const [, y] = project(0, 0, 1.5, 1.5, ROWS + crownLift());
  return Math.round(-y + crownH + 44);   // 44 — верхняя искра (drawSparkles)
}

/** Крепость на крыше: (x, y) — центр крыши в единицах бруска, z — её уровень. */
export function drawCastle(ctx, ox, oy, x, y, z) {
  if (!top.castle) return;
  const [px, py] = project(ox, oy, x, y, z);
  const w = top.castle.width * GRAIN;
  const h = top.castle.height * GRAIN;
  const sx = Math.round((px - top.anchor[0] * GRAIN) / GRAIN) * GRAIN;
  const sy = Math.round((py - top.anchor[1] * GRAIN) / GRAIN) * GRAIN;
  ctx.drawImage(top.castle, sx, sy, w, h);
}

/** Корона: нижний край — в точке (x, y, z). sparkle — искры вокруг (пока
 * она на крепости). */
export function drawCrown(ctx, ox, oy, c, t, sparkle) {
  if (!top.crown) return;
  const [px, py] = project(ox, oy, c.x, c.y, c.z);
  const w = top.crown.width * GRAIN;
  const h = top.crown.height * GRAIN;
  const x = Math.round((px - w / 2) / 2) * 2;
  const y = Math.round((py - h) / 2) * 2;
  ctx.drawImage(top.crown, x, y, w, h);
  if (sparkle) drawSparkles(ctx, x + w / 2, y + h / 2, t);
}

/** Земля — те же каменные плиты дороги Шута, только в изометрии (решение
 * в чате: не заводить под Башню свою землю, а связать карты одним миром). */
export function drawGround(ctx, ox, oy, radius = 4, shadowRows = 0) {
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
  if (shadowRows > 0) drawShadow(ctx, ox, oy, shadowRows);
}

/** Тень башни на полу — свет слева, тень ложится вправо (по +x) на длину,
 * растущую с высотой. Пиксельным растром 2×2 чёрного: палитра без альфы,
 * а сплошная чернота съела бы сетку пола. Даёт башне опору и глубину. */
function drawShadow(ctx, ox, oy, rows) {
  const len = 3 + rows * 0.35;
  const q = [
    project(ox, oy, 3, 0, 0), project(ox, oy, 3 + len, 0, 0),
    project(ox, oy, 3 + len, 3, 0), project(ox, oy, 3, 3, 0),
  ];
  ctx.save();
  ctx.beginPath();
  q.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.clip();
  const xs = q.map((p) => p[0]);
  const ys = q.map((p) => p[1]);
  ctx.fillStyle = BODY;
  for (let y = Math.floor(Math.min(...ys) / 2) * 2; y < Math.max(...ys); y += 2) {
    for (let x = Math.floor(Math.min(...xs) / 2) * 2 + ((y / 2) % 2) * 2; x < Math.max(...xs); x += 4) {
      ctx.fillRect(x, y, 2, 2);
    }
  }
  ctx.restore();
}

/** Куча лежащих обломков — от дальних к ближним, иначе ближние уходят под
 * дальние. Тот же порядок и на сцене, и на предсказании. */
export function drawRubble(ctx, ox, oy, blocks) {
  [...blocks]
    .sort((a, b) => (a.z - b.z) || ((a.x + a.y) - (b.x + b.y)))
    .forEach((b) => drawBlock(ctx, ox, oy, b, false));
}

// Снимок последней кучи: сцена кладёт сюда обломки и точку, где они
// замерли, предсказание читает. Пусто — Башню в этой сессии не играли.
export const rubbleSnapshot = { blocks: [], ox: 0, oyFromBottom: 0, crown: null };

export function saveRubble(blocks, ox, oyFromBottom, crown = null) {
  rubbleSnapshot.blocks = blocks.map((b) => ({ x: b.x, y: b.y, z: b.z, dx: b.dx, dy: b.dy, tone: b.tone }));
  rubbleSnapshot.ox = ox;
  rubbleSnapshot.oyFromBottom = oyFromBottom;
  rubbleSnapshot.crown = crown ? { x: crown.x, y: crown.y, z: crown.z } : null;
}

/** Куча показана — снимок больше не нужен. */
export function clearRubble() {
  rubbleSnapshot.blocks = [];
  rubbleSnapshot.crown = null;
}

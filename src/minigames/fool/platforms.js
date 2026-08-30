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
export const PLATE_H = 32; // 16 нативных px тайлсета × 2 (решение 2026-08-28,
                           // по переписанной BUILD-SPEC-03 задача 2 п.4)

// Тайлсет дороги — public/assets/road/plat_tiles.png, нарезан из
// assets/1-bit Pixel Art Platformer Tile.png (design-system/extract-road-tiles.py).
// Атлас 48×16 нативных: три ячейки 16×16 подряд — [cap_l | mid | cap_r].
// Рисуется ФИКСИРОВАННЫМ ×2, без uiScale (BUILD-SPEC-03 задача 2: ни одного
// drawImage со `* scale`). 1 нативный px = ровно 2 экранных, всегда.
const SRC_TH = 16;      // высота ячейки в тайлсете
const SRC_CELL = 16;    // ширина ячейки
const CAP_W = SRC_CELL * 2; // 32 экранных — торец
const MID_W = SRC_CELL * 2; // 32 экранных — одна серединная плитка, тайлится

// Щели РАЗНЫЕ, но мягкие (правка в чате 2026-08-28: «не жестить со
// сложностью, плиты норм размеров»). Нормальный свайп вверх-вперёд
// перекрывает любую с запасом; упасть можно, если сойти с края или
// фликнуть совсем вяло — тогда возврат на начало плиты (leap.js), не
// проигрыш. Ступени вниз (dy +32) переносятся и ходьбой, вверх (dy −32)
// требуют лёгкого прыжка — естественный пологий градиент.
const G_A = 48; // короткая
const G_B = 56; // средняя
const G_C = 64; // подлиннее

// P1 — старт. Ширина 384 (BUILD-SPEC-02, задача 5): плита продолжается
// влево за кадр, старт отсчитывается от правого края на START_WALK, чтобы
// левый край не был виден с первого кадра (см. leap.js).
//
// Все ширины — кратные 32 экранным (BUILD-SPEC-03 задача 2): плита = торец
// 32 + N×серединная 32 + торец 32, целое число плиток. Минимум — 96, но
// держим 128–224 — «норм размеры». Ступени кратны 32 экранным (CLAUDE.md),
// только ±32 — без резких скачков. Толщина плиты везде одна (PLATE_H 32).
export const P1_WIDTH = 384;
export const START_WALK = 176;

const DATA = [
  { dy: 0, w: P1_WIDTH }, // P1 — старт, длинная
  { dy: -32, w: 160, gap: G_B, jump: true },
  { dy: 0, w: 128, gap: G_A, jump: true },
  { dy: -32, w: 160, gap: G_C, jump: true },
  { dy: 32, w: 128, gap: G_B, jump: true },  // ступень вниз — можно и шагом
  { dy: -32, w: 128, gap: G_C, jump: true },
  { dy: 0, w: 160, gap: G_A, jump: true },
  { dy: -32, w: 128, gap: G_B, jump: true },
  { dy: 0, w: 224, gap: G_B, jump: true }, // финальная — длинная, дальше удержание
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

// Плита = торец + N серединных плиток + торец, каждая копия — целая, ×2,
// по целым координатам (CLAUDE.md: спрайты только по целым, иначе размытая
// полоска). Ширина плиты кратна 32, поэтому N = (w − 64) / 32 всегда целое.
function drawRoad(ctx, img, x, y, w) {
  const blit = (sx, dx, dw) =>
    ctx.drawImage(img, sx, 0, SRC_CELL, SRC_TH, Math.round(dx), Math.round(y), dw, PLATE_H);

  blit(0, x, CAP_W); // cap_l
  const n = Math.max(0, Math.round((w - CAP_W * 2) / MID_W));
  for (let i = 0; i < n; i++) blit(SRC_CELL, x + CAP_W + i * MID_W, MID_W);
  blit(SRC_CELL * 2, x + w - CAP_W, CAP_W); // cap_r
}

/** Рисует плиту: чёрная подложка (тело — дыра в воздухе, design-system) +
 * тайлсет дороги, целыми плитками, фиксированный ×2. */
export function drawPlatform(ctx, images, p, camX, camY) {
  const x = Math.round(p.x - camX);
  const y = Math.round(p.y - camY);
  const w = p.w; // уже экранные px, кратно 32 — без * scale
  if (x + w < -40 || x > 2000) return; // грубый culling

  ctx.fillStyle = '#000000';
  ctx.fillRect(x, y, w, PLATE_H);
  drawRoad(ctx, images.roadTiles, x, y, w);
}

/** Офскрин-полоса дороги шириной sw (кратно 32) — тело + тайлсет, как у
 * обычной плиты. Нужна там, где дорогу надо ПРОЯВИТЬ или РАСТВОРИТЬ
 * попиксельно (`core/pixelReveal.js`): призрачное продолжение у финального
 * края (задача 5) и прибытие после падения (задача 7). Рисуем один раз,
 * дальше только маскируем. */
export function buildRoadStrip(images, sw) {
  const c = document.createElement('canvas');
  c.width = sw;
  c.height = PLATE_H;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  drawPlatform(g, images, { x: 0, y: 0, w: sw }, 0, 0);
  return c;
}

// Геометрия «прибытия» (задача 7 + правка в чате 2026-08-30: «всё внизу
// экрана, продолжение дороги сбоку сразу»). Общая для leap.js (такт 3
// падения) и prediction.js (та же дорога держится под текстом, стыка
// между экранами не видно). Верх дороги — доля высоты экрана.
export const ARRIVE_GROUND_FRAC = 0.82; // верх основной дороги (правка 2026-08-30: ниже)
export const ARRIVE_MAIN_W = 256;  // плита, на которой стоит Шут (кратно 32)
export const ARRIVE_SIDE_W = 160;  // следующая плита над Шутом (кратно 32)
export const ARRIVE_STEP_UP = 128; // насколько следующая плита выше (кратно 32; правка 2026-08-30: ниже)
export const ARRIVE_STEP_DX = 16;  // отступ следующей плиты от правого края основной (правее)

// Дальний пунктирный слой (`drawFarRoad`) удалён — BUILD-SPEC-03 задача 4:
// глубину под дорогой теперь даёт дышащий дизер-градиент пропасти
// (`abyss.js`), а не пунктир. Плюс он был последним местом с дробным
// `* scale` в дорожном пути (хвост задачи 2).
//
// Процедурный дизер призрачной дороги (`drawGhostRoad`) удалён — правка в
// чате 2026-08-29: рушащаяся плита должна быть ТАКОЙ ЖЕ, как остальные, и
// осыпаться пиксельным проявлением оракула. Теперь это `buildRoadStrip` +
// `drawPixelReveal` с progress 1→0 (leap.js).

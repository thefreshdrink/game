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
export const PLATE_H = 24; // 12 нативных px тайлсета × 2 (CLAUDE.md: высота плиты 24)

// Тайлсет дороги — public/assets/road/plat_tiles.png, нарезан из
// assets/1-bit Pixel Art Platformer Tile.png (design-system/extract-road-tiles.py).
// Атлас 48×12 нативных: три ячейки 16×12 подряд — [cap_l | mid | cap_r].
// Рисуется ФИКСИРОВАННЫМ ×2, без uiScale (BUILD-SPEC-03 задача 2: ни одного
// drawImage со `* scale`). 1 нативный px = ровно 2 экранных, всегда.
const SRC_TH = 12;      // высота ячейки в тайлсете
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
// только ±32 — без резких скачков. Толщина плиты везде одна (PLATE_H 24).
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

/** Тусклая дорога за пропастью — видна, недостижима, не интерактивна
 * (BUILD-SPEC «решение B») — тот же тайлсет, приглушённый прозрачностью. */
export function drawGhostRoad(ctx, images, x, y, w, camX, camY) {
  const rx = Math.round(x - camX);
  const ry = Math.round(y - camY);
  ctx.fillStyle = '#000000';
  ctx.fillRect(rx, ry, w, PLATE_H);
  ctx.globalAlpha = 0.4;
  drawRoad(ctx, images.roadTiles, rx, ry, w);
  ctx.globalAlpha = 1;
}

// Дальний слой — не реальная плита, а штрих намёка на то, что мир шире
// кадра (BUILD-SPEC-02, задача 5: «плиты читаются как отдельные бруски в
// пустоте», без глубины). Пунктир, не сплошная полоса — со сплошной
// заливкой параллакс (плита едет медленнее переднего плана) было бы не
// увидеть: у однотонной полосы нет ориентиров, по которым заметно
// движение. Свой ассет не нужен — просто два цвета из палитры пустоты.
const FAR_PARALLAX = 0.4;
const FAR_DASH = 5;
const FAR_GAP = 7;
const FAR_Y_OFFSET = 150; // мировых px ниже стартовой плиты — «дальняя дорога» глубже в кадре
// 0.45 — та же доля h, что и у камеры в leap.js (targetCamY = player.y −
// h×0.45): нужна здесь, чтобы дальний слой стартовал на осмысленной
// высоте кадра, а не считалась заново из camY (см. комментарий ниже).
// Если поменяется камера — поменять и здесь.
const CAM_Y_FRAC = 0.45;

export function drawFarRoad(ctx, w, h, camX, playerY, scale, startY) {
  // По Y — не от camY напрямую: camY уже несёт постоянное смещение
  // кадрирования (игрок держится на 0.45h от верха, BUILD-SPEC-02 задача
  // 5), и это смещение — не «прокрутка мира», а просто композиция кадра,
  // общая у переднего и дальнего плана. Если параллаксить весь camY, эта
  // постоянная часть тоже домножается на 0.4 и слой уезжает на сотни px
  // не туда (баг, пойман вживую при проверке). Параллаксим только
  // РАЗНИЦУ — насколько игрок реально прошёл от старта.
  const traveledY = playerY - startY;
  const y = Math.round(FAR_Y_OFFSET + h * CAM_Y_FRAC - traveledY * FAR_PARALLAX);
  if (y < -20 || y > h + 20) return;

  const parX = camX * FAR_PARALLAX;

  const period = Math.round((FAR_DASH + FAR_GAP) * scale);
  const dashLen = Math.max(1, Math.round(FAR_DASH * scale));
  const barH = Math.max(1, Math.round(2 * scale));
  const offset = ((parX % period) + period) % period;

  ctx.fillStyle = '#2A2A2A';
  for (let x = -offset - period; x < w + period; x += period) {
    ctx.fillRect(Math.round(x), y, dashLen, barH);
  }
  // Ближняя кромка — на полутон светлее, тем же приёмом, что и у настоящих
  // плит (двойная линия дизайн-системы, просто без второй, тёмной нити).
  ctx.fillStyle = '#4A4A4A';
  ctx.fillRect(0, y - barH, w, Math.max(1, Math.round(scale)));
}

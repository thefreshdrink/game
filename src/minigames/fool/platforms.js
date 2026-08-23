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
const GAP_JUMP = 52; // перепрыгивается даже при минимальной силе свайпа
const GAP_JUMP_FAR = 64; // «дальше» — щель побольше, но всё ещё безопасна
const GAP_STEP = 32; // «сходит с края» — переносится ходьбой без прыжка

// P1 — старт. Ширина 400, не 176 (BUILD-SPEC-02, задача 5): игрок стартует
// не у самого левого края плиты, а с отступом на исходные 176px от правого
// края — сама плита продолжается ещё на 224px влево, за кадр, чтобы левый
// край не «обрывался» в кадре с первого мгновения (см. leap.js, START_WALK).
export const P1_WIDTH = 400;
export const START_WALK = 176;

const DATA = [
  { dy: 0, w: P1_WIDTH }, // P1 — старт
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

// Концевая зона блока (скоба + зазор, ASSETS.md: «скоба 7 · зазор 2») —
// остаётся нерастянутой при 3-slice; середина — однородный повторяющийся
// брус, поэтому её можно смело растягивать под любую ширину плиты вместо
// тайлинга по колонкам — визуально неотличимо, а кода меньше.
const CAP_SLICE = 16;

function drawBlock(ctx, img, x, y, w, h) {
  const capW = Math.min(Math.round(w / 2), Math.round(CAP_SLICE * (h / img.height)));
  const midW = Math.max(0, w - capW * 2);
  const srcMidW = img.width - CAP_SLICE * 2;

  ctx.drawImage(img, 0, 0, CAP_SLICE, img.height, x, y, capW, h);
  if (midW > 0) {
    ctx.drawImage(img, CAP_SLICE, 0, srcMidW, img.height, x + capW, y, midW, h);
  }
  ctx.drawImage(img, img.width - CAP_SLICE, 0, CAP_SLICE, img.height, x + w - capW, y, capW, h);
}

/** Рисует плиту: чёрная подложка (design-system) + эталонный блок целиком,
 * 3-slice под фактическую ширину плиты. */
export function drawPlatform(ctx, images, p, camX, camY, scale) {
  const x = Math.round(p.x - camX);
  const y = Math.round(p.y - camY);
  const w = Math.round(p.w * scale);
  const h = Math.round(PLATE_H * scale);
  if (x + w < -40 || x > 2000) return; // грубый culling

  ctx.fillStyle = '#000000';
  ctx.fillRect(x, y, w, h);
  drawBlock(ctx, images.roadBlock, x, y, w, h);
}

/** Тусклая дорога за пропастью — видна, недостижима, не интерактивна
 * (BUILD-SPEC «решение B») — тот же блок, приглушённый прозрачностью. */
export function drawGhostRoad(ctx, images, x, y, w, camX, camY, scale) {
  const rx = Math.round(x - camX);
  const ry = Math.round(y - camY);
  const rw = Math.round(w * scale);
  const rh = Math.round(PLATE_H * scale);
  ctx.fillStyle = '#000000';
  ctx.fillRect(rx, ry, rw, rh);
  ctx.globalAlpha = 0.4;
  drawBlock(ctx, images.roadBlock, rx, ry, rw, rh);
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

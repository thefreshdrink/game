// Экран 5 — мини-игра «Leap». Идёшь по дороге вправо, дорога кончается, и
// последний шаг — тот же самый, что и все предыдущие (BUILD-SPEC).
//
// Управление — РУЧНОЕ (правка в чате 2026-08-28: «фул сам плывёт, игра
// очень лёгкая»): держишь палец — Шут идёт вперёд, отпустил — стоит.
// Назад некуда (уровень линейный). Свайп вверх — прыжок через щель; слабый
// свайп можно не дотянуть. С плиты можно сойти и упасть. Падение = сцена
// падения и возврат на НАЧАЛО той же плиты — теряешь пройденный отрезок,
// не всю игру. Экрана проигрыша, очков, таймера по-прежнему нет
// (CLAUDE.md). У последнего края — одно удержание вместо прыжка.
//
// Анимация — «сначала процедурно, руками только то, что код не умеет»
// (ASSETS.md): нет отдельных кадров ходьбы/наклона у края/«пёс
// оглядывается»/парного падения — вместо них здесь squash-and-stretch,
// программный наклон и позиционирование по существующим позам (idle/fall,
// walk/sit/look_down/jump у пса).

import { drawHoldRing, drawSwipeTick } from '../../core/gestureGlyph.js';
import { drawPixelReveal } from '../../core/pixelReveal.js';
import { PHYS, gravityFor, jumpVelocity } from './physics.js';
import {
  buildPlatforms, platformAt, drawPlatform, buildRoadStrip, START_WALK, PLATE_H,
} from './platforms.js';
import { drawAbyss } from './abyss.js';

// Спрайты — 44×48 и 18×14 арт-px (ASSETS.md). Правило сетки CLAUDE.md —
// 1 арт-пиксель = ровно 2 экранных. Значения ниже уже удвоены и рисуются
// ФИКСИРОВАННЫМ ×2 без uiScale (BUILD-SPEC-03 задача 2) — иначе арт-пиксель
// занимает то 1, то 2 экранных, и контур рвётся.
const PLAYER_W = 88;
const PLAYER_H = 96;
// Парный спрайт падения (Шут+пёс, BUILD-SPEC-03 задача 3) шире соло-поз —
// своя ширина, та же высота (48×48 арт-px → ×2 экранных, см. ASSETS.md).
const PAIR_W = 96;
const IDLE_FPS = 6; // темп смены кадров дыхания (4 кадра)
const DOG_W = 36;
const DOG_H = 28;
const DOG_LAG = 46; // насколько пёс отстаёт по x в обычной ходьбе

// Прыжок пса за игроком — процедурная дуга по Y, не смена спрайта саму
// по себе (правка в чате: «не похоже, что он прыгает за ним» — раньше
// просто менялась поза, а сам пёс продолжал ровно скользить к цели).
// Пёс не считает щели сам — просто подпрыгивает следом с небольшой
// задержкой реакции каждый раз, когда игрок уходит в 'air'.
const DOG_HOP_DELAY = 0.1; // реакция чуть позже, чем прыгнул игрок
const DOG_HOP_DURATION = 0.32;
const DOG_HOP_HEIGHT = 34;

// Стоя у края (walk/wait_leap/charge) фигура центрируется на p.x, а
// p.x — это САМ край плиты (edgeX в 'walk'), поэтому правая половина
// спрайта нависала над пропастью (правка в чате: «выходит за край
// платформы»). Смещаем отрисовку назад только в этих статичных позах —
// на физику и позицию для прыжка (player.x) это не влияет, только на то,
// где рисуется спрайт. Величина сдвига — половина реальной ширины
// спрайта, считается прямо в drawPlayer (там уже есть w).

const HOLD_T1 = 1.6; // первые 75% полоски
const HOLD_T2 = 1.0; // последние 25% — заметно медленнее (BUILD-SPEC)
const HOLD_TOTAL = HOLD_T1 + HOLD_T2; // «~2,6 сек»

// Падение — три такта (BUILD-SPEC-03 задача 7). Не «летим вниз через мир»,
// а «мир едет вверх»: пара Шут+пёс держится по центру кадра, мимо летят
// слои пропасти и обломки, скорость нарастает; книзу темнеет, пока не
// закроет кадр; потом из темноты пиксельно проступает та же дорога.
const BRACE_DUR = 0.15;   // такт 1 — стоп-кадр
const FALL_DUR = 1.5;     // такт 2 — полёт
const ARRIVE_DUR = 1.15;  // такт 3 — проявление земли
const FALL_V0 = 240;      // стартовая скорость «прокрутки мира», экранных px/с
const FALL_ACCEL = 900;   // нарастание
const FALL_VMAX = 1500;
const GHOST_W = 160;      // призрачная плита за краем (кратно 32), задача 5
const ARRIVE_W = 320;     // плита прибытия (кратно 32), задача 7

// Насколько можно провалиться ниже плиты, с которой прыгнул, прежде чем
// это считается промахом и включается респавн — заметно больше любой
// реальной дуги прыжка (макс. дельта дороги −128), чтобы не сработать
// ложно на обычном спуске.
const RESPAWN_DROP = 260;

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function holdProgress(elapsed) {
  if (elapsed <= HOLD_T1) return (elapsed / HOLD_T1) * 0.75;
  return 0.75 + clamp01((elapsed - HOLD_T1) / HOLD_T2) * 0.25;
}

export function createLeapScreen({ input, images, goto }) {
  let offHandlers = [];
  let platforms = [];
  let idx = 0; // индекс текущей/последней плиты под ногами
  let state = 'walk'; // walk | air | wait_leap | charge | brace | fall | arrive
  let t = 0;
  let stateT = 0;
  let deepestY = 0;
  let camX = 0, camY = 0;
  let walking = false;  // палец удерживается — Шут идёт вперёд (ручное управление)
  let movedEver = false; // хоть раз пошёл — знак «удержи, чтобы идти» больше не нужен
  let respawnFlash = 0; // короткая вспышка чёрным после падения, сек
  // Жестовые знаки (задача 8): появляются после паузы бездействия, гаснут
  // навсегда после первого удавшегося жеста своего типа.
  let idleT = 0;            // сек без ввода в состоянии, ждущем жеста
  let swipeGlyphDone = false; // хоть раз прыгнул свайпом — знак свайпа снят
  // Финальный край (задача 5): призрачная дорога проявлена (1) → осыпалась
  // (0); кромка последней плиты разгорается акцентом (0 → 1).
  let ghostReveal = 1;
  let ghostCrumbled = false; // осколки уже сыпанули — один раз
  let accentEdge = 0;
  let lean = 0; // наклон Шута у финального края, 0..1 (задача 6, вместо полоски HOLD)
  // Падение — три такта (задача 7): 'brace' → 'fall' (мир едет вверх) → 'arrive'.
  let fallScroll = 0, fallSpeed = 0, debrisT = 0, arriveDust = false;
  // Офскрин-полосы дороги для пиксельного проявления/растворения: узкая —
  // призрачная плита у края (задача 5), плита прибытия (задача 7).
  let ghostStrip = null;
  let groundStrip = null;
  // Для распознавания «флика вверх на ходу» (input даёт hold-события без
  // скорости) — держим предыдущую точку hold-жеста.
  let holdPrevY = 0, holdPrevMs = 0;

  const player = { x: 0, y: 0, vx: 0, vy: 0, face: 1, sqx: 1, sqy: 1, pose: 'idle' };
  // hopDelay > 0 — отсчитывает задержку реакции; hopT >= 0 — идёт сама
  // дуга прыжка (см. DOG_HOP_*); hopT === -1 — пёс не прыгает.
  const dog = {
    x: 0, y: 0, state: 'follow', pose: 'walk', frameT: 0, hopDelay: 0, hopT: -1, peekT: 0,
  };

  function scheduleDogHop() {
    dog.hopDelay = DOG_HOP_DELAY;
    dog.hopT = -1;
  }
  const dust = [];

  function startPlatform() {
    return platforms[0];
  }

  function spawnDust(x, y, n) {
    for (let i = 0; i < n; i++) {
      dust.push({
        x, y,
        vx: (Math.random() - 0.5) * 70,
        vy: -Math.random() * 40,
        t: 0, life: 0.35 + Math.random() * 0.2,
        s: Math.random() < 0.5 ? 2 : 3,
      });
    }
  }

  function updateDust(dt) {
    for (let i = dust.length - 1; i >= 0; i--) {
      const d = dust[i];
      d.t += dt;
      if (d.t >= d.life) { dust.splice(i, 1); continue; }
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.vy += 220 * dt;
    }
  }

  function land(p) {
    player.y = p.y;
    player.vx = 0;
    player.vy = 0;
    player.sqx = 1.22;
    player.sqy = 0.8;
    idx = platforms.indexOf(p);
    state = 'walk';
    stateT = 0;
    walking = false; // приземлился — не уносим сразу за следующий край
    spawnDust(player.x, player.y, 5);
  }

  /** Упал с плиты (сошёл с края или не дотянул прыжок). Возвращаем на
   * НАЧАЛО той же плиты (левый край) — пройденный по ней отрезок теряется,
   * но не вся игра, экрана проигрыша нет (правка в чате 2026-08-28).
   * Короткая вспышка чёрным вместо полноценной сцены падения — сама сцена
   * (три такта) это отдельная задача BUILD-SPEC-03. */
  function respawnAtStart() {
    const p = platforms[idx];
    player.x = p.x + 20;
    player.y = p.y;
    player.vx = 0;
    player.vy = 0;
    player.sqx = 1;
    player.sqy = 1;
    state = 'walk';
    stateT = 0;
    walking = false;
    idleT = 0;
    respawnFlash = 0.22;
    deepestY = player.y; // иначе «пустота» снизу кадра остаётся раздутой после падения
    // Камеру подводим сразу, без плавного «полёта» обратно.
    camX = player.x - 430 * 0.38;
    camY = player.y - 932 * 0.45;
    dog.x = player.x - DOG_LAG;
    dog.y = player.y;
    dog.state = 'follow';
    spawnDust(player.x, player.y, 6);
  }

  function beginJump(upPow, sidePow) {
    if (state !== 'walk') return;
    const v = jumpVelocity(upPow, sidePow);
    player.vy = v.vy;
    player.vx = v.vx;
    player.sqx = 0.8;
    player.sqy = 1.24;
    state = 'air';
    stateT = 0;
    idleT = 0;
    swipeGlyphDone = true; // удачный свайп — знак свайпа в этой карте больше не нужен
    spawnDust(player.x, player.y, 4);
    scheduleDogHop();
  }

  function commitLeap() {
    // Такт 1 (задача 7): срыв — стоп-кадр. Дальше 'fall' (мир едет вверх),
    // потом 'arrive' (плита проступает пикселями, на неё же садятся Шут и
    // пёс). Пёс всю дорогу — часть парного спрайта (fool_dog_fall),
    // отдельно не летит. lean держим на 1 — Шут застыл заваленным вперёд
    // на весь такт 1.
    state = 'brace';
    stateT = 0;
    lean = 1;
    player.vx = 0;
    player.vy = 0;
    fallScroll = 0;
    fallSpeed = 0;
    debrisT = 0;
    arriveDust = false;
  }

  // Матрица Bayer 4×4 для дизера слоёв пустоты в полёте — та же, что в
  // abyss.js: слои должны быть из тех же «крупных пикселей», не плоские.
  const FALL_BAYER = [
    [0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5],
  ];

  /** Три такта падения (задача 7). Фон уже залит #111111. */
  function drawFallSequence(ctx, w, h) {
    if (state === 'fall') {
      const prog = clamp01(stateT / FALL_DUR);

      // Два дальних слоя пустоты — плиты, ползут вверх медленно, дают
      // глубину. Тело сплошное, верх и низ на 2 ячейки растворены дизером в
      // воздух — те же «крупные пиксели», мягкий край, не плоская полоса.
      const CELL = 8;
      const backLayers = [
        { mult: 0.4, c: '#1C1C1C', band: 96 },
        { mult: 0.7, c: '#212121', band: 136 },
      ];
      for (const L of backLayers) {
        const period = L.band + 160; // просвет воздуха между плитами
        const off = ((fallScroll * L.mult) % period + period) % period;
        for (let top = h - off; top > -period; top -= period) {
          for (let cy = 0; cy < L.band; cy += CELL) {
            const edgeCells = Math.min(cy, L.band - CELL - cy) / CELL; // 0 у края
            const solid = edgeCells >= 2;
            ctx.fillStyle = L.c;
            if (solid) {
              ctx.fillRect(0, Math.round(top + cy), w, CELL);
            } else {
              const row = FALL_BAYER[((top + cy) / CELL | 0) & 3];
              const dens = edgeCells === 0 ? 0.28 : 0.62;
              for (let cx = 0; cx < w; cx += CELL) {
                if (row[(cx / CELL | 0) & 3] / 16 < dens) {
                  ctx.fillRect(cx, Math.round(top + cy), CELL, CELL);
                }
              }
            }
          }
        }
      }

      // Передний план — вертикальные штрихи скорости, летят вверх быстро.
      // Псевдослучайные, но стабильные колонки (seed от индекса).
      const SL_N = 16;
      for (let i = 0; i < SL_N; i++) {
        const seed = (i * 2654435761) >>> 0;
        const colX = (seed % (w - 4));
        const len = 24 + (seed >> 8) % 64;
        const mult = 1.0 + ((seed >> 4) & 7) / 10; // 1.0..1.7
        const period = h + len + 40;
        const yy = h - (((fallScroll * mult) + (seed % period)) % period);
        ctx.fillStyle = ((seed >> 3) & 3) === 0 ? '#808080' : '#4A4A4A';
        ctx.fillRect(Math.round(colX), Math.round(yy), 2, len);
      }

      // Плита, с которой шагнул — видна ~0.5 с и уходит вверх.
      const originY = h * 0.42 - fallScroll;
      if (originY > -PLATE_H) {
        drawPlatform(ctx, images, { x: Math.round(w / 2 - 112), y: 0, w: 224 }, 0, -Math.round(originY));
      }

      // Обломки/искры навстречу (в dust, летят вверх), экранные координаты.
      dust.forEach((d) => {
        ctx.fillStyle = (1 - d.t / d.life) > 0.5 ? '#808080' : '#4A4A4A';
        ctx.fillRect(Math.round(d.x - camX), Math.round(d.y - camY), d.s, d.s);
      });

      // Пара Шут+пёс — по центру, кувыркаются: покачивание по x + лёгкий
      // крен туда-сюда (падают, а не парят).
      const pw = PAIR_W;
      const cx = w / 2 + Math.sin(t * 5) * 4;
      const cyc = h * 0.44;
      ctx.save();
      ctx.translate(cx, cyc);
      ctx.rotate(Math.sin(t * 3.3) * 0.13 + prog * 0.1);
      ctx.drawImage(images.foolDogFall, Math.round(-pw / 2), Math.round(-PLAYER_H / 2), pw, PLAYER_H);
      ctx.restore();

      // Кадр закрывается: снизу растёт чернота (главное), сверху подбирается
      // вдвое медленнее — кадр «схлопывается», а не просто заливается.
      ctx.fillStyle = '#000000';
      const coverB = Math.round(h * clamp01(prog ** 1.6));
      ctx.fillRect(0, h - coverB, w, coverB);
      const coverT = Math.round(h * 0.5 * clamp01(prog ** 2.4));
      ctx.fillRect(0, 0, w, coverT);
      return;
    }

    // arrive — прибытие, не удар: из темноты пиксельным проявлением оракула
    // проступает ТА ЖЕ плита (buildRoadStrip), на неё садятся Шут и пёс.
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);
    const p = clamp01(stateT / ARRIVE_DUR);
    // Немного пустоты под плитой — чтобы читалось как уступ, не просто пол.
    drawAbyss(ctx, w, h, t);

    const gw = groundStrip.width;
    const gx = Math.round((w - gw) / 2);
    const gy = Math.round(h * 0.6);
    drawPixelReveal(ctx, groundStrip, gx, gy, gw, PLATE_H, p, 4, 0.5, 0.4);

    if (p > 0.5) {
      ctx.globalAlpha = clamp01((p - 0.5) / 0.4);
      const cx = Math.round(w / 2);
      // Пёс сидит слева от Шута — «как было с собакой» (правка 2026-08-29).
      const dogImg = images.dogSitFrames[Math.floor(t * 2) % images.dogSitFrames.length];
      ctx.drawImage(dogImg, cx - PLAYER_W / 2 - DOG_W - 4, gy - DOG_H, DOG_W, DOG_H);
      const fr = images.foolIdleFrames;
      ctx.drawImage(fr[Math.floor(t * IDLE_FPS) % fr.length], cx - PLAYER_W / 2, gy - PLAYER_H, PLAYER_W, PLAYER_H);
      ctx.globalAlpha = 1;
    }
    if (p >= 1) {
      dust.forEach((d) => {
        ctx.fillStyle = (1 - d.t / d.life) > 0.5 ? '#808080' : '#4A4A4A';
        ctx.fillRect(Math.round(w / 2 + (d.x - player.x)), Math.round(gy - (player.y - d.y)), d.s, d.s);
      });
    }
  }

  return {
    enter() {
      t = 0;
      stateT = 0;
      idx = 0;
      state = 'walk';
      deepestY = 0;
      walking = false;
      movedEver = false;
      idleT = 0;
      swipeGlyphDone = false;
      respawnFlash = 0;
      ghostReveal = 1;
      ghostCrumbled = false;
      accentEdge = 0;
      lean = 0;
      fallScroll = 0;
      fallSpeed = 0;
      debrisT = 0;
      arriveDust = false;
      holdPrevY = 0;
      holdPrevMs = 0;
      dust.length = 0;
      // Полосы дороги под пиксельное проявление: GHOST_W у края (кратно 32),
      // ARRIVE_W — плита прибытия (кратно 32, уже соло-поз Шута).
      if (!ghostStrip) ghostStrip = buildRoadStrip(images, GHOST_W);
      if (!groundStrip) groundStrip = buildRoadStrip(images, ARRIVE_W);

      const startY = 0;
      platforms = buildPlatforms(startY);
      const p0 = startPlatform();
      // P1 продолжается на 224px левее старого края, за кадр (BUILD-SPEC-02,
      // задача 5) — старт отсчитываем от ПРАВОГО края на исходную дистанцию
      // ходьбы (START_WALK), а не от левого, чтобы длина первого отрезка
      // до первого прыжка не менялась и левый край плиты не был виден.
      player.x = p0.x + p0.w - START_WALK;
      player.y = p0.y;
      player.vx = 0;
      player.vy = 0;
      player.face = 1;
      player.pose = 'idle';
      dog.x = player.x - DOG_LAG;
      dog.y = player.y;
      dog.state = 'follow';
      dog.pose = 'walk';
      dog.frameT = 0;
      camX = 0;
      camY = 0;

      offHandlers = [
        // Держишь палец — Шут идёт вперёд. press* — сырой сигнал «палец
        // сейчас здесь», без задержки в 250мс (в отличие от hold*), нужен
        // отзывчивый старт ходьбы.
        input.on('pressstart', (e) => {
          if (state === 'walk') walking = true;
          idleT = 0;
          holdPrevY = e.y;
          holdPrevMs = 0;
        }),
        input.on('pressend', () => { walking = false; idleT = 0; }),
        input.on('swipe', (e) => {
          // Быстрый свайп (палец на плите < 250мс) — прыжок. Слабый свайп
          // = слабый прыжок, щель можно не дотянуть (правка 2026-08-28).
          idleT = 0;
          if (state !== 'walk') return;
          walking = false;
          beginJump(e.up, Math.min(1, Math.abs(e.side)));
        }),
        input.on('holdstart', () => {
          idleT = 0;
          if (state !== 'wait_leap') return;
          walking = false;
          state = 'charge';
          stateT = 0;
          lean = 0; // кольцо/наклон начинают с нуля, не с недовыпрямленного значения
        }),
        input.on('holdmove', (e) => {
          idleT = 0;
          // Шёл (держал > 250мс) и на ходу дёрнул вверх — это прыжок, а не
          // дрейф пальца: input классифицирует такой жест как hold, не swipe,
          // поэтому ловим по СКОРОСТИ вверх между двумя hold-событиями, а не
          // по накопленному смещению (иначе сработает от медленного увода).
          const dtMs = e.duration - holdPrevMs;
          const prevY = holdPrevY;
          holdPrevY = e.y;
          holdPrevMs = e.duration;
          if (state !== 'walk' || !walking || dtMs < 8) return;
          const vUp = (prevY - e.y) / dtMs; // px/мс, >0 = вверх
          if (vUp > 0.7) {
            walking = false;
            beginJump(Math.max(0.2, Math.min(1.3, vUp * 0.6)), Math.min(1, Math.abs(e.dx) / 140));
          }
        }),
        input.on('holdend', () => {
          idleT = 0;
          if (state !== 'charge') return;
          if (stateT >= HOLD_TOTAL) commitLeap();
          else { state = 'wait_leap'; stateT = 0; } // отпустил раньше — просто ждём снова
        }),
      ];
    },

    exit() {
      offHandlers.forEach((off) => off());
      offHandlers = [];
    },

    update(dt, w = 430, h = 932) {
      t += dt;
      stateT += dt;
      idleT += dt; // сбрасывается в обработчиках ввода; кормит жестовые знаки
      updateDust(dt);
      if (respawnFlash > 0) respawnFlash = Math.max(0, respawnFlash - dt);

      // Камера: портрет, фигура держится ниже середины кадра (0.45, не
      // 0.33 — BUILD-SPEC-02, задача 5: было слишком высоко, нижние ~55%
      // кадра пустовали); по x с лёгким упреждением вправо (BUILD-SPEC:
      // «камера портрет»).
      const targetCamX = player.x - w * 0.38;
      const targetCamY = player.y - h * 0.45;
      const camRate = Math.min(1, 6 * dt);
      camX += (targetCamX - camX) * camRate;
      camY += (targetCamY - camY) * camRate;

      const last = platforms[platforms.length - 1];

      if (state === 'walk') {
        // Ручное управление: идёт вперёд только пока держат палец.
        if (walking) { player.x += PHYS.walk * dt; movedEver = true; }
        player.sqx += (1 - player.sqx) * Math.min(1, dt * 10);
        player.sqy += (1 - player.sqy) * Math.min(1, dt * 10);
        const p = platforms[idx];
        const edgeX = p.x + p.w;
        if (p === last) {
          // У последнего края мир кончается — дальше идти некуда, шаг
          // заменяет удержание (BUILD-SPEC). Просто упираемся в кромку.
          if (player.x >= edgeX - 2) {
            player.x = edgeX - 2;
            if (state === 'walk') { state = 'wait_leap'; stateT = 0; }
          }
        } else if (player.x > edgeX) {
          // Сошёл с края обычной плиты — падаешь. Если впереди есть куда
          // приземлиться в пределах дуги — долетишь; нет — respawnAtStart.
          player.vx = walking ? PHYS.walk : 0;
          player.vy = 0;
          state = 'air';
          stateT = 0;
          scheduleDogHop();
        }
      } else if (state === 'air') {
        // Растяжение с толчка (beginJump: sqx 0.8/sqy 1.24) не отпускало
        // всю дугу полёта — вместе с настоящими позами rise/fall это
        // читалось как «сжато» (правка в чате, 2026-08-26). Отпускаем к 1
        // с тем же темпом, что и в walk, пока летит.
        player.sqx += (1 - player.sqx) * Math.min(1, dt * 8);
        player.sqy += (1 - player.sqy) * Math.min(1, dt * 8);
        const prevY = player.y;
        player.vy += gravityFor(player.vy) * dt;
        player.x += player.vx * dt;
        player.y += player.vy * dt;
        deepestY = Math.max(deepestY, player.y);
        // Пересечение уровня плиты за кадр, не узкое окно — иначе на
        // большой скорости падения нога проскакивает сквозь плиту, не
        // задев её ни в одном кадре (баг, пойман вживую при тесте).
        if (player.vy > 0) {
          const p = platformAt(platforms, player.x, prevY - 2, player.y + 2);
          if (p) land(p);
        }
        // Упал мимо всех плит (не дотянул прыжок или сошёл с края) —
        // возврат на начало текущей плиты. Раньше «промахнуться нельзя»
        // было гарантией подбора щелей; теперь промах штатный, но без
        // проигрыша (правка в чате 2026-08-28).
        if (state === 'air' && player.y - platforms[idx].y > RESPAWN_DROP) {
          respawnAtStart();
        }
      } else if (state === 'wait_leap') {
        player.sqx += (1 - player.sqx) * Math.min(1, dt * 8);
        player.sqy += (1 - player.sqy) * Math.min(1, dt * 8);
        lean = Math.max(0, lean - dt / 0.4); // отпустил до срыва — выпрямляется за 0.4 с
      } else if (state === 'charge') {
        // Наклон вперёд, не «зарядка» (задача 6): пока держишь — угол растёт
        // 0→1 по holdProgress (последняя четверть медленнее). На 100% —
        // точка невозврата: тело уходит само, отпускание уже ничего не меняет.
        lean = holdProgress(stateT);
        if (stateT >= HOLD_TOTAL) commitLeap();
      } else if (state === 'brace') {
        // Такт 1 — срыв: полный стоп-кадр, ничего не двигается.
        if (stateT >= BRACE_DUR) { state = 'fall'; stateT = 0; fallSpeed = FALL_V0; fallScroll = 0; }
      } else if (state === 'fall') {
        // Такт 2 — полёт: мир едет вверх, скорость нарастает.
        fallSpeed = Math.min(FALL_VMAX, fallSpeed + FALL_ACCEL * dt);
        fallScroll += fallSpeed * dt;
        // Обломки и искры навстречу (летят вверх мимо пары) — плотно, чтобы
        // полёт читался. Размер 2–6 px, изредка крупный кусок.
        debrisT -= dt;
        if (debrisT <= 0) {
          debrisT = 0.025 + Math.random() * 0.05;
          for (let i = 0, n = 2 + (Math.random() * 3 | 0); i < n; i++) {
            const big = Math.random() < 0.15;
            dust.push({
              x: camX + Math.random() * (w || 430), y: camY + (h || 844) + 10,
              vx: (Math.random() - 0.5) * 40, vy: -(fallSpeed * (0.5 + Math.random() * 0.9)),
              t: 0, life: 0.3 + Math.random() * 0.35, s: big ? 6 : (Math.random() < 0.5 ? 2 : 4),
            });
          }
        }
        if (stateT >= FALL_DUR) { state = 'arrive'; stateT = 0; }
      } else if (state === 'arrive') {
        // Такт 3 — прибытие: земля проступает пикселями, потом предсказание.
        if (stateT >= ARRIVE_DUR && !arriveDust) {
          arriveDust = true;
          spawnDust(player.x, player.y, 14);
        }
        if (stateT >= ARRIVE_DUR + 0.5) goto('prediction');
      }

      // Пёс следует за игроком, пока не наступает его собственная реплика
      // у финального края (BUILD-SPEC: обгоняет, садится, оглядывается).
      if (dog.state === 'follow') {
        const targetX = player.x - DOG_LAG;
        dog.x += (targetX - dog.x) * Math.min(1, dt * 6);
        const p = platformAt(platforms, dog.x, -Infinity, Infinity) || platforms[idx];
        dog.y += (p.y - dog.y) * Math.min(1, dt * 10);
        dog.frameT += dt;
        // Настоящая дуга прыжка, не просто смена спрайта (правка в чате,
        // 2026-08-27: «не похоже, что он прыгает за ним»). Задержка —
        // реакция чуть позже игрока, потом синус-дуга вверх-вниз
        // (hopOffset читает drawDog); щель под собой пёс не считает,
        // просто подпрыгивает следом каждый раз, когда игрок в 'air'.
        if (dog.hopDelay > 0) {
          dog.hopDelay -= dt;
          if (dog.hopDelay <= 0) dog.hopT = 0;
        } else if (dog.hopT >= 0) {
          dog.hopT += dt;
          if (dog.hopT >= DOG_HOP_DURATION) dog.hopT = -1;
        }
        dog.hopOffset = dog.hopT >= 0
          ? -Math.sin(clamp01(dog.hopT / DOG_HOP_DURATION) * Math.PI) * DOG_HOP_HEIGHT
          : 0;
        dog.pose = dog.hopT >= 0 ? 'jump' : 'walk';
        if (state === 'wait_leap' || state === 'charge') {
          dog.state = 'overtake';
        }
      } else if (dog.state === 'overtake') {
        // Пёс обгоняет и доходит ДО САМОЙ кромки финальной плиты (dog.x —
        // центр, см. drawDog; держим не дальше кромки минус полуширина).
        const lastEdge = platforms[platforms.length - 1].x + platforms[platforms.length - 1].w;
        const targetX = Math.min(player.x + 30, lastEdge - DOG_W / 2 - 2);
        dog.x += (targetX - dog.x) * Math.min(1, dt * 5);
        dog.y += (player.y - dog.y) * Math.min(1, dt * 8);
        dog.frameT += dt;
        if (Math.abs(dog.x - targetX) < 2) { dog.state = 'peek'; dog.pose = 'lookdown'; dog.peekT = 0; }
      } else if (dog.state === 'peek') {
        // Заглядывает вниз с кромки ~0.8 с.
        dog.peekT += dt;
        dog.frameT += dt;
        if (dog.peekT >= 0.8) { dog.state = 'sit'; dog.pose = 'sit'; dog.frameT = 0; }
      } else if (dog.state === 'sit') {
        // Садится и «оглядывается» на игрока — отступив от Шута, чтобы не
        // накладываться на наклоняющуюся фигуру (правка в чате 2026-08-29:
        // «отодвинуть собаку назад»). Отдельного кадра «оглядывается» нет —
        // обходимся sit.
        dog.pose = 'sit';
        dog.frameT += dt;
        const sitX = player.x - 56; // позади Шута, чисто от наклона фигуры
        dog.x += (sitX - dog.x) * Math.min(1, dt * 4);
        dog.y += (player.y - dog.y) * Math.min(1, dt * 8);
      }

      // Финальный край (задача 5): осыпание призрачной дороги + акцентная
      // кромка. Оба — от расстояния до правого края последней плиты.
      const onLast = idx === platforms.length - 1;
      const toFinalEdge = onLast ? (last.x + last.w - player.x) : Infinity;

      if (toFinalEdge < 120) {
        ghostReveal = Math.max(0, ghostReveal - dt / 1.2); // растворяется за 1.2 с
        // Пока тают пиксели — вниз сыплются осколки (те же «крупные
        // пиксели», 4 px), по всей ширине призрачной плиты, гуще у дальнего
        // конца. Разово — как заводится осыпание.
        if (!ghostCrumbled) {
          ghostCrumbled = true;
          const gx = last.x + last.w;
          for (let i = 0; i < 16; i++) {
            const f = Math.random();
            dust.push({
              x: gx + f * GHOST_W, y: last.y + Math.random() * PLATE_H,
              vx: (Math.random() - 0.5) * 24, vy: 20 + Math.random() * 70 + f * 40,
              t: 0, life: 0.6 + Math.random() * 0.5, s: 4,
            });
          }
        }
      }

      // Кромка последней плиты (последние 16 арт-px, верхняя линия)
      // разгорается #EBA331 за 0.6 с, когда подходишь ближе 60px, и гаснет
      // если отошёл. Больше ничего оранжевым в мини-игре не красим.
      const wantAccent = onLast && toFinalEdge < 60
        && (state === 'walk' || state === 'wait_leap' || state === 'charge');
      accentEdge = clamp01(accentEdge + (wantAccent ? dt : -dt) / 0.6);
    },

    draw(ctx, w, h) {
      ctx.fillStyle = '#111111';
      ctx.fillRect(0, 0, w, h);

      // Такты 2–3 падения (задача 7) — свой мир, обычную сцену не рисуем.
      // Такт 1 ('brace') — это стоп-кадр обычной сцены, идёт по общему пути.
      if (state === 'fall' || state === 'arrive') {
        drawFallSequence(ctx, w, h);
        return;
      }

      const last = platforms[platforms.length - 1];
      // Пропасть — едва заметный дизер-градиент у нижней кромки кадра, за
      // плитами, виден всю дорогу (задача 4). Заменил и `drawFarRoad`, и
      // старую растущую черноту.
      drawAbyss(ctx, w, h, t);
      platforms.forEach((p) => drawPlatform(ctx, images, p, camX, camY));
      // Призрачное продолжение дороги за краем — ТА ЖЕ плита (тайлсет), не
      // отдельный дизер (правка 2026-08-29). Впритык к последней плите;
      // `ghostReveal` 1→0 — растворяется тем же пиксельным проявлением
      // оракула, дальние ячейки уходят первыми (origin слева) — «осыпается
      // от тебя в пропасть» (задача 5).
      if (ghostReveal > 0) {
        drawPixelReveal(
          ctx,
          ghostStrip,
          Math.round(last.x + last.w - camX),
          Math.round(last.y - camY),
          ghostStrip.width, PLATE_H,
          ghostReveal, 4, 0, 0.35,
        );
      }

      // Наклон Шута идёт РЕЗЧЕ К КОНЦУ, чем растёт кольцо (правка в чате
      // 2026-08-29: «не в унисон» — кольцо метёт 360°, наклон всего 32°,
      // кольцо убегало). lean² — Шут сперва «сопротивляется», к моменту
      // замыкания кольца валится. Акцентная кромка укорачивается по этой
      // же кривой, чтобы быть в паре с видимым наклоном.
      const leanV = lean * lean;

      // Кромка последней плиты загорается акцентом (задача 5): верхние
      // 2 арт-px последних 16 арт-px плиты. По мере наклона (задача 6)
      // укорачивается от края внутрь — к точке невозврата гаснет совсем.
      const accentW = Math.round(32 * (1 - leanV));
      if (accentEdge > 0 && accentW > 0) {
        const ex = Math.round(last.x - camX) + last.w;
        const ey = Math.round(last.y - camY);
        ctx.globalAlpha = accentEdge;
        ctx.fillStyle = '#EBA331';
        ctx.fillRect(ex - 32, ey, accentW, 4);
        ctx.globalAlpha = 1;
      }

      // Обычное падение с плиты (сошёл с края / не дотянул прыжок) — низ
      // кадра затягивает чернотой, пока не сработает respawnAtStart. Это
      // НЕ финальный leap (у того свои три такта, см. drawFallSequence).
      const fellBelow = deepestY - (platforms[idx] ? platforms[idx].y : 0);
      if (state === 'air' && fellBelow > 40) {
        const voidH = Math.round(h * (0.15 + clamp01(fellBelow / RESPAWN_DROP) * 0.55));
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, h - voidH, w, voidH);
      }

      // Пыль.
      dust.forEach((d) => {
        const a = 1 - d.t / d.life;
        ctx.fillStyle = a > 0.5 ? '#808080' : '#4A4A4A';
        ctx.fillRect(Math.round(d.x - camX), Math.round(d.y - camY - d.s), d.s, d.s);
      });

      // Пёс рисуется поверх Шута, не под ним (правка в чате, 2026-08-27:
      // «собаку на первом плане относительно Шута») — раньше порядок был
      // обратный. В падении пёс — часть парного спрайта игрока
      // (fool_dog_fall, BUILD-SPEC-03 задача 3), отдельно не рисуем.
      // Плиты под ногами — для клэмпа спрайтов по краям (Шут и пёс не
      // должны свисать за плиту ни левым, ни правым краем — правка в чате
      // 2026-08-28). Пёс обычно на той же плите, но у края может быть на
      // соседней — берём по его x.
      const standPlat = platforms[idx] || null;
      const dogPlat = platformAt(platforms, dog.x, -Infinity, Infinity) || standPlat;
      drawPlayer(ctx, images, player, camX, camY, state, t, standPlat, leanV);
      // fall/arrive сюда не доходят (ранний return выше); в остальных
      // состояниях, включая стоп-кадр 'brace', пёс рисуется.
      drawDog(ctx, images, dog, camX, camY, dogPlat);

      // Жестовые знаки (задача 8) — кодом из графического языка проекта,
      // РЯДОМ С ФИГУРОЙ, не в HUD. Ни одного слова в кадре. Появляются
      // после паузы бездействия (1.2 с; у финального края — 6 с, там
      // заминка это содержание, а не затруднение) и гаснут навсегда после
      // первого удавшегося жеста своего типа.
      const glyphX = Math.round(player.x - camX + 30);
      const glyphY = Math.round(player.y - camY - PLAYER_H - 30);
      // Знак удержания-подсказки — та же дуга, что в charge, но сама
      // прокручивается 0→1→0: показывает жест, а не статичный кружок.
      const sweep = 0.5 - 0.5 * Math.cos(t * 2.2);
      if (state === 'charge') {
        // Уже держишь — дуга показывает, сколько до срыва (индикатор, не
        // подсказка). До 100% и на нуле не рисуем. Полный радиус.
        if (lean > 0.02 && lean < 1) drawHoldRing(ctx, glyphX, glyphY, lean);
      } else if (state === 'walk' && !walking && idleT > 1.2) {
        const fade = clamp01((idleT - 1.2) / 0.4);
        const p = platforms[idx];
        const nearGap = p !== last && (p.x + p.w - player.x) < 80;
        if (!movedEver) {
          drawHoldRing(ctx, glyphX, glyphY, sweep, fade, 6); // «удержи, чтобы идти»
        } else if (nearGap && !swipeGlyphDone) {
          drawSwipeTick(ctx, glyphX, glyphY, fade);          // «свайп вверх» у щели
        }
      } else if (state === 'wait_leap' && idleT > 6) {
        drawHoldRing(ctx, glyphX, glyphY, sweep, clamp01((idleT - 6) / 0.8), 6);
      }
      // Полоска HOLD и текст у финального края убраны совсем (задача 6):
      // обратная связь — наклон Шута и укорачивающаяся акцентная кромка.

      // Вспышка чёрным после падения — короткий «моргнул и снова на плите».
      // Не полноценная сцена падения (та — задача 4 BUILD-SPEC-03).
      if (respawnFlash > 0) {
        ctx.globalAlpha = clamp01(respawnFlash / 0.22);
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 1;
      }
    },
  };
}

// Обычный прыжок (state 'air', короткая щель между плитами) читается по
// фазе дуги — вверх и вниз разными позами, не одной статичной (правка в
// чате, 2026-08-26): 'rise', пока vy < 0 (ещё поднимается), 'fall' — как
// только пошёл вниз. Финальный leap через пропасть рисует не эта функция,
// а drawFallSequence (три такта, задача 7) — сюда доходит только стоп-кадр
// 'brace', и он идёт по общей ветке idle, повёрнутой на leanV.
function drawPlayer(ctx, images, p, camX, camY, state, t, standPlat, lean = 0) {
  let pose;
  let img;
  if (state === 'air') {
    pose = p.vy < 0 ? 'rise' : 'fall';
    img = pose === 'rise' ? images.foolRise : images.foolFall;
  } else {
    pose = 'idle';
    const frames = images.foolIdleFrames;
    img = frames[Math.floor(t * IDLE_FPS) % frames.length];
  }
  const baseW = PLAYER_W;
  // Фиксированный ×2 (BUILD-SPEC-03 задача 2): PLAYER_W/H уже удвоены,
  // никакого uiScale. sqx/sqy — намеренный squash анимации, остаются.
  const w = Math.round(baseW * p.sqx);
  const h = Math.round(PLAYER_H * p.sqy);
  // Спрайт центрируется на p.x, но у него есть ширина — на последнем
  // отрезке платформы (ещё в 'walk', не только стоя у края) правая
  // половина заходила за физический край плиты (правка в чате: «выходит
  // за край», «на первой платформе заходит за край» — ловилось уже во
  // время ходьбы, не только в статичных позах ожидания). Первая попытка
  // трогала только 3 «стоячих» состояния и потому не спасала сам подход
  // к краю. Клэмп по фактическому краю ТЕКУЩЕЙ плиты (standEdgeX) решает
  // это на любом расстоянии сразу: пока до края далеко — сдвига нет
  // совсем, чем ближе — тем плавнее подъезжает, у самого края спрайт
  // просто не залезает правым краем дальше физической границы плиты.
  // В воздухе ('air') не клэмпим — там за пределами плиты находиться и
  // есть смысл состояния. На земле — держим спрайт целиком
  // над плитой, ни левым, ни правым краем не свисает (правка 2026-08-28).
  const isGrounded = state === 'walk'
    || state === 'wait_leap' || state === 'charge';
  let x = Math.round(p.x - camX - w / 2);
  if (isGrounded && standPlat) {
    const minLeft = Math.round(standPlat.x - camX);
    const maxRight = Math.round(standPlat.x + standPlat.w - camX);
    if (x + w > maxRight) x = maxRight - w;
    if (x < minLeft) x = minLeft;
  }
  const y = Math.round(p.y - camY - h);

  ctx.save();
  if (lean > 0) {
    // Наклон вперёд у финального края (задача 6, вместо полоски заряда):
    // поворот вокруг точки у ног, угол 0 → 32° по lean. Отдельного кадра
    // нет (ASSETS.md). lean уже несёт кривую holdProgress и выпрямление.
    ctx.translate(x + w / 2, y + h);
    ctx.rotate(lean * 0.559); // 32° в радианах
    ctx.translate(-(x + w / 2), -(y + h));
  }
  ctx.drawImage(img, x, y, w, h);
  ctx.restore();
}

function drawDog(ctx, images, d, camX, camY, dogPlat) {
  let frames = images.dogWalkFrames;
  let idx = Math.floor(d.frameT * 6) % frames.length;
  if (d.pose === 'sit') { frames = images.dogSitFrames; idx = Math.floor(d.frameT * 2) % frames.length; }
  else if (d.pose === 'lookdown') { frames = [images.dogLookDown]; idx = 0; }
  else if (d.pose === 'jump') { frames = [images.dogJump]; idx = 0; }

  const img = frames[idx];
  // Фиксированный ×2 (BUILD-SPEC-03 задача 2) — DOG_W/H уже удвоены.
  const w = DOG_W;
  const h = DOG_H;
  let x = Math.round(d.x - camX - w / 2);
  // Пёс не свисает за край плиты (правка 2026-08-28). Во время прыжка
  // (pose 'jump', над щелью) — можно, там смысл в том, что он в воздухе.
  if (dogPlat && d.pose !== 'jump') {
    const minLeft = Math.round(dogPlat.x - camX);
    const maxRight = Math.round(dogPlat.x + dogPlat.w - camX);
    if (x + w > maxRight) x = maxRight - w;
    if (x < minLeft) x = minLeft;
  }
  const hopY = Math.round(d.hopOffset || 0);
  const y = Math.round(d.y - camY - h) + hopY;
  ctx.drawImage(img, x, y, w, h);
}

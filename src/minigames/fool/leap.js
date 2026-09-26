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
// Общее для всех мини-игр — жизненный цикл, камера, частицы, вспышка,
// подсказки — живёт в src/core/ (BUILD-SPEC-07 задача 1). Здесь только
// то, что принадлежит Шуту: ходьба, прыжок, финальный край.

import { defineMinigame } from '../../core/minigame.js';
import { createFollowCamera } from '../../core/camera.js';
import { createParticles, createFlash, clamp01 } from '../../core/juice.js';
import { PHYS, gravityFor, jumpVelocity } from './physics.js';
import {
  buildPlatforms, platformAt, drawPlatform, buildRoadStrip, START_WALK, ARRIVE_MAIN_W,
} from './platforms.js';
import { drawAbyss } from './abyss.js';
import { drawRainClouds, drawDrizzle } from './weather.js';
import {
  PLAYER_H, createDog, placeDog, scheduleDogHop, updateDog, drawPlayer, drawDog, relaxSquash,
} from './actors.js';
import {
  BRACE_DUR, ARRIVE_DUR, createFall, resetFall, startFlight, stepFlight, drawFallSequence,
} from './fallScene.js';
import { createGhostEdge } from './ghostEdge.js';
import { drawLeapHints } from './leapHints.js';

// Управление ходьбой — на выбор (правка в чате 2026-08-30): УДЕРЖАНИЕ
// пальца ведёт непрерывно, а короткий ТАП делает один «шаг» — авто-ходьба
// на TAP_STEP секунд. Оба пишут movedEver.
const TAP_STEP = 0.34;

const HOLD_T1 = 1.6; // первые 75% полоски
const HOLD_T2 = 1.0; // последние 25% — заметно медленнее (BUILD-SPEC)
const HOLD_TOTAL = HOLD_T1 + HOLD_T2; // «~2,6 сек»

const ARRIVE_W = ARRIVE_MAIN_W; // плита прибытия (правка 2026-08-30: «поменьше»)

// Насколько можно провалиться ниже плиты, с которой прыгнул, прежде чем
// это считается промахом и включается респавн — заметно больше любой
// реальной дуги прыжка (макс. дельта дороги −128), чтобы не сработать
// ложно на обычном спуске.
const RESPAWN_DROP = 260;

// Камера: портрет, фигура держится ниже середины кадра (0.45, не 0.33 —
// BUILD-SPEC-02, задача 5: было слишком высоко, нижние ~55% кадра
// пустовали); по x с лёгким упреждением вправо (BUILD-SPEC: «камера портрет»).
const CAMERA = { leadX: 0.38, leadY: 0.45, rate: 6 };

function holdProgress(elapsed) {
  if (elapsed <= HOLD_T1) return (elapsed / HOLD_T1) * 0.75;
  return 0.75 + clamp01((elapsed - HOLD_T1) / HOLD_T2) * 0.25;
}

export function createLeapScreen({ input, images, goto }) {
  let platforms = [];
  let idx = 0; // индекс текущей/последней плиты под ногами
  let state = 'walk'; // walk | air | wait_leap | charge | brace | fall | arrive
  let t = 0;
  let stateT = 0;
  let deepestY = 0;
  let walking = false;  // палец удерживается — Шут идёт вперёд (ручное управление)
  let pointerDown = false; // сырое состояние пальца на экране, отдельно от walking (BUILD-SPEC-04 задача 2)
  let walkImpulse = 0;  // остаток авто-ходьбы после тапа, сек (TAP_STEP)
  let movedEver = false; // хоть раз пошёл — стартовая подсказка больше не нужна
  let lean = 0; // наклон Шута у финального края, 0..1 (задача 6, вместо полоски HOLD)
  // Плита прибытия — офскрин-полоса под пиксельное проявление (задача 7).
  let groundStrip = null;
  // Для распознавания «флика вверх на ходу» (input даёт hold-события без
  // скорости) — держим предыдущую точку hold-жеста.
  let holdPrevY = 0, holdPrevMs = 0;

  const cam = createFollowCamera(CAMERA);
  const dust = createParticles();
  const respawnFlash = createFlash(0.22);
  const player = { x: 0, y: 0, vx: 0, vy: 0, face: 1, sqx: 1, sqy: 1, pose: 'idle' };
  const dog = createDog();
  // Падение — три такта (задача 7): 'brace' → 'fall' (мир едет вверх) → 'arrive'.
  const fall = createFall();
  const ghost = createGhostEdge(images);

  function land(p) {
    player.y = p.y;
    player.vx = 0;
    player.vy = 0;
    player.sqx = 1.22;
    player.sqy = 0.8;
    idx = platforms.indexOf(p);
    state = 'walk';
    stateT = 0;
    // Палец не отпускали — идём дальше сами (BUILD-SPEC-04 задача 2). Риск
    // унестись за следующий край осознан: падение штатно (решение 2026-08-30).
    walking = pointerDown;
    walkImpulse = 0;
    dust.burst(player.x, player.y, 5);
  }

  /** Упал с плиты (сошёл с края или не дотянул прыжок). Возвращаем на
   * НАЧАЛО той же плиты (левый край) — пройденный по ней отрезок теряется,
   * но не вся игра, экрана проигрыша нет (правка в чате 2026-08-28). */
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
    // Палец на экране — идём сразу, без нового касания (BUILD-SPEC-04
    // задача 2): респавн в начале плиты, до кромки далеко, среагировать успеешь.
    walking = pointerDown;
    walkImpulse = 0;
    respawnFlash.trigger();
    deepestY = player.y; // иначе «пустота» снизу кадра остаётся раздутой после падения
    // Камеру подводим сразу, без плавного «полёта» обратно — по эталонному
    // портрету 430×932, как было всегда.
    cam.snap(player.x, player.y, 430, 932);
    placeDog(dog, player);
    dust.burst(player.x, player.y, 6);
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
    walkImpulse = 0;
    dust.burst(player.x, player.y, 4);
    scheduleDogHop(dog);
  }

  function commitLeap() {
    // Такт 1 (задача 7): срыв — стоп-кадр. Дальше 'fall' (мир едет вверх),
    // потом 'arrive' (плита проступает пикселями, на неё же садятся Шут и
    // пёс). lean держим на 1 — Шут застыл заваленным вперёд на весь такт 1.
    state = 'brace';
    stateT = 0;
    lean = 1;
    player.vx = 0;
    player.vy = 0;
    // Откуда пара въезжает в центр кадра в такте 2 — экранная позиция Шута
    // прямо сейчас (у кромки).
    resetFall(fall, player.x - cam.x, player.y - cam.y - PLAYER_H / 2);
  }

  return defineMinigame({ input, goto }, {
    enter() {
      t = 0;
      stateT = 0;
      idx = 0;
      state = 'walk';
      deepestY = 0;
      walking = false;
      pointerDown = false;
      walkImpulse = 0;
      movedEver = false;
      respawnFlash.reset();
      lean = 0;
      resetFall(fall);
      holdPrevY = 0;
      holdPrevMs = 0;
      dust.clear();
      ghost.reset();
      if (!groundStrip) groundStrip = buildRoadStrip(images, ARRIVE_W);

      platforms = buildPlatforms(0);
      const p0 = platforms[0];
      // P1 продолжается на 224px левее старого края, за кадр (BUILD-SPEC-02,
      // задача 5) — старт отсчитываем от ПРАВОГО края на исходную дистанцию
      // ходьбы (START_WALK), чтобы левый край плиты не был виден.
      player.x = p0.x + p0.w - START_WALK;
      player.y = p0.y;
      player.vx = 0;
      player.vy = 0;
      player.face = 1;
      player.pose = 'idle';
      placeDog(dog, player);
      dog.frameT = 0;
      dog.hopT = -1;
      dog.hopDelay = 0;
      cam.reset();
    },

    input: {
      // Держишь палец — Шут идёт непрерывно. press* — сырой сигнал «палец
      // сейчас здесь», без задержки в 250мс (в отличие от hold*).
      pressstart(e) {
        pointerDown = true;
        if (state === 'walk') walking = true;
        holdPrevY = e.y;
        holdPrevMs = 0;
      },
      pressend() { pointerDown = false; walking = false; },
      // Короткий тап — один «шаг» (авто-ходьба на TAP_STEP). Выбор игрока:
      // тап ИЛИ удержание (правка в чате 2026-08-30).
      tap() {
        if (state !== 'walk') return;
        walkImpulse = TAP_STEP;
        movedEver = true;
      },
      // Быстрый свайп (палец на плите < 250мс) — прыжок. Слабый свайп =
      // слабый прыжок, щель можно не дотянуть (правка 2026-08-28).
      swipe(e) {
        if (state !== 'walk') return;
        walking = false;
        beginJump(e.up, Math.min(1, Math.abs(e.side)));
      },
      holdstart() {
        if (state !== 'wait_leap') return;
        walking = false;
        state = 'charge';
        stateT = 0;
        lean = 0; // кольцо/наклон начинают с нуля, не с недовыпрямленного значения
      },
      // Шёл (держал > 250мс) и на ходу дёрнул вверх — это прыжок, а не дрейф
      // пальца: input классифицирует такой жест как hold, не swipe, поэтому
      // ловим по СКОРОСТИ вверх между двумя hold-событиями, а не по
      // накопленному смещению (иначе сработает от медленного увода).
      holdmove(e) {
        const dtMs = e.duration - holdPrevMs;
        const prevY = holdPrevY;
        holdPrevY = e.y;
        holdPrevMs = e.duration;
        if (state !== 'walk' || !walking || dtMs < 8) return;
        const vUp = (prevY - e.y) / dtMs; // px/мс, >0 = вверх
        if (vUp > 0.35) {
          walking = false;
          // Флик с уже лежащего пальца — тот же жест, что свежий свайп.
          // Горизонталь у вертикального дёрга ≈ 0, поэтому порог снизу 0.35
          // — читается как прыжок с разбега (BUILD-SPEC-04 задача 1).
          const sidePow = Math.max(0.35, Math.min(1, Math.abs(e.dx) / 140));
          beginJump(Math.max(0.2, Math.min(1.3, vUp * 1.0)), sidePow);
        }
      },
      holdend() {
        if (state !== 'charge') return;
        if (stateT >= HOLD_TOTAL) commitLeap();
        else { state = 'wait_leap'; stateT = 0; } // отпустил раньше — просто ждём снова
      },
    },

    update(dt, w = 430, h = 932, finish) {
      t += dt;
      stateT += dt;
      dust.update(dt);
      respawnFlash.update(dt);
      cam.follow(player.x, player.y, w, h, dt);

      const last = platforms[platforms.length - 1];

      if (state === 'walk') {
        // Ручное управление: идёт, пока держат палец ИЛИ пока не истёк
        // импульс от тапа.
        if (walking || walkImpulse > 0) { player.x += PHYS.walk * dt; movedEver = true; }
        if (walkImpulse > 0) walkImpulse = Math.max(0, walkImpulse - dt);
        relaxSquash(player, dt, 10);
        const p = platforms[idx];
        const edgeX = p.x + p.w;
        if (p === last) {
          // У последнего края мир кончается — шаг заменяет удержание
          // (BUILD-SPEC). Просто упираемся в кромку.
          if (player.x >= edgeX - 2) {
            player.x = edgeX - 2;
            walkImpulse = 0;
            if (state === 'walk') { state = 'wait_leap'; stateT = 0; }
          }
        } else if (player.x > edgeX) {
          // Сошёл с края обычной плиты — падаешь. Если впереди есть куда
          // приземлиться в пределах дуги — долетишь; нет — respawnAtStart.
          player.vx = (walking || walkImpulse > 0) ? PHYS.walk : 0;
          player.vy = 0;
          walkImpulse = 0;
          state = 'air';
          stateT = 0;
          scheduleDogHop(dog);
        }
      } else if (state === 'air') {
        // Растяжение с толчка отпускаем к 1 всю дугу полёта (правка в чате,
        // 2026-08-26: вместе с позами rise/fall читалось как «сжато»).
        relaxSquash(player, dt, 8);
        const prevY = player.y;
        player.vy += gravityFor(player.vy) * dt;
        player.x += player.vx * dt;
        player.y += player.vy * dt;
        deepestY = Math.max(deepestY, player.y);
        // Пересечение уровня плиты за кадр, не узкое окно — иначе на большой
        // скорости нога проскакивает сквозь плиту (баг, пойман вживую).
        if (player.vy > 0) {
          const p = platformAt(platforms, player.x, prevY - 2, player.y + 2);
          if (p) land(p);
        }
        // Упал мимо всех плит — возврат на начало текущей плиты, без
        // проигрыша (правка в чате 2026-08-28).
        if (state === 'air' && player.y - platforms[idx].y > RESPAWN_DROP) {
          respawnAtStart();
        }
      } else if (state === 'wait_leap') {
        relaxSquash(player, dt, 8);
        lean = Math.max(0, lean - dt / 0.4); // отпустил до срыва — выпрямляется за 0.4 с
      } else if (state === 'charge') {
        // Наклон вперёд, не «зарядка» (задача 6): пока держишь — угол растёт
        // 0→1 по holdProgress. На 100% — точка невозврата.
        lean = holdProgress(stateT);
        if (stateT >= HOLD_TOTAL) commitLeap();
      } else if (state === 'brace') {
        // Такт 1 — срыв: полный стоп-кадр, ничего не двигается.
        if (stateT >= BRACE_DUR) { state = 'fall'; stateT = 0; startFlight(fall); }
      } else if (state === 'fall') {
        if (stepFlight(fall, stateT, dt, w, h, cam, dust)) { state = 'arrive'; stateT = 0; }
      } else if (state === 'arrive') {
        // Такт 3 — прибытие: земля проступает пикселями, потом предсказание.
        if (stateT >= ARRIVE_DUR && !fall.arriveDust) {
          fall.arriveDust = true;
          dust.burst(player.x, player.y, 14);
        }
        if (stateT >= ARRIVE_DUR + 0.15) finish();
      }

      updateDog(dog, dt, { player, platforms, idx, state, walking });
      const toFinalEdge = idx === platforms.length - 1 ? (last.x + last.w - player.x) : Infinity;
      ghost.step(dt, last, toFinalEdge, dust);
    },

    draw(ctx, w, h) {
      ctx.fillStyle = '#111111';
      ctx.fillRect(0, 0, w, h);

      // Такты 2–3 падения — свой мир, обычную сцену не рисуем. Такт 1
      // ('brace') — стоп-кадр обычной сцены, идёт по общему пути.
      if (state === 'fall' || state === 'arrive') {
        drawFallSequence(ctx, w, h, {
          state, stateT, t, images, groundStrip,
          fallScroll: fall.scroll, fallFromX: fall.fromX, fallFromY: fall.fromY,
          camX: cam.x, camY: cam.y, player, dust: dust.list,
        });
        return;
      }

      const camX = cam.x, camY = cam.y;
      const last = platforms[platforms.length - 1];
      // Дождевые облака наверху + пропасть с облачками внизу (правка 2026-09-10).
      drawRainClouds(ctx, w, h, camX, t);
      drawAbyss(ctx, w, h, t);
      platforms.forEach((p) => drawPlatform(ctx, images, p, camX, camY));
      ghost.draw(ctx, last, camX, camY);

      // Наклон идёт РЕЗЧЕ К КОНЦУ, чем растёт кольцо (правка в чате
      // 2026-08-29: «не в унисон»): lean² — Шут сперва «сопротивляется».
      const leanV = lean * lean;

      // Обычное падение мимо всех плит — низ кадра затягивает чернотой, пока
      // не сработает респавн. Порог высокий: только НАСТОЯЩИЙ провал, иначе
      // чернота мигала на дуге обычного прыжка (правка в чате 2026-08-30).
      const fellBelow = deepestY - (platforms[idx] ? platforms[idx].y : 0);
      const voidStart = RESPAWN_DROP * 0.6;
      if (state === 'air' && player.vy > 0 && fellBelow > voidStart) {
        const k = clamp01((fellBelow - voidStart) / (RESPAWN_DROP - voidStart));
        const voidH = Math.round(h * (0.08 + k * 0.5));
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, h - voidH, w, voidH);
      }

      dust.draw(ctx, camX, camY);

      // Пёс поверх Шута (правка в чате 2026-08-27). Плиты под ногами — для
      // клэмпа спрайтов по краям; пёс у края может стоять на соседней плите.
      const standPlat = platforms[idx] || null;
      const dogPlat = platformAt(platforms, dog.x, -Infinity, Infinity) || standPlat;
      drawPlayer(ctx, images, player, camX, camY, state, t, standPlat, leanV,
        standPlat === platforms[platforms.length - 1]);
      drawDog(ctx, images, dog, camX, camY, dogPlat);

      // Морось — всю дорогу до финального прыжка (правка в чате 2026-09-10).
      if (state === 'walk' || state === 'air' || state === 'wait_leap' || state === 'charge') {
        drawDrizzle(ctx, w, h, t, camX);
      }

      drawLeapHints(ctx, w, camX, camY, { state, stateT, t, movedEver, idx, lean, player });
      respawnFlash.draw(ctx, w, h);
    },
  });
}

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

import { setFont } from '../../core/text.js';
import { PHYS, gravityFor, jumpVelocity } from './physics.js';
import {
  buildPlatforms, platformAt, drawPlatform, drawGhostRoad, drawFarRoad, START_WALK,
} from './platforms.js';

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

const FALL_G = 900;
const FALL_VMAX = 760;
const FALL_DEPTH = 900; // экранных px падения до касания земли

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
  let state = 'walk'; // walk | air | wait_leap | charge | fall | landed
  let t = 0;
  let stateT = 0;
  let deepestY = 0;
  let camX = 0, camY = 0;
  let hintAlpha = 1;
  let walking = false;  // палец удерживается — Шут идёт вперёд (ручное управление)
  let movedEver = false; // хоть раз пошёл — гасим подсказку «HOLD TO WALK»
  let respawnFlash = 0; // короткая вспышка чёрным после падения, сек
  // Для распознавания «флика вверх на ходу» (input даёт hold-события без
  // скорости) — держим предыдущую точку hold-жеста.
  let holdPrevY = 0, holdPrevMs = 0;

  const player = { x: 0, y: 0, vx: 0, vy: 0, face: 1, sqx: 1, sqy: 1, pose: 'idle' };
  // hopDelay > 0 — отсчитывает задержку реакции; hopT >= 0 — идёт сама
  // дуга прыжка (см. DOG_HOP_*); hopT === -1 — пёс не прыгает.
  const dog = {
    x: 0, y: 0, state: 'follow', pose: 'walk', frameT: 0, hopDelay: 0, hopT: -1,
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
    hintAlpha = 1;
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
    hintAlpha = 0;
    spawnDust(player.x, player.y, 4);
    scheduleDogHop();
  }

  function commitLeap() {
    state = 'fall';
    stateT = 0;
    player.vx = 60;
    player.vy = -120;
    // Пёс больше не летит отдельным объектом — падение теперь один
    // парный спрайт (fool_dog_fall, BUILD-SPEC-03 задача 3), не два
    // накладывающихся друг на друга (был баг: «пёс оказался у него на
    // голове»). Состояние 'leap' и физика пса ниже были нужны только
    // для отдельной отрисовки — убраны вместе с ней.
  }

  return {
    enter() {
      t = 0;
      stateT = 0;
      idx = 0;
      state = 'walk';
      deepestY = 0;
      hintAlpha = 1;
      walking = false;
      movedEver = false;
      respawnFlash = 0;
      holdPrevY = 0;
      holdPrevMs = 0;
      dust.length = 0;

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
          holdPrevY = e.y;
          holdPrevMs = 0;
        }),
        input.on('pressend', () => { walking = false; }),
        input.on('swipe', (e) => {
          // Быстрый свайп (палец на плите < 250мс) — прыжок. Слабый свайп
          // = слабый прыжок, щель можно не дотянуть (правка 2026-08-28).
          if (state !== 'walk') return;
          walking = false;
          beginJump(e.up, Math.min(1, Math.abs(e.side)));
        }),
        input.on('holdstart', () => {
          if (state !== 'wait_leap') return;
          walking = false;
          state = 'charge';
          stateT = 0;
        }),
        input.on('holdmove', (e) => {
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
      } else if (state === 'charge') {
        // полоска считается в draw() из stateT — тут только поза/пёс.
      } else if (state === 'fall') {
        player.vy = Math.min(FALL_VMAX, player.vy + FALL_G * dt);
        player.x += player.vx * dt;
        player.y += player.vy * dt;
        deepestY = Math.max(deepestY, player.y);
        if (player.y - last.y >= FALL_DEPTH) {
          state = 'landed';
          stateT = 0;
          spawnDust(player.x, player.y, 14);
        }
      } else if (state === 'landed') {
        // ждём короткий такт, потом уходим на предсказание.
        if (stateT >= 1.1) goto('prediction');
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
        // Пёс выходит вперёд Шута, но НЕ за край: садится у самой кромки
        // финальной плиты и оглядывается (BUILD-SPEC: «обгоняет, садится,
        // оглядывается»). Раньше цель была player.x + 30 — а игрок уже
        // приклеен к краю, так что пёс повисал над пропастью на 30px
        // (правка в чате 2026-08-28). dog.x — центр (см. drawDog), поэтому
        // держим центр не дальше кромки минус полуширина и небольшой зазор.
        const lastEdge = platforms[platforms.length - 1].x + platforms[platforms.length - 1].w;
        const targetX = Math.min(player.x + 30, lastEdge - DOG_W / 2 - 4);
        dog.x += (targetX - dog.x) * Math.min(1, dt * 5);
        dog.y += (player.y - dog.y) * Math.min(1, dt * 8);
        dog.frameT += dt;
        if (Math.abs(dog.x - targetX) < 2) { dog.state = 'sit'; dog.pose = 'sit'; dog.frameT = 0; }
      } else if (dog.state === 'sit') {
        dog.pose = state === 'charge' ? 'lookdown' : 'sit';
        dog.frameT += dt;
      }
    },

    draw(ctx, w, h) {
      const scale = Math.min(Math.max(w / 430, 0.75), 1.25);

      ctx.fillStyle = '#111111';
      ctx.fillRect(0, 0, w, h);

      const last = platforms[platforms.length - 1];
      // Дальний слой — за настоящими плитами, самым первым (BUILD-SPEC-02,
      // задача 5: «плиты читаются как отдельные бруски в пустоте», нужна
      // глубина без новых ассетов).
      drawFarRoad(ctx, w, h, camX, player.y, scale, 0);
      platforms.forEach((p) => drawPlatform(ctx, images, p, camX, camY));
      // Дорога за пропастью — видна, не интерактивна (BUILD-SPEC «решение B»).
      // Ширина кратна 32 — тайлсет кладётся целыми плитками (см. drawRoad).
      drawGhostRoad(ctx, images, last.x + last.w + 40, last.y, 160, camX, camY);

      // Пустота — чем глубже забрались, тем больше съедает низ кадра.
      const voidFrac = clamp01(deepestY / (FALL_DEPTH * 0.9));
      const voidH = Math.round(h * (0.15 + voidFrac * 0.55));
      const ramp = ['#161616', '#1C1C1C', '#212121', '#252525', '#2A2A2A', '#2E2E2E'];
      const bandH = Math.max(2, Math.round(3 * scale));
      ramp.forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.fillRect(0, h - voidH - (ramp.length - i) * bandH, w, bandH);
      });
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, h - voidH, w, voidH);

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
      drawPlayer(ctx, images, player, camX, camY, state, t, standPlat);
      if (state !== 'fall' && state !== 'landed') {
        drawDog(ctx, images, dog, camX, camY, dogPlat);
      }

      // Белая линия земли — проступает в момент касания, не раньше.
      if (state === 'landed') {
        const lineY = Math.round(player.y - camY + PLAYER_H * 0.9);
        ctx.fillStyle = '#FFFFFF';
        ctx.globalAlpha = clamp01(stateT / 0.15);
        ctx.fillRect(0, lineY, w, Math.max(2, Math.round(2 * scale)));
        ctx.globalAlpha = 1;
      }

      // Подсказка — тот же стиль, что и на других экранах. Инлайн у
      // фигуры, не HUD-баннером (BUILD-SPEC-02, задача 5). Текст временный —
      // задача 5 BUILD-SPEC-03 меняет его на жестовые знаки.
      setFont(ctx, 'menuOption', scale);
      ctx.fillStyle = '#EBA331';
      const marginTop = Math.round(48 * scale);
      if (state === 'walk') {
        ctx.textAlign = 'left';
        const headX = player.x - camX + Math.round(90 * scale);
        const headY = player.y - camY - PLAYER_H;
        const p = platforms[idx];
        const nearEdge = p !== last && (p.x + p.w - player.x) < 70;
        if (!movedEver && !walking) {
          ctx.fillText('HOLD TO WALK', headX, headY);
        } else if (nearEdge) {
          ctx.globalAlpha = hintAlpha;
          ctx.fillText('SWIPE TO JUMP', headX, headY);
          ctx.globalAlpha = 1;
        }
      } else if (state === 'wait_leap' || state === 'charge') {
        ctx.textAlign = 'center';
        ctx.fillText('HOLD', w / 2, marginTop);
      }

      if (state === 'charge') {
        const p = clamp01(holdProgress(stateT));
        const barW = Math.round(160 * scale);
        const barX = Math.round(w / 2 - barW / 2);
        const barY = marginTop + Math.round(16 * scale);
        const barH = Math.max(3, Math.round(4 * scale));
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX + 0.5, barY + 0.5, barW, barH);
        ctx.fillStyle = '#EBA331';
        ctx.fillRect(barX, barY, Math.round(barW * p), barH);
      }

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

// Обычный прыжок (state 'air', короткая щель между плитами) теперь
// читается по фазе дуги — вверх и вниз разными позами, не одной статичной
// (правка в чате, 2026-08-26, после разбора ассетов): 'rise', пока
// vy < 0 (ещё поднимается), 'fall' — как только пошёл вниз. Финальный
// прыжок через пропасть (state 'fall'/'landed') — отдельный парный спрайт
// с псом (fool_dog_fall), тот же, что покрывает и такт приземления, пока
// задача 4 не переделает его на три такта отдельно.
function drawPlayer(ctx, images, p, camX, camY, state, t, standPlat) {
  let pose;
  let img;
  if (state === 'fall' || state === 'landed') {
    pose = 'fallPair';
    img = images.foolDogFall;
  } else if (state === 'air') {
    pose = p.vy < 0 ? 'rise' : 'fall';
    img = pose === 'rise' ? images.foolRise : images.foolFall;
  } else {
    pose = 'idle';
    const frames = images.foolIdleFrames;
    img = frames[Math.floor(t * IDLE_FPS) % frames.length];
  }
  // Парный спрайт падения шире соло-поз — своя ширина холста, не PLAYER_W.
  const baseW = pose === 'fallPair' ? PAIR_W : PLAYER_W;
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
  // В воздухе (air/fall/landed) не клэмпим — там за пределами плиты
  // находиться и есть смысл состояния. На земле — держим спрайт целиком
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
  if (state === 'wait_leap' || state === 'charge') {
    // Наклон у края — процедурно, отдельного кадра нет (ASSETS.md).
    ctx.translate(x + w / 2, y + h);
    ctx.rotate(0.10);
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

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
import { blinkAlpha } from '../../core/textReveal.js';
import { drawHoldRing, drawSwipeTick } from '../../core/gestureGlyph.js';
import { drawPixelReveal } from '../../core/pixelReveal.js';
import { PHYS, gravityFor, jumpVelocity } from './physics.js';
import {
  buildPlatforms, platformAt, drawPlatform, buildRoadStrip, START_WALK, PLATE_H,
  ARRIVE_GROUND_FRAC, ARRIVE_MAIN_W, ARRIVE_SIDE_W, ARRIVE_STEP_UP, ARRIVE_STEP_DX,
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

// Управление ходьбой — на выбор (правка в чате 2026-08-30): УДЕРЖАНИЕ
// пальца ведёт непрерывно, а короткий ТАП делает один «шаг» — авто-ходьба
// на TAP_STEP секунд. Оба пишут movedEver.
const TAP_STEP = 0.34;

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
const FALL_DUR = 4.0;     // такт 2 — полёт (правка в чате 2026-08-31: 2.8 → 4, «медленнее»)
const ARRIVE_DUR = 1.4;   // такт 3 — проявление земли (мягче, правка 2026-08-30)

// Полёт «сквозь миры» (правка в чате 2026-08-31): фон — Bayer-дизер двумя
// тонами ЧБ, ступенчато сменяется по фазе (проходишь один мир за другим).
// Плюс пролетающие пласты, звёзды, луна, молнии, искры — «приколы».
const FALL_BAYER = [
  [0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5],
];
// Пары тонов миров, через которые падаешь: тьма → светлеет к середине →
// снова к тьме под прибытие. Все — из таблицы палитры.
const FALL_WORLDS = [
  ['#000000', '#161616'],
  ['#161616', '#252525'],
  ['#1C1C1C', '#4A4A4A'],
  ['#2E2E2E', '#808080'],
  ['#1C1C1C', '#2E2E2E'],
  ['#000000', '#161616'],
];
// Пролетающие пласты других миров — дизер-полосы на разной глубине.
const FALL_SLABS = [
  { pal: ['#1C1C1C', '#4A4A4A'], bandH: 96, mult: 0.55, period: 440 },
  { pal: ['#252525', '#808080'], bandH: 64, mult: 0.85, period: 560 },
  { pal: ['#2E2E2E', '#B8B8B8'], bandH: 40, mult: 1.2,  period: 680 },
];
// Звёздное поле — стабильный псевдослучай, слабый параллакс, мерцание.
const FALL_STARS = [];
for (let i = 0; i < 26; i++) {
  const r = (i * 2654435761 + 0x1234) >>> 0;
  FALL_STARS.push({
    x: (r % 1024) / 1024,
    y: ((r >>> 10) % 1024) / 1024,
    tw: ((r >>> 20) % 628) / 100,
    big: ((r >>> 6) & 7) === 0,
  });
}

// Скорость «прокрутки мира» в полёте идёт по дуге sin(prog·π): мягкий
// разгон от V0, пик VPEAK в середине, плавное оседание к земле — полёт,
// а не обрыв (правка 2026-08-29: «падение обрывистое, хочется красивого
// полёта»).
const FALL_V0 = 100;      // экранных px/с в начале и в конце
const FALL_VPEAK = 820;   // на пике в середине
const GHOST_W = 160;      // призрачная плита за краем (кратно 32), задача 5
const ARRIVE_W = ARRIVE_MAIN_W; // плита прибытия — 256 (правка 2026-08-30: «поменьше»)

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
  let pointerDown = false; // сырое состояние пальца на экране, отдельно от walking (BUILD-SPEC-04 задача 2)
  let walkImpulse = 0;  // остаток авто-ходьбы после тапа, сек (TAP_STEP)
  let movedEver = false; // хоть раз пошёл — стартовая подсказка больше не нужна
  let respawnFlash = 0; // короткая вспышка чёрным после падения, сек
  // Жестовые знаки (задача 8): появляются после паузы бездействия рядом с
  // фигурой. Знак свайпа больше не снимается навсегда (BUILD-SPEC-04
  // задача 3) — условие само себя ограничивает: он виден только когда
  // игрок стоит у кромки дольше 0.5 с, при непрерывном удержании — не виден.
  let idleT = 0;            // сек без ввода в состоянии, ждущем жеста
  // Финальный край (задача 5): призрачная дорога проявлена (1) → осыпалась
  // (0); кромка последней плиты разгорается акцентом (0 → 1).
  let ghostReveal = 1;
  let ghostCrumbled = false; // осколки уже сыпанули — один раз
  let lean = 0; // наклон Шута у финального края, 0..1 (задача 6, вместо полоски HOLD)
  // Падение — три такта (задача 7): 'brace' → 'fall' (мир едет вверх) → 'arrive'.
  let fallScroll = 0, fallSpeed = 0, debrisT = 0, sparkT = 0, arriveDust = false;
  // Экранная позиция Шута в момент срыва — пара въезжает в центр кадра из
  // неё, без скачка (правка в чате 2026-08-30: «камера не движется за
  // персонажем, появление резкое»).
  let fallFromX = 0, fallFromY = 0;
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
    stillT: 0, // сколько пёс стоит на месте — за порогом садится и виляет хвостом
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
      d.vy += (d.g ?? 220) * dt; // мошки в полёте почти не тянет вниз (d.g маленькое)
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
    // Палец не отпускали — идём дальше сами (BUILD-SPEC-04 задача 2). Риск
    // унестись за следующий край осознан: падение штатно (решение 2026-08-30).
    walking = pointerDown;
    walkImpulse = 0;
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
    // Палец на экране — идём сразу, без нового касания (BUILD-SPEC-04
    // задача 2): респавн в начале плиты, до кромки далеко, среагировать
    // успеешь; заодно чинится молчаливый ступор.
    walking = pointerDown;
    walkImpulse = 0;
    idleT = 0;
    respawnFlash = 0.22;
    deepestY = player.y; // иначе «пустота» снизу кадра остаётся раздутой после падения
    // Камеру подводим сразу, без плавного «полёта» обратно.
    camX = player.x - 430 * 0.38;
    camY = player.y - 932 * 0.45;
    dog.x = player.x - DOG_LAG;
    dog.y = player.y;
    dog.state = 'follow';
    dog.pose = 'walk';
    dog.stillT = 0;
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
    walkImpulse = 0;
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
    sparkT = 0;
    arriveDust = false;
    // Откуда пара въезжает в центр кадра в такте 2 — экранная позиция
    // Шута прямо сейчас (у кромки).
    fallFromX = player.x - camX;
    fallFromY = player.y - camY - PLAYER_H / 2;
  }

  /** Три такта финального падения (задача 7): 'brace' (стоп-кадр) → 'fall'
   * (полёт) → 'arrive' (проявление земли). Фон уже залит #111111.
   *
   * Переделано в чате 2026-08-31: полёт 4 с, «сквозь миры» — фон-дизер
   * двумя тонами ЧБ ступенчато сменяется по фазе, поверх летят пласты
   * других миров, звёзды, луна-серп, молнии в двух окнах, искры на стыках.
   * Пара Шут+пёс видна ВСЁ время — без затемнения и повторного проявления,
   * — и плавно опускается на плиту, которая проступает под ней. */
  function drawFallSequence(ctx, w, h) {
    // Линия прибытия и точка, где встаёт пара — общие для 'fall' и
    // 'arrive', чтобы снижение шло без скачка.
    const groundY = Math.round(h * ARRIVE_GROUND_FRAC);
    const gw = groundStrip.width;                 // ARRIVE_MAIN_W (256)
    const groundX = Math.round(w / 2 - gw / 2 - 28);
    const standCX = groundX + Math.round(gw * 0.44); // центр Шута на плите
    const floatY = Math.round(h * 0.44);            // высота парения в полёте

    // Обломки, пылинки и искры навстречу. Искры (d.spark) — ярко-белые.
    const drawDebris = () => {
      dust.forEach((d) => {
        if (d.spark) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(Math.round((d.x - camX) / 2) * 2, Math.round((d.y - camY) / 2) * 2, 2, 2);
          return;
        }
        ctx.fillStyle = (1 - d.t / d.life) > 0.5 ? '#808080' : '#4A4A4A';
        const s = Math.max(4, d.s);
        ctx.fillRect(Math.round((d.x - camX) / 4) * 4, Math.round((d.y - camY) / 4) * 4, s, s);
      });
    };

    if (state === 'fall') {
      const prog = clamp01(stateT / FALL_DUR);

      // Фон — мир, через который падаешь (дизер двумя тонами ЧБ, сменяется
      // по фазе); поверх — звёзды, луна, пролетающие пласты других миров.
      drawFallWorld(ctx, w, h, prog, fallScroll);
      drawFallStars(ctx, w, h, fallScroll, t);
      drawFallMoon(ctx, w, h, prog, fallScroll);
      drawFallSlabs(ctx, w, h, fallScroll);

      // Плита, с которой шагнул — уходит вверх и растворяется.
      const enterRaw = clamp01(stateT / 0.45);
      const enter = enterRaw * enterRaw * (3 - 2 * enterRaw); // smoothstep
      const originA = clamp01(1 - fallScroll / 240);
      const originY = floatY + PLAYER_H / 2 - fallScroll * 0.9;
      if (originA > 0 && originY > -PLATE_H) {
        ctx.globalAlpha = originA;
        drawPlatform(ctx, images, { x: Math.round(w / 2 - 112), y: 0, w: 224 }, 0, -Math.round(originY));
        ctx.globalAlpha = 1;
      }

      drawDebris();
      drawFallBolts(ctx, w, h, prog, t);

      // Пара: въезжает из точки срыва к центру за ~0.45 с, парит, а в
      // последней трети полёта плавно опускается к линии прибытия — без
      // затемнения. dv 0→1 — доля снижения.
      const descRaw = clamp01((prog - 0.6) / 0.4);
      const dv = descRaw * descRaw * (3 - 2 * descRaw);
      const px = fallFromX + (w / 2 - fallFromX) * enter + (standCX - w / 2) * dv;
      const py = fallFromY + (floatY - fallFromY) * enter + (groundY - PLAYER_H / 2 - floatY) * dv;
      const wob = 1 - dv; // у земли качание и крен гаснут

      // Плита прибытия проступает ПОД парой, пока та подлетает (до 0.8 —
      // такт 'arrive' дотянет до 1).
      if (dv > 0) {
        drawPixelReveal(ctx, groundStrip, groundX, groundY, gw, PLATE_H, dv * 0.8, 4, 0.42, 0.4);
      }

      const pw = PAIR_W;
      const cx = px + Math.sin(t * 1.7) * 6 * enter * wob;
      const cy = py + Math.sin(t * 1.3) * 4 * enter * wob;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((0.5 * (1 - enter) + Math.sin(t * 1.05) * 0.16 * enter) * wob);
      ctx.drawImage(images.foolDogFall, Math.round(-pw / 2), Math.round(-PLAYER_H / 2), pw, PLAYER_H);
      ctx.restore();
      return;
    }

    // arrive — земля дотягивает проявление, пара доседает и встаёт. Без
    // чёрного кадра и повторного «появления»: пара всё время на экране
    // (правка в чате 2026-08-31). Верх кадра чистый под слова предсказания.
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);
    const p = clamp01(stateT / ARRIVE_DUR);

    // Основная плита — с 0.8 (осталось от полёта) до 1 за первые ~0.4 такта.
    const mainP = clamp01(0.8 + 0.2 * (p / 0.4));
    drawPixelReveal(ctx, groundStrip, groundX, groundY, gw, PLATE_H, mainP, 4, 0.42, 0.4);

    // Следующая плита — НАД парой, ступенькой вправо-вверх, проступает позже.
    const upP = clamp01((p - 0.3) / 0.6);
    if (upP > 0) {
      drawPixelReveal(ctx, ghostStrip, groundX + gw - ARRIVE_STEP_DX, groundY - ARRIVE_STEP_UP,
        ghostStrip.width, PLATE_H, upP, 4, 0.2, 1);
    }

    // Пара: первые ~0.3 такта ещё во «влётном» спрайте у самой земли, потом
    // встаёт — Шут дышит, пёс садится, с коротким доседанием.
    const set = clamp01(p / 0.3);
    if (set < 1) {
      const pw = PAIR_W;
      ctx.drawImage(images.foolDogFall, Math.round(standCX - pw / 2), Math.round(groundY - PLAYER_H), pw, PLAYER_H);
    } else {
      const settle = Math.round((1 - clamp01((p - 0.3) / 0.3)) * 6);
      const dogImg = images.dogSitFrames[Math.floor(t * 4) % images.dogSitFrames.length];
      ctx.drawImage(dogImg, standCX - PLAYER_W / 2 - DOG_W - 2, groundY - DOG_H - settle, DOG_W, DOG_H);
      const fr = images.foolIdleFrames;
      ctx.drawImage(fr[Math.floor(t * IDLE_FPS) % fr.length], standCX - PLAYER_W / 2, groundY - PLAYER_H - settle, PLAYER_W, PLAYER_H);
    }

    if (p >= 1) {
      dust.forEach((d) => {
        ctx.fillStyle = (1 - d.t / d.life) > 0.5 ? '#808080' : '#4A4A4A';
        ctx.fillRect(Math.round(standCX + (d.x - player.x)), Math.round(groundY - (player.y - d.y)), d.s, d.s);
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
      pointerDown = false;
      walkImpulse = 0;
      movedEver = false;
      idleT = 0;
      respawnFlash = 0;
      ghostReveal = 1;
      ghostCrumbled = false;
      lean = 0;
      fallScroll = 0;
      fallSpeed = 0;
      debrisT = 0;
      sparkT = 0;
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
      dog.stillT = 0;
      dog.hopT = -1;
      dog.hopDelay = 0;
      camX = 0;
      camY = 0;

      offHandlers = [
        // Держишь палец — Шут идёт непрерывно. press* — сырой сигнал «палец
        // сейчас здесь», без задержки в 250мс (в отличие от hold*), нужен
        // отзывчивый старт ходьбы.
        input.on('pressstart', (e) => {
          pointerDown = true;
          if (state === 'walk') walking = true;
          idleT = 0;
          holdPrevY = e.y;
          holdPrevMs = 0;
        }),
        input.on('pressend', () => { pointerDown = false; walking = false; idleT = 0; }),
        // Короткий тап — один «шаг» (авто-ходьба на TAP_STEP). Выбор
        // игрока: тап ИЛИ удержание (правка в чате 2026-08-30).
        input.on('tap', () => {
          if (state !== 'walk') return;
          walkImpulse = TAP_STEP;
          movedEver = true;
          idleT = 0;
        }),
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
          if (vUp > 0.35) {
            walking = false;
            // Флик с уже лежащего пальца — тот же жест, что свежий свайп:
            // сила нормируется как множитель 1.0 (был 0.6 — прыжок выходил
            // слабее). Горизонталь у вертикального дёрга ≈ 0, поэтому порог
            // снизу 0.35 — читается как прыжок с разбега (BUILD-SPEC-04 задача 1).
            const sidePow = Math.max(0.35, Math.min(1, Math.abs(e.dx) / 140));
            beginJump(Math.max(0.2, Math.min(1.3, vUp * 1.0)), sidePow);
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
        // Ручное управление: идёт, пока держат палец ИЛИ пока не истёк
        // импульс от тапа.
        if (walking || walkImpulse > 0) { player.x += PHYS.walk * dt; movedEver = true; }
        if (walkImpulse > 0) walkImpulse = Math.max(0, walkImpulse - dt);
        player.sqx += (1 - player.sqx) * Math.min(1, dt * 10);
        player.sqy += (1 - player.sqy) * Math.min(1, dt * 10);
        const p = platforms[idx];
        const edgeX = p.x + p.w;
        if (p === last) {
          // У последнего края мир кончается — дальше идти некуда, шаг
          // заменяет удержание (BUILD-SPEC). Просто упираемся в кромку.
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
        // Такт 2 — полёт: мир едет вверх по дуге скорости (мягкий разгон →
        // пик в середине → плавное оседание к земле, не обрыв).
        const prog = clamp01(stateT / FALL_DUR);
        fallSpeed = FALL_V0 + (FALL_VPEAK - FALL_V0) * Math.sin(prog * Math.PI);
        fallScroll += fallSpeed * dt;
        // Навстречу — два потока: редкие обломки (быстро, вверх) и медленные
        // пылинки-мошки (долго живут, чуть парят) — от них полёт «дышит».
        debrisT -= dt;
        if (debrisT <= 0) {
          debrisT = 0.06 + Math.random() * 0.11;
          for (let i = 0, n = 1 + (Math.random() * 2 | 0); i < n; i++) {
            const mote = Math.random() < 0.5;
            dust.push({
              x: camX + Math.random() * (w || 430), y: camY + (h || 844) + 12,
              vx: (Math.random() - 0.5) * (mote ? 16 : 34),
              vy: mote ? -(45 + Math.random() * 80) : -(fallSpeed * (0.55 + Math.random() * 0.7)),
              t: 0, life: mote ? (1.1 + Math.random() * 1.3) : (0.4 + Math.random() * 0.4),
              // крупнее (правка 2026-08-30): мошки 4, обломки 4–8
              s: mote ? 4 : (Math.random() < 0.5 ? 4 : 8),
              g: mote ? 12 : 220,
            });
          }
        }
        // Искры — яркие белые крупицы навстречу, гуще на стыке миров.
        const wfNow = prog * (FALL_WORLDS.length - 1);
        const nearBoundary = Math.abs(wfNow - Math.round(wfNow)) < 0.06 && prog > 0.05 && prog < 0.95;
        sparkT -= dt;
        if (sparkT <= 0) {
          sparkT = nearBoundary ? 0.02 : 0.10 + Math.random() * 0.12;
          for (let i = 0, n = nearBoundary ? 5 : 1; i < n; i++) {
            dust.push({
              x: camX + Math.random() * (w || 430),
              y: camY + (h || 844) * (0.28 + Math.random() * 0.72),
              vx: (Math.random() - 0.5) * 150,
              vy: -(260 + Math.random() * 480),
              t: 0, life: 0.2 + Math.random() * 0.24,
              s: 2, g: 540, spark: true,
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
        // Стоит на месте (игрок не идёт, пёс догнал, не в прыжке) — через
        // 0.3 с садится и виляет хвостом (кадр dog_sit — это анимация
        // хвоста), а не топчется в цикле ходьбы (правка в чате 2026-08-30).
        const still = !walking && dog.hopT < 0 && Math.abs(dog.x - targetX) < 6;
        dog.stillT = still ? dog.stillT + dt : 0;
        dog.pose = dog.hopT >= 0 ? 'jump' : (dog.stillT > 0.3 ? 'sit' : 'walk');
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

      // Финальный край (задача 5): осыпание призрачной дороги — от
      // расстояния до правого края последней плиты.
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
          for (let i = 0; i < 14; i++) {
            const f = Math.random();
            dust.push({
              x: gx + f * GHOST_W, y: last.y + Math.random() * PLATE_H,
              vx: (Math.random() - 0.5) * 24, vy: 20 + Math.random() * 70 + f * 40,
              t: 0, life: 0.6 + Math.random() * 0.5, s: Math.random() < 0.5 ? 4 : 8,
            });
          }
        }
      }

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
      // Пиксельные облака — далёкий фон в пустом небе над дорогой (правка в
      // чате 2026-08-31: занять пустое пространство, дать ориентир масштаба).
      // За дорогой, тусклым тоном дальней детали, лёгкий параллакс.
      drawClouds(ctx, w, h, camX, camY, t);
      // Пропасть — едва заметный дизер-градиент у САМОГО низа кадра, далеко
      // под дорогой (задача 4; правка в чате 2026-08-31: отодвинута ниже,
      // «подманивание» после обрушения плиты убрано).
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
      // замыкания кольца валится.
      const leanV = lean * lean;

      // Обычное падение мимо всех плит (сошёл с края / не дотянул прыжок) —
      // низ кадра затягивает чернотой, пока не сработает respawnAtStart.
      // Порог высокий: только НАСТОЯЩИЙ провал (уже больше половины пути до
      // респавна и летим ВНИЗ), иначе чернота мигала на дуге обычного
      // прыжка и на ступенях вниз (правка в чате 2026-08-30: «чёрный экран
      // обрывистый внизу во время прыжков»).
      const fellBelow = deepestY - (platforms[idx] ? platforms[idx].y : 0);
      const voidStart = RESPAWN_DROP * 0.6;
      if (state === 'air' && player.vy > 0 && fellBelow > voidStart) {
        const k = clamp01((fellBelow - voidStart) / (RESPAWN_DROP - voidStart));
        const voidH = Math.round(h * (0.08 + k * 0.5));
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
      drawPlayer(ctx, images, player, camX, camY, state, t, standPlat, leanV,
        standPlat === platforms[platforms.length - 1]);
      // fall/arrive сюда не доходят (ранний return выше); в остальных
      // состояниях, включая стоп-кадр 'brace', пёс рисуется.
      drawDog(ctx, images, dog, camX, camY, dogPlat);

      // Подсказки (BUILD-SPEC-04 задача 3 + правки в чате 2026-08-31): каждая —
      // две строки-фразы, чуть ВЫШЕ головы, с миганием как на других экранах.
      // WALK — сразу на старте; SWIPE — сразу после первого шага и держится по
      // обычным плитам; HOLD TO JUMP — на последнем краю. Стрелка свайпа —
      // справа от нижней строки, на её уровне, с заметным зазором.
      const scale = Math.min(Math.max(w / 430, 0.75), 1.25);
      const marginX = Math.round(53 * scale);
      const headTop = Math.round(player.y - camY - PLAYER_H);
      const figX = Math.round(player.x - camX);

      // Рисует строки по центру фигуры (клэмп в поля), низ стека на
      // 34px выше макушки. Возвращает геометрию для стрелки.
      const hintStack = (words, fadeIn) => {
        const lineH = Math.round(24 * scale);
        setFont(ctx, 'menuOption', scale);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#EBA331';
        ctx.globalAlpha = clamp01(fadeIn) * blinkAlpha(t);
        const bottom = headTop - Math.round(34 * scale);
        let widest = 0;
        words.forEach((word, i) => {
          const wy = bottom - (words.length - 1 - i) * lineH;
          const halfW = ctx.measureText(word).width / 2;
          const cxw = Math.max(marginX + halfW, Math.min(figX, w - marginX - halfW));
          ctx.fillText(word, cxw, wy);
          widest = Math.max(widest, halfW * 2);
        });
        ctx.globalAlpha = 1;
        ctx.textAlign = 'left';
        return { bottom, lineH, count: words.length, widest };
      };

      if (state === 'charge' || state === 'wait_leap') {
        // Последний край: подсказка HOLD / TO JUMP — сразу как встал у кромки
        // и НЕ пропадает во время удержания (правка в чате 2026-08-31). Пока
        // держишь — справа от неё аккуратно проявляется кольцо индикатора.
        // stateT не сбрасывается вводом.
        const box = hintStack(['HOLD', 'TO JUMP'], stateT / 0.3);
        if (state === 'charge' && lean > 0.02) {
          const rx = Math.round(figX + box.widest / 2 + 30);
          const ry = Math.round(box.bottom - 4);
          drawHoldRing(ctx, rx, ry, Math.min(lean, 0.999), clamp01(lean / 0.12), 8);
        }
      } else if (state === 'walk' && !movedEver) {
        // Первая подсказка — практически сразу, без задержки в 0.3 с.
        hintStack(['TAP OR HOLD', 'TO WALK'], t / 0.2);
      } else if (state === 'walk' && movedEver && idx === 0) {
        // Знак свайпа — сразу после первого действия игрока, но ТОЛЬКО на
        // первой плите (правка в чате 2026-08-31): показали жест один раз и
        // дальше не мешаем.
        const box = hintStack(['SWIPE UP', 'TO JUMP'], 1);
        // Центр знака — на базовой линии нижней строки, не по середине стека.
        const ay = box.bottom;
        drawSwipeTick(ctx, Math.round(figX + box.widest / 2 + 28), Math.round(ay), 1, t);
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

// Обычный прыжок (state 'air', короткая щель между плитами) читается по
// фазе дуги — вверх и вниз разными позами, не одной статичной (правка в
// чате, 2026-08-26): 'rise', пока vy < 0 (ещё поднимается), 'fall' — как
// только пошёл вниз. Финальный leap через пропасть рисует не эта функция,
// а drawFallSequence (три такта, задача 7) — сюда доходит только стоп-кадр
// 'brace', и он идёт по общей ветке idle, повёрнутой на leanV.
function drawPlayer(ctx, images, p, camX, camY, state, t, standPlat, lean = 0, finalEdge = false) {
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
  // есть смысл состояния. На земле — держим спрайт целиком над плитой,
  // ни левым, ни правым краем не свисает (правка 2026-08-28). ИСКЛЮЧЕНИЕ:
  // последняя плита (finalEdge) — правый клэмп снят, Шут подходит носком
  // к самому обрыву (правка в чате 2026-08-31, отмена оранжевой кромки —
  // см. decisions-log).
  const isGrounded = state === 'walk'
    || state === 'wait_leap' || state === 'charge';
  let x = Math.round(p.x - camX - w / 2);
  if (isGrounded && standPlat) {
    const minLeft = Math.round(standPlat.x - camX);
    if (x < minLeft) x = minLeft;
    if (!finalEdge) {
      const maxRight = Math.round(standPlat.x + standPlat.w - camX);
      if (x + w > maxRight) x = maxRight - w;
    }
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

// Пиксельные облака (правка в чате 2026-08-31). Далёкий фон в небе над
// дорогой — блочные силуэты тоном «дальней детали» #4A4A4A, без сглаживания.
// Живут в world-x: параллакс ×0.26 от камеры + собственный медленный снос;
// экранный y почти не ведётся за камерой (небо стоит). Форма — 4 ряда
// блоков 8px, тапер кверху, чуть шире книзу — блочный силуэт, не овал.
// Тайлятся с шагом CLOUD_PERIOD, каждое рисуется во всех видимых копиях.
const CLOUD_CELL = 8;
const CLOUD_PERIOD = 1200; // world-px между повторами набора облаков
const CLOUDS = [
  { bx: 60,   y: 84,  rows: [3, 6, 8, 5] },
  { bx: 360,  y: 176, rows: [2, 5, 6, 4] },
  { bx: 610,  y: 52,  rows: [4, 7, 9, 6] },
  { bx: 900,  y: 212, rows: [2, 4, 5, 3] },
  { bx: 1120, y: 128, rows: [3, 6, 7, 4] },
];

function drawClouds(ctx, w, h, camX, camY, t) {
  ctx.fillStyle = '#4A4A4A';
  const skyY = camY * 0.1; // чуть ведётся за камерой, но не скачет со ступенями
  for (const c of CLOUDS) {
    const drift = c.bx - camX * 0.26 - t * 5;
    let base = ((drift % CLOUD_PERIOD) + CLOUD_PERIOD) % CLOUD_PERIOD;
    for (let sx = base - CLOUD_PERIOD; sx < w + 120; sx += CLOUD_PERIOD) {
      if (sx < -120) continue;
      c.rows.forEach((cells, r) => {
        const rowW = cells * CLOUD_CELL;
        ctx.fillRect(
          Math.round(sx - rowW / 2),
          Math.round(c.y - skyY + r * CLOUD_CELL),
          rowW, CLOUD_CELL,
        );
      });
    }
  }
}

// ── Визуал финального падения «сквозь миры» (правка в чате 2026-08-31) ──

/** Фон текущего мира — Bayer-дизер двумя тонами ЧБ. Ступенчато сменяется
 * по фазе полёта, на стыке — короткий диссолв в следующий мир + вспышка.
 * Узор ползёт вверх вместе с fallScroll. */
function drawFallWorld(ctx, w, h, prog, scroll) {
  const N = FALL_WORLDS.length;
  const wf = prog * (N - 1);
  const wi = Math.min(N - 1, Math.floor(wf));
  const frac = wf - wi;
  const cur = FALL_WORLDS[wi];
  const nxt = FALL_WORLDS[Math.min(N - 1, wi + 1)];
  const CELL = 8;
  const yoff = ((Math.round(scroll) % CELL) + CELL) % CELL;
  for (let cy = -CELL + yoff, row = 0; cy < h; cy += CELL, row++) {
    const brow = FALL_BAYER[((row % 4) + 4) % 4];
    for (let cx = 0, col = 0; cx < w; cx += CELL, col++) {
      const thr = brow[col & 3] / 16;
      let pair = cur;
      if (frac > 0.72 && thr < (frac - 0.72) / 0.28) pair = nxt; // диссолв в след. мир
      ctx.fillStyle = thr < 0.5 ? pair[0] : pair[1];
      ctx.fillRect(cx, cy, CELL, CELL);
    }
  }
  // Вспышка на стыке миров.
  const flash = frac > 0.86 ? (frac - 0.86) / 0.14
    : (frac < 0.12 && wi > 0 ? 1 - frac / 0.12 : 0);
  if (flash > 0) {
    ctx.save();
    ctx.globalAlpha = 0.2 * flash;
    ctx.fillStyle = '#B8B8B8';
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}

/** Звёзды — далёкий слой, слабый параллакс вверх, мерцание по синусу. */
function drawFallStars(ctx, w, h, scroll, t) {
  const span = h + 40;
  for (const s of FALL_STARS) {
    let y = s.y * span - (scroll * 0.14) % span;
    y = ((y % span) + span) % span - 20;
    ctx.globalAlpha = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * 3 + s.tw));
    ctx.fillStyle = s.big ? '#B8B8B8' : '#808080';
    const sz = s.big ? 4 : 2;
    ctx.fillRect(Math.round(s.x * w / 2) * 2, Math.round(y / 2) * 2, sz, sz);
  }
  ctx.globalAlpha = 1;
}

/** Луна — пиксельный серп. Проявляется к середине полёта, медленно плывёт. */
function drawFallMoon(ctx, w, h, prog, scroll) {
  const a = clamp01((prog - 0.26) / 0.16) * (1 - clamp01((prog - 0.7) / 0.2));
  if (a <= 0) return;
  const R = 16;
  const cx = Math.round((w * 0.68 - scroll * 0.05) / 2) * 2;
  const cy = Math.round(h * 0.22 / 2) * 2;
  ctx.save();
  ctx.globalAlpha = a;
  for (let dy = -R; dy <= R; dy += 2) {
    const dx = Math.floor(Math.sqrt(Math.max(0, R * R - dy * dy)) / 2) * 2;
    ctx.fillStyle = '#808080';
    ctx.fillRect(cx - dx, cy + dy, dx * 2 + 2, 2);
    ctx.fillStyle = '#2E2E2E';                       // серп-тень справа
    ctx.fillRect(cx + dx - 10, cy + dy, 12, 2);
    if (dy <= 2) {                                   // светлая кромка слева-сверху
      ctx.fillStyle = '#B8B8B8';
      ctx.fillRect(cx - dx, cy + dy, 4, 2);
    }
  }
  ctx.restore();
}

/** Пролетающие пласты других миров — дизер-полосы разной глубины, вверх,
 * зациклены. Это «текстуры красиво сменяются». */
function drawFallSlabs(ctx, w, h, scroll) {
  const CELL = 8;
  for (const L of FALL_SLABS) {
    const off = ((scroll * L.mult) % L.period + L.period) % L.period;
    for (let top = h - off; top > -L.bandH; top -= L.period) {
      for (let r = 0; r < L.bandH; r += CELL) {
        const edge = Math.min(r, L.bandH - CELL - r) / CELL; // 0 у кромки
        const dens = edge >= 2 ? 1 : edge === 1 ? 0.6 : 0.24;
        const brow = FALL_BAYER[(((top + r) / CELL | 0) % 4 + 4) % 4];
        for (let c = 0, col = 0; c < w; c += CELL, col++) {
          const th = brow[col & 3] / 16;
          if (th > dens) continue;
          ctx.fillStyle = th < dens * 0.5 ? L.pal[0] : L.pal[1];
          ctx.fillRect(c, Math.round(top + r), CELL, CELL);
        }
      }
    }
  }
}

/** Молнии — два коротких окна за полёт. Ломаная сверху вниз: 2px белое
 * ядро + смещённый серый призрак + одна ветка. Резкая вспышка → спад. */
function drawFallBolts(ctx, w, h, prog, t) {
  const WINDOWS = [0.30, 0.62];
  for (let k = 0; k < WINDOWS.length; k++) {
    const d = prog - WINDOWS[k];
    if (d < 0 || d > 0.12) continue;
    const life = d / 0.12;
    const alpha = life < 0.15 ? 1 : (1 - life) * 0.5;
    const seed = (k * 0x9E3779B1 + 0x51ED2F) >>> 0;
    let bx = 60 + (seed % Math.max(1, w - 120));
    let by = -20;
    const pts = [[bx, by]];
    for (let s = 0; s < 14 && by < h + 20; s++) {
      by += 32 + ((seed >>> s) & 7) * 6;
      bx += (((seed >>> (s * 2)) & 3) - 1.5) * 14;
      pts.push([bx, by]);
    }
    const stroke = (ox, col) => {
      ctx.fillStyle = col;
      for (let i = 1; i < pts.length; i++) {
        const ax = pts[i - 1][0], ay = pts[i - 1][1];
        const dxx = pts[i][0] - ax, dyy = pts[i][1] - ay;
        const n = Math.max(1, Math.ceil(Math.hypot(dxx, dyy) / 3));
        for (let j = 0; j <= n; j++) {
          ctx.fillRect(Math.round((ax + dxx * j / n + ox) / 2) * 2,
            Math.round((ay + dyy * j / n) / 2) * 2, 2, 2);
        }
      }
    };
    ctx.save();
    ctx.globalAlpha = alpha * 0.5;
    stroke(4, '#B8B8B8');
    ctx.globalAlpha = alpha;
    stroke(0, '#FFFFFF');
    // одна ветка от середины
    const mid = pts[pts.length >> 1];
    let bx2 = mid[0], by2 = mid[1];
    ctx.fillStyle = '#FFFFFF';
    for (let s = 0; s < 5; s++) {
      bx2 += 10 + ((seed >>> s) & 3) * 6;
      by2 += 14 + ((seed >>> (s + 3)) & 3) * 6;
      ctx.fillRect(Math.round(bx2 / 2) * 2, Math.round(by2 / 2) * 2, 2, 2);
    }
    ctx.restore();
  }
}

function drawDog(ctx, images, d, camX, camY, dogPlat) {
  let frames = images.dogWalkFrames;
  let idx = Math.floor(d.frameT * 6) % frames.length;
  if (d.pose === 'sit') { frames = images.dogSitFrames; idx = Math.floor(d.frameT * 4) % frames.length; } // 2 кадра = хвост вверх/вниз, ~2 виляния/с
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

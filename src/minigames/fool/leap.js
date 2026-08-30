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
const FALL_DUR = 2.8;     // такт 2 — полёт (длинный, чтобы «летелось», правка 2026-08-29)
const ARRIVE_DUR = 1.4;   // такт 3 — проявление земли (мягче, правка 2026-08-30)
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
  let walkImpulse = 0;  // остаток авто-ходьбы после тапа, сек (TAP_STEP)
  let movedEver = false; // хоть раз пошёл — стартовая подсказка больше не нужна
  let respawnFlash = 0; // короткая вспышка чёрным после падения, сек
  // Жестовые знаки (задача 8): появляются после паузы бездействия, гаснут
  // навсегда после первого удавшегося жеста своего типа.
  let idleT = 0;            // сек без ввода в состоянии, ждущем жеста
  let swipeGlyphDone = false; // хоть раз прыгнул свайпом — знак свайпа снят
  // Финальный край (задача 5): призрачная дорога проявлена (1) → осыпалась
  // (0); кромка последней плиты разгорается акцентом (0 → 1).
  let ghostReveal = 1;
  let ghostCrumbled = false; // осколки уже сыпанули — один раз
  let abyssLure = 0;         // 0→1 после обрушения плиты: пропасть светлее и дышит чаще
  let accentEdge = 0;
  let lean = 0; // наклон Шута у финального края, 0..1 (задача 6, вместо полоски HOLD)
  // Падение — три такта (задача 7): 'brace' → 'fall' (мир едет вверх) → 'arrive'.
  let fallScroll = 0, fallSpeed = 0, debrisT = 0, arriveDust = false;
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
    walking = false; // приземлился — не уносим сразу за следующий край
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
    walking = false;
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
    // Откуда пара въезжает в центр кадра в такте 2 — экранная позиция
    // Шута прямо сейчас (у кромки).
    fallFromX = player.x - camX;
    fallFromY = player.y - camY - PLAYER_H / 2;
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
        { mult: 0.28, c: '#1C1C1C', band: 88 },
        { mult: 0.5, c: '#1C1C1C', band: 120 },
        { mult: 0.78, c: '#212121', band: 148 },
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

      // Передний план — РЕДКИЕ чанки-пиксельные молнии (правка в чате
      // 2026-08-30: тонкие линии «не в стиле», хочется покрупнее, и молнии,
      // а не линии). Ломаный путь снизу вверх блочными сегментами 6 px,
      // каждая молния видна ~0.12 с своего цикла.
      for (let b = 0; b < 3; b++) {
        const seed = (b * 0x9E37 + 0x1B1B) >>> 0;
        const cyc = 1.0 + (seed % 5) * 0.22;          // период появления, с
        const ph = ((t / cyc) + (seed % 97) / 97) % 1;
        if (ph > 0.12) continue;
        ctx.globalAlpha = (ph < 0.05 ? 0.9 : 0.45);   // резкий блик, потом гаснет
        let bx = 24 + (seed % Math.max(1, w - 48));
        let by = h + 24;
        for (let s = 0; s < 10 && by > -40; s++) {
          const seg = 44 + ((seed >> (s + 1)) & 7) * 10;   // вертикальный отрезок
          const jog = (((seed >> (s * 2)) & 3) - 1.5) * 22; // горизонтальный сдвиг
          ctx.fillStyle = (s & 1) ? '#808080' : '#4A4A4A';
          ctx.fillRect(Math.round(bx), Math.round(by - seg), 6, Math.round(seg) + 6);       // вертикаль
          ctx.fillRect(Math.round(Math.min(bx, bx + jog)), Math.round(by - seg), Math.round(Math.abs(jog)) + 6, 6); // колено
          bx += jog;
          by -= seg;
        }
        ctx.globalAlpha = 1;
      }

      // Пара въезжает в центр кадра из позиции срыва за первые ~0.45 с —
      // не телепорт (правка в чате 2026-08-30). enter 0→1 сглажен.
      const enterRaw = clamp01(stateT / 0.45);
      const enter = enterRaw * enterRaw * (3 - 2 * enterRaw); // smoothstep
      const baseX = fallFromX + (w / 2 - fallFromX) * enter;
      const baseY = fallFromY + (h * 0.44 - fallFromY) * enter;

      // Плита, с которой шагнул — стоит под парой в момент срыва и уходит
      // вверх вместе с миром, растворяясь (fade), а не сползая рывком за край.
      const originY = baseY + PLAYER_H / 2 - fallScroll * 0.9;
      const originA = clamp01(1 - fallScroll / 240);
      if (originA > 0 && originY > -PLATE_H) {
        ctx.globalAlpha = originA;
        drawPlatform(ctx, images, { x: Math.round(w / 2 - 112), y: 0, w: 224 }, 0, -Math.round(originY));
        ctx.globalAlpha = 1;
      }

      // Обломки и пылинки навстречу (в dust, летят вверх) — крупными
      // квадратами по сетке (правка в чате 2026-08-30: «увеличить
      // пиксельность»). Размер уже задан крупнее при спавне.
      dust.forEach((d) => {
        ctx.fillStyle = (1 - d.t / d.life) > 0.5 ? '#808080' : '#4A4A4A';
        const s = Math.max(4, d.s);
        ctx.fillRect(Math.round((d.x - camX) / 4) * 4, Math.round((d.y - camY) / 4) * 4, s, s);
      });

      // Пара Шут+пёс: качание/боб/крен нарастают по enter (у кромки —
      // ещё почти завал из такта 1, к центру — плавный парящий крен).
      const pw = PAIR_W;
      const cx = baseX + Math.sin(t * 1.7) * 6 * enter;
      const cyc = baseY + Math.sin(t * 1.3) * 4 * enter;
      ctx.save();
      ctx.translate(cx, cyc);
      ctx.rotate(0.5 * (1 - enter) + Math.sin(t * 1.05) * 0.16 * enter);
      ctx.drawImage(images.foolDogFall, Math.round(-pw / 2), Math.round(-PLAYER_H / 2), pw, PLAYER_H);
      ctx.restore();

      // Кадр гасится снизу ДИЗЕР-ГРАДИЕНТОМ (как пропасть), а не резким
      // чёрным (правка в чате 2026-08-30). Полоса растёт с 60% полёта:
      // сверху почти воздух, книзу — чёрное, через тона пустоты; матрица
      // Bayer решает стык. К самому концу добиваем сплошным чёрным, чтобы
      // 'arrive' стартовал от чёрного.
      const DARK = ['#111111', '#161616', '#1C1C1C', '#252525', '#000000'];
      const coverP = clamp01((prog - 0.60) / 0.40);
      if (coverP > 0) {
        const bandH = Math.round(h * coverP * 1.2);
        const bandTop = h - bandH;
        const dl = DARK.length - 1;
        for (let cy = Math.floor(bandTop / CELL) * CELL, row = 0; cy < h; cy += CELL, row++) {
          const f = clamp01((cy - bandTop) / Math.max(1, bandH));
          const gi = f * dl;
          const lo = Math.floor(gi);
          const hi = lo < dl ? lo + 1 : dl;
          const fr = gi - lo;
          const brow = FALL_BAYER[row & 3];
          for (let cx = 0, col = 0; cx < w; cx += CELL, col++) {
            ctx.fillStyle = brow[col & 3] / 16 < fr ? DARK[hi] : DARK[lo];
            ctx.fillRect(cx, cy, CELL, Math.min(CELL, h - cy));
          }
        }
      }
      if (prog > 0.9) {
        ctx.globalAlpha = clamp01((prog - 0.9) / 0.1);
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 1;
      }
      return;
    }

    // arrive — прибытие ВНИЗУ экрана (правка в чате 2026-08-30): без тумана,
    // Шут с псом стоят на дороге у нижней кромки, а НАД ними проявляется
    // следующая плита — путь идёт дальше и вверх. Верх кадра чистый: туда
    // лягут слова предсказания (prediction.js держит ту же композицию).
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);
    const p = clamp01(stateT / ARRIVE_DUR);

    const gy = Math.round(h * ARRIVE_GROUND_FRAC);
    const gw = groundStrip.width;                    // ARRIVE_MAIN_W (256)
    const gx = Math.round(w / 2 - gw / 2 - 28);      // чуть левее центра
    const fcx = gx + Math.round(gw * 0.44);          // где стоит Шут

    // Основная плита — пиксельным проявлением оракула.
    drawPixelReveal(ctx, groundStrip, gx, gy, gw, PLATE_H, p, 4, 0.42, 0.4);
    // Следующая плита — НАД Шутом, ступенькой вправо-вверх, проступает позже.
    const upP = clamp01((p - 0.3) / 0.6);
    if (upP > 0) {
      drawPixelReveal(ctx, ghostStrip, gx + gw - ARRIVE_STEP_DX, gy - ARRIVE_STEP_UP, ghostStrip.width, PLATE_H, upP, 4, 0.2, 1);
    }

    if (p > 0.35) {
      const a = clamp01((p - 0.35) / 0.45);
      ctx.globalAlpha = a;
      const settle = Math.round((1 - a) * 10); // Шут мягко оседает на дорогу
      const dogImg = images.dogSitFrames[Math.floor(t * 4) % images.dogSitFrames.length];
      ctx.drawImage(dogImg, fcx - PLAYER_W / 2 - DOG_W - 2, gy - DOG_H - settle, DOG_W, DOG_H);
      const fr = images.foolIdleFrames;
      ctx.drawImage(fr[Math.floor(t * IDLE_FPS) % fr.length], fcx - PLAYER_W / 2, gy - PLAYER_H - settle, PLAYER_W, PLAYER_H);
      ctx.globalAlpha = 1;
    }
    if (p >= 1) {
      dust.forEach((d) => {
        ctx.fillStyle = (1 - d.t / d.life) > 0.5 ? '#808080' : '#4A4A4A';
        ctx.fillRect(Math.round(fcx + (d.x - player.x)), Math.round(gy - (player.y - d.y)), d.s, d.s);
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
      walkImpulse = 0;
      movedEver = false;
      idleT = 0;
      swipeGlyphDone = false;
      respawnFlash = 0;
      ghostReveal = 1;
      ghostCrumbled = false;
      abyssLure = 0;
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
          if (state === 'walk') walking = true;
          idleT = 0;
          holdPrevY = e.y;
          holdPrevMs = 0;
        }),
        input.on('pressend', () => { walking = false; idleT = 0; }),
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

      // После обрушения плиты пропасть «манит вниз» — светлеет и дышит
      // чаще (правка в чате 2026-08-30). Нарастает за ~1 с.
      if (ghostCrumbled) abyssLure = Math.min(1, abyssLure + dt / 1.0);

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
      // плитами, виден всю дорогу (задача 4). После обрушения плиты —
      // светлеет и дышит чаще (abyssLure, правка 2026-08-30).
      drawAbyss(ctx, w, h, t, abyssLure);
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
      drawPlayer(ctx, images, player, camX, camY, state, t, standPlat, leanV);
      // fall/arrive сюда не доходят (ранний return выше); в остальных
      // состояниях, включая стоп-кадр 'brace', пёс рисуется.
      drawDog(ctx, images, dog, camX, camY, dogPlat);

      // Подсказки (правка в чате 2026-08-30): текст ВЫСОКИЙ И УЗКИЙ —
      // слова в столбик, чуть ВЫШЕ головы, с миганием как на других
      // экранах. Стрелка свайпа — вплотную справа от столбика.
      const scale = Math.min(Math.max(w / 430, 0.75), 1.25);
      const marginX = Math.round(53 * scale);
      const headTop = Math.round(player.y - camY - PLAYER_H);
      const figX = Math.round(player.x - camX);

      // Рисует слова в столбик по центру фигуры (клэмп в поля), низ
      // столбика на 18px выше головы. Возвращает геометрию для стрелки.
      const hintStack = (words, fadeIn) => {
        const lineH = Math.round(24 * scale);
        setFont(ctx, 'menuOption', scale);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#EBA331';
        ctx.globalAlpha = clamp01(fadeIn) * blinkAlpha(t);
        const bottom = headTop - Math.round(18 * scale);
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

      if (state === 'charge') {
        if (lean > 0.02 && lean < 1) drawHoldRing(ctx, figX + 30, headTop - 30, lean, 1, 8);
      } else if (state === 'wait_leap' && idleT > 6) {
        const sweep = 0.5 - 0.5 * Math.cos(t * 2.2);
        drawHoldRing(ctx, figX + 30, headTop - 30, sweep, clamp01((idleT - 6) / 0.8), 6);
      } else if (state === 'walk' && !movedEver) {
        hintStack(['TAP', 'OR', 'HOLD', 'TO', 'WALK'], (t - 0.3) / 0.5);
      } else if (state === 'walk' && !walking && walkImpulse <= 0 && !swipeGlyphDone && idleT > 0.5) {
        const p = platforms[idx];
        const nearGap = p !== last && (p.x + p.w - player.x) < 90;
        if (nearGap) {
          const a = clamp01((idleT - 0.5) / 0.4);
          const box = hintStack(['SWIPE', 'UP'], a);
          const ay = box.bottom - (box.count - 1) * box.lineH / 2 + 4;
          drawSwipeTick(ctx, Math.round(figX + box.widest / 2 + 14), Math.round(ay), a, t);
        }
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

// Экран 5 для карты The Tower — мини-игра «Release» (глагол карты, GDD §8.2).
//
// Механика — дженга: вынимаешь брусок за бруском, башня всё неустойчивее и
// в какой-то момент падает сама. Решение в чате: «башня упадёт в любом
// случае, ты решаешь только как быстро» — это и есть release. Проиграть
// нельзя: обвал не наказание, а то, ради чего пришли (CLAUDE.md).
//
// Отличия от спеки BUILD-SPEC-06, принятые в чате:
// — не шесть тапов по экрану, а удержание на конкретном бруске;
// — башня не отдельный спрайт, а кладка из брусков, поэтому разрушение
//   собирается из того, что вынули, и отдельные «состояния распада» не нужны;
// — ракурс изометрический: в лоб кладка крест-накрест читалась стеной.
//
// Такты: play → crown (дрожь обрывается, корона в замедленной съёмке
// падает на край пола) → fall (башня рушится быстро) → settle (тишина) →
// lower (композиция едет вниз, к месту предсказания) → экран 6.

import { defineMinigame } from '../../core/minigame.js';
import { drawTopHint } from '../../core/hints.js';
import { uiScale } from '../../core/text.js';
import {
  ROWS, crownLift, drawBlock, drawGround, drawRubble, saveRubble, drawCastle, drawCrown,
  project, towerReach,
} from './blocks.js';
import { createPile } from './pile.js';
import { buildRows, shiftAt, cellPos, updateStability, tension } from './release/masonry.js';
import { pickAt } from './release/pick.js';
import { sendToStack, stepFlying, flyingPos } from './release/stacks.js';
import { puff, stepDust, collapse, launchCrown, stepDebris } from './release/fall.js';
import { t as str } from '../../data/strings.js';

const PULL_TIME = 0.8;      // сек удержания до выхода бруска
const PULL_DIST = 2.6;      // насколько выезжает, в единицах бруска
const SETTLE_HOLD = 2.2;    // тишина после того, как всё легло
const LOWER_TIME = 1.2;     // сколько едет вниз перед предсказанием
const CROWN_SLOW = 0.55;    // корона падает в лёгкой замедленной съёмке (правка 29.09)
const FALL_FAST = 1.3;      // а здание за ней — быстро

// Дрожь нарастает плавно: до TREMOR_FROM нагрузки башня стоит мёртво,
// дальше раскачка растёт квадратично и сглаживается во времени — правка
// 29.09 «очень рано начинается, хочется, чтобы плавно надвигалась».
// Качается только башня, пол стоит: дрожит то, что вот-вот упадёт.
const TREMOR_FROM = 0.35;
const TREMOR_MAX = 6;       // экранных px на пике
const TREMOR_EASE = 1.2;    // скорость, с которой дрожь догоняет нагрузку

// Стопки, куда перелетают вынутые бруски, — release/stacks.js; обвал,
// корона и пыль — release/fall.js; кладка и устойчивость — release/masonry.js.

// Подсказка жеста живёт над башней: верх короны с искрами не заходит на неё.
const HINT_CLEAR = 104;     // экранных px от верха экрана, ×uiScale

// Где стоит основание башни и куда оно приезжает к предсказанию. Второе
// значение — отступ от НИЖНЕЙ кромки: тот же в prediction.js, иначе на
// склейке 5→6 куча прыгает.
const BASE_Y_FRAC = 0.66;
export const RUBBLE_BOTTOM_GAP = 190;   // 150 → 190 (правка 29.09): перед кучи и корона упирались в нижний край

export function createReleaseScene({ input, goto }) {
  let rows = [];
  let debris = [];
  let flying = [];
  let stackH = { left: 0, right: 0 };
  let dust = [];
  const pile = createPile();
  let phase = 'play';
  let tPhase = 0;
  let tremor = 0;
  let pulling = null;
  let pivotRow = -1;
  let crown = null;
  let lowerFrom = 0;
  let lowerTo = 0;
  let baseX = 0;
  let baseY = 0;
  let movedEver = false;
  let castleUp = true;   // крепость стоит на крыше; при обвале — в обломки
  let t = 0;             // для искр короны

  function reset() {
    rows = buildRows();
    debris = [];
    flying = [];
    stackH = { left: 0, right: 0 };
    dust = [];
    pile.reset();
    phase = 'play';
    tPhase = 0;
    tremor = 0;
    pulling = null;
    pivotRow = -1;
    crown = { x: 1.5, y: 1.5, z: ROWS + crownLift(), vx: 0, vy: 0, vz: 0, live: false, rest: false, landed: false };
    castleUp = true;
    movedEver = false;
  }

  function startCollapse() {
    phase = 'fall';
    tPhase = 0;
    collapse(rows, pulling, pivotRow, castleUp, debris, dust);
    castleUp = false;
  }

  /** Корона уходит первой, здание — когда она легла (release/fall.js). */
  function startCrownFall() {
    phase = 'crown';
    tPhase = 0;
    launchCrown(crown, rows, pivotRow);
  }

  return defineMinigame({ input, goto }, {
    enter: reset,

    input: {
      pressstart(e) {
        if (phase !== 'play') return;
        const hit = pickAt(rows, pulling, baseX, baseY, e.x, e.y);
        if (hit) { pulling = { r: hit.r, i: hit.i, t: 0, out: 0 }; movedEver = true; }
      },
      pressend() { if (pulling) pulling.releasing = true; },
    },

    update(dt, w, h, finish) {
      baseX = Math.round(w / 2);
      if (phase !== 'lower') {
        // Ниже доли экрана, если иначе корона залезает на подсказку.
        const clear = Math.round(HINT_CLEAR * uiScale(w, 1.15)) + towerReach();
        baseY = Math.round(Math.max(h * BASE_Y_FRAC, clear) / 2) * 2;
        lowerFrom = baseY;
        lowerTo = h - RUBBLE_BOTTOM_GAP;
      }
      tPhase += dt;
      t += dt;

      if (pulling) {
        if (pulling.releasing) {
          pulling.out -= dt * 6;
          if (pulling.out <= 0) pulling = null;
        } else {
          pulling.t += dt;
          pulling.out = Math.min(PULL_DIST, (pulling.t / PULL_TIME) * PULL_DIST);
          if (pulling.t >= PULL_TIME) {
            const o = cellPos(rows, pulling, pulling.r, pulling.i);
            rows[pulling.r].slots[pulling.i] = 0;
            sendToStack(flying, stackH, o);
            pulling = null;
          }
        }
      }

      rows.forEach((r) => { r.lean += (r.leanTo - r.lean) * Math.min(1, dt * 4); });

      if (phase === 'play') {
        const k = Math.max(0, (tension(rows) - TREMOR_FROM) / (1 - TREMOR_FROM));
        tremor += (k * k - tremor) * Math.min(1, dt * TREMOR_EASE);
        const p = updateStability(rows, pulling);
        if (p >= 0) { pivotRow = p; startCrownFall(); }
      }

      // Дрожь обрывается ровно в кадр отрыва — канонный «гул в тишину»
      // переведён в картинку (BUILD-SPEC-06 §6).
      if (phase !== 'play') tremor = 0;

      flying = stepFlying(flying, dt, (d) => {
        debris.push(d);
        pile.claim(d);
        puff(dust, d);
      });
      stepDebris(debris, crown, pile, dust, dt, phase === 'fall' ? FALL_FAST : 1, phase === 'crown' ? CROWN_SLOW : 1);

      // Удар короны о пол и есть толчок: здание рушится с первого касания.
      if (phase === 'crown' && crown.landed) startCollapse();

      if (phase === 'fall' && !flying.length && debris.every((d) => d.rest) && crown.rest && tPhase > 1.5) {
        phase = 'settle'; tPhase = 0;
      }
      if (phase === 'settle' && tPhase > SETTLE_HOLD) { phase = 'lower'; tPhase = 0; }
      if (phase === 'lower') {
        const k = Math.min(1, tPhase / LOWER_TIME);
        const eased = 1 - (1 - k) * (1 - k);
        baseY = Math.round(lowerFrom + (lowerTo - lowerFrom) * eased);
        if (k >= 1) {
          // Куча переезжает на экран предсказания как есть — там она и
          // растворится, освободив место знаку вопроса.
          saveRubble(debris, baseX, RUBBLE_BOTTOM_GAP, crown);
          finish();
        }
      }

      dust = stepDust(dust, dt);
    },

    draw(ctx, w, h) {
      ctx.fillStyle = '#111111';
      ctx.fillRect(0, 0, w, h);

      drawGround(ctx, baseX, baseY, 4, phase === 'play' ? ROWS : 0);
      // Лежащее — до башни: пока она стоит, это стопки за ней; после обвала
      // башни уже нет, и порядок решает сама куча. Летящий в стопку брусок
      // вторую половину пути уже за башней.
      drawRubble(ctx, baseX, baseY, debris.filter((d) => d.rest));
      flying.filter((f) => f.k >= 0.5).forEach((f) => drawBlock(ctx, baseX, baseY, flyingPos(f), false));

      // Раскачка — медленная синусоида по чётным px, а не случайный рывок
      // каждый кадр: рывок читался вибрацией экрана, а не башней.
      const sway = Math.round(Math.sin(t * (5 + tremor * 9)) * tremor * TREMOR_MAX / 2) * 2;
      ctx.save();
      ctx.translate(sway, 0);

      for (let r = 0; r < ROWS; r++) {
        const list = [];
        rows[r].slots.forEach((v, i) => {
          if (!v) return;
          list.push({ o: cellPos(rows, pulling, r, i), hot: !!(pulling && pulling.r === r && pulling.i === i) });
        });
        list.sort((a, b) => (a.o.x + a.o.y) - (b.o.x + b.o.y));
        list.forEach((e) => drawBlock(ctx, baseX, baseY, e.o, e.hot));
      }

      if (castleUp) {
        const [sx, sy] = shiftAt(rows, ROWS);
        drawCastle(ctx, baseX, baseY, 1.5 + sx, 1.5 + sy, ROWS);
      }
      if (!crown.live) {
        const [sx, sy] = shiftAt(rows, ROWS);
        const bob = Math.round(Math.sin(t * 2) * 1.5) * 0.08;
        drawCrown(ctx, baseX, baseY, { x: crown.x + sx, y: crown.y + sy, z: crown.z + bob }, t, true);
      }
      ctx.restore();

      flying.filter((f) => f.k < 0.5).forEach((f) => drawBlock(ctx, baseX, baseY, flyingPos(f), false));

      debris.filter((d) => !d.rest).sort((a, b) => a.z - b.z)
        .forEach((d) => drawBlock(ctx, baseX, baseY, d, false));

      // Корона над крепостью дышит (выше, вместе с башней); сорвавшись —
      // падает и лежит на краю пола.
      if (crown.live) drawCrown(ctx, baseX, baseY, crown, t, false);

      // Пыль — процедурно, как везде в проекте (ASSETS.md).
      dust.forEach((d) => {
        const [sx, sy] = project(baseX, baseY, d.wx, d.wy, d.wz);
        ctx.fillStyle = d.t / d.life < 0.5 ? '#B8B8B8' : '#808080';
        ctx.fillRect(Math.round(sx / 2) * 2, Math.round(sy / 2) * 2, d.s, d.s);
      });

      // Подсказка жеста — как у Шута: словом, один раз, пока не тронули.
      if (phase === 'play' && !movedEver) {
        drawTopHint(ctx, str('tower.hold'), { w, t: tPhase, scale: uiScale(w, 1.15) });
      }
    },
  });
}

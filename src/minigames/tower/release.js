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
// Такты: play → fall (обвал, дрожь обрывается) → settle (тишина) →
// lower (композиция едет вниз, к месту предсказания) → экран 6.

import { setFont } from '../../core/text.js';
import { blinkAlpha } from '../../core/textReveal.js';
import {
  ROWS, COLS, cellsOf, facesOf, drawBlock, drawGround, drawRubble, saveRubble,
} from './blocks.js';

const PULL_TIME = 0.8;      // сек удержания до выхода бруска
const PULL_DIST = 2.6;      // насколько выезжает, в единицах бруска
const SETTLE_HOLD = 2.2;    // тишина после того, как всё легло
const LOWER_TIME = 1.2;     // сколько едет вниз перед предсказанием
const FALL_SLOW = 0.55;     // замедление в такте обвала (BUILD-SPEC-06 §11)
const GRAVITY = 26;

// Где стоит основание башни и куда оно приезжает к предсказанию. Второе
// значение — отступ от НИЖНЕЙ кромки: тот же в prediction.js, иначе на
// склейке 5→6 куча прыгает.
const BASE_Y_FRAC = 0.66;
export const RUBBLE_BOTTOM_GAP = 150;

export function createReleaseScene({ input, goto }) {
  let rows = [];
  let debris = [];
  let dust = [];
  let taken = new Set();
  let phase = 'play';
  let tPhase = 0;
  let shake = 0;
  let pulling = null;
  let pivotRow = -1;
  let crown = null;
  let lowerFrom = 0;
  let lowerTo = 0;
  let offHandlers = [];
  let baseX = 0;
  let baseY = 0;
  let movedEver = false;

  function reset() {
    rows = [];
    for (let r = 0; r < ROWS; r++) {
      rows.push({
        r,
        slots: [1, 1, 1],
        lean: 0,
        leanTo: 0,
        // Пара брусков изначально чуть выдвинута: идеально ровная кладка
        // читается кирпичом, неровная сразу говорит «в это уже играли».
        jitter: [0, 1, 2].map(() => (Math.random() < 0.3 ? 0.1 + Math.random() * 0.12 : 0)),
      });
    }
    debris = [];
    dust = [];
    taken = new Set();
    phase = 'play';
    tPhase = 0;
    shake = 0;
    pulling = null;
    pivotRow = -1;
    crown = { x: 1.5, y: 1.5, z: ROWS, vx: 0, vy: 0, vz: 0, live: false, rest: false };
    movedEver = false;
  }

  /** Просадка рядов ниже сдвигает всё, что выше, поперёк своего ряда. */
  function shiftAt(r) {
    let sx = 0;
    let sy = 0;
    for (let i = 0; i < r; i++) {
      if (i % 2 === 0) sy += rows[i].lean; else sx += rows[i].lean;
    }
    return [sx, sy];
  }

  function cellPos(r, i) {
    const c = cellsOf(r)[i];
    const [sx, sy] = shiftAt(r);
    const out = (pulling && pulling.r === r && pulling.i === i) ? pulling.out : 0;
    const push = out + rows[r].jitter[i];
    return {
      x: c.x + sx + (r % 2 === 0 ? push : 0),
      y: c.y + sy + (r % 2 === 0 ? 0 : push),
      z: r, dx: c.dx, dy: c.dy,
    };
  }

  /** Два бруска в ряду держат, один — ряд проседает на его сторону. Башня
   * падает, когда центр тяжести верха уходит за опору ряда. Возвращает
   * номер ряда-излома или −1. */
  function updateStability() {
    rows.forEach((row) => {
      const n = row.slots.filter(Boolean).length;
      const side = row.slots.reduce((a, v, i) => a + (v ? [-1, 0, 1][i] : 0), 0);
      row.leanTo = n >= 2 ? 0 : (n === 1 ? side * 0.5 : 0);
    });
    for (let r = 0; r < ROWS; r++) {
      const kept = rows[r].slots.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
      if (!kept.length) return r;
      let mass = 0; let mx = 0; let my = 0;
      for (let q = r + 1; q < ROWS; q++) {
        rows[q].slots.forEach((v, i) => {
          if (!v) return;
          const p = cellPos(q, i);
          mass += 1; mx += p.x + p.dx / 2; my += p.y + p.dy / 2;
        });
      }
      if (!mass) continue;
      const com = r % 2 === 0 ? my / mass : mx / mass;
      const [sx, sy] = shiftAt(r);
      const base = r % 2 === 0 ? sy : sx;
      if (com < base + Math.min(...kept) - 0.35 || com > base + Math.max(...kept) + 1.35) return r;
    }
    return -1;
  }

  const blocksLeft = () => rows.reduce((a, r) => a + r.slots.filter(Boolean).length, 0);
  const tension = () => Math.min(1,
    (COLS * ROWS - blocksLeft()) / 16 + rows.reduce((a, r) => a + Math.abs(r.lean), 0) / 3);

  // --- куча обломков ------------------------------------------------------
  // Плотно: место ищем по спирали от центра основания и складываем слоями,
  // а не разбрасываем по всей земле (правка в чате — «куча плотнее»).
  function cellKeys(d) {
    const out = [];
    for (let a = 0; a < Math.round(d.dx); a++) {
      for (let b = 0; b < Math.round(d.dy); b++) {
        out.push(`${Math.round(d.x) + a},${Math.round(d.y) + b},${Math.round(d.z)}`);
      }
    }
    return out;
  }

  function freeAt(d, x, y, z) {
    const probe = { ...d, x, y, z };
    return cellKeys(probe).every((k) => !taken.has(k));
  }

  function settle(d) {
    const cx = 1.5;
    const cy = 1.5;
    let best = null;
    for (let z = 0; z <= 3 && !best; z++) {
      for (let ring = 0; ring <= 3 && !best; ring++) {
        for (let dx = -ring; dx <= ring && !best; dx++) {
          for (let dy = -ring; dy <= ring && !best; dy++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
            const x = Math.round(cx - d.dx / 2) + dx;
            const y = Math.round(cy - d.dy / 2) + dy;
            if (!freeAt(d, x, y, z)) continue;
            // На весу не висим: либо земля, либо есть опора снизу.
            if (z > 0 && freeAt(d, x, y, z - 1)) continue;
            best = { x, y, z };
          }
        }
      }
    }
    const spot = best ?? { x: Math.round(d.x), y: Math.round(d.y), z: 0 };
    d.x = spot.x; d.y = spot.y; d.z = spot.z;
    cellKeys(d).forEach((k) => taken.add(k));
  }

  function puff(o) {
    for (let k = 0; k < 6; k++) {
      dust.push({
        wx: o.x + (o.dx || 1) / 2,
        wy: o.y + (o.dy || 1) / 2,
        wz: o.z + 0.5,
        vx: (Math.random() * 2 - 1) * 0.6,
        vy: (Math.random() * 2 - 1) * 0.6,
        vz: 0.8 + Math.random(),
        t: 0,
        life: 0.5 + Math.random() * 0.5,
        s: Math.random() < 0.5 ? 2 : 4,
      });
    }
  }

  function startCollapse() {
    phase = 'fall';
    tPhase = 0;
    const dir = rows[pivotRow].lean <= 0 ? -1 : 1;
    for (let r = 0; r < ROWS; r++) {
      rows[r].slots.forEach((v, i) => {
        if (!v) return;
        const o = cellPos(r, i);
        const lever = Math.max(0.1, r - pivotRow) * 0.16 + 0.3;
        debris.push({
          ...o,
          // часть брусьев разворачивается — куча не должна лечь орнаментом
          ...(Math.random() < 0.45 ? { dx: o.dy, dy: o.dx } : {}),
          vx: (r % 2 === 0 ? dir * lever * 0.7 : dir * lever * 1.1) + (Math.random() - 0.5) * 1.2,
          vy: (r % 2 === 0 ? dir * lever * 1.1 : dir * lever * 0.7) + (Math.random() - 0.5) * 1.2,
          vz: 0.6 + Math.random(),
          rest: false,
        });
        rows[r].slots[i] = 0;
        puff(o);
      });
    }
    crown.live = true;
    crown.vx = dir * 1.1;
    crown.vy = dir * 1.1;
    crown.vz = 2.4;
  }

  function stepDebris(dt, slow) {
    const d2 = dt * slow;
    debris.forEach((d) => {
      if (d.rest) return;
      d.vz -= GRAVITY * d2;
      d.x += d.vx * d2; d.y += d.vy * d2; d.z += d.vz * d2;
      d.vx *= (1 - 1.4 * d2); d.vy *= (1 - 1.4 * d2);
      if (d.z <= 0) {
        d.z = 0;
        if (Math.abs(d.vz) < 3) {
          d.rest = true; d.vx = 0; d.vy = 0; d.vz = 0;
          settle(d);
        } else {
          d.vz *= -0.24; d.vx *= 0.4; d.vy *= 0.4; puff(d);
        }
      }
    });
    if (crown.live && !crown.rest) {
      crown.vz -= GRAVITY * d2;
      crown.x += crown.vx * d2; crown.y += crown.vy * d2; crown.z += crown.vz * d2;
      if (crown.z <= 0.2) {
        crown.z = 0.2;
        if (Math.abs(crown.vz) < 3) { crown.rest = true; crown.vx = 0; crown.vy = 0; } else {
          crown.vz *= -0.3; crown.vx *= 0.6; crown.vy *= 0.6;
        }
      }
    }
  }

  // --- ввод ---------------------------------------------------------------
  function pickAt(px, py) {
    let found = null; // ближний к зрителю выигрывает
    for (let r = 0; r < ROWS; r++) {
      rows[r].slots.forEach((v, i) => {
        if (!v) return;
        const o = cellPos(r, i);
        const f = facesOf(baseX, baseY, o);
        if (inPoly(px, py, f.top) || inPoly(px, py, f.front) || inPoly(px, py, f.right)) {
          const depth = (o.x + o.y) + r * 0.01;
          if (!found || depth > found.depth) found = { r, i, depth };
        }
      });
    }
    return found;
  }

  function inPoly(px, py, pts) {
    let hit = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i];
      const [xj, yj] = pts[j];
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) hit = !hit;
    }
    return hit;
  }

  return {
    enter() {
      reset();
      offHandlers = [
        input.on('pressstart', (e) => {
          if (phase !== 'play') return;
          const hit = pickAt(e.x, e.y);
          if (hit) { pulling = { r: hit.r, i: hit.i, t: 0, out: 0 }; movedEver = true; }
        }),
        input.on('pressend', () => { if (pulling) pulling.releasing = true; }),
      ];
    },

    exit() {
      offHandlers.forEach((off) => off?.());
      offHandlers = [];
    },

    update(dt, w, h) {
      baseX = Math.round(w / 2);
      if (phase !== 'lower') {
        baseY = Math.round(h * BASE_Y_FRAC);
        lowerFrom = baseY;
        lowerTo = h - RUBBLE_BOTTOM_GAP;
      }
      tPhase += dt;

      if (pulling) {
        if (pulling.releasing) {
          pulling.out -= dt * 6;
          if (pulling.out <= 0) pulling = null;
        } else {
          pulling.t += dt;
          pulling.out = Math.min(PULL_DIST, (pulling.t / PULL_TIME) * PULL_DIST);
          if (pulling.t >= PULL_TIME) {
            const o = cellPos(pulling.r, pulling.i);
            rows[pulling.r].slots[pulling.i] = 0;
            debris.push({
              ...o,
              vx: o.dx === 3 ? 2.4 : 0.7,
              vy: o.dy === 3 ? 2.4 : 0.7,
              vz: 0.5,
              rest: false,
            });
            puff(o);
            pulling = null;
          }
        }
      }

      rows.forEach((r) => { r.lean += (r.leanTo - r.lean) * Math.min(1, dt * 4); });

      if (phase === 'play') {
        shake = tension() * 3;
        const p = updateStability();
        if (p >= 0) { pivotRow = p; startCollapse(); }
      }

      // Дрожь обрывается ровно в кадр отрыва — канонный «гул в тишину»
      // переведён в картинку (BUILD-SPEC-06 §6).
      if (phase !== 'play') shake = 0;

      stepDebris(dt, phase === 'fall' ? FALL_SLOW : 1);

      if (phase === 'fall' && debris.every((d) => d.rest) && crown.rest && tPhase > 1.5) {
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
          saveRubble(debris, baseX, RUBBLE_BOTTOM_GAP);
          goto('prediction');
        }
      }

      dust = dust.filter((d) => {
        d.t += dt;
        d.wx += d.vx * dt; d.wy += d.vy * dt; d.wz += d.vz * dt;
        d.vz -= 2 * dt;
        return d.t < d.life;
      });
    },

    draw(ctx, w, h) {
      ctx.fillStyle = '#111111';
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      if (shake) {
        ctx.translate(
          Math.round((Math.random() * 2 - 1) * shake),
          Math.round((Math.random() * 2 - 1) * shake),
        );
      }

      drawGround(ctx, baseX, baseY, 4);
      drawRubble(ctx, baseX, baseY, debris.filter((d) => d.rest));

      for (let r = 0; r < ROWS; r++) {
        const list = [];
        rows[r].slots.forEach((v, i) => {
          if (!v) return;
          list.push({ o: cellPos(r, i), hot: !!(pulling && pulling.r === r && pulling.i === i) });
        });
        list.sort((a, b) => (a.o.x + a.o.y) - (b.o.x + b.o.y));
        list.forEach((e) => drawBlock(ctx, baseX, baseY, e.o, e.hot));
      }

      debris.filter((d) => !d.rest).sort((a, b) => a.z - b.z)
        .forEach((d) => drawBlock(ctx, baseX, baseY, d, false));

      // Пыль — процедурно, как везде в проекте (ASSETS.md).
      dust.forEach((d) => {
        const sx = baseX + (d.wx - d.wy) * 26;
        const sy = baseY + (d.wx + d.wy) * 13 - d.wz * 20;
        ctx.fillStyle = d.t / d.life < 0.5 ? '#B8B8B8' : '#808080';
        ctx.fillRect(Math.round(sx), Math.round(sy), d.s, d.s);
      });
      ctx.restore();

      // Подсказка жеста — как у Шута: словом, один раз, пока не тронули.
      if (phase === 'play' && !movedEver) {
        const scale = Math.min(Math.max(w / 430, 0.75), 1.15);
        setFont(ctx, 'caption', scale);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#EBA331';
        ctx.globalAlpha = blinkAlpha(tPhase);
        ctx.fillText('HOLD A BLOCK', w / 2, Math.round(74 * scale));
        ctx.globalAlpha = 1;
      }
    },
  };
}

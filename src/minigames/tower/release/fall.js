// Обвал Башни: корона срывается первой, кладка рассыпается обломками,
// обломки и корона падают и ложатся, из-под них летит пыль. Вынесено из
// release.js (задача 6 бэклога агента) без изменения поведения — значения
// и комментарии перенесены как были.

import { ROWS } from '../blocks.js';
import { shiftAt, cellPos } from './masonry.js';

const GRAVITY = 26;

// Куда ложится корона: на край пола со стороны крена, ближе к зрителю.
const CROWN_EDGE = 6.5;
const CROWN_REST_Z = 0.2;

export function puff(dust, o) {
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

/** Шаг пыли; возвращает ещё живые пылинки. */
export function stepDust(dust, dt) {
  return dust.filter((d) => {
    d.t += dt;
    d.wx += d.vx * dt; d.wy += d.vy * dt; d.wz += d.vz * dt;
    d.vz -= 2 * dt;
    return d.t < d.life;
  });
}

/** Всё, что стоит, уходит в обломки (debris) с рычагом от ряда-излома
 * pivotRow; withCastle — крепость на крыше ещё стоит и уходит вместе. */
export function collapse(rows, pulling, pivotRow, withCastle, debris, dust) {
  const dir = rows[pivotRow].lean <= 0 ? -1 : 1;
  for (let r = 0; r < ROWS; r++) {
    rows[r].slots.forEach((v, i) => {
      if (!v) return;
      const o = cellPos(rows, pulling, r, i);
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
      puff(dust, o);
    });
  }
  // Крепость уходит обломками вместе с кладкой (решение в чате): светлый
  // камень с крыши летит дальше всех — у него самый длинный рычаг.
  if (withCastle) {
    const [sx, sy] = shiftAt(rows, ROWS);
    [[0, 1, 3, 1, 'light'], [1, 0, 1, 3, 'light'], [0.5, 0.5, 3, 1, 'mid']].forEach(([ox, oy, dx, dy, tone]) => {
      const o = { x: ox + sx, y: oy + sy, z: ROWS, dx, dy, tone };
      debris.push({
        ...o,
        vx: dir * 2 + (Math.random() - 0.5) * 1.2,
        vy: dir * 2 + (Math.random() - 0.5) * 1.2,
        vz: 1 + Math.random(),
        rest: false,
      });
      puff(dust, o);
    });
  }
}

/** Корона уходит первой (правка 29.09): башня замирает, корона в
 * замедленной съёмке соскальзывает на край пола со стороны крена, и
 * только когда она легла, рушится здание. Баллистика считается под
 * точку падения, чтобы корона легла ровно на край, а не куда вынесет. */
export function launchCrown(crown, rows, pivotRow) {
  const dir = rows[pivotRow].lean <= 0 ? -1 : 1;
  const [cx, cy] = shiftAt(rows, ROWS);
  crown.x += cx;
  crown.y += cy;
  crown.live = true;
  crown.vz = 2.2;
  const z0 = crown.z - CROWN_REST_Z;
  const tFly = (crown.vz + Math.sqrt(crown.vz * crown.vz + 2 * GRAVITY * z0)) / GRAVITY;
  const [tx, ty] = dir > 0 ? [CROWN_EDGE, 1.5] : [1.5, CROWN_EDGE];
  crown.vx = (tx - crown.x) / tFly;
  crown.vy = (ty - crown.y) / tFly;
}

/** Шаг падения обломков и короны; slow / crownSlow — множители времени
 * (замедленная съёмка короны, быстрый обвал здания). */
export function stepDebris(debris, crown, pile, dust, dt, slow, crownSlow = slow) {
  const d2 = dt * slow;
  const c2 = dt * crownSlow;
  debris.forEach((d) => {
    if (d.rest) return;
    d.vz -= GRAVITY * d2;
    d.x += d.vx * d2; d.y += d.vy * d2; d.z += d.vz * d2;
    d.vx *= (1 - 1.4 * d2); d.vy *= (1 - 1.4 * d2);
    if (d.z <= 0) {
      d.z = 0;
      if (Math.abs(d.vz) < 3) {
        d.rest = true; d.vx = 0; d.vy = 0; d.vz = 0;
        pile.settle(d);
      } else {
        d.vz *= -0.24; d.vx *= 0.4; d.vy *= 0.4; puff(dust, d);
      }
    }
  });
  if (crown.live && !crown.rest) {
    crown.vz -= GRAVITY * c2;
    crown.x += crown.vx * c2; crown.y += crown.vy * c2; crown.z += crown.vz * c2;
    if (crown.z <= CROWN_REST_Z) {
      crown.z = CROWN_REST_Z;
      crown.vx = 0; crown.vy = 0;   // точка падения рассчитана — не уезжаем с края
      crown.landed = true;
      if (Math.abs(crown.vz) < 3) crown.rest = true; else crown.vz *= -0.15;
    }
  }
}

// Кладка Башни: ряды брусков, их просадка, положение каждого бруска и
// устойчивость. Вынесено из release.js (задача 6 бэклога агента) без
// изменения поведения — значения и комментарии перенесены как были.

import { ROWS, COLS, cellsOf, toneOf } from '../blocks.js';

/** Свежая кладка: ROWS рядов по три бруска. */
export function buildRows() {
  const rows = [];
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
  return rows;
}

/** Просадка рядов ниже сдвигает всё, что выше, поперёк своего ряда. */
export function shiftAt(rows, r) {
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < r; i++) {
    if (i % 2 === 0) sy += rows[i].lean; else sx += rows[i].lean;
  }
  return [sx, sy];
}

/** Где стоит брусок i ряда r; вытягиваемый (pulling) выдвинут на свой out. */
export function cellPos(rows, pulling, r, i) {
  const c = cellsOf(r)[i];
  const [sx, sy] = shiftAt(rows, r);
  const out = (pulling && pulling.r === r && pulling.i === i) ? pulling.out : 0;
  const push = out + rows[r].jitter[i];
  return {
    x: c.x + sx + (r % 2 === 0 ? push : 0),
    y: c.y + sy + (r % 2 === 0 ? 0 : push),
    z: r, dx: c.dx, dy: c.dy, tone: toneOf(r, i),
  };
}

/** Два бруска в ряду держат, один — ряд проседает на его сторону. Башня
 * падает, когда центр тяжести верха уходит за опору ряда. Возвращает
 * номер ряда-излома или −1. */
export function updateStability(rows, pulling) {
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
        const p = cellPos(rows, pulling, q, i);
        mass += 1; mx += p.x + p.dx / 2; my += p.y + p.dy / 2;
      });
    }
    if (!mass) continue;
    const com = r % 2 === 0 ? my / mass : mx / mass;
    const [sx, sy] = shiftAt(rows, r);
    const base = r % 2 === 0 ? sy : sx;
    if (com < base + Math.min(...kept) - 0.35 || com > base + Math.max(...kept) + 1.35) return r;
  }
  return -1;
}

const blocksLeft = (rows) => rows.reduce((a, r) => a + r.slots.filter(Boolean).length, 0);
export const tension = (rows) => Math.min(1,
  (COLS * ROWS - blocksLeft(rows)) / 16 + rows.reduce((a, r) => a + Math.abs(r.lean), 0) / 3);

// Сад Императрицы — раскладка и рисование (макет `flow_iso7`, 25.10):
// шесть клеток земли в изометрии одним блоком, светлая рамка вокруг,
// извилистая дорожка, мягкий фон-градиент, рощицы, корзинка, Императрица
// с карты под зонтиком. Ввод и такты — в bloom.js.
//
// Всё в экранных px, зерно 2 (1 арт-пиксель = 2 экранных). Клетки и рамка —
// кодом по сетке 2:1 (`tools/empress-plots.py`, `tools/empress-ring.py`),
// остальное — Pro Flash.

import { drawPixelReveal } from '../../core/pixelReveal.js';

export const GRAIN = 2;
const U = 32 * GRAIN;   // шаг клетки: ромб 2U × U
const NI = 3;           // клеток вдоль одной оси
const NJ = 2;           // и вдоль другой
const even = (v) => Math.round(v / 2) * 2;

// Мягкий градиент, как холмы Шута: тоны пустоты, переходы Байером 4×4.
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const RAMP = ['#111111', '#161616', '#1C1C1C'];
const PATH_TONE = '#2E2E2E';
const PATH_EDGE = '#2A2A2A';
const PEBBLES = ['#4A4A4A', '#4A4A4A', '#808080'];
const PATH_W = 30;

// Что вырастает на каждой клетке (по кругу задний ряд → передний):
// высокие сзади, низкие спереди. Номер — crop_N.png.
export const CROP_OF = [1, 2, 5, 4, 3, 3];
export const HOLD_PLOT = 4;    // передняя средняя — на ней удержание

/** Детерминированный шум — дорожка одинаковая на каждом кадре и заходе. */
function rand(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export function createGarden(images) {
  const L = {};            // раскладка под текущий размер экрана
  let bgKey = '';
  let bg = null;           // фон + рамка + дорожка, снятые в буфер

  /** Угол клетки (i, j) блока: i — вправо-вниз, j — влево-вниз. */
  const P = (i, j) => ({ x: L.sx + NJ * U + (i - j) * U, y: L.sy + (i + j) * U / 2 });

  function place(w, h) {
    const blockW = images.empressPlotsDry.width * GRAIN;
    L.w = w; L.h = h;
    L.sx = even((w - blockW) / 2);
    L.sy = even(h * 0.52);
    L.spots = [];
    for (let j = 0; j < NJ; j++) {
      for (let i = 0; i < NI; i++) {
        const c = P(i + 0.5, j + 0.5);
        L.spots.push({ x: even(c.x), y: even(c.y) });
      }
    }
    const emp = images.empressFigure;   // портрет с карты лежит ×4 — рисуем ×2
    L.empW = emp.width / 2; L.empH = emp.height / 2;
    L.ex = even(w - L.empW - 18);
    L.ey = even(L.sy - L.empH - 80);
    const par = images.empressParasol;
    L.px = even(L.ex - par.width * GRAIN / 2 + 6);
    L.py = even(L.ey + L.empH - par.height * GRAIN - 6);
    const left = P(0, NJ);
    L.bx = even(left.x + 6); L.by = even(left.y + 34);
    L.groveA = { x: -60, y: even(L.sy - 210) };
    L.groveB = { x: even(w - images.empressGrove.width * GRAIN + 40), y: even(L.sy + 200) };
    if (`${w}x${h}` !== bgKey) { bgKey = `${w}x${h}`; bg = buildBackground(w, h); }
  }

  /** Фон, рамка вокруг блока и дорожка — один раз на размер экрана. */
  function buildBackground(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    for (let ay = 0; ay < h / 2; ay++) {
      for (let ax = 0; ax < w / 2; ax++) {
        const v = 0.2 + 2.0 * (ay * 2 / h);
        const lo = Math.min(RAMP.length - 1, Math.floor(v));
        const k = lo + 1 < RAMP.length && (v - lo) * 16 > BAYER[ay % 4][ax % 4] + 0.5 ? lo + 1 : lo;
        g.fillStyle = RAMP[k];
        g.fillRect(ax * 2, ay * 2, 2, 2);
      }
    }
    const ring = images.empressPlotsRing;
    g.drawImage(ring, L.sx - 2 * U, L.sy - U, ring.width * GRAIN, ring.height * GRAIN);
    const T = P(0, 0), B = P(NI, NJ);
    drawPath(g, w, h, [
      { x: 70, y: L.sy - 80 }, { x: 150, y: L.sy - 30 }, { x: T.x - 30, y: T.y + 10 }, T, B,
      { x: B.x - 20, y: B.y + 70 }, { x: 150, y: L.sy + 350 }, { x: 210, y: h + 30 },
    ]);
    return c;
  }

  function drawPath(g, w, h, pts) {
    const P4 = [pts[0], ...pts, pts[pts.length - 1]];
    const line = [];
    for (let i = 1; i < P4.length - 2; i++) {
      const [p0, p1, p2, p3] = [P4[i - 1], P4[i], P4[i + 1], P4[i + 2]];
      for (let k = 0; k < 12; k++) {
        const t = k / 12, t2 = t * t, t3 = t2 * t;
        const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        line.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) });
      }
    }
    line.push(pts[pts.length - 1]);
    const r = rand(9);
    const half = PATH_W / 2;
    for (let ay = 0; ay < h / 2; ay++) {
      for (let ax = 0; ax < w / 2; ax++) {
        const x = ax * 2 + 1, y = ay * 2 + 1;
        let d2 = Infinity;
        for (const p of line) { const dx = x - p.x, dy = y - p.y; const q = dx * dx + dy * dy; if (q < d2) d2 = q; }
        const d = Math.sqrt(d2);
        if (d > half + 6) continue;
        let c;
        if (d <= half) c = r() > 0.08 ? PATH_TONE : PEBBLES[Math.floor(r() * PEBBLES.length)];
        else if ((1 - (d - half) / 6) * 16 > BAYER[ay % 4][ax % 4] + 0.5) c = PATH_EDGE;
        else continue;
        g.fillStyle = c;
        g.fillRect(ax * 2, ay * 2, 2, 2);
      }
    }
  }

  const draw = (ctx, img, x, y) => ctx.drawImage(img, even(x), even(y), img.width * GRAIN, img.height * GRAIN);

  /** Растение стоит основанием в точке (x, y). p < 1 — проявляется пикселями. */
  function drawPlant(ctx, img, x, y, p = 1) {
    const pw = img.width * GRAIN, ph = img.height * GRAIN;
    const px = even(x - pw / 2), py = even(y - ph + 8);
    if (p >= 1) ctx.drawImage(img, px, py, pw, ph);
    else drawPixelReveal(ctx, img, px, py, pw, ph, p, 2, 0.5, 1, 0.2);
  }

  return {
    L, place,
    drawBack(ctx, wet) {
      ctx.drawImage(bg, 0, 0);
      draw(ctx, images.empressGrove, L.groveA.x, L.groveA.y);
      draw(ctx, wet ? images.empressPlotsWet : images.empressPlotsDry, L.sx, L.sy);
    },
    drawPlant,
    drawFront(ctx) {
      draw(ctx, images.empressBasket, L.bx, L.by);
      draw(ctx, images.empressParasol, L.px, L.py);
      ctx.drawImage(images.empressFigure, L.ex, L.ey, L.empW, L.empH);
      const gb = images.empressGrove;
      ctx.save();
      ctx.translate(L.groveB.x + gb.width * GRAIN, L.groveB.y);
      ctx.scale(-1, 1);
      ctx.drawImage(gb, 0, 0, gb.width * GRAIN, gb.height * GRAIN);
      ctx.restore();
    },
    /** Попал ли палец в Императрицу (с запасом — прощает). */
    hitEmpress(x, y) {
      return x > L.ex - 16 && x < L.ex + L.empW + 16 && y > L.ey - 16 && y < L.ey + L.empH + 16;
    },
  };
}

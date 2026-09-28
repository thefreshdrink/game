// Финальное падение Шута — три такта (BUILD-SPEC-03 задача 7): 'brace'
// (стоп-кадр обычной сцены, рисует leap.js) → 'fall' (полёт «сквозь миры»)
// → 'arrive' (проявление земли). Здесь — кадр тактов 2–3 и их визуал.

import { clamp01 } from '../../core/ease.js';
import { drawPixelReveal } from '../../core/pixelReveal.js';
import { drawPlatform, PLATE_H, ARRIVE_GROUND_FRAC } from './platforms.js';
import { drawArrivalLife } from './arrivalScene.js';
import { PLAYER_W, PLAYER_H, PAIR_W, DOG_W, DOG_H, IDLE_FPS } from './actors.js';

export const BRACE_DUR = 0.15;   // такт 1 — стоп-кадр
export const FALL_DUR = 4.0;     // такт 2 — полёт (правка в чате 2026-08-31: 2.8 → 4, «медленнее»)
export const ARRIVE_DUR = 1.0;   // такт 3 — проявление земли (правка в чате 2026-09-10: быстрее, «сразу потом предсказание»)

// Скорость «прокрутки мира» в полёте идёт по дуге sin(prog·π): мягкий
// разгон от V0, пик VPEAK в середине, плавное оседание к земле — полёт,
// а не обрыв (правка 2026-08-29: «падение обрывистое, хочется красивого
// полёта»).
const FALL_V0 = 100;      // экранных px/с в начале и в конце
const FALL_VPEAK = 480;   // на пике в середине (BUILD-SPEC-05 задача 5: 820→480, «падение перестаёт быть рывком»)

/** Состояние падения: прокрутка мира, темп потоков частиц и экранная точка
 * срыва — пара въезжает в центр кадра из неё, без скачка (правка в чате
 * 2026-08-30: «камера не движется за персонажем, появление резкое»). */
export function createFall() {
  return { scroll: 0, speed: 0, debrisT: 0, sparkT: 0, arriveDust: false, fromX: 0, fromY: 0 };
}

/** Сброс перед тактом 1; fromX/fromY — экранная позиция Шута у кромки. */
export function resetFall(fall, fromX = 0, fromY = 0) {
  Object.assign(fall, { scroll: 0, speed: 0, debrisT: 0, sparkT: 0, arriveDust: false, fromX, fromY });
}

/** Переход такт 1 → такт 2. */
export function startFlight(fall) {
  fall.speed = FALL_V0;
  fall.scroll = 0;
}

/** Такт 2 — полёт: мир едет вверх по дуге скорости; навстречу — редкие
 * обломки (быстро, вверх), медленные пылинки-мошки (долго живут, чуть
 * парят — от них полёт «дышит») и искры. true — полёт окончен. */
export function stepFlight(fall, stateT, dt, w, h, cam, particles) {
  const prog = clamp01(stateT / FALL_DUR);
  fall.speed = FALL_V0 + (FALL_VPEAK - FALL_V0) * Math.sin(prog * Math.PI);
  fall.scroll += fall.speed * dt;
  fall.debrisT -= dt;
  if (fall.debrisT <= 0) {
    fall.debrisT = 0.06 + Math.random() * 0.11;
    for (let i = 0, n = 1 + (Math.random() * 2 | 0); i < n; i++) {
      const mote = Math.random() < 0.5;
      particles.push({
        x: cam.x + Math.random() * (w || 430), y: cam.y + (h || 844) + 12,
        vx: (Math.random() - 0.5) * (mote ? 16 : 34),
        vy: mote ? -(45 + Math.random() * 80) : -(fall.speed * (0.55 + Math.random() * 0.7)),
        t: 0, life: mote ? (1.1 + Math.random() * 1.3) : (0.4 + Math.random() * 0.4),
        // крупнее (правка 2026-08-30): мошки 4, обломки 4–8
        s: mote ? 4 : (Math.random() < 0.5 ? 4 : 8),
        g: mote ? 12 : 220,
      });
    }
  }
  // Искры — яркие белые крупицы; ливень в момент удара молнии (начало),
  // дальше редкий ручеёк.
  const boltBurst = prog < 0.12;
  fall.sparkT -= dt;
  if (fall.sparkT <= 0) {
    fall.sparkT = boltBurst ? 0.02 : 0.12 + Math.random() * 0.14;
    for (let i = 0, n = boltBurst ? 6 : 1; i < n; i++) {
      particles.push({
        x: cam.x + Math.random() * (w || 430),
        y: cam.y + (h || 844) * (0.28 + Math.random() * 0.72),
        vx: (Math.random() - 0.5) * 150,
        vy: -(260 + Math.random() * 480),
        t: 0, life: 0.2 + Math.random() * 0.24,
        s: 2, g: 540, spark: true,
      });
    }
  }
  return stateT >= FALL_DUR;
}

// Финальное падение — кадры «сквозь миры» (правки в чате 2026-08-31):
// мягкий фон-дизер + звёзды, а по фазе полёта — молния (открывает) →
// месяц (крупный, вертится) → солнце → облака. Bayer 4×4 для дизера.
const FALL_BAYER = [
  [0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5],
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

// ── Визуал финального падения «сквозь миры» ──

// Пары тонов «миров», через которые падаешь (правка в чате 2026-09-10:
// вернули смену оттенков — «так было лучше»). Все — из «градаций
// пустоты» палитры. Тьма → чуть светлеет к середине → снова к тьме.
const FALL_WORLDS = [
  ['#000000', '#161616'],
  ['#161616', '#1C1C1C'],
  ['#1C1C1C', '#252525'],
  ['#212121', '#2E2E2E'],
  ['#161616', '#212121'],
  ['#000000', '#161616'],
];

/** Фон полёта — Bayer-дизер, где ОТТЕНКИ сменяются по фазе: текущий мир
 * плавно «перетекает» в следующий (диссолвом по порогу Bayer, без
 * вспышек и резкого шага). Узор ползёт вверх вместе с fallScroll. */
function drawFallWorld(ctx, w, h, prog, scroll) {
  const N = FALL_WORLDS.length;
  const wf = clamp01(prog) * (N - 1);
  const wi = Math.min(N - 1, Math.floor(wf));
  const frac = wf - wi;               // 0..1 — доля перехода в следующий мир
  const cur = FALL_WORLDS[wi];
  const nxt = FALL_WORLDS[Math.min(N - 1, wi + 1)];
  // Ячейка 2 — сетка сцены Шута. Узор 4×4 ячейки собирается один раз на
  // (мир, ступень перехода) и кладётся заливкой: по ячейке — это сотня
  // тысяч fillRect за кадр.
  const tile = FALL_CELL * 4;
  const yoff = ((Math.round(scroll * 0.4) % tile) + tile) % tile;
  ctx.save();
  ctx.fillStyle = fallPattern(ctx, wi, cur, nxt, Math.ceil(frac * 16));
  ctx.translate(0, yoff - tile);
  ctx.fillRect(0, 0, w, h + tile * 2);
  ctx.restore();
}

const FALL_CELL = 2;
const fallPatterns = new Map();

function fallPattern(ctx, wi, cur, nxt, level) {
  const key = `${wi}:${level}`;
  let p = fallPatterns.get(key);
  if (!p) {
    const c = document.createElement('canvas');
    c.width = c.height = FALL_CELL * 4;
    const g = c.getContext('2d');
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        const b = FALL_BAYER[row][col];
        const pair = b < level ? nxt : cur;   // диссолв: чем дальше переход, тем больше ячеек из nxt
        g.fillStyle = b < 8 ? pair[0] : pair[1];
        g.fillRect(col * FALL_CELL, row * FALL_CELL, FALL_CELL, FALL_CELL);
      }
    }
    p = ctx.createPattern(c, 'repeat');
    fallPatterns.set(key, p);
  }
  return p;
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

/** Месяц: крупнопиксельный шар в ВЕРХНЕЙ части кадра, быстрое появление и
 * уход, терминатор света/тени качается по фазе — «словно шар вертится».
 * Окно ~prog 0.14…0.44. Правка в чате 2026-09-10: меньше и выше, чтобы
 * пара Шут+пёс его не загораживала. */
function drawFallMoon(ctx, w, h, prog) {
  const P0 = 0.14, P1 = 0.44;
  if (prog < P0 || prog > P1) return;
  const local = (prog - P0) / (P1 - P0);
  const a = clamp01(local / 0.14) * (1 - clamp01((local - 0.82) / 0.18));
  if (a <= 0) return;
  const CELL = 2;                                  // сетка сцены Шута
  const R = Math.round((Math.min(w, h) * 0.15) / CELL) * CELL;
  const cx = Math.round(w / 2 / CELL) * CELL;
  const cy = Math.round((h * 0.19) / CELL) * CELL;
  const spin = local * Math.PI * 3;               // несколько «оборотов» за окно
  const term = Math.cos(spin) * R;               // граница тени по x
  const litLeft = Math.cos(spin) >= 0;
  ctx.save();
  ctx.globalAlpha = a;
  for (let dy = -R; dy <= R; dy += CELL) {
    const hw = Math.floor(Math.sqrt(Math.max(0, R * R - dy * dy)) / CELL) * CELL;
    for (let dx = -hw; dx <= hw; dx += CELL) {
      const lit = litLeft ? dx <= term : dx >= term;
      ctx.fillStyle = lit ? '#B8B8B8' : '#2E2E2E';
      ctx.fillRect(cx + dx, cy + dy, CELL, CELL);
    }
  }
  ctx.restore();
}

/** Солнце: крупнопиксельный яркий диск с вращающимися лучами. Окно ~prog
 * 0.44…0.82, после месяца. Правка в чате 2026-09-10: меньше и выше —
 * пара его не загораживает. */
function drawFallSun(ctx, w, h, prog, alphaMul = 1) {
  const P0 = 0.44, P1 = 0.82;
  if (prog < P0 || prog > P1) return;
  const local = (prog - P0) / (P1 - P0);
  const a = clamp01(local / 0.18) * (1 - clamp01((local - 0.85) / 0.15)) * alphaMul;
  if (a <= 0) return;
  const CELL = 2;                                  // сетка сцены Шута
  const R = Math.round((Math.min(w, h) * 0.10) / CELL) * CELL;
  const cx = Math.round(w / 2 / CELL) * CELL;
  const cy = Math.round((h * 0.20) / CELL) * CELL;
  ctx.save();
  ctx.globalAlpha = a;
  const rot = local * Math.PI * 0.8;
  ctx.fillStyle = '#808080';
  for (let i = 0; i < 12; i++) {
    const ang = rot + i * Math.PI / 6;
    for (let rr = R + 15; rr < R + 45; rr += CELL) {
      ctx.fillRect(
        Math.round((cx + Math.cos(ang) * rr) / CELL) * CELL,
        Math.round((cy + Math.sin(ang) * rr) / CELL) * CELL,
        CELL, CELL,
      );
    }
  }
  for (let dy = -R; dy <= R; dy += CELL) {
    const hw = Math.floor(Math.sqrt(Math.max(0, R * R - dy * dy)) / CELL) * CELL;
    ctx.fillStyle = '#B8B8B8';
    ctx.fillRect(cx - hw, cy + dy, hw * 2 + CELL, CELL);
    if (dy > -R + CELL && dy < 0) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(cx - hw + CELL, cy + dy, CELL * 2, CELL);
    }
  }
  ctx.restore();
}


/** Молния — открывает падение (правка в чате 2026-08-31: «сначала ударяет
 * молния»). Два коротких удара в первые ~0.1 prog. Ломаная сверху вниз:
 * 2px белое ядро + смещённый серый призрак + одна ветка. */
function drawFallBolts(ctx, w, h, prog, t) {
  const WINDOWS = [0.01, 0.07];
  for (let k = 0; k < WINDOWS.length; k++) {
    const d = prog - WINDOWS[k];
    if (d < 0 || d > 0.10) continue;
    const life = d / 0.10;
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
    // короткая вспышка кадра в момент удара
    if (life < 0.18) {
      ctx.globalAlpha = 0.28 * (1 - life / 0.18);
      ctx.fillStyle = '#B8B8B8';
      ctx.fillRect(0, 0, w, h);
    }
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

/** Три такта финального падения (задача 7): 'brace' (стоп-кадр) → 'fall'
 * (полёт) → 'arrive' (проявление земли). Фон уже залит #111111.
 *
 * Переделано в чате 2026-08-31: полёт 4 с, кадрами. Мягкий фон-дизер +
 * звёзды, а по фазе: молния открывает → крупный вертящийся месяц →
 * солнце с лучами → облака поверх солнца; на 'arrive' небо держится, и
 * предсказание проявляется поверх него. Пара Шут+пёс видна ВСЁ время. */
export function drawFallSequence(ctx, w, h, s) {
  const {
    state, stateT, t, images, groundStrip, fallScroll, fallFromX, fallFromY, camX, camY, player,
  } = s;
  const dust = s.dust;
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

    // Кадры падения (правка в чате 2026-09-10): фон — дизер, где ОТТЕНКИ
    // ПУСТОТЫ сменяются по фазе, «мир перетекает в другой мир» (вернули
    // прежнее поведение — так было лучше). По фазе: молния открывает →
    // месяц (крупный, вертится) → солнце. Облака в конце падения убраны.
    drawFallWorld(ctx, w, h, prog, fallScroll);
    drawFallStars(ctx, w, h, fallScroll, t);
    drawFallBolts(ctx, w, h, prog, t);
    drawFallMoon(ctx, w, h, prog);
    drawFallSun(ctx, w, h, prog);

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

  // arrive — «другой мир», БЫСТРО (правка в чате 2026-09-10, чтобы не
  // тянуло тапать): сперва плита + трава/кустик/лесенка, дальше сразу
  // предсказание с заголовком и солнцем (правка 2026-09-11: цветы и
  // мелькание солнца при приземлении убраны — солнце теперь только там).
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, w, h);
  const p = clamp01(stateT / ARRIVE_DUR);

  // Основная плита — быстро дотягивается.
  const mainP = clamp01(0.8 + 0.2 * (p / 0.3));
  drawPixelReveal(ctx, groundStrip, groundX, groundY, gw, PLATE_H, mainP, 4, 0.42, 0.4);
  // Жизнь на плите — сразу следом за плитой. Солнце здесь больше НЕ
  // мелькает (правка в чате 2026-09-11: «на секунду при приземлении» не
  // читалось) — целиком его дело теперь экран предсказания, где оно
  // проступает плавно вместе с заголовком (prediction.js).
  drawArrivalLife(ctx, groundX, gw, groundY, clamp01(p / 0.3));

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
      ctx.fillRect(Math.round((standCX + (d.x - player.x)) / 2) * 2, Math.round((groundY - (player.y - d.y)) / 2) * 2, d.s, d.s);
    });
  }
}

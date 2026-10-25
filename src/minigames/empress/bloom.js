// Экран 5 для карты The Empress — мини-игра «Bloom» (глагол карты, GDD §8.2).
//
// «Погода Императрицы» (docs/empress-proposal.md, 25.10): самая массовая
// ферма сейчас — Grow a Garden — в другом ключе. Кусты уже плодоносят,
// плоды собираешь свайпом в корзину, на месте сорванного завязывается
// новый. Погода идёт сама — ясно, дождь, луна — и меняет только то, что
// висит: дождь делает плод мокрым, луна — серебряным. Потом один плод
// становится золотым: первое в сцене, что зовёт руку (CLAUDE.md, золото).
//
// Удержание — один раз (GDD §8.1a): палец на золотом плоде, кольцо
// заполняется, мир стихает. Отпустить = не сорвать: плод остаётся на
// ветке, а по краям грядки сам встаёт сад, которого никто не сажал.
// Проиграть нельзя: сорвал всё — золото придёт к новому верхнему плоду.
//
// Такты: play (погода по кругу) → gold (ждёт удержания) → bloom (отпустил,
// сад встаёт) → экран 6.

import { defineMinigame } from '../../core/minigame.js';
import { drawTopHint, drawHintStack } from '../../core/hints.js';
import { drawHoldRing } from '../../core/gestureGlyph.js';
import { createParticles } from '../../core/juice.js';
import { uiScale } from '../../core/text.js';
import { clamp01 } from '../../core/ease.js';
import { drawPixelReveal } from '../../core/pixelReveal.js';
import { t as str } from '../../data/strings.js';
import { createGarden, GRAIN, PLAIN, WET } from './garden.js';
import { createSky, weatherAt } from './weather.js';

const PICK_R = 24;        // экранных px — зона касания шире плода (прощает)
const FLY_TIME = 0.5;     // с, полёт плода в корзину
const HOLD_TIME = 1.8;    // с, кольцо удержания на золотом плоде
const HOLD_DECAY = 1.5;   // как быстро кольцо стекает, если отпустил рано
const GOLD_GRAB_R = 34;   // зона касания золотого плода
const BLOOM_TIME = 2.6;   // сад встаёт по краям грядки
const BLOOM_HOLD = 1.6;   // тишина перед предсказанием

// Самосев на переднем крае грядки — растения, которых не сажали
// (изобилие). Тюльпан встаёт прямо под оставленным плодом: dx: null.
const VOLUNTEERS = [
  { img: 'empressTulip', dx: null, delay: 0 },
  { img: 'empressWheat', dx: -112, delay: 0.5 },
  { img: 'empressPomegranate', dx: 116, delay: 0.9 },
];

export function createBloomScene({ input, images, goto }) {
  const garden = createGarden();
  const sky = createSky();
  const leaves = createParticles();
  let phase = 'play';
  let tW = 0;          // время погоды
  let tPhase = 0;
  let t = 0;
  let flying = [];
  let last = null;     // прошлая точка пальца — свайп режет отрезком
  let pickedEver = false;
  let gold = null;
  let holding = false;
  let hold = 0;        // 0..1, кольцо удержания

  function pickAlong(ax, ay, bx, by) {
    garden.hitSegment(ax, ay, bx, by, PICK_R).forEach((f) => {
      const p = garden.pos(f);
      const img = f.state === WET ? 'empressFruitWet' : f.state > WET ? 'empressFruitMoon' : 'empressFruitPlain';
      if (!garden.pick(f)) return;
      pickedEver = true;
      flying.push({ x: p.x, y: p.y, k: 0, img });
      leaves.burst(p.x, p.y, 5, { spreadX: 80, liftY: 60, life: 0.4 });
    });
  }

  const nearGold = (e) => {
    if (!gold) return false;
    const p = garden.pos(gold);
    return Math.hypot(e.x - p.x, e.y - p.y) <= GOLD_GRAB_R;
  };

  return defineMinigame({ input, goto }, {
    enter() {
      garden.reset();
      sky.reset();
      leaves.clear();
      phase = 'play';
      tW = 0; tPhase = 0; t = 0;
      flying = [];
      last = null;
      pickedEver = false;
      gold = null;
      holding = false;
      hold = 0;
    },

    input: {
      pressstart(e) {
        if (phase === 'gold' && nearGold(e)) { holding = true; return; }
        if (phase === 'play' || phase === 'gold') {
          last = e;
          pickAlong(e.x, e.y, e.x, e.y);
        }
      },
      pressmove(e) {
        if (holding || !last) return;
        pickAlong(last.x, last.y, e.x, e.y);
        last = e;
      },
      pressend() {
        last = null;
        if (!holding) return;
        holding = false;
        // Решение: кольцо полное — отпустил, не сорвав.
        if (hold >= 1 && phase === 'gold') {
          gold.kept = true;
          phase = 'bloom'; tPhase = 0;
          leaves.burst(garden.pos(gold).x, garden.pos(gold).y, 10, { spreadX: 120, liftY: 90, life: 0.6 });
        }
      },
    },

    update(dt, w, h, finish) {
      garden.place(w, h);
      t += dt;
      tPhase += dt;
      const quiet = holding && hold >= 1;

      if (phase === 'play' || phase === 'gold') {
        if (!holding) tW += dt;
        const wx = weatherAt(tW);
        if (wx === 'rain') garden.weather(dt, PLAIN);
        if (wx === 'moon') garden.weather(dt, WET);
        if (wx === 'gold' && phase === 'play') { gold = garden.crownGold(); phase = 'gold'; tPhase = 0; }
      }
      if (phase === 'gold') {
        hold = holding ? Math.min(1, hold + dt / HOLD_TIME) : Math.max(0, hold - dt * HOLD_DECAY);
      }

      garden.step(dt);
      const wx = weatherAt(tW);
      sky.update(dt, w, garden.layout.gy, {
        raining: wx === 'rain' && !quiet,
        moonUp: wx === 'moon' || wx === 'gold',
      });
      leaves.update(dt);

      const b = garden.basketPos(images);
      flying.forEach((f) => { f.k += dt / FLY_TIME; });
      flying = flying.filter((f) => {
        if (f.k < 1) return true;
        garden.addToBasket();
        leaves.burst(b.x + 20, b.y + 4, 3, { spreadX: 40, liftY: 30, life: 0.3 });
        return false;
      });
      flying.forEach((f) => { f.tx = b.x + 20; f.ty = b.y; });

      if (phase === 'bloom' && tPhase > BLOOM_TIME + BLOOM_HOLD) finish();
    },

    draw(ctx, w, h) {
      ctx.fillStyle = '#111111';
      ctx.fillRect(0, 0, w, h);
      const { cx, gy } = garden.layout;

      // Небо фона непрозрачное (#111111), поэтому луна — поверх него.
      sky.drawBackdrop(ctx, images, w, h, gy);
      sky.drawMoon(ctx, images, w, h);
      sky.drawRain(ctx, images);

      garden.drawBed(ctx, images);
      garden.drawBushes(ctx, images);
      // Самосев встаёт после решения, перед кустами.
      if (phase === 'bloom') {
        VOLUNTEERS.forEach((v) => {
          const img = images[v.img];
          const vw = img.width * GRAIN, vh = img.height * GRAIN;
          const x = cx + (v.dx ?? gold.ox) - vw / 2;
          const p = clamp01((tPhase - v.delay) / (BLOOM_TIME - v.delay));
          drawPixelReveal(ctx, img, Math.round(x / 2) * 2, gy + 44 - vh, vw, vh, p, 2, 0.5, 1, 0.15);
        });
      }
      garden.drawFruits(ctx, images, t, (f) => (f === gold && holding && hold >= 1 ? 2 : 0));
      garden.drawBasket(ctx, images);

      flying.forEach((f) => {
        const img = images[f.img];
        const k = clamp01(f.k);
        const x = f.x + ((f.tx ?? f.x) - f.x) * k;
        const y = f.y + ((f.ty ?? f.y) - f.y) * k - Math.sin(k * Math.PI) * 60;
        const fw = img.width * GRAIN, fh = img.height * GRAIN;
        ctx.drawImage(img, Math.round((x - fw / 2) / 2) * 2, Math.round((y - fh / 2) / 2) * 2, fw, fh);
      });
      leaves.draw(ctx, 0, 0);

      const scale = uiScale(w, 1.15);
      if (phase === 'play' && !pickedEver) {
        drawTopHint(ctx, str('empress.gather'), { w, t, scale });
      }
      if (phase === 'gold') {
        const p = garden.pos(gold);
        drawHoldRing(ctx, p.x, p.y, hold, 1, 16);
        if (!holding) {
          drawHintStack(ctx, str('empress.hold'), { figX: p.x, headTop: p.y - 20, w, t: tPhase, scale });
        }
      }
    },
  });
}

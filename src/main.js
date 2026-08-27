// Точка входа: canvas, ввод, роутер сцен, игровой цикл.
//
// BUILD-SPEC.md, шаг 2 — экраны 1–4 (вопрос, веер, вытягивание, раскрытие)
// с заглушкой вместо мини-игры. Заглушка на экране 4 замыкает цикл сама на
// себя (экран 1), потому что экранов 5–6 ещё нет.

import { createCanvas } from './core/canvas.js';
import { createInput } from './core/input.js';
import { loadSprites, sliceStrip } from './core/sprites.js';
import { CARDS } from './data/cards.js';
import { createQuestionScreen } from './screens/question.js';
import { createDeckScreen } from './screens/deck.js';
import { createDrawScreen } from './screens/draw.js';
import { createRevealScreen } from './screens/reveal.js';
import { createLeapScreen } from './minigames/fool/leap.js';
import { createPredictionScreen } from './screens/prediction.js';

const canvasEl = document.getElementById('game');
const screen = createCanvas(canvasEl);
const input = createInput(canvasEl);

// --- Роутер сцен ------------------------------------------------------
// Сцена: { enter(prevName), exit(), update(dt), draw(ctx, w, h) }.
// enter/exit/update — опциональны.

const scenes = {};
let current = null;
let currentName = null;

function registerScene(name, scene) {
  scenes[name] = scene;
}

function goto(name) {
  if (!scenes[name]) {
    console.warn(`[router] unknown scene "${name}", available:`, Object.keys(scenes));
    return;
  }
  current?.exit?.();
  const prevName = currentName;
  currentName = name;
  current = scenes[name];
  current.enter?.(prevName);
  console.log(`[router] → ${name}`);
}

// Отладочные хуки — переключение сцен без UI, по заданию BUILD-SPEC.
window.gameGoto = goto;
window.gameScenes = () => Object.keys(scenes);
window.gameCurrentScene = () => currentName;

// --- Тестовая сцена: ввод (осталась с шага 1, доступна из консоли) -------

registerScene('boot', {
  taps: 0,
  lastSwipe: null,
  holding: false,
  holdProgress: 0,
  offHandlers: [],

  enter() {
    this.taps = 0;
    this.lastSwipe = null;
    this.holding = false;
    this.holdProgress = 0;
    this.offHandlers = [
      input.on('tap', () => { this.taps++; }),
      input.on('swipe', (e) => { this.lastSwipe = e; }),
      input.on('holdstart', () => { this.holding = true; this.holdProgress = 0; }),
      input.on('holdmove', (e) => { this.holdProgress = Math.min(e.duration / 2600, 1); }),
      input.on('holdend', () => { this.holding = false; this.holdProgress = 0; }),
    ];
  },

  exit() {
    this.offHandlers.forEach((off) => off());
    this.offHandlers = [];
  },

  draw(ctx, w, h) {
    ctx.fillStyle = '#111111';
    ctx.fillRect(0, 0, w, h);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '28px Alagard, serif';
    ctx.fillText('TAROT JOURNEY', w / 2, h * 0.28);

    ctx.fillStyle = '#B8B8B8';
    ctx.font = '14px "Pixelify Sans", monospace';
    ctx.fillText('input test scene', w / 2, h * 0.28 + 26);
    ctx.fillText(`bank: ${CARDS.fool.name} loaded`, w / 2, h * 0.28 + 46);

    ctx.fillStyle = '#EBA331';
    ctx.font = '16px "Pixelify Sans", monospace';
    ctx.fillText('tap / swipe / hold to test input', w / 2, h * 0.5);
    ctx.fillText(`taps: ${this.taps}`, w / 2, h * 0.5 + 24);

    if (this.lastSwipe) {
      const s = this.lastSwipe;
      ctx.fillText(
        `swipe dx:${s.dx.toFixed(0)} dy:${s.dy.toFixed(0)} up:${s.up.toFixed(2)} side:${s.side.toFixed(2)}`,
        w / 2, h * 0.5 + 44,
      );
    }

    const barW = w * 0.6, barX = w * 0.2, barY = h * 0.62;
    ctx.strokeStyle = '#FFFFFF';
    ctx.strokeRect(barX, barY, barW, 12);
    if (this.holding) {
      ctx.fillStyle = '#EBA331';
      ctx.fillRect(barX, barY, barW * this.holdProgress, 12);
    }

    ctx.fillStyle = '#808080';
    ctx.font = '11px "Pixelify Sans", monospace';
    ctx.fillText('console: gameGoto("question")', w / 2, h - 30);
  },
});

// --- Сцена загрузки -------------------------------------------------------

registerScene('loading', {
  failed: null,
  draw(ctx, w, h) {
    ctx.fillStyle = '#111111';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = this.failed ? '#EBA331' : '#B8B8B8';
    ctx.font = '14px "Pixelify Sans", monospace';
    ctx.fillText(this.failed ? `sprite load failed: ${this.failed}` : 'loading…', w / 2, h / 2);
  },
});

goto('loading');

// --- Экраны 1–4 -------------------------------------------------------

const IMAGE_MANIFEST = {
  futureTellerBody: 'assets/future_teller/oracle_body.png',
  futureTellerEyes: 'assets/future_teller/oracle_eyes.png',
  cardBack: 'assets/card/back_side_card_final.png',
  cardSelectFrame: 'assets/card/select_frame.png',
  cardFront: 'assets/card/card_frame_fool.png',
  foolOnCard: 'assets/card/fool_on_the_card.png',
  foolIdleStrip: 'assets/fool/strips/fool_idle_4f_44x48.png',
  foolRise: 'assets/fool/strips/fool_rise_1f_44x48.png',
  foolFall: 'assets/fool/strips/fool_fall_1f_44x48.png',
  foolDogFall: 'assets/fool/strips/fool_dog_fall_1f_48x48.png',
  roadBlock: 'assets/road/frame_block_native.png',
  dogWalkStrip: 'assets/dog/strips/dog_walk_3f_18x14.png',
  dogSitStrip: 'assets/dog/strips/dog_sit_2f_18x14.png',
  dogLookDown: 'assets/dog/strips/dog_look_down_1f_18x14.png',
  dogJump: 'assets/dog/strips/dog_jump_1f_18x14.png',
};

loadSprites(IMAGE_MANIFEST).then((images) => {
  images.dogWalkFrames = sliceStrip(images.dogWalkStrip, 18, 14);
  images.dogSitFrames = sliceStrip(images.dogSitStrip, 18, 14);
  images.foolIdleFrames = sliceStrip(images.foolIdleStrip, 44, 48);

  const deps = { input, images, goto };
  registerScene('question', createQuestionScreen(deps));
  registerScene('deck', createDeckScreen(deps));
  registerScene('draw', createDrawScreen(deps));
  registerScene('reveal', createRevealScreen(deps));
  registerScene('leap', createLeapScreen(deps));
  registerScene('prediction', createPredictionScreen(deps));
  goto('question');
}).catch((err) => {
  scenes.loading.failed = err.message;
  console.error(err);
});

// --- Игровой цикл -------------------------------------------------------

let lastTime = performance.now();
function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  current?.update?.(dt, screen.width, screen.height);
  current?.draw?.(screen.ctx, screen.width, screen.height);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

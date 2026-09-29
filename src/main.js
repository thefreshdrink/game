// Точка входа: canvas, ввод, роутер сцен, загрузка картинок, игровой цикл.
//
// Ритуал — шесть экранов: вопрос → веер → вытягивание → раскрытие →
// мини-игра карты → предсказание. Мини-игры приходят из реестра
// (minigames/index.js) вместе со своими картинками — здесь о них ничего не
// знают.

import { createCanvas } from './core/canvas.js';
import { createInput } from './core/input.js';
import { loadSprites } from './core/sprites.js';
import { CARDS, cardArt } from './data/cards.js';
import { createQuestionScreen } from './screens/question.js';
import { createDeckScreen } from './screens/deck.js';
import { createDrawScreen } from './screens/draw.js';
import { createRevealScreen } from './screens/reveal.js';
import { createPredictionScreen } from './screens/prediction.js';
import { MINIGAMES } from './minigames/index.js';

const canvasEl = document.getElementById('game');
const screen = createCanvas(canvasEl);
const input = createInput(canvasEl);

// --- Роутер сцен ------------------------------------------------------
// Сцена: { enter(prevName), exit(), update(dt, w, h), draw(ctx, w, h) }.
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
  if (import.meta.env.DEV) console.log(`[router] → ${name}`);
}

// Отладочные хуки — переключение сцен из консоли: gameGoto('leap').
window.gameGoto = goto;
window.gameScenes = () => Object.keys(scenes);
window.gameCurrentScene = () => currentName;

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

// --- Картинки -------------------------------------------------------------
// Общие для ритуала + портрет каждой карты (путь выводится из id) + то, что
// объявила каждая мини-игра. Совпавший ключ с другим путём — ошибка: одна
// картинка молча подменила бы другую.

const RITUAL_IMAGES = {
  futureTellerBody: 'assets/future_teller/oracle_body.png',
  futureTellerEyes: 'assets/future_teller/oracle_eyes.png',
  cardBack: 'assets/card/back_side_card_final.png',
  cardSelectFrame: 'assets/card/select_frame.png',
  cardFront: 'assets/card/card_frame_fool.png',
};

function buildManifest() {
  const manifest = { ...RITUAL_IMAGES };
  const add = (key, path, from) => {
    if (manifest[key] && manifest[key] !== path) throw new Error(`image key "${key}" (${from}) уже занят`);
    manifest[key] = path;
  };
  Object.values(CARDS).forEach((c) => { const a = cardArt(c.id); add(a.key, a.path, `card ${c.id}`); });
  Object.values(MINIGAMES).forEach((m) => {
    Object.entries(m.assets ?? {}).forEach(([k, p]) => add(k, p, `minigame ${m.verb}`));
  });
  return manifest;
}

// --- Шрифты --------------------------------------------------------------
// canvas не ждёт @font-face: шрифт грузится при первом fillText и до того
// рисуется запасным (номер на карте проступал чужим шрифтом — правка
// 29.09). Грузим все три вместе с картинками, до первого экрана. Вес 500
// — роли cardNumeral/cardName (text.js).
const FONTS = ['16px Kingdom', '16px Alagard', '500 16px Alagard', '16px "Pixelify Sans"', '700 16px "Pixelify Sans"'];
const loadFonts = () => Promise.all(FONTS.map((f) => document.fonts.load(f)));

Promise.all([loadSprites(buildManifest()), loadFonts()]).then(([images]) => {
  Object.values(MINIGAMES).forEach((m) => m.prepare?.(images));
  const deps = { input, images, goto };
  registerScene('question', createQuestionScreen(deps));
  registerScene('deck', createDeckScreen(deps));
  registerScene('draw', createDrawScreen(deps));
  registerScene('reveal', createRevealScreen(deps));
  Object.values(MINIGAMES).forEach((m) => registerScene(m.verb, m.createScene(deps)));
  registerScene('prediction', createPredictionScreen(deps));
  goto('question');
}).catch((err) => {
  scenes.loading.failed = err.message;
  console.error(err);
});

// --- Игровой цикл -------------------------------------------------------

let lastTime = performance.now();
function frame(dt) {
  current?.update?.(dt, screen.width, screen.height);
  current?.draw?.(screen.ctx, screen.width, screen.height);
}
function loop(now) {
  frame(Math.min((now - lastTime) / 1000, 0.1));
  lastTime = now;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Отладка, как gameGoto: n кадров по 1/60 с мимо requestAnimationFrame —
// прогон петли в скрытой вкладке, где браузер кадры не выдаёт.
window.gameStep = (n = 1) => { for (let i = 0; i < n; i++) frame(1 / 60); };

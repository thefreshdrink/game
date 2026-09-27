#!/usr/bin/env node
// Заготовка мини-игры новой карты: папка src/minigames/<карта>/ с паспортом
// (index.js) и сценой на каркасе core/minigame.js. Реестр найдёт папку сам —
// после запуска карта уже проходится: тап по экрану ведёт к предсказанию.
// Дальше в сцене пишется только механика.
//
//   npm run new-minigame -- empress bloom
//   node tools/new-minigame.mjs empress bloom
//
// Глагол должен совпадать с `minigame` карты в src/data/cards.js — иначе
// скрипт откажет: карта не найдёт свою сцену.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [cardId, verb] = process.argv.slice(2);

function fail(msg) {
  console.error(`new-minigame: ${msg}`);
  process.exit(1);
}

if (!cardId || !verb) fail('нужно два аргумента: <карта> <глагол>, например: empress bloom');
if (!/^[a-z]+$/.test(cardId) || !/^[a-z]+$/.test(verb)) fail('карта и глагол — латиница в нижнем регистре');

const cards = readFileSync(join(root, 'src/data/cards.js'), 'utf8');
const entry = cards.match(new RegExp(`\\n  ${cardId}: \\{[\\s\\S]*?\\n  \\},`));
if (!entry) fail(`карты "${cardId}" нет в src/data/cards.js — сначала запись карты с текстами`);
const declared = entry[0].match(/minigame: '(\w+)'/)?.[1];
if (declared !== verb) fail(`у карты "${cardId}" minigame: '${declared}', а не '${verb}'`);

const dir = join(root, 'src/minigames', cardId);
if (existsSync(dir)) fail(`${dir} уже есть`);

const Verb = verb[0].toUpperCase() + verb.slice(1);

const indexJs = `// ${cardId} — мини-игра «${Verb}». Паспорт для реестра (minigames/index.js).

import { create${Verb}Scene } from './${verb}.js';

export default {
  verb: '${verb}',

  // { ключ: 'assets/${cardId}/файл.png' } — картинки сцены; ключи не должны
  // совпадать с чужими (main.js откажет при загрузке).
  assets: {},

  // prepare(images) { … } — нарезка лент после загрузки, если нужна.

  createScene: create${Verb}Scene,

  // createAfterscene({ images }) → { enter?, exit?, draw(ctx, w, h, t) } —
  // что остаётся под текстом предсказания. Нет — низ экрана пустой.
};
`;

const sceneJs = `// Экран 5 для карты ${cardId} — мини-игра «${Verb}» (глагол карты, GDD §8.2).
// ЗАГОТОВКА: тап по экрану ведёт к предсказанию. Механику пишем здесь;
// общее (камера, частицы, вспышка, дрожь, подсказки) — из src/core/.

import { defineMinigame } from '../../core/minigame.js';
import { drawTopHint } from '../../core/hints.js';
import { uiScale } from '../../core/text.js';

export function create${Verb}Scene({ input, images, goto }) {
  let t = 0;
  let done = false;

  return defineMinigame({ input, goto }, {
    enter() {
      t = 0;
      done = false;
    },

    input: {
      tap() { done = true; },
    },

    update(dt, w, h, finish) {
      t += dt;
      if (done) finish();
    },

    draw(ctx, w, h) {
      ctx.fillStyle = '#111111';
      ctx.fillRect(0, 0, w, h);
      drawTopHint(ctx, '${verb.toUpperCase()} — TAP', { w, t, scale: uiScale(w) });
    },
  });
}
`;

mkdirSync(dir);
writeFileSync(join(dir, 'index.js'), indexJs);
writeFileSync(join(dir, `${verb}.js`), sceneJs);
console.log(`готово: src/minigames/${cardId}/index.js, src/minigames/${cardId}/${verb}.js`);
console.log(`проверка: npm run dev → в консоли gameGoto('${verb}')`);

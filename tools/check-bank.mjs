#!/usr/bin/env node
// Банк предсказаний у проходимых карт — без дыр (BUILD-SPEC-07 задача 4).
//
// Проходимая карта — та, у которой есть своя сцена: папка
// src/minigames/<карта>/index.js с `verb`, равным `minigame` карты
// (так её находит реестр minigames/index.js). Такая карта попадает в
// раздачу, и у неё в `reading` должны быть все категории из CATEGORIES:
// непустая строка без пометки TODO. Иначе — строка с картой и категорией,
// выход с кодом 1. Карты без сцены в раздачу не попадают и не проверяются.
//
//   npm run check-bank
//   node tools/check-bank.mjs

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { CARDS, CATEGORIES } = await import(pathToFileURL(join(root, 'src/data/cards.js')).href);

// Глаголы сцен читаются из текста паспорта, а не импортом: index.js тянет
// за собой canvas и картинки, которых в node нет.
const scenes = join(root, 'src/minigames');
const verbs = new Set();
for (const dir of readdirSync(scenes, { withFileTypes: true })) {
  const file = join(scenes, dir.name, 'index.js');
  if (!dir.isDirectory() || !existsSync(file)) continue;
  const m = readFileSync(file, 'utf8').match(/\bverb:\s*['"]([a-z]+)['"]/);
  if (m) verbs.add(m[1]);
}

const bad = [];
const playable = Object.entries(CARDS).filter(([, card]) => verbs.has(card.minigame));
for (const [id, card] of playable) {
  for (const cat of CATEGORIES) {
    const text = card.reading?.[cat];
    if (typeof text !== 'string' || !text.trim()) bad.push(`${id}.reading.${cat}: нет текста`);
    else if (/TODO/.test(text)) bad.push(`${id}.reading.${cat}: помечен TODO`);
  }
}

for (const line of bad) console.error(`check-bank: ${line}`);
console.log(`check-bank: проходимых карт ${playable.length} (${playable.map(([id]) => id).join(', ')}), ` +
  `текстов ${playable.length * CATEGORIES.length - bad.length} из ${playable.length * CATEGORIES.length} в порядке`);
if (bad.length) process.exit(1);

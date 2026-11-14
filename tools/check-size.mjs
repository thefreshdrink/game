#!/usr/bin/env node
// Размер модулей — правило CLAUDE.md: файл больше ~400 строк — повод разделить.
//
// Печатает файлы src/ и tools/ (.js/.mjs) длиннее порога и пять самых
// длинных под ним. Сборку не роняет: это напоминание, а не запрет —
// когда делить, решает человек. Порог можно сменить аргументом.
//
//   npm run check-size
//   node tools/check-size.mjs [порог]

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const limit = Number(process.argv[2]) || 400;

function* jsFiles(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* jsFiles(p);
    else if (/\.m?js$/.test(e.name)) yield p;
  }
}

const sizes = [];
for (const dir of ['src', 'tools']) {
  for (const f of jsFiles(join(root, dir))) {
    const text = readFileSync(f, 'utf8');
    const lines = text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
    sizes.push([relative(root, f), lines]);
  }
}
sizes.sort((a, b) => b[1] - a[1]);

const over = sizes.filter(([, n]) => n > limit);
const near = sizes.filter(([, n]) => n <= limit).slice(0, 5);
if (over.length) {
  console.warn(`check-size: длиннее ${limit} строк — повод разделить (CLAUDE.md):`);
  for (const [f, n] of over) console.warn(`  ${f}: ${n}`);
} else {
  console.log(`check-size: файлов длиннее ${limit} строк нет; ближе всех ${near.map(([f, n]) => `${f} (${n})`).join(', ')}`);
}

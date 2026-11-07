#!/usr/bin/env node
// Строки интерфейса — у каждого вызова есть строка в словаре.
//
// Экраны берут строки через `t(key)` из src/data/strings.js (в файлах —
// `str`). Если ключа нет, `t()` бросает ошибку уже в браузере, а на экране 1
// это случается при загрузке модуля — игра не стартует вовсе. Здесь то же
// ловится при сборке: каждый `str('…')` / `t('…')` в src/ ищется в EN.
// Ключ не строкой (собран в рантайме) проверить нельзя — это тоже ошибка.
// Ключи EN, которых никто не зовёт, и ключи других языков, которых нет в EN
// или не хватает относительно EN, печатаются предупреждением, сборку не роняют.
//
//   npm run check-strings
//   node tools/check-strings.mjs

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stringsFile = join(root, 'src/data/strings.js');
const { DICTS } = await import(pathToFileURL(stringsFile).href);
const EN = DICTS.en;

function* jsFiles(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* jsFiles(p);
    else if (e.name.endsWith('.js')) yield p;
  }
}

const bad = [];
const used = new Set();
let calls = 0;
for (const file of jsFiles(join(root, 'src'))) {
  if (file === stringsFile) continue;
  const text = readFileSync(file, 'utf8');
  // имя, под которым t импортирован в этом файле: `t` или `t as str`
  const imp = text.match(/import\s*\{([^}]*)\}\s*from\s*['"][./]*\/?(?:data\/)?strings\.js['"]/);
  if (!imp) continue;
  const alias = imp[1].match(/\bt(?:\s+as\s+(\w+))?\b/);
  if (!alias) continue;
  const name = alias[1] ?? 't';
  text.split('\n').forEach((line, i) => {
    for (const m of line.matchAll(new RegExp(`(?<![\\w.])${name}\\(\\s*([^)]*)`, 'g'))) {
      calls++;
      const where = `${relative(root, file)}:${i + 1}`;
      const lit = m[1].match(/^(['"])([^'"]+)\1\s*$/);
      if (!lit) { bad.push(`${where}: ключ не строкой — ${name}(${m[1].trim()})`); continue; }
      used.add(lit[2]);
      if (!(lit[2] in EN)) bad.push(`${where}: нет строки «${lit[2]}» в EN`);
    }
  });
}

for (const key of Object.keys(EN)) {
  if (!used.has(key)) console.warn(`check-strings: предупреждение — «${key}» в EN никто не зовёт`);
}
for (const [lang, dict] of Object.entries(DICTS)) {
  if (lang === 'en') continue;
  for (const key of Object.keys(dict)) if (!(key in EN)) console.warn(`check-strings: предупреждение — ${lang}: «${key}» нет в EN`);
  const missing = Object.keys(EN).filter((k) => !(k in dict));
  if (missing.length) console.warn(`check-strings: предупреждение — ${lang}: без перевода ${missing.length} (${missing.join(', ')}), берётся EN`);
}

for (const line of bad) console.error(`check-strings: ${line}`);
console.log(`check-strings: вызовов ${calls}, ключей в EN ${Object.keys(EN).length}, ` +
  `в порядке ${calls - bad.length} из ${calls}`);
if (bad.length) process.exit(1);

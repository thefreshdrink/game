// Тесты «картинка на месте»: каждый путь к ассету, который игра попросит
// в рантайме, лежит в public/. Без браузера: node:test. Запуск — `npm test`.
//
// Битый путь сам по себе не роняет `npm run build` (vite не знает о строках
// 'assets/...'), а в игре даёт пустое место или зависшую загрузку — раньше
// это ловил только ночной прогон в браузере. Здесь проверяется до него:
//   1. паспорта мини-игр (src/minigames/<карта>/index.js) — их `assets`,
//      включая пути, собранные в коде (облака, плиты дороги, бруски башни);
//   2. портрет каждой карты из CARDS — путь выводится из id (`cardArt`);
//   3. каждая строка 'assets/...' в src/ без подстановок ${...}.
// И заодно: папка паспорта названа id карты, а его `verb` равен её `minigame`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'public');
const missing = (paths) => paths.filter((p) => !existsSync(join(pub, p)));

// sprites.js читает константу, которую vite подставляет при сборке
globalThis.__ASSET_VERSION__ = 'test';

const { CARDS, cardArt } = await import(pathToFileURL(join(root, 'src/data/cards.js')).href);

const scenesDir = join(root, 'src/minigames');
const passports = [];
for (const d of readdirSync(scenesDir, { withFileTypes: true })) {
  const file = join(scenesDir, d.name, 'index.js');
  if (!d.isDirectory() || !existsSync(file)) continue;
  passports.push({ id: d.name, m: (await import(pathToFileURL(file).href)).default });
}

function jsFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? jsFiles(p) : e.name.endsWith('.js') ? [p] : [];
  });
}

test('паспорта найдены: папка = id карты, verb = её minigame, есть сцена', () => {
  assert.ok(passports.length >= 3, `паспортов найдено ${passports.length}`);
  for (const { id, m } of passports) {
    assert.ok(CARDS[id], `src/minigames/${id}/: карты с id "${id}" нет в cards.js`);
    assert.equal(m.verb, CARDS[id].minigame, `src/minigames/${id}/: verb не совпадает с minigame карты`);
    assert.equal(typeof m.createScene, 'function', `src/minigames/${id}/: нет createScene`);
  }
});

test('все картинки из паспортов мини-игр лежат в public/', () => {
  // Пустой assets допустим: так выглядит свежая заготовка из
  // `npm run new-minigame` — она проходится тапом, картинок у неё ещё нет.
  let total = 0;
  for (const { id, m } of passports) {
    assert.equal(typeof (m.assets ?? {}), 'object', `src/minigames/${id}/: assets не объект`);
    const paths = Object.values(m.assets ?? {});
    total += paths.length;
    assert.deepEqual(missing(paths), [], `src/minigames/${id}/: нет файлов`);
  }
  assert.ok(total > 0, 'ни у одного паспорта нет картинок — пути не прочитались');
});

test('у каждой карты из CARDS есть портрет', () => {
  const paths = Object.keys(CARDS).map((id) => cardArt(id).path);
  assert.ok(paths.length >= 5);
  assert.deepEqual(missing(paths), []);
});

test("каждая строка 'assets/...' в src/ указывает на файл", () => {
  const found = [];
  for (const f of jsFiles(join(root, 'src'))) {
    const src = readFileSync(f, 'utf8');
    for (const [, p] of src.matchAll(/['"`](assets\/[^'"`]+)['"`]/g)) {
      if (!p.includes('${')) found.push(`${p}  ← ${relative(root, f)}`);
    }
  }
  assert.ok(found.length >= 20, `строк найдено подозрительно мало: ${found.length}`);
  const bad = found.filter((s) => !existsSync(join(pub, s.split('  ← ')[0])));
  assert.deepEqual(bad, []);
});

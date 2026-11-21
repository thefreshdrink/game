// Тесты заготовки мини-игры (`npm run new-minigame -- <карта> <глагол>`).
//
// Шаг 3 из CLAUDE.md обещает: после заготовки карта сразу проходится.
// До 07.11 это было не так — свежая заготовка роняла и `npm test` (пустой
// assets, строка 'assets/...' в комментарии), и `npm run build` (длинное
// тире в подсказке, check-glyphs). Здесь скрипт запускается на копии src/
// во временной папке, рабочее дерево не трогается.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// копия: tools/new-minigame.mjs + src/ (скрипт ищет корень от своего файла)
function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'new-minigame-'));
  cpSync(join(root, 'tools/new-minigame.mjs'), join(dir, 'tools/new-minigame.mjs'));
  cpSync(join(root, 'src'), join(dir, 'src'), { recursive: true });
  return dir;
}

const run = (dir, ...args) =>
  spawnSync(process.execPath, [join(dir, 'tools/new-minigame.mjs'), ...args], { encoding: 'utf8' });

const { CARDS } = await import(pathToFileURL(join(root, 'src/data/cards.js')).href);
const scenes = new Set(readdirSync(join(root, 'src/minigames')));
// карта без своей сцены — на ней и пробуем; если таких нет, тест не о чем
const free = Object.keys(CARDS).find((id) => !scenes.has(id));

test('заготовка: паспорт и сцена создаются, паспорт годится реестру', { skip: !free && 'у всех карт есть сцена' }, async () => {
  const dir = sandbox();
  try {
    const verb = CARDS[free].minigame;
    const r = run(dir, free, verb);
    assert.equal(r.status, 0, r.stderr);
    const folder = join(dir, 'src/minigames', free);
    assert.deepEqual(readdirSync(folder).sort(), [`${verb}.js`, 'index.js'].sort());

    // импорт тянет настоящие core/minigame.js, core/hints.js, core/text.js —
    // значит, имена, которые зовёт заготовка, там есть
    const m = (await import(pathToFileURL(join(folder, 'index.js')).href)).default;
    assert.equal(m.verb, verb);
    assert.equal(typeof m.createScene, 'function');
    assert.deepEqual(m.assets, {});

    // то, на чём заготовка роняла проверки
    const text = readFileSync(join(folder, 'index.js'), 'utf8') + readFileSync(join(folder, `${verb}.js`), 'utf8');
    assert.doesNotMatch(text, /['"`]assets\//, 'строка в кавычках с assets/ — assets.test.mjs примет её за путь');
    const hint = text.match(/drawTopHint\(ctx, '([^']*)'/)?.[1];
    assert.ok(hint, 'нет подсказки drawTopHint');
    assert.match(hint, /^[\x20-\x7e]+$/, `в подсказке не ASCII: «${hint}» — check-glyphs не поймёт шрифт`);
    for (const c of text.match(/#[0-9a-fA-F]{6}\b/g) ?? []) assert.equal(c.toUpperCase(), '#111111', `цвет ${c}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('заготовка: отказы — ничего не создаётся, код выхода не 0', { skip: !free && 'у всех карт есть сцена' }, () => {
  const dir = sandbox();
  try {
    const before = readdirSync(join(dir, 'src/minigames')).sort();
    const cases = [
      [],                                   // без аргументов
      [free, 'Wrong'],                      // не латиница в нижнем регистре
      ['nosuchcard', 'leap'],               // карты нет в cards.js
      [free, CARDS[free].minigame + 'x'],   // глагол не тот, что у карты
      ['fool', CARDS.fool.minigame],        // папка уже есть
    ];
    for (const args of cases) {
      const r = run(dir, ...args);
      assert.notEqual(r.status, 0, `ждали отказ: ${args.join(' ')}`);
      assert.match(r.stderr, /^new-minigame: /, `нет понятной ошибки: ${args.join(' ')}`);
    }
    assert.deepEqual(readdirSync(join(dir, 'src/minigames')).sort(), before);
    assert.ok(!existsSync(join(dir, 'src/minigames', free)));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

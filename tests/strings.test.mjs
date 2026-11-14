// Тесты слоя строк и выбора языка (src/data/strings.js) и флага короткого
// входа после смены языка (src/core/session.js). Без браузера: node:test.
// Запуск — `npm test`.
//
// strings.js выбирает язык один раз при загрузке модуля (`?lang=`, потом
// localStorage, иначе EN), поэтому каждый случай грузит модуль заново со
// своим «адресом» и хранилищем (хвост `?v=` заставляет node загрузить его ещё раз).

import { test } from 'node:test';
import assert from 'node:assert/strict';

const fakeStorage = (m = new Map()) => ({
  getItem: (k) => (m.has(k) ? m.get(k) : null),
  setItem: (k, v) => { m.set(k, String(v)); },
  removeItem: (k) => { m.delete(k); },
});

let loads = 0;
async function loadStrings(href = 'https://x.test/game/', { local = new Map(), session = new Map(), noStorage = false } = {}) {
  const replaced = [];
  globalThis.location = { href, search: new URL(href).search, replace: (u) => replaced.push(u) };
  globalThis.document = { documentElement: {} };
  if (noStorage) {
    const deny = { get() { throw new Error('SecurityError'); }, configurable: true };
    Object.defineProperty(globalThis, 'localStorage', deny);
    Object.defineProperty(globalThis, 'sessionStorage', deny);
  } else {
    Object.defineProperty(globalThis, 'localStorage', { value: fakeStorage(local), configurable: true, writable: true });
    Object.defineProperty(globalThis, 'sessionStorage', { value: fakeStorage(session), configurable: true, writable: true });
  }
  const mod = await import(`../src/data/strings.js?v=${++loads}`);
  return { mod, replaced, local, session };
}

test('язык: по умолчанию EN, <html lang> ставится', async () => {
  const { mod } = await loadStrings();
  assert.equal(mod.getLang(), 'en');
  assert.equal(globalThis.document.documentElement.lang, 'en');
});

test('язык: ?lang= важнее сохранённого, незнакомый ?lang= не считается', async () => {
  const local = new Map([['tj.lang', 'es']]);
  assert.equal((await loadStrings('https://x.test/?lang=ru', { local })).mod.getLang(), 'ru');
  assert.equal((await loadStrings('https://x.test/?lang=xx', { local })).mod.getLang(), 'es');
  assert.equal((await loadStrings('https://x.test/', { local })).mod.getLang(), 'es');
  const bad = new Map([['tj.lang', 'de']]);
  assert.equal((await loadStrings('https://x.test/', { local: bad })).mod.getLang(), 'en');
});

test('язык: без хранилища (приватная вкладка) не падает, остаётся EN', async () => {
  const { mod } = await loadStrings('https://x.test/', { noStorage: true });
  assert.equal(mod.getLang(), 'en');
});

test('t(): строка своего языка, без перевода — EN, незнакомый ключ — ошибка', async () => {
  const { mod } = await loadStrings('https://x.test/?lang=pt');
  assert.equal(mod.t('prediction.share'), mod.DICTS.pt['prediction.share']);
  const key = Object.keys(mod.DICTS.en)[0];
  delete mod.DICTS.pt[key]; // словарь — копия этой загрузки модуля, другим тестам не мешает
  assert.equal(mod.t(key), mod.DICTS.en[key]);
  assert.throws(() => mod.t('нет.такого'), /нет строки/);
});

// строка или, у подсказок в несколько строк, массив строк — того же вида, что в EN
test('t(): на каждом языке каждый ключ EN даёт непустой текст того же вида', async () => {
  for (const lang of ['en', 'ru', 'uk', 'es', 'pt']) {
    const { mod } = await loadStrings(`https://x.test/?lang=${lang}`);
    for (const [key, en] of Object.entries(mod.DICTS.en)) {
      const v = mod.t(key);
      const where = `${lang}: ${key}`;
      assert.equal(Array.isArray(v), Array.isArray(en), where);
      for (const line of [v].flat()) assert.ok(typeof line === 'string' && line.length > 0, where);
    }
  }
});

test('setLang: запоминает язык, ставит флаг короткого входа, убирает ?lang= и перезапускает', async () => {
  const { mod, replaced, local, session } = await loadStrings('https://x.test/game/?lang=en&card=fool');
  mod.setLang('uk');
  assert.equal(local.get('tj.lang'), 'uk');
  assert.equal(session.get('tj.langSwitched'), '1');
  assert.deepEqual(replaced, ['https://x.test/game/?card=fool']);
});

test('setLang: тот же или незнакомый язык — ничего не делает', async () => {
  const { mod, replaced, local } = await loadStrings('https://x.test/?lang=ru');
  mod.setLang('ru');
  mod.setLang('de');
  assert.deepEqual(replaced, []);
  assert.equal(local.has('tj.lang'), false);
});

test('session: флаг смены языка даёт короткий вход один раз', async () => {
  const session = new Map([['tj.langSwitched', '1']]);
  Object.defineProperty(globalThis, 'sessionStorage', { value: fakeStorage(session), configurable: true, writable: true });
  const first = await import(`../src/core/session.js?v=${++loads}`);
  assert.equal(first.session.seenIntro, true);
  assert.equal(session.has('tj.langSwitched'), false);
  const second = await import(`../src/core/session.js?v=${++loads}`);
  assert.equal(second.session.seenIntro, false);
  // resetSession не трогает seenIntro
  first.resetSession();
  assert.equal(first.session.seenIntro, true);
});

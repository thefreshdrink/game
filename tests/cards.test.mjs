// Тесты раздачи карт и подстановки предсказания (src/data/cards.js).
// Без браузера и зависимостей: node:test. Запуск — `npm test`.
//
// cards.js читает `?seq=1` и `?card=` один раз при загрузке модуля, поэтому
// каждый режим грузится заново со своим «адресом» и своим localStorage
// (хвост `?v=` в пути заставляет node загрузить модуль ещё раз).

import { test } from 'node:test';
import assert from 'node:assert/strict';

let loads = 0;
async function loadCards(search = '', storage = new Map()) {
  globalThis.window = { location: { search } };
  globalThis.localStorage = {
    getItem: (k) => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => { storage.set(k, String(v)); },
  };
  // глобалы остаются до следующей загрузки: localStorage читается при раздаче
  return import(`../src/data/cards.js?v=${++loads}`);
}

test('обычная ссылка: случайная карта, только из переданного пула', async () => {
  const m = await loadCards('');
  assert.equal(m.SEQUENTIAL_DRAW, false);
  const pool = ['fool', 'tower', 'empress'];
  const seen = new Set();
  for (let i = 0; i < 300; i++) seen.add(m.pickCardId(pool));
  assert.deepEqual([...seen].sort(), [...pool].sort());
});

test('незнакомый id в пуле в раздачу не попадает', async () => {
  const m = await loadCards('');
  for (let i = 0; i < 50; i++) assert.equal(m.pickCardId(['fool', 'nope']), 'fool');
});

test('?seq=1: по кругу в порядке DECK_ORDER, пропуская карты не из пула', async () => {
  const storage = new Map();
  const m = await loadCards('?seq=1', storage);
  assert.equal(m.SEQUENTIAL_DRAW, true);
  const pool = ['tower', 'fool', 'empress']; // порядок пула не важен
  const got = Array.from({ length: 4 }, () => m.pickCardId(pool));
  assert.deepEqual(got, ['fool', 'empress', 'tower', 'fool']);
});

test('?seq=1: позиция в круге переживает перезагрузку страницы', async () => {
  const storage = new Map();
  const first = await loadCards('?seq=1', storage);
  first.pickCardId(['fool', 'tower']);
  const again = await loadCards('?seq=1', storage);
  assert.equal(again.pickCardId(['fool', 'tower']), 'tower');
});

test('?seq=1 без хранилища (приватная вкладка) не падает', async () => {
  globalThis.window = { location: { search: '?seq=1' } };
  globalThis.localStorage = {
    getItem() { throw new Error('denied'); },
    setItem() { throw new Error('denied'); },
  };
  const m = await import(`../src/data/cards.js?v=${++loads}`);
  assert.equal(m.pickCardId(['tower', 'fool']), 'fool');
  assert.equal(m.pickCardId(['tower', 'fool']), 'fool');
});

test('?card=<id>: всегда эта карта; неизвестный id игнорируется', async () => {
  const m = await loadCards('?card=tower');
  for (let i = 0; i < 5; i++) assert.equal(m.pickCardId(['fool']), 'tower');
  const bad = await loadCards('?card=nope');
  assert.equal(bad.pickCardId(['fool']), 'fool');
});

test('getReading: текст из банка по категории, ошибка на дыре', async () => {
  const m = await loadCards('');
  for (const cat of ['work', 'love', 'mental']) {
    assert.equal(m.getReading('fool', cat), m.CARDS.fool.reading[cat]);
  }
  assert.throws(() => m.getReading('nope', 'work'), /Unknown card/);
  assert.throws(() => m.getReading('fool', 'money'), /No reading/);
});

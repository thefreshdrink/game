// Тесты экрана 1 «Вопрос» (src/screens/question.js, бэклог 68): полное
// интро на первом входе и короткое на возврате, флаг session.seenIntro,
// пункты WORK / LOVE / MENTAL — тап раньше времени не срабатывает, тап по
// пункту ставит категорию и уводит на экран 2; подсветка: палец > курсор >
// холостой перебор; строка языков: текущий белым, остальные серым, тап —
// setLang; моргание ровно раз в 2.5 с. Без браузера: node:test, канвас —
// заглушка. Код экрана не трогается — тест фиксирует то, что есть.
// Запуск — `npm test`.

import { test } from 'node:test';
import assert from 'node:assert/strict';

// Заглушки окружения ДО импорта: pixelReveal и voidGradient заводят
// буферы через document, setLang перезапускает страницу через location.
const replaced = [];
globalThis.document = {
  documentElement: {},
  createElement() {
    const ctx = new Proxy({}, {
      get: (o, k) => (k in o ? o[k] : k === 'createImageData'
        ? (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) })
        : () => {}),
      set: (o, k, v) => { o[k] = v; return true; },
    });
    return { width: 0, height: 0, getContext: () => ctx };
  },
};
globalThis.location = {
  search: '', href: 'https://example.test/game/?lang=en',
  replace(u) { replaced.push(u); },
};

const { createQuestionScreen } = await import('../src/screens/question.js');
const { session } = await import('../src/core/session.js');
const { t: str, LANGS, getLang } = await import('../src/data/strings.js');
const { revealDuration } = await import('../src/core/textReveal.js');
const { textButtonZone } = await import('../src/core/textButton.js');
const { uiScale } = await import('../src/core/text.js');

const DT = 1 / 64;
const images = {
  futureTellerBody: { id: 'body', width: 430, height: 678 },
  futureTellerEyes: { id: 'eyes', width: 430, height: 678 },
};
const PALETTE = new Set([
  '#111111', '#000000', '#FFFFFF', '#B8B8B8', '#4A4A4A', '#808080',
  '#161616', '#1C1C1C', '#212121', '#252525', '#2A2A2A', '#2E2E2E', '#EBA331', '#B07A1C',
]);

// Тайминги интро — повторены из question.js: тест ловит, если их сдвинут.
const words = (s) => s.split(' ').length;
const TEXT1_START = 0.5 + 0.4;
const BODY_START = TEXT1_START + revealDuration(words(str('question.ask'))) + 1.4;
const TEXT2_START = BODY_START + 1.8;
const OPTIONS_START = TEXT2_START + revealDuration(words(str('question.about'))) + 1.6;
const ALL_SHOWN = OPTIONS_START + 2 * 0.18;
const SHORT_OPTIONS = revealDuration(words(str('question.about'))) + 0.3;

// Канвас-заглушка: журнал fillText / drawImage / fillRect с текущим цветом
// и альфой; measureText — 10 px на знак; всё прочее — пустышки.
function recorder() {
  const log = [];
  const base = {
    fillStyle: '', font: '', letterSpacing: '0px', textAlign: 'start', globalAlpha: 1,
    measureText: (s) => ({ width: s.length * 10 }),
    fillText(s, x, y) { log.push({ op: 'text', s, x, y, color: this.fillStyle, alpha: this.globalAlpha }); },
    drawImage(img, ...a) { log.push({ op: 'image', id: img.id, a, alpha: this.globalAlpha }); },
    fillRect(...a) { log.push({ op: 'rect', a, color: this.fillStyle }); },
    createPattern: () => ({ pattern: true }),
  };
  const ctx = new Proxy(base, {
    get: (o, k) => (k in o ? o[k] : () => {}),
    set: (o, k, v) => { o[k] = v; return true; },
  });
  return { ctx, log };
}

function makeInput() {
  const handlers = {};
  return {
    on(name, fn) {
      (handlers[name] ??= []).push(fn);
      return () => { handlers[name] = handlers[name].filter((f) => f !== fn); };
    },
    fire(name, e = {}) { (handlers[name] ?? []).forEach((f) => f(e)); },
    count: () => Object.values(handlers).reduce((s, a) => s + a.length, 0),
  };
}

function makeScreen({ seenIntro = false } = {}) {
  session.seenIntro = seenIntro;
  session.category = null;
  const input = makeInput();
  const calls = [];
  const s = createQuestionScreen({ input, images, goto: (to) => calls.push(to) });
  s.enter();
  return { s, input, calls };
}

// Прокрутить до момента t (секунды от входа) шагами DT.
function runTo(s, from, to) { for (let k = Math.round(from / DT); k < Math.round(to / DT); k++) s.update(DT); }

function frame(s, w = 390, h = 844) {
  const { ctx, log } = recorder();
  s.draw(ctx, w, h);
  return log;
}

const texts = (log) => log.filter((c) => c.op === 'text');
const menu = (log) => texts(log).filter((c) => c.s.startsWith('›'));
// Центр хит-зоны пункта — по той же формуле, что у экрана (10 px на знак).
function centerOf(item, scale = uiScale(390)) {
  const z = textButtonZone(item.x, item.y, item.s.length * 10, Math.round(30 * scale));
  return { x: (z.x0 + z.x1) / 2, y: (z.y0 + z.y1) / 2 };
}

test('question: полное интро — первая реплика с 0.9 с, меню только после второй', () => {
  const { s } = makeScreen();
  runTo(s, 0, TEXT1_START - 0.05);
  assert.equal(texts(frame(s)).length, 0, 'до первой реплики текста нет');
  runTo(s, TEXT1_START - 0.05, TEXT1_START + 0.05);
  const first = texts(frame(s));
  assert.equal(first.length, 1);
  assert.equal(first[0].s, str('question.ask').split(' ')[0]);
  assert.equal(first[0].color, '#FFFFFF');
  runTo(s, TEXT1_START + 0.05, OPTIONS_START - 0.05);
  assert.equal(menu(frame(s)).length, 0, 'меню ещё не показано');
  const ask = str('question.ask').split(' ');
  assert.ok(!texts(frame(s)).some((c) => ask.includes(c.s)), 'первая реплика к этому моменту погасла');
  runTo(s, OPTIONS_START - 0.05, OPTIONS_START + 0.05);
  assert.deepEqual(menu(frame(s)).map((c) => c.s), [`›${str('category.work')}`]);
  runTo(s, OPTIONS_START + 0.05, ALL_SHOWN + 0.02);
  assert.deepEqual(menu(frame(s)).map((c) => c.s),
    ['work', 'love', 'mental'].map((k) => `›${str(`category.${k}`)}`));
});

test('question: пункты меню в один ряд, слева направо, с зазором 30·scale', () => {
  const { s } = makeScreen();
  runTo(s, 0, ALL_SHOWN + 0.02);
  const items = menu(frame(s));
  const scale = uiScale(390);
  assert.equal(items[0].x, Math.round(53 * scale));
  assert.ok(items.every((c) => c.y === items[0].y), 'одна строка');
  for (let i = 1; i < items.length; i++) {
    assert.equal(items[i].x, items[i - 1].x + items[i - 1].s.length * 10 + Math.round(30 * scale));
  }
});

test('question: seenIntro ставится ровно к появлению меню', () => {
  const { s } = makeScreen();
  runTo(s, 0, OPTIONS_START - 0.05);
  assert.equal(session.seenIntro, false);
  runTo(s, OPTIONS_START - 0.05, OPTIONS_START + 0.05);
  assert.equal(session.seenIntro, true);
});

test('question: тап раньше, чем показан последний пункт, не срабатывает', () => {
  const { s, input, calls } = makeScreen();
  runTo(s, 0, ALL_SHOWN + 0.02);
  const work = menu(frame(s))[0];
  const p = centerOf(work);
  const early = makeScreen();
  runTo(early.s, 0, OPTIONS_START + 0.05); // WORK уже виден, MENTAL ещё нет
  frame(early.s);
  early.input.fire('tap', p);
  assert.deepEqual(early.calls, []);
  assert.equal(session.category, null);
  // А у готового экрана тот же тап проходит.
  input.fire('tap', p);
  assert.deepEqual(calls, ['deck']);
  assert.equal(session.category, 'work');
});

test('question: тап по каждому пункту — своя категория, тап мимо — ничего', () => {
  for (const [i, cat] of ['work', 'love', 'mental'].entries()) {
    const { s, input, calls } = makeScreen();
    runTo(s, 0, ALL_SHOWN + 0.02);
    const items = menu(frame(s));
    input.fire('tap', { x: 2, y: 2 });
    assert.deepEqual(calls, []);
    input.fire('tap', centerOf(items[i]));
    assert.deepEqual(calls, ['deck']);
    assert.equal(session.category, cat);
  }
});

test('question: холостой перебор — пункты загораются по очереди раз в 0.8 с', () => {
  const { s } = makeScreen();
  let t = 0;
  const lit = () => menu(frame(s)).map((c) => c.color === '#EBA331');
  for (const [k, expect] of [[0, [1, 0, 0]], [1, [0, 1, 0]], [2, [0, 0, 1]], [3, [1, 0, 0]]]) {
    const at = ALL_SHOWN + k * 0.8 + 0.05;
    runTo(s, t, at); t = at;
    assert.deepEqual(lit(), expect.map(Boolean), `шаг ${k}`);
  }
  assert.ok(menu(frame(s)).every((c) => c.color === '#EBA331' || c.color === '#FFFFFF'));
});

test('question: палец важнее курсора, курсор важнее перебора', () => {
  const { s, input } = makeScreen();
  runTo(s, 0, ALL_SHOWN + 0.05); // перебор держит WORK
  const items = menu(frame(s));
  const lit = () => menu(frame(s)).map((c) => c.color === '#EBA331');
  input.fire('hover', centerOf(items[2]));
  assert.deepEqual(lit(), [false, false, true], 'курсор над MENTAL');
  input.fire('pressstart', centerOf(items[1]));
  assert.deepEqual(lit(), [false, true, false], 'палец на LOVE');
  input.fire('pressmove', { x: 2, y: 2 });
  assert.deepEqual(lit(), [false, false, true], 'палец ушёл — снова курсор');
  input.fire('pressend', {});
  assert.deepEqual(lit(), [true, false, false], 'отрыв чистит и курсор — снова перебор');
  input.fire('hover', centerOf(items[1]));
  input.fire('hoverend', {});
  assert.deepEqual(lit(), [true, false, false]);
});

test('question: до готовности меню наведение и нажатие ничего не подсвечивают', () => {
  const { s } = makeScreen();
  runTo(s, 0, ALL_SHOWN + 0.02);
  const items = menu(frame(s));
  const early = makeScreen();
  runTo(early.s, 0, OPTIONS_START + 0.2); // WORK и LOVE видны, перебора ещё нет
  early.input.fire('hover', centerOf(items[1]));
  early.input.fire('pressstart', centerOf(items[0]));
  assert.ok(menu(frame(early.s)).every((c) => c.color === '#FFFFFF'));
});

test('question: строка языков под меню — текущий белым, остальные серым', () => {
  const { s, input } = makeScreen();
  runTo(s, 0, ALL_SHOWN + 0.02);
  const log = frame(s);
  const row = texts(log).filter((c) => LANGS.map((l) => l.toUpperCase()).includes(c.s));
  assert.deepEqual(row.map((c) => c.s), LANGS.map((l) => l.toUpperCase()));
  const scale = uiScale(390);
  assert.ok(row.every((c) => c.y === menu(log)[0].y + Math.round(40 * scale)), 'на 40·scale ниже меню');
  assert.deepEqual(row.map((c) => c.color),
    LANGS.map((l) => (l === getLang() ? '#FFFFFF' : '#808080')));
  // Под пальцем — акцент.
  const ru = row[LANGS.indexOf('ru')];
  const lh = Math.round(30 * scale * 0.75);
  const z = textButtonZone(ru.x, ru.y, ru.s.length * 10, lh);
  input.fire('pressstart', { x: (z.x0 + z.x1) / 2, y: (z.y0 + z.y1) / 2 });
  const after = texts(frame(s)).find((c) => c.s === 'RU');
  assert.equal(after.color, '#EBA331');
});

test('question: тап по языку — перезапуск страницы без ?lang, на экран 2 не уходит', () => {
  const { s, input, calls } = makeScreen();
  runTo(s, 0, ALL_SHOWN + 0.02);
  const scale = uiScale(390);
  const lh = Math.round(30 * scale * 0.75);
  const row = texts(frame(s)).filter((c) => ['EN', 'RU'].includes(c.s));
  const hit = (c) => {
    const z = textButtonZone(c.x, c.y, c.s.length * 10, lh);
    return { x: (z.x0 + z.x1) / 2, y: (z.y0 + z.y1) / 2 };
  };
  replaced.length = 0;
  input.fire('tap', hit(row.find((c) => c.s === getLang().toUpperCase())));
  assert.deepEqual(replaced, [], 'тап по текущему языку ничего не делает');
  input.fire('tap', hit(row.find((c) => c.s === 'RU')));
  assert.deepEqual(replaced, ['https://example.test/game/']);
  assert.deepEqual(calls, []);
  assert.equal(session.category, null);
});

test('question: короткий вход — без первой реплики, фигура сразу, меню через 0.3 с', () => {
  const { s, input, calls } = makeScreen({ seenIntro: true });
  const ask = str('question.ask').split(' ');
  const log0 = frame(s);
  assert.ok(!texts(log0).some((c) => ask.includes(c.s)), 'первой реплики нет');
  assert.ok(log0.some((c) => c.op === 'image' && c.id === 'eyes' && c.alpha === 1), 'глаза сразу на 100%');
  assert.equal(texts(log0)[0].s, str('question.about').split(' ')[0], 'вторая реплика с нуля');
  runTo(s, 0, SHORT_OPTIONS - 0.05);
  assert.equal(menu(frame(s)).length, 0);
  runTo(s, SHORT_OPTIONS - 0.05, SHORT_OPTIONS + 2 * 0.18 + 0.02);
  const items = menu(frame(s));
  assert.equal(items.length, 3);
  input.fire('tap', centerOf(items[2]));
  assert.deepEqual(calls, ['deck']);
  assert.equal(session.category, 'mental');
});

test('question: глаза моргают ровно раз в 2.5 с на 0.12 с', () => {
  const { s } = makeScreen({ seenIntro: true });
  const eyes = () => frame(s).some((c) => c.op === 'image' && c.id === 'eyes');
  runTo(s, 0, 2.45);
  assert.ok(eyes());
  runTo(s, 2.45, 2.55);
  assert.ok(!eyes(), 'моргнул');
  runTo(s, 2.55, 2.7);
  assert.ok(eyes(), 'открыл');
  runTo(s, 2.7, 2.7 + 2.3);
  assert.ok(eyes());
  runTo(s, 5.0, 5.2);
  assert.ok(!eyes(), 'второе моргание через 2.5 с после первого');
});

test('question: фон #111111 первым, цвета кадра только из палитры', () => {
  for (const at of [0.1, TEXT1_START + 0.5, TEXT2_START + 1, ALL_SHOWN + 1]) {
    const fresh = makeScreen();
    runTo(fresh.s, 0, at);
    const log = frame(fresh.s);
    assert.deepEqual(log[0], { op: 'rect', a: [0, 0, 390, 844], color: '#111111' });
    for (const c of log) {
      if (c.color && typeof c.color === 'string') assert.ok(PALETTE.has(c.color), `${c.color} вне палитры`);
    }
  }
});

test('question: exit() снимает все обработчики ввода', () => {
  const { s, input, calls } = makeScreen();
  assert.ok(input.count() > 0);
  runTo(s, 0, ALL_SHOWN + 0.02);
  const items = menu(frame(s));
  s.exit();
  assert.equal(input.count(), 0);
  input.fire('tap', centerOf(items[0]));
  assert.deepEqual(calls, []);
});

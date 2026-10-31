// Строки интерфейса — один слой (CLAUDE.md: «строки идут через один слой, а
// не хардкодом по файлам»). Тексты предсказаний и имена карт сюда не входят —
// они в банке `cards.js` и пока только на EN. Глиф «›» перед пунктом меню —
// часть рисунка, а не перевода, поэтому ставится на экране, а не здесь.
//
// Выбор языка (2026-10-24): строка «EN RU UK ES PT» под меню экрана 1, тап —
// сразу нужный язык.
// Экраны читают строки при загрузке модулей (и тайминги интро считают по
// числу слов), поэтому смена языка перезапускает страницу — один раз, на
// экран 1, с коротким входом (session.js). Выбор помнится в localStorage —
// это настройка, не прогресс; решение о хранилище прогресса (2026-08-20) не
// затрагивает.
//
// RU, UK, ES, PT — ЧЕРНОВИКИ Claude, носителями не проверены (план, недели
// 6–7). В UK нет «ґ»: строчной ґ нет в Pixelify (open-questions B13).

const EN = {
  // экран 1 (question.js)
  'question.ask': 'Do you want to see the future?',
  'question.about': 'What is your question about?',
  'category.work': 'WORK',
  'category.love': 'LOVE',
  'category.mental': 'MENTAL',

  // экраны 2–3 (deck.js, draw.js) — заголовок общий, переход 2 → 3 читается
  // одним непрерывным текстом
  'deck.title': 'The deck offers itself…',
  'deck.hint.1': 'DRAG ACROSS THE DECK.',
  'deck.hint.2': 'TRUST THE POOL. PICK THE CARD',

  // экран 4 (reveal.js)
  'reveal.continue': 'KEEP GOING',

  // экран 5 — подсказки мини-игр
  'fool.walk': ['TAP OR HOLD', 'TO WALK'],
  'fool.swipe': ['SWIPE UP', 'TO JUMP'],
  'fool.hold': ['HOLD', 'TO JUMP'],
  'tower.hold': 'HOLD A BLOCK',
  'empress.plant': 'DRAG TO PLANT',
  'empress.touch': 'TOUCH THE EMPRESS',
  'empress.hold': 'HOLD THE BUD',

  // экран 6 (prediction.js)
  'prediction.again': 'ONE MORE QUESTION',
  'prediction.share': 'SHARE',
};

// Черновики (Claude, 2026-10-24), не проверены носителями.
const RU = {
  'question.ask': 'Хочешь увидеть будущее?',
  'question.about': 'О чём твой вопрос?',
  'category.work': 'РАБОТА',
  'category.love': 'ЛЮБОВЬ',
  'category.mental': 'РАЗУМ',
  'deck.title': 'Колода открывается…',
  'deck.hint.1': 'ПРОВЕДИ ПО КОЛОДЕ.',
  'deck.hint.2': 'ДОВЕРЬСЯ. ВЫБЕРИ КАРТУ',
  'reveal.continue': 'ДАЛЬШЕ',
  'fool.walk': ['НАЖМИ ИЛИ ДЕРЖИ', 'ЧТОБЫ ИДТИ'],
  'fool.swipe': ['СВАЙП ВВЕРХ', 'ЧТОБЫ ПРЫГНУТЬ'],
  'fool.hold': ['ДЕРЖИ', 'ЧТОБЫ ПРЫГНУТЬ'],
  'tower.hold': 'ДЕРЖИ БРУСОК',
  'empress.plant': 'ТЯНИ, ЧТОБЫ ПОСАДИТЬ',
  'empress.touch': 'КОСНИСЬ ИМПЕРАТРИЦЫ',
  'empress.hold': 'ДЕРЖИ БУТОН',
  'prediction.again': 'ЕЩЁ ВОПРОС',
  'prediction.share': 'ПОДЕЛИТЬСЯ',
};

const UK = {
  'question.ask': 'Хочеш побачити майбутнє?',
  'question.about': 'Про що твоє питання?',
  'category.work': 'РОБОТА',
  'category.love': 'КОХАННЯ',
  'category.mental': 'РОЗУМ',
  'deck.title': 'Колода відкривається…',
  'deck.hint.1': 'ПРОВЕДИ ПО КОЛОДІ.',
  'deck.hint.2': 'ДОВІРСЯ. ОБЕРИ КАРТУ',
  'reveal.continue': 'ДАЛІ',
  'fool.walk': ['ТОРКНИСЬ АБО ТРИМАЙ', 'ЩОБ ЙТИ'],
  'fool.swipe': ['СВАЙП УГОРУ', 'ЩОБ СТРИБНУТИ'],
  'fool.hold': ['ТРИМАЙ', 'ЩОБ СТРИБНУТИ'],
  'tower.hold': 'ТРИМАЙ БРУСОК',
  'empress.plant': 'ТЯГНИ, ЩОБ ПОСАДИТИ',
  'empress.touch': 'ТОРКНИСЬ ІМПЕРАТРИЦІ',
  'empress.hold': 'ТРИМАЙ БУТОН',
  'prediction.again': 'ЩЕ ПИТАННЯ',
  'prediction.share': 'ПОДІЛИТИСЯ',
};

const ES = {
  'question.ask': '¿Quieres ver el futuro?',
  'question.about': '¿Sobre qué es tu pregunta?',
  'category.work': 'TRABAJO',
  'category.love': 'AMOR',
  'category.mental': 'MENTE',
  'deck.title': 'La baraja se ofrece…',
  'deck.hint.1': 'DESLIZA POR LA BARAJA.',
  'deck.hint.2': 'CONFÍA. ELIGE LA CARTA',
  'reveal.continue': 'SIGUE',
  'fool.walk': ['TOCA O MANTÉN', 'PARA CAMINAR'],
  'fool.swipe': ['DESLIZA ARRIBA', 'PARA SALTAR'],
  'fool.hold': ['MANTÉN', 'PARA SALTAR'],
  'tower.hold': 'MANTÉN UN BLOQUE',
  'empress.plant': 'ARRASTRA PARA SEMBRAR',
  'empress.touch': 'TOCA A LA EMPERATRIZ',
  'empress.hold': 'MANTÉN EL BROTE',
  'prediction.again': 'OTRA PREGUNTA',
  'prediction.share': 'COMPARTIR',
};

const PT = {
  'question.ask': 'Quer ver o futuro?',
  'question.about': 'Sobre o que é a sua pergunta?',
  'category.work': 'TRABALHO',
  'category.love': 'AMOR',
  'category.mental': 'MENTE',
  'deck.title': 'O baralho se oferece…',
  'deck.hint.1': 'DESLIZE PELO BARALHO.',
  'deck.hint.2': 'CONFIE. ESCOLHA A CARTA',
  'reveal.continue': 'CONTINUE',
  'fool.walk': ['TOQUE OU SEGURE', 'PARA ANDAR'],
  'fool.swipe': ['DESLIZE PARA CIMA', 'PARA PULAR'],
  'fool.hold': ['SEGURE', 'PARA PULAR'],
  'tower.hold': 'SEGURE UM BLOCO',
  'empress.plant': 'ARRASTE PARA PLANTAR',
  'empress.touch': 'TOQUE A IMPERATRIZ',
  'empress.hold': 'SEGURE O BOTÃO',
  'prediction.again': 'MAIS UMA PERGUNTA',
  'prediction.share': 'COMPARTILHAR',
};

// словари по языкам; экспорт — для проверки сборки (tools/check-strings.mjs)
export const DICTS = { en: EN, ru: RU, uk: UK, es: ES, pt: PT };
/** Порядок в строке языков на экране 1. Подпись — код языка заглавными. */
export const LANGS = ['en', 'ru', 'uk', 'es', 'pt'];
const STORE_KEY = 'tj.lang';

function readLang() {
  try {
    const q = new URLSearchParams(location.search).get('lang');
    if (q && DICTS[q]) return q;
    const v = localStorage.getItem(STORE_KEY);
    if (v && DICTS[v]) return v;
  } catch { /* приватный режим, превью — просто EN */ }
  return 'en';
}

const lang = readLang();
try { document.documentElement.lang = lang; } catch { /* вне браузера */ }

export function getLang() { return lang; }

/** Выбрать язык: запомнить и перезапустить страницу на экран 1. */
export function setLang(next) {
  if (next === lang || !DICTS[next]) return;
  try {
    localStorage.setItem(STORE_KEY, next);
    sessionStorage.setItem('tj.langSwitched', '1'); // короткий вход после перезапуска
  } catch { /* без хранилища язык живёт до перезагрузки — не страшно */ }
  const url = new URL(location.href);
  url.searchParams.delete('lang');
  location.replace(url.toString());
}

export function t(key) {
  const v = DICTS[lang][key] ?? EN[key];
  if (v === undefined) throw new Error(`strings.js: нет строки «${key}»`);
  return v;
}

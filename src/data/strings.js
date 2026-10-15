// Строки интерфейса — один слой (CLAUDE.md: «строки идут через один слой, а
// не хардкодом по файлам»). Сейчас язык один — EN, тексты слово в слово те,
// что раньше жили по экранам. Тексты предсказаний сюда не входят — они в
// банке `cards.js`. Глиф «›» перед пунктом меню — часть рисунка, а не
// перевода, поэтому ставится на экране, а не здесь.
//
// Как устроен выбор языка — ещё не решено (open-questions B6 про лицо карты;
// переключатель — оболочка). Пока `t()` всегда отдаёт EN.

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

  // экран 6 (prediction.js)
  'prediction.again': 'ONE MORE QUESTION',
  'prediction.share': 'SHARE',
};

const DICTS = { en: EN };
const lang = 'en';

export function t(key) {
  const v = DICTS[lang][key] ?? EN[key];
  if (v === undefined) throw new Error(`strings.js: нет строки «${key}»`);
  return v;
}

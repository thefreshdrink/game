// Статичный банк текстов. В рантайме ИИ не вызывается — только подстановка
// по ключу card.reading[category]. Пайплайн авторинга — GDD §7.2.
// Тексты написаны голосом Future Teller и вычитаны вручную.
// Модель карты — GDD §7.3.

export const CATEGORIES = ['work', 'love', 'mental'];

export const CARDS = {
  fool: {
    id: 'fool',
    numeral: '0',
    name: 'The Fool',
    minigame: 'leap',
    art: 'foolOnCard',        // ключ IMAGE_MANIFEST (main.js)

    upright: 'beginnings, faith, the open road',
    shadow: 'recklessness, avoidance, the un-looked leap',
    symbolism: 'the edge, the empty pockets, the step over air',

    // Короткая реплика-образ перед мини-игрой. Не отдельный экран —
    // проступает на сцене карты. Опциональна.
    intro: 'He does not look down. It is not courage. He is just thinking about something else.',

    // Заголовок экрана 4 (BUILD-SPEC-02, задача 4) — момент «тебе выпал
    // Шут» получает свою реплику вместо унаследованного с экрана 2
    // «The deck offers itself…». Текст банка, не выдумывать на ходу.
    arrival: 'The Fool answers you.',

    // Два абзаца через \n\n — правка в чате 2026-08-30, отход от «строфы
    // приедут отдельно» (задача 10). Формулировки переписаны простым языком
    // 2026-09-13: аудитория читает по-английски как по неродному, и на
    // плотных образах спотыкалась. Смысл и разбивка прежние, тронуты слова.
    reading: {
      work:
        'You are at the start of something at work with nothing ready in your ' +
        'hands. That is normal. From up here it only looks like falling.' +
        '\n\n' +
        'Say yes this week to the one thing you are not ready for. The ground ' +
        'shows up under the foot that moves. Go lightly. Just do not call ' +
        'running away a beginning.',

      love:
        'You want to walk toward someone without knowing how it ends. That is ' +
        'not foolish. Everyone starts that way.' +
        '\n\n' +
        'Let yourself be seen before you are sure. Say the simple sentence you ' +
        'keep practising, and say it first. Being open is not the same as ' +
        'having no limits. Keep something for yourself.',

      mental:
        'You have been standing at the same decision for a long time, looking ' +
        'at it. You call that thinking. It is not. You are going over it again.' +
        '\n\n' +
        'Pick one small thing and do it before you feel ready. The body settles ' +
        'what the head cannot. Take your time. Starting again is not the same ' +
        'as having failed.',
    },
  },

  tower: {
    id: 'tower',
    numeral: 'XVI',
    name: 'The Tower',
    minigame: 'release',      // глагол карты, GDD §8.2. Сцены ещё нет —
                              // поэтому карта не в PLAYABLE (см. ниже)
    art: 'towerOnCard',

    upright: 'sudden collapse, release, the necessary ruin',
    shadow: 'clinging, the propped-up thing, ruin refused',
    symbolism: 'the crown knocked off first, the crack already there, the quiet after',

    intro: 'The crack was there before the storm. The storm only found it.',

    arrival: 'The Tower answers you.',

    reading: {
      work:
        'Something you built at work has been cracked for a while. You have ' +
        'been holding it up with both arms. That is where the tiredness comes ' +
        'from, not the work.' +
        '\n\n' +
        'Let it come down. What is still standing after was the part holding ' +
        'you up, and you will see it clearly. A ruin is not a failure. Just do ' +
        'not rebuild the same walls out of habit.',

      love:
        'There is something between you and another person that stands only ' +
        'because you keep holding it up. You know which hour of your day is ' +
        'the tired one. It is that one.' +
        '\n\n' +
        'Take your hands away and let it fall. What is real between two people ' +
        'survives being dropped. What does not survive was never the thing you ' +
        'loved. You are allowed to be sad about it.',

      mental:
        'You have kept one story about yourself in good repair for years — the ' +
        'one that explains why you are like this. You have seen the cracks and ' +
        'painted over them.' +
        '\n\n' +
        'Let the story come down. You will not be less yourself without it. You ' +
        'will be quieter. Do not rush to build the next explanation.',
    },
  },

  // --- Оставшиеся три карты MVP ---------------------------------------
  // Мини-игры не спроектированы (только строчки в GDD §8.2), тексты не
  // написаны. В веере они видны, но пока не выбираются — см. BUILD-SPEC.
  //
  // magician, empress, wheel
};

/** Портрет по номеру карты — временный мост для `cardRender.drawCardFace`,
 * пока экраны полируются параллельно и не передают `art` параметром.
 * Удаляется вместе с добавлением `art: card.art` в reveal.js. */
export const ART_BY_NUMERAL = Object.fromEntries(
  Object.values(CARDS).map((c) => [c.numeral, c.art]),
);

export const DECK_ORDER = ['fool', 'magician', 'empress', 'wheel', 'tower'];

/** Карты, которые реально ПРОХОДЯТСЯ: у них есть своя сцена мини-игры.
 * У Башни `minigame: 'release'`, сцены нет — поэтому её здесь нет. */
export const PLAYABLE = ['fool'];

/** Карта для выдачи на экране 2. Берёт любую, у которой есть запись в банке
 * (портрет, имя, номер, три текста) — список растёт сам по мере наполнения
 * CARDS, отдельный перечень вести не надо.
 *
 * ВРЕМЕННО: выпавшая карта показывается и отдаёт своё предсказание, но
 * дорога у всех одна — `reveal.js` жёстко уводит в 'leap'. Когда появятся
 * остальные сцены, там встанет `goto(card.minigame)`, и выбор здесь можно
 * будет сузить до PLAYABLE. */
export function pickCardId() {
  const ids = Object.keys(CARDS);
  return ids[Math.floor(Math.random() * ids.length)];
}

export function getReading(cardId, category) {
  const card = CARDS[cardId];
  if (!card) throw new Error(`Unknown card: ${cardId}`);
  const text = card.reading?.[category];
  if (!text) throw new Error(`No reading for ${cardId}.${category}`);
  return text;
}

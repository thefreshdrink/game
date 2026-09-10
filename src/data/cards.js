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
    intro: 'He does not look down. That is not courage. His attention is simply elsewhere.',

    // Заголовок экрана 4 (BUILD-SPEC-02, задача 4) — момент «тебе выпал
    // Шут» получает свою реплику вместо унаследованного с экрана 2
    // «The deck offers itself…». Текст банка, не выдумывать на ходу.
    arrival: 'The Fool answers you.',

    // Разбивка на абзацы (\n\n) — правка в чате 2026-08-30. Слова не
    // тронуты, только вставлен разрыв на смысловом переходе «наблюдение →
    // совет». Отход от «строфы приедут отдельно» (задача 10) — по прямой
    // просьбе пользователя.
    reading: {
      work:
        'You are standing at the edge of your working life with empty pockets and ' +
        'the whole morning ahead of you. What looks like a fall is only the shape ' +
        'of a beginning seen from above.' +
        '\n\n' +
        'This week, say yes to the one thing you are not qualified for — the ground ' +
        'arrives under the foot that moves, not the foot that waits. Go lightly. ' +
        'Only do not confuse the leap with running away.',

      love:
        'Something in you wants to walk toward a person without a map. That is not ' +
        'foolish. It is the only way anyone has ever arrived.' +
        '\n\n' +
        'Let yourself be seen before you are certain — say the plain sentence you ' +
        'have been rehearsing, and say it first. An open road is not the same as an ' +
        'open door. Keep one hand for yourself.',

      mental:
        'Your mind has been standing at the same edge for a long time now, looking ' +
        'down and calling it thinking. It is not thinking. It is rehearsal.' +
        '\n\n' +
        'Choose one small thing and do it before you feel ready — the body settles ' +
        'what the head cannot. Be gentle about the timing. Beginning again is not ' +
        'the same as having failed.',
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

    intro: 'The crack was there before the storm. The storm only asked it a question.',

    arrival: 'The Tower answers you.',

    reading: {
      work:
        'Something you built at work has been cracked for a while now, and you ' +
        'have been standing inside it holding the ceiling up with both arms. ' +
        'That is where the tiredness comes from. Not the work.' +
        '\n\n' +
        'Let the thing come down. What is still standing afterward was the part ' +
        'that was holding you, and you will see it for the first time. Ruin is ' +
        'not the same as failure. Only do not rebuild the same walls out of habit.',

      love:
        'There is something between you and another person that stands only ' +
        'because you keep propping it up. You know which hour of your day is ' +
        'the tired one. It is the hour you spend holding it.' +
        '\n\n' +
        'Take your hands away and let it fall. What is real between two people ' +
        'survives being dropped. What does not survive was never the thing you ' +
        'loved, only the shape of it. Grief is allowed here. It is not a verdict.',

      mental:
        'You have kept a story about yourself in good repair for years — the ' +
        'one that explains why you are the way you are. Lately you have seen ' +
        'the cracks and gone on painting over them.' +
        '\n\n' +
        'Let the story come down. You will not be less yourself without it. You ' +
        'will be quieter. The noise you have been calling thinking was the sound ' +
        'of walls being held. Do not hurry to build the next explanation.',
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

/** Карты, которые реально играются в текущей сборке. */
export const PLAYABLE = ['fool'];

export function getReading(cardId, category) {
  const card = CARDS[cardId];
  if (!card) throw new Error(`Unknown card: ${cardId}`);
  const text = card.reading?.[category];
  if (!text) throw new Error(`No reading for ${cardId}.${category}`);
  return text;
}

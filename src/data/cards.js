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

    reading: {
      work:
        'You are standing at the edge of your working life with empty pockets and ' +
        'the whole morning ahead of you. What looks like a fall is only the shape ' +
        'of a beginning seen from above. This week, say yes to the one thing you ' +
        'are not qualified for — the ground arrives under the foot that moves, not ' +
        'the foot that waits. Go lightly. Only do not confuse the leap with running away.',

      love:
        'Something in you wants to walk toward a person without a map. That is not ' +
        'foolish. It is the only way anyone has ever arrived. Let yourself be seen ' +
        'before you are certain — say the plain sentence you have been rehearsing, ' +
        'and say it first. An open road is not the same as an open door. Keep one ' +
        'hand for yourself.',

      mental:
        'Your mind has been standing at the same edge for a long time now, looking ' +
        'down and calling it thinking. It is not thinking. It is rehearsal. Choose ' +
        'one small thing and do it before you feel ready — the body settles what the ' +
        'head cannot. Be gentle about the timing. Beginning again is not the same as ' +
        'having failed.',
    },
  },

  // --- Остальные четыре карты MVP -------------------------------------
  // Мини-игры не спроектированы (только строчки в GDD §8.2), тексты не
  // написаны. В веере они видны, но пока не выбираются — см. BUILD-SPEC.
  // Заполнять только после тестов вертикального среза.
  //
  // magician, empress, wheel, tower
};

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

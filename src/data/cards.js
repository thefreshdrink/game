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

  // Три карты ниже заведены 2026-09-13: портрет, номер, имя и три текста
  // есть у каждой, поэтому они выпадают в вере и отдают предсказание. Своей
  // сцены мини-игры нет ни у одной — в GDD §8.2 только строчка с глаголом,
  // спеки уровня нет (open-questions.md B2), поэтому в PLAYABLE их нет и
  // экран 5 они пропускают.

  magician: {
    id: 'magician',
    numeral: 'I',
    name: 'The Magician',
    minigame: 'channel',      // глагол карты, GDD §8.2. Сцены ещё нет
    art: 'magicianOnCard',

    upright: 'will, focus, the tools already at hand',
    shadow: 'scattered power, talk in place of making',
    symbolism: 'one hand up and one hand down, the four tools, the light that passes through',

    intro: 'He is not making anything new. He is using what is already on the table.',

    arrival: 'The Magician answers you.',

    reading: {
      work:
        'You have everything you need for the thing you keep talking about. ' +
        'The tools are on the table. You keep counting them instead of using ' +
        'them.' +
        '\n\n' +
        'Pick one and start this week. Tell someone who will ask you about it ' +
        'later. A plan stays soft until a hand moves.',

      love:
        'You know what you want to say to someone. You have said it in your ' +
        'head a hundred times. You have not said it once out loud.' +
        '\n\n' +
        'Say the plain version, not the good one. People can only answer what ' +
        'they actually hear.',

      mental:
        'Your attention is the strongest thing you own. Lately you spend it on ' +
        'everything at once.' +
        '\n\n' +
        'Give one hour to one thing this week and let the rest wait. Nothing is ' +
        'wrong with you. You are pointed in too many directions.',
    },
  },

  empress: {
    id: 'empress',
    numeral: 'III',
    name: 'The Empress',
    minigame: 'bloom',        // глагол карты, GDD §8.2. Сцены ещё нет
    art: 'empressOnCard',

    upright: 'abundance, care, the slow growing thing',
    shadow: 'smothering, tending until empty, the root pulled up to be looked at',
    symbolism: 'the crown, the tulip held and not gripped, the vine over the throne',

    intro: 'Nothing here was hurried. Look how much of it there is.',

    arrival: 'The Empress answers you.',

    reading: {
      work:
        'Something you started is already growing. You keep pulling it up to ' +
        'look at it. Checking is not the same as helping.' +
        '\n\n' +
        'Leave one thing alone this week and let it finish. It is further along ' +
        'than you think. Your worry is not what makes it grow.',

      love:
        'You give first and you give well. You have not asked in a long time ' +
        'who gives to you.' +
        '\n\n' +
        'Let someone do something for you, and do not pay it back the same day. ' +
        'Giving that only runs one way is not generosity. It empties you slowly.',

      mental:
        'You are hard on yourself on purpose. You treat rest like something you ' +
        'have to earn first.' +
        '\n\n' +
        'Feed yourself the way you feed people you love. Sleep, food, an hour ' +
        'with nothing in it. Things grow in warm places, not under pressure.',
    },
  },

  wheel: {
    id: 'wheel',
    numeral: 'X',
    name: 'Wheel of Fortune',
    minigame: 'spin',         // глагол карты, GDD §8.2. Сцены ещё нет
    art: 'wheelOnCard',

    upright: 'the turn, luck, the season changing',
    shadow: 'gripping the rim, waiting to be lucky, blaming the turn',
    symbolism: 'the marked rim, the top of the arc, the hands that aim and do not stop it',

    intro: 'It was already turning when you came in. It will turn after you leave.',

    arrival: 'The Wheel answers you.',

    reading: {
      work:
        'Something at work is already turning. It started before you noticed. ' +
        'It is not waiting for you to agree.' +
        '\n\n' +
        'Stop pulling at the direction and hold on instead. Some of what arrives ' +
        'this season is luck. It will still be yours.',

      love:
        'Something between you and another person is changing. You can feel it ' +
        'move. You have been calling that feeling doubt.' +
        '\n\n' +
        'Let it change without explaining it to yourself every day. Nothing is ' +
        'being taken from you. What comes back will be different, and that is ' +
        'allowed.',

      mental:
        'You are reading a bad stretch as the truth about you. It is not. It is ' +
        'a low point, and low points move.' +
        '\n\n' +
        'Let this week be ordinary. Decide nothing. Moods pass over you like ' +
        'weather. You are not the weather.',
    },
  },
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

/** ТЕСТОВЫЙ РЕЖИМ — выключить и удалить, когда тесты закончатся.
 *
 * Пока `true`, карты выдаются не случайно, а по кругу в порядке DECK_ORDER:
 * Шут → Маг → Императрица → Колесо → Башня → снова Шут. Это просьба из чата
 * 2026-09-13: проверять все пять карт на рандоме неудобно, нужен один и тот
 * же предсказуемый порядок.
 *
 * Позиция в круге лежит в localStorage, поэтому порядок не сбрасывается при
 * перезагрузке страницы — иначе на телефоне каждый заход отдавал бы Шута.
 * Хранилище может быть недоступно (приватная вкладка) — тогда режим тихо
 * отдаёт первую карту, а не падает.
 *
 * Выключение: SEQUENTIAL_DRAW = false вернёт случайную выдачу. */
export const SEQUENTIAL_DRAW = true;
const SEQ_KEY = 'tarot.test.drawIndex';

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
  if (SEQUENTIAL_DRAW) {
    // DECK_ORDER, а не Object.keys: порядок в банке — история правок, а
    // DECK_ORDER это канонический порядок арканов по номеру.
    const order = DECK_ORDER.filter((id) => CARDS[id]);
    let i = 0;
    try { i = Number(localStorage.getItem(SEQ_KEY)) || 0; } catch { i = 0; }
    if (!Number.isInteger(i) || i < 0) i = 0;
    try { localStorage.setItem(SEQ_KEY, String((i + 1) % order.length)); } catch { /* приватная вкладка */ }
    return order[i % order.length];
  }
  return ids[Math.floor(Math.random() * ids.length)];
}

export function getReading(cardId, category) {
  const card = CARDS[cardId];
  if (!card) throw new Error(`Unknown card: ${cardId}`);
  const text = card.reading?.[category];
  if (!text) throw new Error(`No reading for ${cardId}.${category}`);
  return text;
}

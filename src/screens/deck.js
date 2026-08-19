// Экран 2 — «The deck offers itself…» Переход с экрана 1 показан прямо
// здесь (правки в чате, 2026-08-18): старая реплика гаснет и на её месте
// тем же словом-за-словом проявляется новый заголовок, фигура оракула
// уходит обратно в темноту, потом каскадом (как в выигрышной анимации
// Windows Solitaire) влетают карты и ложатся веером внизу экрана —
// оригинального размера PNG, внахлёст, как настоящая колода. Дальше —
// проведение пальцем по колоде: под пальцем карта поднимается и красится
// акцентом, соседние расступаются. Референс по финальной раскладке (без
// перехода и каскада — тех эффектов в макетах нет):
// docs/interfaces/Picking the card.png

import { session } from '../core/session.js';
import { setFont, wrapLines } from '../core/text.js';
import { layoutWords, visibleWordCount, revealDuration } from '../core/textReveal.js';
import { computeOracleLayout, drawOracleBody, drawOracleEyes } from '../core/oracle.js';

// Число карт в вере — чисто визуальное (правка в чате: сначала 5
// читалось «мало для колоды», подняли до 9, потом ещё раз попросили
// больше), с реальным банком карт не связано: какую ни коснись, в этой
// сборке всегда падает Шут (BUILD-SPEC).
const CARD_COUNT = 14;

// Текст, с которым игрок пришёл с экрана 1 (должен быть слово-в-слово
// тем же — это финальная реплика question.js) — гаснет тут же, на той
// же высоте, будто это один непрерывный текст, а не новый экран.
const OLD_TEXT = 'What is your question about?';
const NEW_TITLE = 'The deck offers itself…';
const SUBTITLE = 'PICK THE CARD. TRUST THE POOL.';

const OLD_FADE_OUT = 0.5;
const TITLE_START = OLD_FADE_OUT; // новый текст ждёт, пока старый погаснет — без нахлёста
const TITLE_REVEAL = revealDuration(NEW_TITLE.split(' ').length);
const SUBTITLE_START = TITLE_START + TITLE_REVEAL + 0.25;
const SUBTITLE_FADE = 0.35;

// Фигура уходит в темноту тем же слоем, что проявлялась на экране 1 —
// пиксельно, стягиваясь обратно к глазам (core/oracle.js, progress 1→0).
const ORACLE_CONCEAL_START = 0;
const ORACLE_CONCEAL = 1.2;
const ORACLE_CELL_SIZE = 4;

// Каскад карт — «как в Виндовс-Косынке при победе» (правка в чате):
// вылетают из центра пачкой, с нахлёстом по времени, и ложатся веером.
// Высота вылета — небольшая (не с верха экрана): иначе все пять карт
// одновременно летят через весь экран и наслаиваются друг на друга и на
// текст — читалось грязно, а не как каскад.
const CARDS_START = SUBTITLE_START + SUBTITLE_FADE + 0.3;
const CASCADE_STAGGER = 0.09;
const CASCADE_DURATION = 0.5;
const CASCADE_DROP_HEIGHT = 200;

const CARD_W_FRAC = 0.5; // как на экранах 3–4 — тот же размер карты насквозь
// Зазор между центрами карт в вере. При таком количестве карт крайние
// заведомо уходят за края экрана — это нормально для полной колоды
// (веер длиннее видимой области, как у настоящей колоды в руке),
// непрозрачная подложка карты (ниже) не даёт им путаться друг с другом.
const FAN_OFFSET = 40;
const FAN_ARC = 4; // px понижения на шаг от центра — едва заметная дуга веера
const FAN_BOTTOM_MARGIN = 20;

// Наведённая карта только чуть-чуть приподнимается — расстояние между
// соседними картами не меняется вообще (правка в чате, 2026-08-19):
// пробовали и полный гарантированный зазор (100%+ высоты, потом 55%), и
// сдвиг только двух соседей — оба варианта читались «странно». Осталась
// только вертикальная подсказка: карта всё равно может быть частично
// закрыта той, что лежит спереди в естественном порядке вера — это
// нормально и ожидаемо.
const LIFT_FRAC = 0.12;
const SPREAD_RATE = 14; // скорость лерпа подъёма

// Вылет выбранной карты к позиции экрана 3 (то же место, что и в
// draw.js: половина ширины экрана, y ≈ 0.364h) — правка в чате: «плавно
// вылететь и встать в позицию третьего интерфейса», а не резким
// переключением сцены. Была 0.45 — попросили медленнее и плавнее.
const FLY_DURATION = 0.9;
const FLY_FADE_OTHERS = 0.4; // остальные карты гаснут, чтобы не мешать

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function easeInOutQuad(x) {
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

// Лёгкий перелёт с притормаживанием в конце — «приземление» карты.
function easeOutBack(x) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

export function createDeckScreen({ input, images, goto }) {
  let offHandlers = [];
  let t = 0;
  let cards = []; // {rest:{x,y}, spread:{x,y}, hovered}
  let hoveredIndex = null;
  let cardsSettled = false;
  let selected = false; // выбор сделан, дальше не реагируем на ввод
  let flying = false;
  let flyStartT = 0;
  let flyFrom = null; // {x, y} — позиция карты в момент выбора

  function layoutCards(w, h) {
    const cardW = Math.round(w * CARD_W_FRAC);
    const cardH = Math.round(cardW * (384 / 224));
    const centerX = w / 2;
    const restY = h - FAN_BOTTOM_MARGIN - cardH;
    const firstOffset = -((CARD_COUNT - 1) / 2) * FAN_OFFSET;

    const centerIndex = (CARD_COUNT - 1) / 2;
    for (let i = 0; i < CARD_COUNT; i++) {
      const restX = Math.round(centerX + firstOffset + i * FAN_OFFSET - cardW / 2);
      const restYArc = Math.round(restY + Math.abs(i - centerIndex) * FAN_ARC);
      if (!cards[i]) {
        cards[i] = { spread: { x: 0, y: 0 } };
      }
      cards[i].rest = { x: restX, y: restYArc };
      cards[i].w = cardW;
      cards[i].h = cardH;
      cards[i].delay = CARDS_START + i * CASCADE_STAGGER;
    }
  }

  function cardIndexAt(x) {
    // Ближайшая по X карта среди «домашних» слотов вера — не зависит от
    // текущего анимированного расступания, иначе слоты гуляли бы под
    // пальцем.
    let best = null;
    let bestDist = Infinity;
    cards.forEach((c, i) => {
      const cx = c.rest.x + c.w / 2;
      const d = Math.abs(x - cx);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    return best;
  }

  return {
    enter() {
      t = 0;
      cards = [];
      hoveredIndex = null;
      cardsSettled = false;
      selected = false;
      flying = false;
      flyFrom = null;

      offHandlers = [
        input.on('pressstart', (e) => {
          if (!cardsSettled || selected) return;
          hoveredIndex = cardIndexAt(e.x);
        }),
        input.on('pressmove', (e) => {
          if (!cardsSettled || selected) return;
          hoveredIndex = cardIndexAt(e.x);
        }),
        input.on('pressend', () => {
          if (!cardsSettled || selected || hoveredIndex === null) return;
          selected = true;
          flying = true;
          flyStartT = t;
          const c = cards[hoveredIndex];
          flyFrom = { x: c.rest.x + c.spread.x, y: c.rest.y + c.spread.y, w: c.w, h: c.h };
          session.cardId = 'fool'; // любая карта в этой сборке — Шут (BUILD-SPEC)
        }),
      ];
    },

    exit() {
      offHandlers.forEach((off) => off());
      offHandlers = [];
    },

    update(dt) {
      t += dt;

      if (flying) {
        if (t - flyStartT >= FLY_DURATION) goto('draw');
        return;
      }

      const allLanded = cards.length === CARD_COUNT
        && cards.every((c) => t >= c.delay + CASCADE_DURATION);
      if (allLanded) cardsSettled = true;

      cards.forEach((c, i) => {
        // Только вертикальный подъём наведённой карты — горизонтальное
        // расстояние между соседями не трогаем (правка в чате).
        const targetY = i === hoveredIndex ? -c.h * LIFT_FRAC : 0;
        const rate = 1 - Math.exp(-SPREAD_RATE * dt);
        c.spread.y += (targetY - c.spread.y) * rate;
      });
    },

    draw(ctx, w, h) {
      ctx.fillStyle = '#111111';
      ctx.fillRect(0, 0, w, h);

      const scale = Math.min(Math.max(w / 430, 0.75), 1.25);
      const marginX = Math.round(53 * scale);
      const textMaxWidth = w - marginX * 2;

      const titleLH = setFont(ctx, 'title', scale);
      const oldLines = wrapLines(ctx, OLD_TEXT, textMaxWidth);
      const newLines = wrapLines(ctx, NEW_TITLE, textMaxWidth);
      const ty = Math.round(70 * scale); // тот же уровень, что и на экране 1
      // Подсказка — по числу строк НОВОГО заголовка (он остаётся), не по
      // максимуму со старым: тот виден всего 0.5с, а прежде подсказка
      // сидела ниже, чем нужно, «под запас» на лишнюю строку — казалась
      // слишком низкой (правка в чате: «текст с подсказкой повыше»).
      const headerBottomY = ty + newLines.length * titleLH + Math.round(9 * scale);

      // Старая реплика — гаснет; новый заголовок — тем же способом,
      // слово за словом, что и на экране 1.
      ctx.textAlign = 'left';
      ctx.fillStyle = '#FFFFFF';
      const oldAlpha = clamp01(1 - t / OLD_FADE_OUT);
      if (oldAlpha > 0) {
        ctx.globalAlpha = oldAlpha;
        oldLines.forEach((line, i) => ctx.fillText(line, marginX, ty + i * titleLH));
        ctx.globalAlpha = 1;
      }
      const elapsedTitle = t - TITLE_START;
      if (elapsedTitle >= 0) {
        const words = layoutWords(ctx, newLines, marginX, ty, titleLH);
        const shown = visibleWordCount(elapsedTitle, words.length);
        for (let i = 0; i < shown; i++) ctx.fillText(words[i].text, words[i].x, words[i].y);
      }

      const subtitleAlpha = clamp01((t - SUBTITLE_START) / SUBTITLE_FADE);
      if (subtitleAlpha > 0) {
        setFont(ctx, 'menuOption', scale); // тот же стиль/размер, что у опций на экране 1
        ctx.fillStyle = '#EBA331';
        ctx.globalAlpha = subtitleAlpha;
        ctx.fillText(SUBTITLE, marginX, headerBottomY);
        ctx.globalAlpha = 1;
      }

      // Оракул уходит обратно в темноту — тот же слой, что и на экране 1.
      const oracle = computeOracleLayout(w, headerBottomY, scale, images.futureTellerBody);
      const concealProgress = clamp01(1 - (t - ORACLE_CONCEAL_START) / ORACLE_CONCEAL);
      drawOracleBody(ctx, images, oracle, concealProgress, ORACLE_CELL_SIZE);
      drawOracleEyes(ctx, images, oracle, concealProgress);

      layoutCards(w, h);

      if (flying && flyFrom) {
        // Выбранная карта плавно летит к позиции экрана 3 (draw.js) —
        // тот же размер и та же формула центрирования, чтобы при смене
        // сцены не было скачка (правка в чате).
        const flyP = easeInOutQuad(clamp01((t - flyStartT) / FLY_DURATION));
        const targetX = Math.round((w - flyFrom.w) / 2);
        const targetY = Math.round(h * 0.364);
        const x = flyFrom.x + (targetX - flyFrom.x) * flyP;
        const y = flyFrom.y + (targetY - flyFrom.y) * flyP;

        ctx.globalAlpha = clamp01(1 - (t - flyStartT) / FLY_FADE_OTHERS);
        cards.forEach((c, i) => {
          if (i === hoveredIndex) return;
          ctx.fillStyle = '#000000';
          ctx.fillRect(Math.round(c.rest.x), Math.round(c.rest.y), c.w, c.h);
          ctx.drawImage(images.cardBack, Math.round(c.rest.x), Math.round(c.rest.y), c.w, c.h);
        });
        ctx.globalAlpha = 1;

        ctx.fillStyle = '#000000';
        ctx.fillRect(Math.round(x), Math.round(y), flyFrom.w, flyFrom.h);
        ctx.drawImage(images.cardBack, Math.round(x), Math.round(y), flyFrom.w, flyFrom.h);
        ctx.strokeStyle = '#EBA331';
        ctx.lineWidth = Math.max(2, Math.round(2 * scale));
        ctx.strokeRect(Math.round(x) + 1, Math.round(y) + 1, flyFrom.w - 2, flyFrom.h - 2);
        return;
      }

      // Карты — каскадом влетают, потом лежат вером внизу. Рисуем строго в
      // порядке индекса (естественный порядок стопки): карта справа лежит
      // «спереди» и рисуется позже, поэтому продолжает частично перекрывать
      // наведённую, если та приподнята недостаточно, чтобы выйти из-под
      // неё — так и должно быть (правка в чате: «она должна быть закрыта
      // всё равно спереди лежащей картой»). Раньше наведённая карта
      // принудительно рисовалась последней (поверх всех) — убрали.
      cards.forEach((c, i) => {
        const elapsed = t - c.delay;
        let x = c.rest.x + c.spread.x;
        let y = c.rest.y + c.spread.y;
        let alpha = 1;

        if (elapsed < 0) {
          alpha = 0;
        } else if (elapsed < CASCADE_DURATION) {
          const p = easeOutBack(clamp01(elapsed / CASCADE_DURATION));
          const startX = w / 2 - c.w / 2;
          const startY = c.rest.y - CASCADE_DROP_HEIGHT;
          x = startX + (c.rest.x - startX) * p;
          y = startY + (c.rest.y - startY) * p;
        }

        if (alpha <= 0) return;
        ctx.globalAlpha = alpha;
        // У рубашки прозрачный фон (только линии) — без непрозрачной
        // подложки карты в вере просвечивают друг сквозь друга вместо
        // того, чтобы перекрывать (правка в чате).
        ctx.fillStyle = '#000000';
        ctx.fillRect(Math.round(x), Math.round(y), c.w, c.h);
        ctx.drawImage(images.cardBack, Math.round(x), Math.round(y), c.w, c.h);
        if (i === hoveredIndex) {
          ctx.strokeStyle = '#EBA331';
          ctx.lineWidth = Math.max(2, Math.round(2 * scale));
          ctx.strokeRect(Math.round(x) + 1, Math.round(y) + 1, c.w - 2, c.h - 2);
        }
        ctx.globalAlpha = 1;
      });
    },
  };
}

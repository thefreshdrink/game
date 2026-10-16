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
import { setFont, wrapLines, uiScale } from '../core/text.js';
import {
  layoutWords, visibleWordCount, revealDuration, blinkAlpha,
} from '../core/textReveal.js';
import {
  computeOracleLayout, drawOracleBody, drawOracleEyes, headerBottomY as oracleHeaderBottomY,
} from '../core/oracle.js';
import { CARDS, pickCardId } from '../data/cards.js';
import { isPlayable } from '../minigames/index.js';
import { drawVoidGradient } from '../core/voidGradient.js';
import { easeInOutQuad, clamp01 } from '../core/ease.js';
import { t as str } from '../data/strings.js';
// Веер, вход карт и рубашка — в src/screens/deck/ (разделено 2026-10-16,
// задача 5 бэклога агента; поведение не менялось).
import {
  CARD_COUNT, LIFT_FRAC, SPREAD_RATE, layoutFan, cardCenterAt, cardIndexAt,
} from './deck/fan.js';
import { CASCADE_STAGGER, stepCascade, placingAngle } from './deck/cascade.js';
import { drawCardBack } from './deck/cardBack.js';

// Текст, с которым игрок пришёл с экрана 1 (должен быть слово-в-слово
// тем же — это финальная реплика question.js) — гаснет тут же, на той
// же высоте, будто это один непрерывный текст, а не новый экран.
const OLD_TEXT = str('question.about');
const NEW_TITLE = str('deck.title');
// Две строки подписи (правка в чате 2026-09-10): сначала про руку, потом
// про доверие и выбор. Одинаковой насыщенности, чуть меньше кеглем.
const SUBTITLE_LINES = [str('deck.hint.1'), str('deck.hint.2')];

// Волна-подсказка (BUILD-SPEC-05 2b.1; правка в чате 2026-09-10: не
// одновременно по двум рядам, а ПО ОЧЕРЕДИ — сперва задний ряд слева
// направо, потом передний, — и медленнее/плавнее). Один раз после того
// как карты улеглись; повтор через WAVE_HOLD, пока игрок не тронул веер.
const WAVE_DUR = 0.95;   // проход волны по ОДНОМУ ряду, сек
const WAVE_GAP = 0.18;   // пауза между рядами, сек
const WAVE_HOLD = 5.0;   // покой перед повтором, сек
const WAVE_LIFT = 24;    // радиальный подъём на гребне, px
const WAVE_SPAN = 0.17;  // ширина «горба» в долях веера — шире = плавнее

const OLD_FADE_OUT = 0.5;
// Заголовок и подпись ждут не фиксированное время, а момент, когда карты
// начинают садиться в веер (правка в чате 2026-09-11: «до этого никакого
// текста на экране» — пока карты просто падают с неба, экран пуст). Момент
// берётся из самого каскада — firstPlaceT, время, когда ПЕРВАЯ карта дошла
// до третьего отскока и пошла дугой в свой слот (см. ниже, физика в draw()).
const TITLE_REVEAL = revealDuration(NEW_TITLE.split(' ').length);
const SUBTITLE_FADE = 0.35;

// Фигура уходит в темноту тем же слоем, что проявлялась на экране 1 —
// пиксельно, стягиваясь обратно к глазам (core/oracle.js, progress 1→0).
const ORACLE_CONCEAL_START = 0;
const ORACLE_CONCEAL = 1.2;
const ORACLE_CELL_SIZE = 4;

// Фон-градиент пустоты пришёл с экрана 1 на полной прозрачности и гаснет
// ЗДЕСЬ — медленно, уже после того как Предсказатель стянулся к глазам
// (правка в чате 2026-08-31: «пусть исчезает медленно после исчезновения
// предсказателя», не мгновенно по тапу на категорию).
const BG_FADE_OUT = 1.6;

// Карты стартуют СРАЗУ, как погасла старая реплика; физика входа и её
// история — в deck/cascade.js.
const CARDS_START = OLD_FADE_OUT;

// Вылет выбранной карты к позиции экрана 3 (то же место, что и в
// draw.js: половина ширины экрана, по центру по вертикали) — правка в
// чате: «плавно вылететь и встать в позицию третьего интерфейса», а не
// резким переключением сцены. Была 0.45h, потом 0.364h — попросили
// медленнее и плавнее, а затем (2026-08-23) — «карту чётко посередине
// экрана», формула здесь и в draw.js/reveal.js обновлены синхронно.
const FLY_DURATION = 0.9;
const FLY_FADE_OTHERS = 0.4; // остальные карты гаснут, чтобы не мешать


// Авто-фит текстовой подписи (BUILD-SPEC-02, задача 3): пробуем базовый
// кегль, потом уменьшаем шагами до 0.8 от базового; если и на 0.8 не
// влезло в maxWidth — переносим на две строки на этом же (0.8) кегле.
// ctx.font после вызова остаётся выставленным на menuOption/scale
// результата — вызывающему коду setFont звать заново не нужно.
function fitLabel(ctx, text, maxWidth, baseScale) {
  const steps = [1, 0.93, 0.86, 0.8];
  for (const step of steps) {
    const lineHeight = setFont(ctx, 'menuOption', baseScale * step);
    if (ctx.measureText(text).width <= maxWidth) {
      return { scale: baseScale * step, lines: [text], lineHeight };
    }
  }
  const scale = baseScale * 0.8;
  const lineHeight = setFont(ctx, 'menuOption', scale);
  return { scale, lines: wrapLines(ctx, text, maxWidth), lineHeight };
}

export function createDeckScreen({ input, images, goto }) {
  let offHandlers = [];
  let t = 0;
  let cards = []; // {angle, w, h, spreadR, delay}
  let pivot = { x: 0, y: 0 };
  let hoveredIndex = null;
  let cardsSettled = false;
  let selected = false; // выбор сделан, дальше не реагируем на ввод
  let waveStart = -1;   // время начала текущей волны-подсказки; -1 — ещё не было
  let firstTouch = false; // игрок коснулся веера — волна и вторая строка больше не нужны
  let flying = false;
  let flyStartT = 0;
  let flyFrom = null; // {x, y, rotation} — позиция и угол карты в момент выбора
  let cascadePrevT = 0; // прошлый t — для шага физики каскада в draw()
  let firstPlaceT = -1; // t, когда первая карта вошла в финальный отскок; -1 = ещё не было


  function layoutCards(w, h) {
    pivot = layoutFan(cards, w, h);
    for (let i = 0; i < CARD_COUNT; i++) cards[i].delay = CARDS_START + i * CASCADE_STAGGER;
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
      waveStart = -1;
      firstTouch = false;
      cascadePrevT = 0;
      firstPlaceT = -1;

      offHandlers = [
        input.on('pressstart', (e) => {
          if (!cardsSettled || selected) return;
          firstTouch = true;
          hoveredIndex = cardIndexAt(cards, pivot, e.x, e.y);
        }),
        input.on('pressmove', (e) => {
          if (!cardsSettled || selected) return;
          firstTouch = true;
          hoveredIndex = cardIndexAt(cards, pivot, e.x, e.y);
        }),
        // Десктоп: подсветка карты под КУРСОРОМ до нажатия (BUILD-SPEC-05
        // 2b.2). На тач-устройствах hover дублирует pressmove и сам затихает.
        input.on('hover', (e) => {
          if (!cardsSettled || selected) return;
          const idx = cardIndexAt(cards, pivot, e.x, e.y);
          if (idx !== null) firstTouch = true;
          hoveredIndex = idx;
        }),
        input.on('hoverend', () => { hoveredIndex = null; }),
        input.on('pressend', () => {
          if (!cardsSettled || selected || hoveredIndex === null) return;
          selected = true;
          flying = true;
          flyStartT = t;
          const c = cards[hoveredIndex];
          const p = cardCenterAt(pivot, c.angle, c.radius + c.spreadR);
          flyFrom = {
            x: p.x - c.w / 2, y: p.y - c.h / 2, w: c.w, h: c.h, rotation: c.angle,
          };
          // только карты со своей мини-игрой (BUILD-SPEC-07 задача 5)
          session.cardId = pickCardId(Object.keys(CARDS).filter((id) => isPlayable(CARDS[id])));
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
        && cards.every((c) => c.placed);
      if (allLanded) cardsSettled = true;

      // Волна-подсказка: первая — через 0.4 с после того как карты улеглись;
      // дальше повтор каждые WAVE_HOLD, пока игрок не тронул веер.
      if (cardsSettled && !firstTouch && !selected) {
        if (waveStart < 0) waveStart = t + 0.4;
        else if (t - waveStart > WAVE_DUR * 2 + WAVE_GAP + WAVE_HOLD) waveStart = t;
      }

      cards.forEach((c, i) => {
        // Только радиальный подъём наведённой карты (вдоль её же угла на
        // дуге) — соседей не трогаем (правка в чате).
        const targetR = i === hoveredIndex ? c.h * LIFT_FRAC : 0;
        const rate = 1 - Math.exp(-SPREAD_RATE * dt);
        c.spreadR += (targetR - c.spreadR) * rate;
      });
    },

    draw(ctx, w, h) {
      ctx.fillStyle = '#111111';
      ctx.fillRect(0, 0, w, h);

      // Фон-градиент с экрана 1: держится полным, пока Предсказатель
      // стягивается (ORACLE_CONCEAL), затем медленно гаснет за BG_FADE_OUT.
      const bgA = 1 - clamp01((t - ORACLE_CONCEAL) / BG_FADE_OUT);
      drawVoidGradient(ctx, w, h, { alpha: bgA, t, topFrac: 0.54, maxLevel: 4 });

      const scale = uiScale(w);
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
      // Заголовок/подпись ждут firstPlaceT — момент, когда первая карта
      // каскада вошла в финальный отскок (физика ниже, в блоке карт).
      // firstPlaceT === -1, пока такого момента не было — тогда titleStart
      // уходит в бесконечность и ни заголовок, ни подпись не показываются.
      const titleStart = firstPlaceT < 0 ? Infinity : firstPlaceT;
      const elapsedTitle = t - titleStart;
      if (elapsedTitle >= 0) {
        const words = layoutWords(ctx, newLines, marginX, ty, titleLH);
        const shown = visibleWordCount(elapsedTitle, words.length);
        for (let i = 0; i < shown; i++) ctx.fillText(words[i].text, words[i].x, words[i].y);
      }

      // Подпись — две строки, одинаковой насыщенности, чуть меньше кеглем
      // (правка в чате 2026-09-10). Первая — про руку («проведи по
      // колоде»), вторая — про доверие и выбор. Обе держатся, мигают
      // вместе; авто-фит по ширине у каждой отдельно.
      const subScale = scale * 0.9;
      const subLines = SUBTITLE_LINES.map((s) => fitLabel(ctx, s, textMaxWidth, subScale));
      const subtitleStart = titleStart + TITLE_REVEAL + 0.25;
      const subtitleFadeIn = clamp01((t - subtitleStart) / SUBTITLE_FADE);
      if (subtitleFadeIn > 0) {
        const subtitleAlpha = subtitleFadeIn >= 1
          ? blinkAlpha(t - (subtitleStart + SUBTITLE_FADE))
          : subtitleFadeIn;
        ctx.fillStyle = '#EBA331';
        ctx.globalAlpha = subtitleAlpha;
        let subY = headerBottomY;
        subLines.forEach((fit) => {
          setFont(ctx, 'menuOption', fit.scale);
          fit.lines.forEach((line) => {
            ctx.fillText(line, marginX, subY);
            subY += fit.lineHeight;
          });
        });
        ctx.globalAlpha = 1;
      }
      // Оракул уходит обратно в темноту — тот же слой, что и на экране 1.
      // Якорь — ФИКСИРОВАННЫЙ (core/oracle.js: headerBottomY), не от
      // фактического числа строк заголовка/подписи ЭТОГО экрана: на
      // экране 1 те же реплики иногда переносятся на 3 строки, здесь
      // заголовок всегда на 2 — от разной высоты шапки фигура «скакала»
      // между экранами (баг, пойман в чате). Подпись по-прежнему растёт
      // от headerBottomY (реального, не фиксированного) — ей нужно не
      // налезать на СВОЙ заголовок, а не совпадать с экраном 1.
      const oracle = computeOracleLayout(w, oracleHeaderBottomY(ty, titleLH, scale), scale, images.futureTellerBody);
      const concealProgress = clamp01(1 - (t - ORACLE_CONCEAL_START) / ORACLE_CONCEAL);
      drawOracleBody(ctx, images, oracle, concealProgress, ORACLE_CELL_SIZE);
      drawOracleEyes(ctx, images, oracle, concealProgress);

      layoutCards(w, h);

      const drawCard = (cx, cy, cw, ch, rotation, accent) => (
        drawCardBack(ctx, images, cx, cy, cw, ch, rotation, accent)
      );

      if (flying && flyFrom) {
        // Выбранная карта плавно летит к позиции экрана 3 (draw.js) —
        // тот же фиксированный размер CARD_W×CARD_H и там, и там, и та же
        // формула центрирования, чтобы при смене сцены не было скачка — и
        // выпрямляется по пути из своего угла на веере обратно в 0.
        const flyP = easeInOutQuad(clamp01((t - flyStartT) / FLY_DURATION));
        const targetX = Math.round((w - flyFrom.w) / 2);
        const targetY = Math.round((h - flyFrom.h) / 2);
        const x = flyFrom.x + (targetX - flyFrom.x) * flyP;
        const y = flyFrom.y + (targetY - flyFrom.y) * flyP;
        const rotation = flyFrom.rotation * (1 - flyP);

        ctx.globalAlpha = clamp01(1 - (t - flyStartT) / FLY_FADE_OTHERS);
        cards.forEach((c, i) => {
          if (i === hoveredIndex) return;
          const p = cardCenterAt(pivot, c.angle, c.radius);
          drawCard(p.x, p.y, c.w, c.h, c.angle, false);
        });
        ctx.globalAlpha = 1;

        drawCard(x + flyFrom.w / 2, y + flyFrom.h / 2, flyFrom.w, flyFrom.h, rotation, true);
        return;
      }

      // Волна-подсказка идёт по очереди: задний ряд (row 0) слева направо за
      // WAVE_DUR, пауза WAVE_GAP, потом передний ряд (row 1). Плавный горб.
      // Применяется только к уже приземлившимся картам (см. ниже).
      const waveTotal = WAVE_DUR * 2 + WAVE_GAP;
      const waveLocal = waveStart >= 0 ? t - waveStart : -99;
      const waveActive = !firstTouch && waveLocal >= 0 && waveLocal < waveTotal + 0.1;

      // Вход: карты падают с неба (физика — deck/cascade.js). Шаг привязан
      // к dt кадра (cascadePrevT). Рисуем строго по индексу (карта правее —
      // «спереди»).
      const cascDt = Math.min(Math.max(t - cascadePrevT, 0), 0.033);
      cascadePrevT = t;
      stepCascade(cards, pivot, {
        t, dt: cascDt, w, h,
        // Заголовок/подпись ждали именно этого момента — первая
        // карта дошла до финального отскока (см. блок текста выше).
        onPlace: (pt) => { if (firstPlaceT < 0) firstPlaceT = pt; },
      });

      // 2) Сами карты. До запуска — не рисуем. В свободном полёте — по физике,
      //    без поворота. На финальном отскоке — по дуге, доворачиваясь в свой
      //    угол. После посадки — обычная жизнь веера (радиальный ховер-подъём
      //    + волна-подсказка), та же формула, что раньше.
      cards.forEach((c, i) => {
        if (t < c.delay || c.cx === undefined) return;

        if (c.placed) {
          let waveLift = 0;
          if (waveActive) {
            const rowStart = c.row === 0 ? 0 : WAVE_DUR + WAVE_GAP;
            const rp = (waveLocal - rowStart) / WAVE_DUR; // 0..1 проход по этому ряду
            if (rp > -0.05 && rp < 1.08) {
              const head = rp * 1.2 - 0.1; // от -0.1 до 1.1 по вееру
              const dd = Math.abs(head - c.fx);
              if (dd < WAVE_SPAN) waveLift = Math.cos((dd / WAVE_SPAN) * Math.PI * 0.5) * WAVE_LIFT;
            }
          }
          const p = cardCenterAt(pivot, c.angle, c.radius + c.spreadR + waveLift);
          drawCard(p.x, p.y, c.w, c.h, c.angle, i === hoveredIndex);
          return;
        }

        if (c.placing) {
          drawCard(c.cx, c.cy, c.w, c.h, placingAngle(c, t), false);
          return;
        }

        drawCard(c.cx, c.cy, c.w, c.h, 0, false); // свободный полёт — без поворота
      });
    },
  };
}
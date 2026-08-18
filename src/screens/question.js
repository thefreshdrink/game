// Экран 1 — оракул проступает из темноты, задаёт два вопроса голосом,
// затем открывает выбор категории. Референс по финальной раскладке:
// docs/interfaces/Main - The question.png — но сама интро-сцена (проявление
// фигуры, моргание, отложенное появление свечения у рук, два вступительных
// вопроса) в документах не описана — это правки по ходу работы, добавлено
// 2026-08-16, см. docs/decisions-log.md.
//
// Расхождение с BUILD-SPEC.md, зафиксировано вслух (правило CLAUDE.md
// «скажи, не сглаживай молча»): текст задания рисует пункты меню
// столбиком с одним ►. На самом референсном PNG пункты идут в один ряд,
// и «›» стоит перед каждым, просто активный — акцентный, а не белый.
// Взят вариант с PNG: он помечен в CLAUDE.md как канон по UI.

import { CATEGORIES } from '../data/cards.js';
import { session } from '../core/session.js';
import { setFont, wrapLines } from '../core/text.js';
import { layoutWords, visibleWordCount, revealDuration } from '../core/textReveal.js';
import { computeOracleLayout, drawOracleBody, drawOracleEyes } from '../core/oracle.js';

const LABELS = { work: 'WORK', love: 'LOVE', mental: 'MENTAL' };

// Без пальца на экране пункты сами по очереди загораются акцентом —
// динамика, о которой просили в чате. Резкое переключение, без fade
// (тот же стиль, что и у точек — «плавно» не понравилось). Палец поверх
// автоцикла — pressedIndex всегда важнее.
const MENU_ITEM_ON = 0.8;

// Точки свечения у рук — 10 отдельных кластеров (найдены разбором связных
// областей в oracle_sparks.png), а не один кусок: нужны порознь, чтобы
// мерцать по очереди, а не одним пятном.
const DOTS_SRC = [
  { sx: 71, sy: 420, sw: 8, sh: 8 },
  { sx: 91, sy: 392, sw: 12, sh: 12 },
  { sx: 107, sy: 356, sw: 12, sh: 12 },
  { sx: 123, sy: 440, sw: 12, sh: 12 },
  { sx: 131, sy: 400, sw: 12, sh: 12 },
  { sx: 295, sy: 436, sw: 12, sh: 12 },
  { sx: 303, sy: 392, sw: 12, sh: 12 },
  { sx: 335, sy: 368, sw: 8, sh: 8 },
  { sx: 335, sy: 412, sw: 12, sh: 12 },
  { sx: 347, sy: 444, sw: 12, sh: 12 },
];

// Мерцание — каждая точка светится в своей фазе цикла, поэтому зажигаются
// по очереди, а не одним пятном сразу. Без плавного fade — сразу 100% и
// сразу 0%, как переключатель (правка в чате: «плавно» не понравилось,
// темп и очередность — да, их не трогаем).
const DOT_CYCLE = 2.2;
const DOT_ON = 1.0; // суммарная длительность «горит», была fade-in+hold+fade-out

function twinkleAlpha(localT) {
  if (localT < 0) return 0;
  if (localT < DOT_ON) return 1;
  return 0;
}

// Тайминги интро, секунды.
//
// Реплики не fade-in целиком — каждое слово выскакивает сразу на 100%
// яркости, слово за словом (core/textReveal.js). Первая реплика гаснет
// плавно и полностью ПРЕЖДЕ, чем начинает появляться вторая — раньше
// они шли внахлёст, читалось грязно (правка в чате: «накладываются
// друг на друга»). Вторая реплика никуда не исчезает — остаётся
// заголовком экрана.
const EYES_FADE = 0.5;
const EYES_HOLD = 0.4; // одни глаза в темноте, до первой реплики

const TEXT1 = 'Do you want to see the future?';
const TEXT2 = 'What is your question about?';

const TEXT1_REVEAL = revealDuration(TEXT1.split(' ').length);
const TEXT1_READ_HOLD = 1.4; // держим прочитанной, прежде чем гасить
const TEXT1_FADE_OUT = 0.5; // единственный плавный переход у текста

const TEXT2_REVEAL = revealDuration(TEXT2.split(' ').length);
const TEXT2_READ_HOLD = 1.6;

// Силуэт проступает пикселями, расходящимися от глаз волной наружу
// (core/pixelReveal.js) — перебирали в чате Bayer-узор, чересстрочные
// жалюзи, равномерный случайный шум; в итоге важны обе вещи разом:
// пиксельная фактура И направление от головы.
const BODY_REVEAL = 3.2;
const BODY_CELL_SIZE = 4; // экранных px на ячейку

// Пункты меню появляются по одному, сразу на 100% (без общего fade на
// всю группу) — тот же стиль резкого появления, что у слов реплик и у
// точек свечения (правка в чате).
const OPTION_ITEM_STAGGER = 0.18;

const TEXT1_START = EYES_FADE + EYES_HOLD;
// Первая реплика начинает гаснуть здесь же — тогда же проступает силуэт.
const BODY_START = TEXT1_START + TEXT1_REVEAL + TEXT1_READ_HOLD;
// Вторая реплика ждёт, пока силуэт проступит ПОЛНОСТЬЮ — не раньше
// (правка в чате), не просто пока погаснет первая реплика.
const TEXT2_START = BODY_START + BODY_REVEAL;
const OPTIONS_START = TEXT2_START + TEXT2_REVEAL + TEXT2_READ_HOLD;

// Моргание — процедурное, кадра нет (ASSETS.md): просто не рисуем слой
// глаз на пару кадров. Фиксированный ритм, попросили ровно 2.5 сек
// (правка в чате) — раньше был случайный разброс 2.6–5.5.
const BLINK_MIN = 2.5;
const BLINK_MAX = 2.5;
const BLINK_DURATION = 0.12;

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

export function createQuestionScreen({ input, images, goto }) {
  let offHandlers = [];
  let items = []; // {category, label, x0, x1, y}
  let t = 0;
  let blinkTimer = BLINK_MIN + Math.random() * (BLINK_MAX - BLINK_MIN);
  let blinking = false;
  let blinkT = 0;
  let pressedIndex = null; // подсветка «пальцем сейчас здесь», не финальный выбор

  function itemAt(x, y) {
    const idx = items.findIndex(
      (it) => x >= it.x0 - 10 && x <= it.x1 + 10 && Math.abs(y - it.y) < 22,
    );
    return idx === -1 ? null : idx;
  }

  function layout(ctx, w, scale, y) {
    const marginX = Math.round(53 * scale);
    setFont(ctx, 'menuOption', scale);
    const gap = Math.round(30 * scale);

    items = [];
    let x = marginX;
    for (const cat of CATEGORIES) {
      const label = `›${LABELS[cat]}`; // › + имя, как на референсе
      const width = ctx.measureText(label).width;
      items.push({ category: cat, label, x0: x, x1: x + width, y });
      x += width + gap;
    }
  }

  return {
    enter() {
      t = 0;
      blinking = false;
      blinkTimer = BLINK_MIN + Math.random() * (BLINK_MAX - BLINK_MIN);
      pressedIndex = null;

      const optionsReady = () => t >= OPTIONS_START + (CATEGORIES.length - 1) * OPTION_ITEM_STAGGER;

      offHandlers = [
        input.on('pressstart', (e) => {
          pressedIndex = optionsReady() ? itemAt(e.x, e.y) : null;
        }),
        input.on('pressmove', (e) => {
          if (pressedIndex === null && !optionsReady()) return;
          pressedIndex = optionsReady() ? itemAt(e.x, e.y) : null;
        }),
        input.on('pressend', () => {
          pressedIndex = null;
        }),
        input.on('tap', (e) => {
          if (!optionsReady()) return;
          const idx = itemAt(e.x, e.y);
          if (idx === null) return;
          session.category = items[idx].category;
          goto('deck');
        }),
      ];
    },

    exit() {
      offHandlers.forEach((off) => off());
      offHandlers = [];
    },

    update(dt) {
      t += dt;

      // Моргание идёт всё время, уже во время проявления глаз (правка в
      // чате: «глаза появляются, которые уже моргают») — при малой
      // альфе не заметно, а как только глаза видны, моргание уже готово.
      if (blinking) {
        blinkT += dt;
        if (blinkT >= BLINK_DURATION) {
          blinking = false;
          blinkTimer = BLINK_MIN + Math.random() * (BLINK_MAX - BLINK_MIN);
        }
        return;
      }
      blinkTimer -= dt;
      if (blinkTimer <= 0) {
        blinking = true;
        blinkT = 0;
      }
    },

    draw(ctx, w, h) {
      ctx.fillStyle = '#111111';
      ctx.fillRect(0, 0, w, h);

      const scale = Math.min(Math.max(w / 430, 0.75), 1.25);
      const marginX = Math.round(53 * scale);
      const textMaxWidth = w - marginX * 2;

      // Обе реплики оракула переносятся под ширину экрана (Alagard не
      // моноширинный, на глаз перенос не угадать — только measureText).
      // Число строк берём по более длинной реплике, чтобы меню категорий
      // не прыгало по вертикали при смене текста.
      const titleLH = setFont(ctx, 'title', scale);
      const lines1 = wrapLines(ctx, TEXT1, textMaxWidth);
      const lines2 = wrapLines(ctx, TEXT2, textMaxWidth);
      const maxLines = Math.max(lines1.length, lines2.length);
      const ty = Math.round(70 * scale); // ещё выше — 160 → 130 → 70 (правки в чате)
      const optionsY = ty + maxLines * titleLH + Math.round(9 * scale);

      // Оракул — оригинальный размер (100% ширины, PNG не ужимается),
      // но не прижат к низу: макушка ставится на высоту, которая уже
      // понравилась (правка в чате), а низ уходит за край экрана и
      // обрезается канвасом — это явно разрешено («ничего страшного, если
      // фигура уйдёт вниз»), скролл не заводим (запрещён в CLAUDE.md).
      const oracle = computeOracleLayout(w, optionsY, scale, images.futureTellerBody);

      const eyesAlpha = clamp01(t / EYES_FADE) * (blinking ? 0 : 1);
      const bodyProgress = clamp01((t - BODY_START) / BODY_REVEAL);

      // Тело — пикселями от глаз из темноты; глаза — отдельным слоем
      // поверх, они проступают раньше и не зависят от прогресса тела.
      drawOracleBody(ctx, images, oracle, bodyProgress, BODY_CELL_SIZE);
      drawOracleEyes(ctx, images, oracle, eyesAlpha);

      if (t >= OPTIONS_START) {
        const dotPhaseStep = DOT_CYCLE / DOTS_SRC.length;
        DOTS_SRC.forEach((dot, i) => {
          const localT = ((t - OPTIONS_START + i * dotPhaseStep) % DOT_CYCLE + DOT_CYCLE) % DOT_CYCLE;
          const alpha = twinkleAlpha(localT);
          if (alpha <= 0) return;
          ctx.globalAlpha = alpha;
          ctx.drawImage(
            images.futureTellerSparks,
            dot.sx, dot.sy, dot.sw, dot.sh,
            Math.round(oracle.oracleX + dot.sx * oracle.oracleScale),
            Math.round(oracle.oracleY + dot.sy * oracle.oracleScale),
            Math.round(dot.sw * oracle.oracleScale),
            Math.round(dot.sh * oracle.oracleScale),
          );
        });
        ctx.globalAlpha = 1;
      }

      // Голос оракула — слово за словом, сразу на 100%. Первая реплика
      // гаснет плавно (единственный fade), вторая остаётся заголовком.
      setFont(ctx, 'title', scale);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#FFFFFF';

      const elapsed1 = t - TEXT1_START;
      if (elapsed1 >= 0 && elapsed1 < TEXT1_REVEAL + TEXT1_READ_HOLD + TEXT1_FADE_OUT) {
        const words1 = layoutWords(ctx, lines1, marginX, ty, titleLH);
        const fadeT = elapsed1 - (TEXT1_REVEAL + TEXT1_READ_HOLD);
        ctx.globalAlpha = fadeT > 0 ? clamp01(1 - fadeT / TEXT1_FADE_OUT) : 1;
        const shown = visibleWordCount(elapsed1, words1.length);
        for (let i = 0; i < shown; i++) ctx.fillText(words1[i].text, words1[i].x, words1[i].y);
        ctx.globalAlpha = 1;
      }

      const elapsed2 = t - TEXT2_START;
      if (elapsed2 >= 0) {
        const words2 = layoutWords(ctx, lines2, marginX, ty, titleLH);
        const shown = visibleWordCount(elapsed2, words2.length);
        for (let i = 0; i < shown; i++) ctx.fillText(words2[i].text, words2[i].x, words2[i].y);
      }

      // Меню категорий — появляются по одному пункту, сразу на 100%
      // (правка в чате: «по словам по очереди, не всё сразу»).
      if (t >= OPTIONS_START) {
        layout(ctx, w, scale, optionsY);
        setFont(ctx, 'menuOption', scale);
        const allShownT = OPTIONS_START + (items.length - 1) * OPTION_ITEM_STAGGER;
        const autoIndex = t >= allShownT
          ? Math.floor((t - allShownT) / MENU_ITEM_ON) % items.length
          : null;
        const highlighted = pressedIndex !== null ? pressedIndex : autoIndex;
        items.forEach((it, i) => {
          if (t < OPTIONS_START + i * OPTION_ITEM_STAGGER) return;
          ctx.fillStyle = i === highlighted ? '#EBA331' : '#FFFFFF';
          ctx.fillText(it.label, it.x0, it.y);
        });
      }
    },
  };
}

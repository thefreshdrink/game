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
import { textButtonZone, zoneHit } from '../core/textButton.js';
import { layoutWords, visibleWordCount, revealDuration } from '../core/textReveal.js';
import {
  computeOracleLayout, drawOracleBody, drawOracleEyes, headerBottomY,
} from '../core/oracle.js';

const LABELS = { work: 'WORK', love: 'LOVE', mental: 'MENTAL' };

// Без пальца/курсора на экране пункты сами по очереди загораются —
// динамика, о которой просили в чате. Резкое переключение, без fade
// (тот же стиль, что и у точек — «плавно» не понравилось). Но это
// ХОЛОСТОЙ перебор: акцент в полсилы (globalAlpha 0.55), полный акцент
// только под пальцем или курсором (BUILD-SPEC-03 задача 9).
const MENU_ITEM_ON = 0.8;
const IDLE_CYCLE_ALPHA = 0.55;

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
// Было 3.2 — «слишком долгая анимация появления» (правка в чате,
// 2026-08-23); уход оракула на экране 2 (deck.js, ORACLE_CONCEAL) в этой
// правке не тронут — там жалобы не было.
const BODY_REVEAL = 1.8;
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

// Фон-градиент (правка в чате 2026-08-31): та же идея, что пропасть в
// мини-игре Leap — тёмные тона пустоты снизу, — но НЕ пиксельный дизер, а
// плавный линейный градиент, и проявляется медленно из темноты только
// ПОСЛЕ того, как фигура Предсказателя проступила целиком.
const BG_FADE_DUR = 3.0;
const OPTIONS_START = TEXT2_START + TEXT2_REVEAL + TEXT2_READ_HOLD;

// Короткий вход на возврате (BUILD-SPEC-02, задача 2): полное интро — ~9с
// до первого тапа, на втором круге это уже не ритуал, а пошлина. Фигура
// сразу проявлена (без пиксельного прохода), первой реплики нет, вторая
// стартует с нулевой задержки, пункты — через 0.3с после последнего слова.
// Только первый вход за сессию (перезагрузка = снова первый) играет
// полное интро — session.seenIntro, в памяти, не в сторадже.
const RETURN_TEXT2_START = 0;
const RETURN_OPTIONS_GAP = 0.3;

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
  let items = []; // {category, label, zone}
  let t = 0;
  let blinkTimer = BLINK_MIN + Math.random() * (BLINK_MAX - BLINK_MIN);
  let blinking = false;
  let blinkT = 0;
  let pressedIndex = null; // подсветка «пальцем сейчас здесь», не финальный выбор
  let hoverIndex = null;   // подсветка «курсор над пунктом» (десктоп)
  let shortMode = false; // короткий вход на возврате — session.seenIntro на момент enter()
  let introMarked = false; // session.seenIntro уже выставлен в этом заходе
  let text2Start = TEXT2_START;
  let optionsStart = OPTIONS_START;

  function itemAt(x, y) {
    const idx = items.findIndex((it) => zoneHit(it.zone, x, y));
    return idx === -1 ? null : idx;
  }

  function layout(ctx, w, scale, y) {
    const marginX = Math.round(53 * scale);
    const lineHeight = setFont(ctx, 'menuOption', scale);
    const gap = Math.round(30 * scale);

    items = [];
    let x = marginX;
    for (const cat of CATEGORIES) {
      const label = `›${LABELS[cat]}`; // › + имя, как на референсе
      const width = ctx.measureText(label).width;
      items.push({
        category: cat, label, x, y,
        zone: textButtonZone(x, y, width, lineHeight),
      });
      x += width + gap;
    }
  }

  return {
    enter() {
      t = 0;
      blinking = false;
      blinkTimer = BLINK_MIN + Math.random() * (BLINK_MAX - BLINK_MIN);
      pressedIndex = null;
      hoverIndex = null;
      introMarked = false;

      // Короткий вход — только если полное интро уже отыграло в этой
      // сессии (перезагрузка страницы сбрасывает session.seenIntro,
      // это ожидаемо — «снова первый вход»).
      shortMode = session.seenIntro;
      text2Start = shortMode ? RETURN_TEXT2_START : TEXT2_START;
      optionsStart = shortMode ? text2Start + TEXT2_REVEAL + RETURN_OPTIONS_GAP : OPTIONS_START;

      const optionsReady = () => t >= optionsStart + (CATEGORIES.length - 1) * OPTION_ITEM_STAGGER;

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
          hoverIndex = null; // тач: pointermove после отрыва не придёт, чистим руками
        }),
        input.on('hover', (e) => {
          hoverIndex = optionsReady() ? itemAt(e.x, e.y) : null;
        }),
        input.on('hoverend', () => {
          hoverIndex = null;
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

      // Флаг ставится, когда интро доиграло до появления пунктов — что в
      // полном, что в коротком заходе (BUILD-SPEC-02, задача 2). Дальше
      // именно он решает, каким будет вход в следующий раз.
      if (!introMarked && t >= optionsStart) {
        session.seenIntro = true;
        introMarked = true;
      }

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

      // Фон-градиент: медленно проявляется из темноты снизу вверх, только
      // после полного проявления фигуры (на возврате — сразу). Плавный
      // линейный градиент из тонов пустоты, без пиксельного дизера.
      const bgStart = shortMode ? 0 : TEXT2_START;
      const bgA = clamp01((t - bgStart) / BG_FADE_DUR);
      if (bgA > 0) {
        const gTop = Math.round(h * 0.52);
        const grad = ctx.createLinearGradient(0, gTop, 0, h);
        grad.addColorStop(0, '#111111');
        grad.addColorStop(0.45, '#1C1C1C');
        grad.addColorStop(0.75, '#252525');
        grad.addColorStop(1, '#2E2E2E');
        ctx.save();
        ctx.globalAlpha = bgA;
        ctx.fillStyle = grad;
        ctx.fillRect(0, gTop, w, h - gTop);
        ctx.restore();
      }

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
      //
      // Якорь оракула — ФИКСИРОВАННЫЙ (core/oracle.js: headerBottomY), не
      // optionsY: тот считается по фактическому числу строк ЭТОГО экрана
      // (иногда 3 у длинной реплики), а на экране 2 заголовок всегда
      // 2 строки — оракул «скакал» между экранами на высоту строки
      // (баг, пойман в чате). Меню по-прежнему на optionsY — ему нужно
      // реальное число строк, чтобы не налезать на текст.
      const oracle = computeOracleLayout(w, headerBottomY(ty, titleLH, scale), scale, images.futureTellerBody);

      // Короткий вход: фигура уже проявлена целиком, без пиксельного
      // прохода — глаза без нарастания альфы, только моргание как обычно
      // (правка в чате, BUILD-SPEC-02 задача 2).
      const eyesAlpha = (shortMode ? 1 : clamp01(t / EYES_FADE)) * (blinking ? 0 : 1);
      const bodyProgress = shortMode ? 1 : clamp01((t - BODY_START) / BODY_REVEAL);

      // Лёгкое парение (синус по Y) пробовали и убрали — правка в чате,
      // 2026-08-23: «двигается не плавно а пиксельно и глаза опаздывают
      // за ним». Причина техническая, не решаемая без нарушения других
      // правил: спрайты рисуются только по целым координатам (CLAUDE.md),
      // а амплитуда дыхания — единицы px, поэтому непрерывный синус
      // округлялся до соседних пиксельных шагов заметными скачками; тело
      // и глаза считают свой Math.round от разных выражений и округлялись
      // не в один и тот же момент — отсюда рассинхрон. Пользователь прямо
      // разрешил «либо плавно, либо не делать» — оставлена статичная
      // фигура.

      // Тело — пикселями от глаз из темноты; глаза — отдельным слоем
      // поверх, они проступают раньше и не зависят от прогресса тела.
      drawOracleBody(ctx, images, oracle, bodyProgress, BODY_CELL_SIZE);
      drawOracleEyes(ctx, images, oracle, eyesAlpha);

      // Голос оракула — слово за словом, сразу на 100%. Первая реплика
      // гаснет плавно (единственный fade), вторая остаётся заголовком.
      setFont(ctx, 'title', scale);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#FFFFFF';

      // Короткий вход: первой реплики нет вообще (BUILD-SPEC-02 задача 2).
      const elapsed1 = t - TEXT1_START;
      if (!shortMode && elapsed1 >= 0 && elapsed1 < TEXT1_REVEAL + TEXT1_READ_HOLD + TEXT1_FADE_OUT) {
        const words1 = layoutWords(ctx, lines1, marginX, ty, titleLH);
        const fadeT = elapsed1 - (TEXT1_REVEAL + TEXT1_READ_HOLD);
        ctx.globalAlpha = fadeT > 0 ? clamp01(1 - fadeT / TEXT1_FADE_OUT) : 1;
        const shown = visibleWordCount(elapsed1, words1.length);
        for (let i = 0; i < shown; i++) ctx.fillText(words1[i].text, words1[i].x, words1[i].y);
        ctx.globalAlpha = 1;
      }

      const elapsed2 = t - text2Start;
      if (elapsed2 >= 0) {
        const words2 = layoutWords(ctx, lines2, marginX, ty, titleLH);
        const shown = visibleWordCount(elapsed2, words2.length);
        for (let i = 0; i < shown; i++) ctx.fillText(words2[i].text, words2[i].x, words2[i].y);
      }

      // Меню категорий — появляются по одному пункту, сразу на 100%
      // (правка в чате: «по словам по очереди, не всё сразу»).
      if (t >= optionsStart) {
        layout(ctx, w, scale, optionsY);
        setFont(ctx, 'menuOption', scale);
        const allShownT = optionsStart + (items.length - 1) * OPTION_ITEM_STAGGER;
        const autoIndex = t >= allShownT
          ? Math.floor((t - allShownT) / MENU_ITEM_ON) % items.length
          : null;
        // Приоритет: палец > курсор > холостой перебор. Первые два — полный
        // акцент; перебор — акцент в полсилы (задача 9).
        const active = pressedIndex !== null ? pressedIndex : hoverIndex;
        items.forEach((it, i) => {
          if (t < optionsStart + i * OPTION_ITEM_STAGGER) return;
          if (i === active) {
            ctx.fillStyle = '#EBA331';
            ctx.fillText(it.label, it.x, it.y);
          } else if (active === null && i === autoIndex) {
            ctx.fillStyle = '#EBA331';
            ctx.globalAlpha = IDLE_CYCLE_ALPHA;
            ctx.fillText(it.label, it.x, it.y);
            ctx.globalAlpha = 1;
          } else {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText(it.label, it.x, it.y);
          }
        });
      }
    },
  };
}

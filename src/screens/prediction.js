// Экран 6 — Предсказание. Референс: docs/interfaces/The prediction.png —
// но там текст банка показан КАПСОМ; сами тексты в data/cards.js написаны
// обычным регистром (голос оракула, не лейбл-кнопка вроде WORK/CONTINUE).
// Расхождение фиксирую вслух (правило CLAUDE.md): беру обычный регистр —
// так же как реплики оракула на экране 1, а не как подписи-кнопки.
//
// Итог мини-игры на текст не влияет — банк статичный, только подстановка
// по ключу card.reading[category] (BUILD-SPEC, GDD §7.4).

import { CARDS, getReading } from '../data/cards.js';
import { session, resetSession } from '../core/session.js';
import { setFont, wrapLines } from '../core/text.js';
import { textButtonZone, zoneHit } from '../core/textButton.js';

const CHAR_INTERVAL = 0.022; // сек/символ — «~22 мс», значение из прототипа
const CURSOR_BLINK = 0.5;

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

export function createPredictionScreen({ input, goto }) {
  let offTap = null;
  let t = 0;
  let fullText = '';
  let promptZone = null; // хит-зона ›ONE MORE QUESTION (textButton.js)

  function shownCount() {
    return Math.min(fullText.length, Math.floor(t / CHAR_INTERVAL));
  }

  function typingDone() {
    return shownCount() >= fullText.length;
  }

  return {
    enter() {
      t = 0;
      const card = CARDS[session.cardId] ?? CARDS.fool;
      fullText = getReading(card.id, session.category ?? 'work');

      offTap = input.on('tap', (e) => {
        if (!typingDone()) { t = fullText.length * CHAR_INTERVAL; return; }
        if (!zoneHit(promptZone, e.x, e.y)) return;
        resetSession();
        goto('question');
      });
    },

    exit() {
      offTap?.();
    },

    update(dt) {
      t += dt;
    },

    draw(ctx, w, h) {
      ctx.fillStyle = '#111111';
      ctx.fillRect(0, 0, w, h);

      const scale = Math.min(Math.max(w / 430, 0.75), 1.25);
      const marginX = Math.round(53 * scale);
      const textMaxWidth = w - marginX * 2;
      const card = CARDS[session.cardId] ?? CARDS.fool;

      const titleLH = setFont(ctx, 'title', scale);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#FFFFFF';
      // Экран 6 — не часть связки «The deck offers itself…» с экранов
      // 2–5, а отдельный, самостоятельный момент (само предсказание) —
      // держит собственный, более низкий уровень заголовка (правка в
      // чате: «сделай как было по расположению текста»), а не общий
      // уровень 70 экранов 1–5.
      const titleY = Math.round(230 * scale);
      ctx.fillText(card.name, marginX, titleY);

      const bodyLH = setFont(ctx, 'body', scale);
      const lines = wrapLines(ctx, fullText, textMaxWidth);

      const shown = shownCount();
      let consumed = 0;
      let cursorX = marginX;
      let cursorY = titleY + titleLH + Math.round(28 * scale);
      const bodyStartY = cursorY;
      ctx.fillStyle = '#FFFFFF';
      lines.forEach((line, i) => {
        const lineY = bodyStartY + i * bodyLH;
        const visible = Math.max(0, Math.min(line.length, shown - consumed));
        if (visible > 0) {
          const text = line.slice(0, visible);
          ctx.fillText(text, marginX, lineY);
          cursorX = marginX + ctx.measureText(text).width;
          cursorY = lineY;
        }
        consumed += line.length + 1; // +1 — пробел, «съеденный» переносом
      });

      if (!typingDone() && Math.floor(t / CURSOR_BLINK) % 2 === 0) {
        ctx.fillRect(Math.round(cursorX) + 2, Math.round(cursorY) - bodyLH + 4, Math.round(2 * scale), bodyLH - 6);
      }

      if (typingDone()) {
        const lineHeight = setFont(ctx, 'menuOption', scale);
        ctx.fillStyle = '#EBA331';
        const promptY = bodyStartY + lines.length * bodyLH + Math.round(28 * scale);
        const label = '›ONE MORE QUESTION';
        ctx.fillText(label, marginX, promptY);
        const width = ctx.measureText(label).width;
        // Одна формула хит-зоны на все экраны (задача 9). Своей подсветки
        // под курсором у этой подписи нет — она и так статичный акцент,
        // подсвечивать нечего (в отличие от мигающей ›KEEP GOING и
        // перебора категорий).
        promptZone = textButtonZone(marginX, promptY, width, lineHeight);
      }
    },
  };
}

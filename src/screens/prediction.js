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
const PARA_PAUSE = 0.6;      // печать замирает на границе абзацев (задача 10)
const PARA_GAP_LINES = 1;    // пустая строка между абзацами

export function createPredictionScreen({ input, goto }) {
  let offTap = null;
  let t = 0;
  let promptZone = null; // хит-зона ›ONE MORE QUESTION (textButton.js)
  // Тексты банка приходят одной строкой; `\n\n` (пустая строка) делит их
  // на абзацы (задача 10). Одиночные переводы строки внутри абзаца
  // схлопываем в пробел — wrapLines рвёт только по пробелам.
  let paragraphs = [];

  /** Общая длительность печати: все символы + паузы на стыках абзацев. */
  function totalTime() {
    const chars = paragraphs.reduce((s, p) => s + p.length, 0);
    return chars * CHAR_INTERVAL + Math.max(0, paragraphs.length - 1) * PARA_PAUSE;
  }

  function typingDone() {
    return t >= totalTime();
  }

  /** Сколько символов каждого абзаца показано к моменту t (с паузами). */
  function paragraphReveal() {
    if (typingDone()) return paragraphs.map((p) => p.length);
    let time = Math.max(0, t);
    return paragraphs.map((para, i) => {
      const full = para.length * CHAR_INTERVAL;
      if (time >= full) {
        time -= full + (i < paragraphs.length - 1 ? PARA_PAUSE : 0);
        if (time < 0) time = 0;
        return para.length;
      }
      const n = Math.floor(time / CHAR_INTERVAL);
      time = 0;
      return n;
    });
  }

  return {
    enter() {
      t = 0;
      const card = CARDS[session.cardId] ?? CARDS.fool;
      const raw = getReading(card.id, session.category ?? 'work');
      paragraphs = raw
        .split(/\n[ \t]*\n/)
        .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
        .filter(Boolean);

      offTap = input.on('tap', (e) => {
        if (!typingDone()) { t = totalTime(); return; }
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
      const reveal = paragraphReveal();

      let cursorX = marginX;
      let cursorY = titleY + titleLH + Math.round(28 * scale);
      const bodyStartY = cursorY;
      let lineIndex = 0; // сквозной номер визуальной строки, с учётом пустых
      ctx.fillStyle = '#FFFFFF';
      paragraphs.forEach((para, pi) => {
        const shown = reveal[pi];
        let consumed = 0;
        wrapLines(ctx, para, textMaxWidth).forEach((line) => {
          const lineY = bodyStartY + lineIndex * bodyLH;
          const visible = Math.max(0, Math.min(line.length, shown - consumed));
          if (visible > 0) {
            const text = line.slice(0, visible);
            ctx.fillText(text, marginX, lineY);
            cursorX = marginX + ctx.measureText(text).width;
            cursorY = lineY;
          }
          consumed += line.length + 1; // +1 — пробел, «съеденный» переносом
          lineIndex++;
        });
        if (pi < paragraphs.length - 1) lineIndex += PARA_GAP_LINES; // пустая строка
      });

      if (!typingDone() && Math.floor(t / CURSOR_BLINK) % 2 === 0) {
        ctx.fillRect(Math.round(cursorX) + 2, Math.round(cursorY) - bodyLH + 4, Math.round(2 * scale), bodyLH - 6);
      }

      if (typingDone()) {
        const lineHeight = setFont(ctx, 'menuOption', scale);
        ctx.fillStyle = '#EBA331';
        const promptY = bodyStartY + lineIndex * bodyLH + Math.round(28 * scale);
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

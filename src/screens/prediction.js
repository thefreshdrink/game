// Экран 6 — Предсказание. Референс: docs/interfaces/The prediction.png —
// но там текст банка показан КАПСОМ; сами тексты в data/cards.js написаны
// обычным регистром (голос оракула, не лейбл-кнопка вроде WORK/CONTINUE).
// Расхождение фиксирую вслух (правило CLAUDE.md): беру обычный регистр —
// так же как реплики оракула на экране 1, а не как подписи-кнопки.
//
// Итог мини-игры на текст не влияет — банк статичный, только подстановка
// по ключу card.reading[category] (BUILD-SPEC, GDD §7.4).
//
// Расхождение с референсом, зафиксировано вслух (правило CLAUDE.md): на
// The prediction.png низ экрана пустой, а здесь у нижней кромки остаётся
// сцена мини-игры, из которой пришли (`createAfterscene` в паспорте
// мини-игры, minigames/index.js) — по правке в чате 2026-08-30: экраны 5→6
// склеиваются без скачка. У карты без своей сцены низ пустой, как на фрейме.

import { CARDS, getReading } from '../data/cards.js';
import { session, resetSession } from '../core/session.js';
import { setFont, wrapLines, uiScale } from '../core/text.js';
import { textButtonZone, zoneHit } from '../core/textButton.js';
import { MINIGAMES } from '../minigames/index.js';

const CHAR_INTERVAL = 0.022; // сек/символ — «~22 мс», значение из прототипа
const CURSOR_BLINK = 0.5;
const PARA_PAUSE = 0.6;      // печать замирает на границе абзацев (задача 10)
const PARA_GAP_LINES = 1;    // пустая строка между абзацами

export function createPredictionScreen({ input, images, goto }) {
  let offTap = null;
  let t = 0;
  let promptZone = null; // хит-зона ›ONE MORE QUESTION (textButton.js)
  // Тексты банка приходят одной строкой; `\n\n` (пустая строка) делит их
  // на абзацы (задача 10). Одиночные переводы строки внутри абзаца
  // схлопываем в пробел — wrapLines рвёт только по пробелам.
  let paragraphs = [];
  // Сцены под текстом — по одной на мини-игру, у которой она есть.
  const afterscenes = {};
  Object.values(MINIGAMES).forEach((m) => {
    if (m.createAfterscene) afterscenes[m.verb] = m.createAfterscene({ images });
  });
  let after = null;

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

      after = afterscenes[card.minigame] ?? null;
      after?.enter?.();

      offTap = input.on('tap', (e) => {
        if (!typingDone()) { t = totalTime(); return; }
        if (!zoneHit(promptZone, e.x, e.y)) return;
        resetSession();
        goto('question');
      });
    },

    exit() {
      offTap?.();
      after?.exit?.();
    },

    update(dt) {
      t += dt;
    },

    draw(ctx, w, h) {
      const card = CARDS[session.cardId] ?? CARDS.fool;
      ctx.fillStyle = '#111111';
      ctx.fillRect(0, 0, w, h);

      // Сцена мини-игры — ДО текста: слова лягут поверх чистого воздуха
      // верхней части.
      after?.draw(ctx, w, h, t);

      const scale = uiScale(w);
      const marginX = Math.round(53 * scale);
      const textMaxWidth = w - marginX * 2;

      const titleLH = setFont(ctx, 'title', scale);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#FFFFFF';
      // Заголовок и текст — в ВЕРХНЕЙ части кадра, над дорогой и следующей
      // плитой (правка в чате 2026-08-30: «текст появляется выше, где
      // чёрный фон»). Уровень 90 — как у экранов 1–5, не прежний 230.
      const titleY = Math.round(90 * scale);
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

        // SHARE — пока НЕ активно, но правка в чате 2026-09-11: тот же
        // акцент и та же «›»-галочка, что у ›ONE MORE QUESTION (не серая
        // заглушка), только притушенный альфой — читается как «кнопка того
        // же рода», не разжалованная в текстуру. Логики шаринга ещё нет.
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = '#EBA331';
        ctx.fillText('›SHARE', marginX, promptY + lineHeight + Math.round(6 * scale));
        ctx.globalAlpha = 1;
      }
    },
  };
}

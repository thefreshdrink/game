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
// The prediction.png низ экрана пустой, а здесь у нижней кромки держится
// та же дорога, на которую Шут пришёл в такте 3 падения (leap.js) — по
// правке в чате 2026-08-30 («размести сцену внизу экрана, предсказание
// проявляй поверх фона верхней части»): экраны 5→6 склеиваются без
// скачка, дорога просто остаётся под словами.

import { CARDS, getReading } from '../data/cards.js';
import { session, resetSession } from '../core/session.js';
import { setFont, wrapLines } from '../core/text.js';
import { textButtonZone, zoneHit } from '../core/textButton.js';
import {
  buildRoadStrip, ARRIVE_GROUND_FRAC, ARRIVE_MAIN_W, ARRIVE_SIDE_W, ARRIVE_STEP_UP,
} from '../minigames/fool/platforms.js';

const CHAR_INTERVAL = 0.022; // сек/символ — «~22 мс», значение из прототипа
const CURSOR_BLINK = 0.5;
const PARA_PAUSE = 0.6;      // печать замирает на границе абзацев (задача 10)
const PARA_GAP_LINES = 1;    // пустая строка между абзацами
// Размеры спрайтов Шута и пса — как в leap.js (не экспортируются оттуда;
// нужны для статичной композиции прибытия под текстом).
const PLAYER_W = 88;
const PLAYER_H = 96;
const DOG_W = 36;
const DOG_H = 28;
const IDLE_FPS = 6;

export function createPredictionScreen({ input, images, goto }) {
  let offTap = null;
  let t = 0;
  let promptZone = null; // хит-зона ›ONE MORE QUESTION (textButton.js)
  let groundMain = null; // полосы дороги под текстом — та же, что в такте 3 падения
  let groundSide = null;
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

      if (!groundMain) groundMain = buildRoadStrip(images, ARRIVE_MAIN_W);
      if (!groundSide) groundSide = buildRoadStrip(images, ARRIVE_SIDE_W);

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

      // Та же композиция, что в такте 3 падения (leap.js): Шут с псом на
      // дороге у нижней кромки, над ними — следующая плита; без тумана
      // (правка в чате 2026-08-30). Статична — «прибытие» уже отыграно.
      // Рисуем ДО текста: слова лягут поверх чистого воздуха верхней части.
      const scale = Math.min(Math.max(w / 430, 0.75), 1.25);
      if (groundMain) {
        const gy = Math.round(h * ARRIVE_GROUND_FRAC);
        const gw = groundMain.width;
        const gx = Math.round(w / 2 - gw / 2 - 28);
        const fcx = gx + Math.round(gw * 0.44);
        ctx.drawImage(groundMain, gx, gy);
        ctx.drawImage(groundSide, gx + gw - 72, gy - ARRIVE_STEP_UP); // следующая плита над Шутом
        const dogImg = images.dogSitFrames[Math.floor(t * 4) % images.dogSitFrames.length];
        ctx.drawImage(dogImg, fcx - PLAYER_W / 2 - DOG_W - 2, gy - DOG_H, DOG_W, DOG_H);
        const fr = images.foolIdleFrames;
        ctx.drawImage(fr[Math.floor(t * IDLE_FPS) % fr.length], fcx - PLAYER_W / 2, gy - PLAYER_H, PLAYER_W, PLAYER_H);
      }

      const marginX = Math.round(53 * scale);
      const textMaxWidth = w - marginX * 2;
      const card = CARDS[session.cardId] ?? CARDS.fool;

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
      }
    },
  };
}

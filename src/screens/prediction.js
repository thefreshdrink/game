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

import { CARDS, PLAYABLE, getReading } from '../data/cards.js';
import { session, resetSession } from '../core/session.js';
import { setFont, wrapLines } from '../core/text.js';
import { textButtonZone, zoneHit } from '../core/textButton.js';
import {
  buildRoadStrip, ARRIVE_GROUND_FRAC, ARRIVE_MAIN_W,
} from '../minigames/fool/platforms.js';
import { drawArrivalSun, drawArrivalLife } from '../minigames/fool/arrivalScene.js';
import { drawPixelReveal } from '../core/pixelReveal.js';
import { rubbleSnapshot, drawRubble, drawGround } from '../minigames/tower/blocks.js';

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

// Башня: куча обломков приезжает со сцены мини-игры и лежит у нижней кромки,
// как у Шута лежит дорога. Когда предсказание уже пошло, куча РАСТВОРЯЕТСЯ
// тем же пиксельным уходом, каким уходит в темноту оракул (core/oracle.js),
// и на её месте проступает знак вопроса: дальше решать тому, кто читает
// (правка в чате).
const RUBBLE_HOLD = 1.4;       // сек: сначала читается текст, куча ещё цела
const RUBBLE_DISSOLVE = 1.6;   // сколько растворяется
const MARK_REVEAL = 1.0;       // сколько проступает знак вопроса
const RUBBLE_CELL = 4;         // ячейка растворения — как у оракула
const MARK_SIZE = 96;

export function createPredictionScreen({ input, images, goto }) {
  let offTap = null;
  let t = 0;
  let promptZone = null; // хит-зона ›ONE MORE QUESTION (textButton.js)
  let groundMain = null; // полоса дороги под текстом — та же, что в такте 3 падения
  // Тексты банка приходят одной строкой; `\n\n` (пустая строка) делит их
  // на абзацы (задача 10). Одиночные переводы строки внутри абзаца
  // схлопываем в пробел — wrapLines рвёт только по пробелам.
  let paragraphs = [];
  let rubbleBuf = null;  // куча, снятая в буфер: её растворяем целиком
  let markBuf = null;    // знак вопроса на её месте
  let bufKey = '';

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

  /** Куча и знак вопроса — в буферы: пиксельное растворение работает по
   * готовой картинке, ровно как у фигуры оракула. */
  function buildBuffers(w, h) {
    const key = `${w}x${h}x${rubbleSnapshot.blocks.length}`;
    if (bufKey === key) return;
    bufKey = key;
    const baseX = Math.round(w / 2);
    const baseY = h - rubbleSnapshot.oyFromBottom;
    const top = baseY - 170;

    // В буфер идут ТОЛЬКО обломки: земля под ними остаётся на месте и
    // никуда не девается (правка в чате) — растворяется то, что упало.
    rubbleBuf = document.createElement('canvas');
    rubbleBuf.width = w;
    rubbleBuf.height = Math.max(1, h - top);
    const rc = rubbleBuf.getContext('2d');
    rc.imageSmoothingEnabled = false;
    drawRubble(rc, baseX, baseY - top, rubbleSnapshot.blocks);
    rubbleBuf.top = top;

    markBuf = document.createElement('canvas');
    markBuf.width = MARK_SIZE;
    markBuf.height = MARK_SIZE;
    const mc = markBuf.getContext('2d');
    mc.imageSmoothingEnabled = false;
    mc.fillStyle = '#EBA331';   // акцент: дальше решать тому, кто читает
    mc.textAlign = 'center';
    mc.textBaseline = 'middle';
    mc.font = `${Math.round(MARK_SIZE * 0.8)}px Alagard, serif`;
    mc.fillText('?', MARK_SIZE / 2, MARK_SIZE / 2 + 2);
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
      const card = CARDS[session.cardId] ?? CARDS.fool;
      ctx.fillStyle = '#111111';
      ctx.fillRect(0, 0, w, h);

      // Та же композиция, что в такте 3 падения (leap.js): Шут с псом на
      // дороге у нижней кромки, над ними — следующая плита; без тумана
      // (правка в чате 2026-08-30). Статична — «прибытие» уже отыграно.
      // Рисуем ДО текста: слова лягут поверх чистого воздуха верхней части.
      const scale = Math.min(Math.max(w / 430, 0.75), 1.25);
      // Сцена прибытия принадлежит мини-игре, с которой пришли. У карты без
      // своей сцены прибытия не было — низ остаётся пустым, ровно как на
      // docs/interfaces/The prediction.png (дорога там появилась правкой
      // 2026-08-30 специально под склейку 5→6 у Шута).
      if (groundMain && card.id === 'fool') {
        const gy = Math.round(h * ARRIVE_GROUND_FRAC);
        const gw = groundMain.width;
        const gx = Math.round(w / 2 - gw / 2 - 28);
        const fcx = gx + Math.round(gw * 0.44);
        // «Другой мир»: солнце в верхнем углу, трава и кустик на плите
        // (правка в чате 2026-09-10). Солнце проступает вместе с заголовком.
        // Второй плиты над Шутом нет — конец пути, одна плита, пришли и всё.
        drawArrivalSun(ctx, w - 6, 22, t, Math.min(1, t / 0.3));
        ctx.drawImage(groundMain, gx, gy);
        drawArrivalLife(ctx, gx, gw, gy);
        const dogImg = images.dogSitFrames[Math.floor(t * 4) % images.dogSitFrames.length];
        ctx.drawImage(dogImg, fcx - PLAYER_W / 2 - DOG_W - 2, gy - DOG_H, DOG_W, DOG_H);
        const fr = images.foolIdleFrames;
        ctx.drawImage(fr[Math.floor(t * IDLE_FPS) % fr.length], fcx - PLAYER_W / 2, gy - PLAYER_H, PLAYER_W, PLAYER_H);
      }

      // Башня: куча лежит там же, где её оставила мини-игра, потом уходит
      // пикселями и отдаёт место знаку вопроса.
      if (card.id === 'tower' && rubbleSnapshot.blocks.length) {
        buildBuffers(w, h);
        drawGround(ctx, Math.round(w / 2), h - rubbleSnapshot.oyFromBottom, 4);
        const dissolveT = t - RUBBLE_HOLD;
        if (dissolveT <= 0) {
          ctx.drawImage(rubbleBuf, 0, rubbleBuf.top);
        } else if (dissolveT < RUBBLE_DISSOLVE) {
          const left = 1 - dissolveT / RUBBLE_DISSOLVE;
          drawPixelReveal(
            ctx, rubbleBuf, 0, rubbleBuf.top, rubbleBuf.width, rubbleBuf.height,
            left, RUBBLE_CELL, 0.5, 0.55,
          );
        }
        const markT = dissolveT - RUBBLE_DISSOLVE * 0.7;
        if (markT > 0) {
          const baseY = h - rubbleSnapshot.oyFromBottom;
          drawPixelReveal(
            ctx, markBuf,
            Math.round(w / 2 - MARK_SIZE / 2), Math.round(baseY - MARK_SIZE / 2),
            MARK_SIZE, MARK_SIZE,
            Math.min(1, markT / MARK_REVEAL), RUBBLE_CELL, 0.5, 0.5,
          );
        }
      }

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

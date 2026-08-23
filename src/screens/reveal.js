// Экран 4 — Раскрытие. Карта уже открыта (флип прошёл на экране 3), портрет
// проступает на ней пиксельным эффектом — тем же самым, что и силуэт
// оракула на экранах 1–2 (правка в чате 2026-08-19: «появляй дурака так же,
// как силуэт»). Заголовок — своя реплика оракула про пришедшую карту
// (`card.arrival`, BUILD-SPEC-02 задача 4), не унаследованное с экрана 2
// «The deck offers itself…»: у момента «тебе выпал Шут» не было своей
// строки. `›CONTINUE` — под картой, а не в шапке: раньше сидел на месте
// пунктов меню экрана 1, примерно на 400px выше карты, к которой относится.
//
// CONTINUE ведёт в мини-игру «Leap» (экран 5).

import { CARDS } from '../data/cards.js';
import { session } from '../core/session.js';
import { setFont, wrapLines } from '../core/text.js';
import {
  layoutWords, visibleWordCount, revealDuration, blinkAlpha,
} from '../core/textReveal.js';
import { drawCardFace } from '../core/cardRender.js';

const REVEAL_DURATION = 1.6; // сек — портрет проступает пикселями от лица
const REVEAL_CELL_SIZE = 4;
const CONTINUE_DELAY = 0.3; // короткая пауза после того, как всё проступило

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

export function createRevealScreen({ input, images, goto }) {
  let offTap = null;
  let t = 0;
  let box = { x: 0, y: 0, w: 0, h: 0 };
  let continueLabel = { x0: 0, x1: 0, y: 0 };
  let titleRevealDuration = 0;

  function layout(w, h, scale) {
    const cardW = Math.round(w * 0.5);
    const cardH = Math.round(cardW * (384 / 224));
    box = {
      // По центру экрана, не 0.364h (правка в чате, 2026-08-23: «карту
      // выбранную сделать чётко посередине экрана») — раньше карта висела
      // ощутимо выше центра, ближе к шапке.
      x: Math.round((w - cardW) / 2),
      y: Math.round((h - cardH) / 2),
      w: cardW,
      h: cardH,
    };
    // Под картой (BUILD-SPEC-02, задача 4) — раньше сидел в шапке, у
    // пунктов меню экрана 1, примерно на 400px выше карты, к которой
    // относится: взгляд шёл реплика → CTA → только потом карта. Отступ
    // увеличен с 36 (правка в чате: «оч близко расположена к карте») —
    // явный зазор, а не почти впритык к нижнему краю рамки.
    continueLabel.y = box.y + box.h + Math.round(64 * scale);
  }

  function continueReady() {
    return t >= Math.max(REVEAL_DURATION, titleRevealDuration) + CONTINUE_DELAY;
  }

  return {
    enter() {
      t = 0;
      offTap = input.on('tap', (e) => {
        if (!continueReady()) return;
        const l = continueLabel;
        if (e.x < l.x0 - 12 || e.x > l.x1 + 12 || Math.abs(e.y - l.y) > 22) return;
        goto('leap');
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

      // Реплика оракула про пришедшую карту — слово за словом, тем же
      // способом, что и на экране 1 (core/textReveal.js).
      const titleLH = setFont(ctx, 'title', scale);
      const ty = Math.round(70 * scale); // тот же уровень, что и на экране 1
      const lines = wrapLines(ctx, card.arrival, textMaxWidth);
      const words = layoutWords(ctx, lines, marginX, ty, titleLH);
      titleRevealDuration = revealDuration(words.length);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#FFFFFF';
      const shown = visibleWordCount(t, words.length);
      for (let i = 0; i < shown; i++) ctx.fillText(words[i].text, words[i].x, words[i].y);

      layout(w, h, scale);
      const revealProgress = clamp01(t / REVEAL_DURATION);
      drawCardFace(ctx, images, box.x, box.y, box.w, box.h, card.name, scale, {
        numeral: card.numeral, revealProgress, cellSize: REVEAL_CELL_SIZE,
      });

      if (continueReady()) {
        setFont(ctx, 'menuOption', scale);
        ctx.textAlign = 'left';
        ctx.fillStyle = '#EBA331';
        // Было «›CONTINUE» — «нелогичная формулировка» (правка в чате):
        // CONTINUE ничего не говорит о том, что дальше начнётся сама
        // мини-игра (Шут идёт и прыгает через провалы, экран 5, «Leap»).
        // Потом «›TAKE THE STEP» — тоже не понравилось. Выбрано из
        // предложенных вариантов в чате.
        const label = '›KEEP GOING';
        const width = ctx.measureText(label).width;
        continueLabel.x0 = Math.round(w / 2 - width / 2);
        continueLabel.x1 = continueLabel.x0 + width;
        // Мигание — тем же приёмом, что у CLICK TO DRAW/подписи экрана 2
        // (правка в чате: «она не мигает», забыли применить сюда же).
        ctx.globalAlpha = blinkAlpha(t);
        ctx.fillText(label, continueLabel.x0, continueLabel.y);
        ctx.globalAlpha = 1;
      }
    },
  };
}

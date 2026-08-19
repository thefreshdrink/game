// Экран 4 — Раскрытие. Карта уже открыта (флип прошёл на экране 3), портрет
// проступает на ней пиксельным эффектом — тем же самым, что и силуэт
// оракула на экранах 1–2 (правка в чате 2026-08-19: «появляй дурака так же,
// как силуэт»). После того как портрет проступил полностью, там, где на
// экране 1 были пункты меню (сразу под заголовком, не под картой — тоже
// правка в чате), появляется CONTINUE.
//
// BUILD-SPEC, шаг 2: мини-игру пока не строим — CONTINUE сбрасывает сессию
// и возвращает на экран 1, чтобы весь цикл экранов 1–4 можно было прогнать
// руками до конца. Как только появится мини-игра — CONTINUE поведёт туда.

import { resetSession } from '../core/session.js';
import { setFont } from '../core/text.js';
import { drawCardFace } from '../core/cardRender.js';

const REVEAL_DURATION = 1.6; // сек — портрет проступает пикселями от лица
const REVEAL_CELL_SIZE = 4;
const CONTINUE_DELAY = 0.3; // короткая пауза после полного проявления

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

export function createRevealScreen({ input, images, goto }) {
  let offTap = null;
  let t = 0;
  let box = { x: 0, y: 0, w: 0, h: 0 };
  let continueLabel = { x0: 0, x1: 0, y: 0 };

  function layout(w, h, scale, ctx) {
    const cardW = Math.round(w * 0.5);
    const cardH = Math.round(cardW * (384 / 224));
    box = {
      x: Math.round((w - cardW) / 2),
      y: Math.round(h * 0.364),
      w: cardW,
      h: cardH,
    };

    // Та же формула, что у optionsY на экране 1 (question.js): сразу под
    // заголовком, не привязано к карте — по месту, где раньше были пункты
    // меню (правка в чате).
    const marginX = Math.round(53 * scale);
    const titleLH = setFont(ctx, 'title', scale);
    const ty = Math.round(160 * scale);
    const continueY = ty + 2 * titleLH + Math.round(9 * scale);
    setFont(ctx, 'menuOption', scale);
    const label = '›CONTINUE';
    const width = ctx.measureText(label).width;
    continueLabel = { x0: marginX, x1: marginX + width, y: continueY, label };
  }

  function continueReady() {
    return t >= REVEAL_DURATION + CONTINUE_DELAY;
  }

  return {
    enter() {
      t = 0;
      offTap = input.on('tap', (e) => {
        if (!continueReady()) return;
        const l = continueLabel;
        if (e.x < l.x0 - 12 || e.x > l.x1 + 12 || Math.abs(e.y - l.y) > 22) return;
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

      const titleLH = setFont(ctx, 'title', scale);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#FFFFFF';
      let ty = Math.round(160 * scale);
      ctx.fillText('The deck', marginX, ty);
      ty += titleLH;
      ctx.fillText('offers itself…', marginX, ty);

      layout(w, h, scale, ctx);
      const revealProgress = clamp01(t / REVEAL_DURATION);
      drawCardFace(ctx, images, box.x, box.y, box.w, box.h, revealProgress, REVEAL_CELL_SIZE);

      if (continueReady()) {
        setFont(ctx, 'menuOption', scale);
        ctx.textAlign = 'left';
        ctx.fillStyle = '#EBA331';
        ctx.fillText(continueLabel.label, continueLabel.x0, continueLabel.y);
      }
    },
  };
}

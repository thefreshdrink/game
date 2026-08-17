// Экран 4 — Раскрытие. Карта уже открыта (флип прошёл на экране 3),
// здесь она просто лежит открытой. Референс: docs/interfaces/The card.png
//
// BUILD-SPEC, шаг 2: мини-игру пока не строим — вместо неё заглушка,
// тап по которой сбрасывает сессию и возвращает на экран 1, чтобы весь
// цикл экранов 1–4 можно было прогнать руками до конца.

import { CARDS } from '../data/cards.js';
import { session, resetSession } from '../core/session.js';
import { setFont } from '../core/text.js';
import { drawCardFace } from '../core/cardRender.js';

export function createRevealScreen({ input, images, goto }) {
  let offTap = null;
  let box = { x: 0, y: 0, w: 0, h: 0 };
  let placeholderY = 0;

  function layout(w, h, scale) {
    const cardW = Math.round(w * 0.5);
    const cardH = Math.round(cardW * (384 / 224));
    box = {
      x: Math.round((w - cardW) / 2),
      y: Math.round(h * 0.364),
      w: cardW,
      h: cardH,
    };
    placeholderY = box.y + box.h + Math.round(56 * scale);
  }

  return {
    enter() {
      offTap = input.on('tap', (e) => {
        if (e.y < placeholderY - 20) return; // не уходим от случайного тапа по карте
        resetSession();
        goto('question');
      });
    },

    exit() {
      offTap?.();
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

      layout(w, h, scale);
      const card = CARDS[session.cardId] ?? CARDS.fool;
      drawCardFace(ctx, images, box.x, box.y, box.w, box.h, card.name, scale);

      setFont(ctx, 'body', scale);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#EBA331';
      ctx.fillText('› CONTINUE', w / 2, placeholderY);

      setFont(ctx, 'caption', scale);
      ctx.fillStyle = '#808080';
      ctx.fillText('minigame placeholder — see BUILD-SPEC step 3', w / 2, placeholderY + Math.round(20 * scale));
    },
  };
}

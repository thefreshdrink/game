// Экран 2 — «The deck offers itself…» Веер рубашек, любая карта даёт Шута.
// Референс: docs/interfaces/Picking the card.png

import { DECK_ORDER } from '../data/cards.js';
import { session } from '../core/session.js';
import { setFont } from '../core/text.js';

const CARD_COUNT = DECK_ORDER.length; // 5 — визуальная колода MVP (BUILD-SPEC)
const SELECT_DELAY = 0.16; // сек — успеть увидеть акцентный отклик перед уходом

export function createDeckScreen({ input, images, goto }) {
  let offTap = null;
  let cards = []; // {x, y, w, h}
  let pendingIndex = null;
  let pendingTimer = 0;

  function layout(w, h) {
    const scale = Math.min(Math.max(w / 430, 0.75), 1.25);
    const marginX = Math.round(20 * scale);
    const gap = Math.round(10 * scale);
    const cardW = Math.round((w - marginX * 2 - gap * (CARD_COUNT - 1)) / CARD_COUNT);
    const cardH = Math.round(cardW * (384 / 224));
    const y = Math.round(h * 0.6);

    cards = [];
    for (let i = 0; i < CARD_COUNT; i++) {
      cards.push({
        x: marginX + i * (cardW + gap),
        y,
        w: cardW,
        h: cardH,
      });
    }
  }

  return {
    enter() {
      pendingIndex = null;
      pendingTimer = 0;
      offTap = input.on('tap', (e) => {
        if (pendingIndex !== null) return;
        const idx = cards.findIndex(
          (c) => e.x >= c.x && e.x <= c.x + c.w && e.y >= c.y && e.y <= c.y + c.h,
        );
        if (idx === -1) return;
        pendingIndex = idx;
        pendingTimer = SELECT_DELAY;
      });
    },

    exit() {
      offTap?.();
    },

    update(dt) {
      if (pendingIndex === null) return;
      pendingTimer -= dt;
      if (pendingTimer <= 0) {
        session.cardId = 'fool'; // любая карта в этой сборке — Шут (BUILD-SPEC)
        goto('draw');
      }
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

      setFont(ctx, 'body', scale);
      ctx.fillStyle = '#EBA331';
      ctx.fillText('PICK THE CARD. TRUST THE POOL.', marginX, Math.round(255 * scale));

      layout(w, h);
      const lift = Math.round(16 * scale);
      cards.forEach((c, i) => {
        const selected = i === pendingIndex;
        const y = selected ? c.y - lift : c.y;
        ctx.drawImage(images.cardBack, Math.round(c.x), Math.round(y), c.w, c.h);
        if (selected) {
          ctx.strokeStyle = '#EBA331';
          ctx.lineWidth = Math.max(2, Math.round(2 * scale));
          ctx.strokeRect(Math.round(c.x), Math.round(y), c.w, c.h);
        }
      });
    },
  };
}

// Экран 3 — Вытягивание. Одна карта рубашкой вверх и переворачивается сама:
// тап, подпись TAP THE CARD и искра на рубашке сняты (правка 29.09).
// Референс: docs/interfaces/Tap to see.png

import { setFont, wrapLines, uiScale } from '../core/text.js';
import { drawCardBack, drawCardBlank, CARD_W, CARD_H } from '../core/cardRender.js';
import { easeInOutQuad } from '../core/ease.js';

// «Не быстрее ~0.8 сек» — это ритуал (BUILD-SPEC). BUILD-SPEC-05 задача 3c:
// 0.8 → 1.1 и через easing, а не линейно, — переворот как жест, не как
// переключение кадра.
// Слово в слово заголовок экрана 2 (deck.js, NEW_TITLE): игрок переходит
// 2 → 3 и должен видеть один непрерывный текст, а не новый. Пока это две
// копии одной строки в двух файлах — схлопнутся, когда появится слой строк
// для локализации (CLAUDE.md: строки идут через один слой, не хардкодом).
const TITLE = 'The deck offers itself…';

const FLIP_DURATION = 1.1;
const FLIP_DELAY = 0.8;   // сек рубашкой вверх до переворота: карта успевает прочитаться

export function createDrawScreen({ images, goto }) {
  let state = 'waiting'; // waiting | flipping
  let t = 0;
  let idleT = 0;
  let box = { x: 0, y: 0, w: 0, h: 0 };

  function layout(w, h) {
    const scale = uiScale(w);
    // Карта — фиксированные 224×384, без uiScale (BUILD-SPEC-03 задача 2).
    // По центру экрана (правка в чате, 2026-08-23) — та же формула, что и в
    // reveal.js, иначе при переходе 3→4 карта прыгнет.
    box = {
      x: Math.round((w - CARD_W) / 2),
      y: Math.round((h - CARD_H) / 2),
      w: CARD_W,
      h: CARD_H,
      scale,
    };
  }

  return {
    enter() {
      state = 'waiting';
      t = 0;
      idleT = 0;
    },

    update(dt) {
      idleT += dt;
      if (state === 'waiting' && idleT >= FLIP_DELAY) { state = 'flipping'; t = 0; }
      if (state !== 'flipping') return;
      t += dt;
      if (t >= FLIP_DURATION) {
        goto('reveal');
      }
    },

    draw(ctx, w, h) {
      ctx.fillStyle = '#111111';
      ctx.fillRect(0, 0, w, h);

      const scale = uiScale(w);
      const marginX = Math.round(53 * scale);

      const titleLH = setFont(ctx, 'title', scale);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#FFFFFF';
      const ty = Math.round(70 * scale); // тот же уровень, что и на экране 1 (правка в чате)
      // Перенос считается, а не задаётся руками: экран 2 ломает эту же
      // строку через wrapLines, и при забитом вручную переносе заголовок
      // прыгал бы на переходе 2 → 3. Число строк разное у разных шрифтов —
      // Kingdom уже Alagard и влезает в одну.
      const titleLines = wrapLines(ctx, TITLE, w - marginX * 2);
      titleLines.forEach((line, i) => ctx.fillText(line, marginX, ty + i * titleLH));

      layout(w, h);
      // Прогресс переворота через easing — разгон и торможение, без жёсткой
      // смены стороны ровно на середине по времени (BUILD-SPEC-05 3c).
      const rawP = state === 'flipping' ? Math.min(t / FLIP_DURATION, 1) : 0;
      const progress = easeInOutQuad(rawP);
      const scaleX = state === 'flipping' ? Math.abs(Math.cos(progress * Math.PI)) : 1;
      const cx = box.x + box.w / 2;
      const cy = box.y + box.h / 2;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(Math.max(scaleX, 0.02), 1);
      ctx.translate(-cx, -cy);

      if (progress < 0.5) {
        drawCardBack(ctx, images, box.x, box.y, box.w, box.h);
      } else {
        // Лик ещё не проступает здесь — он материализуется отдельным
        // тактом на экране 4 (revealProgress 0→1), флип только открывает
        // пустую (без портрета) сторону карты.
        drawCardBlank(ctx, images, box.x, box.y, box.w, box.h);
      }
      ctx.restore();

      // Кромка ловит свет: когда карта стоит почти ребром (scaleX → 0) —
      // короткая вспышка белой вертикалью (BUILD-SPEC-05 3c).
      if (state === 'flipping' && scaleX < 0.14) {
        ctx.save();
        ctx.globalAlpha = 1 - scaleX / 0.14;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(Math.round(cx - 1), box.y - 6, 2, box.h + 12);
        ctx.restore();
      }
    },
  };
}

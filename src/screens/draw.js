// Экран 3 — Вытягивание. Одна карта рубашкой вверх, тап переворачивает.
// Референс: docs/interfaces/Tap to see.png

import { setFont } from '../core/text.js';
import { drawCardBack, drawCardBlank } from '../core/cardRender.js';
import { blinkAlpha } from '../core/textReveal.js';

const FLIP_DURATION = 0.8; // сек — «не быстрее ~0.8 сек», это ритуал (BUILD-SPEC)

export function createDrawScreen({ input, images, goto }) {
  let offTap = null;
  let state = 'waiting'; // waiting | flipping
  let t = 0;
  // Отдельный от t таймер: t стоит на 0, пока не начался флип (используется
  // только для прогресса переворота), а мигать CLICK TO DRAW должен всё
  // время ожидания тапа.
  let idleT = 0;
  let box = { x: 0, y: 0, w: 0, h: 0 };

  function layout(w, h) {
    const scale = Math.min(Math.max(w / 430, 0.75), 1.25);
    const cardW = Math.round(w * 0.5);
    const cardH = Math.round(cardW * (384 / 224));
    box = {
      // По центру экрана (правка в чате, 2026-08-23) — тот же формула, что
      // и в reveal.js/deck.js, иначе при переходах карта прыгнет.
      x: Math.round((w - cardW) / 2),
      y: Math.round((h - cardH) / 2),
      w: cardW,
      h: cardH,
      scale,
    };
  }

  return {
    enter() {
      state = 'waiting';
      t = 0;
      idleT = 0;
      offTap = input.on('tap', () => {
        if (state !== 'waiting') return;
        state = 'flipping';
        t = 0;
      });
    },

    exit() {
      offTap?.();
    },

    update(dt) {
      idleT += dt;
      if (state !== 'flipping') return;
      t += dt;
      if (t >= FLIP_DURATION) {
        goto('reveal');
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
      const ty = Math.round(70 * scale); // тот же уровень, что и на экране 1 (правка в чате)
      ctx.fillText('The deck', marginX, ty);
      ctx.fillText('offers itself…', marginX, ty + titleLH);

      if (state === 'waiting') {
        // Тот же стиль/размер, что у вспомогательного текста на экране 1
        // (правка в чате: «вспомогательный текст по размеру как на первом»).
        // Отступ считаем от ПЕРВОЙ строки заголовка на всю высоту двух
        // строк — иначе подпись налезает на вторую строку (баг, пойман
        // вживую при проверке).
        setFont(ctx, 'menuOption', scale);
        ctx.fillStyle = '#EBA331';
        ctx.globalAlpha = blinkAlpha(idleT);
        ctx.fillText('CLICK TO DRAW', marginX, ty + 2 * titleLH + Math.round(9 * scale));
        ctx.globalAlpha = 1;
      }

      layout(w, h);
      const progress = state === 'flipping' ? Math.min(t / FLIP_DURATION, 1) : 0;
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
    },
  };
}

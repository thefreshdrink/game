// Экран 3 — Вытягивание. Одна карта рубашкой вверх, тап переворачивает.
// Референс: docs/interfaces/Tap to see.png

import { setFont, wrapLines } from '../core/text.js';
import { drawCardBack, drawCardBlank, CARD_W, CARD_H } from '../core/cardRender.js';
import { blinkAlpha } from '../core/textReveal.js';
import { drawTapStar } from '../core/gestureGlyph.js';
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
const STAR_DELAY = 0.6;   // сек после появления карты — знак тапа проступает
const STAR_PERIOD = 1.4;  // сек — период пульса знака
const STAR_FADE = 0.15;   // сек — знак гаснет с началом переворота

export function createDrawScreen({ input, images, goto }) {
  let offTap = null;
  let state = 'waiting'; // waiting | flipping
  let t = 0;
  // Отдельный от t таймер: t стоит на 0, пока не начался флип (используется
  // только для прогресса переворота), а мигать CLICK TO DRAW и пульсировать
  // звёздочка должны всё время ожидания тапа.
  let idleT = 0;
  let box = { x: 0, y: 0, w: 0, h: 0 };

  function layout(w, h) {
    const scale = Math.min(Math.max(w / 430, 0.75), 1.25);
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
      // Перенос считается, а не задаётся руками: экран 2 ломает эту же
      // строку через wrapLines, и при забитом вручную переносе заголовок
      // прыгал бы на переходе 2 → 3. Число строк разное у разных шрифтов —
      // Kingdom уже Alagard и влезает в одну.
      const titleLines = wrapLines(ctx, TITLE, w - marginX * 2);
      titleLines.forEach((line, i) => ctx.fillText(line, marginX, ty + i * titleLH));

      if (state === 'waiting') {
        // Тот же стиль/размер, что у вспомогательного текста на экране 1
        // (правка в чате: «вспомогательный текст по размеру как на первом»).
        // Текст ОСТАЁТСЯ (BUILD-SPEC-05 3b: он объясняет, звёздочка
        // показывает куда). Отступ считаем от ПЕРВОЙ строки заголовка на
        // всю высоту двух строк — иначе подпись налезает на вторую строку.
        setFont(ctx, 'menuOption', scale);
        ctx.fillStyle = '#EBA331';
        ctx.globalAlpha = blinkAlpha(idleT);
        ctx.fillText('TAP THE CARD', marginX, ty + titleLines.length * titleLH + Math.round(9 * scale));
        ctx.globalAlpha = 1;
      }

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

      // Знак тапа — пиксельная искра на рубашке, В ГЕОМЕТРИЧЕСКОМ ЦЕНТРЕ
      // карты. Было чуть выше центра (0.40h, правка 2026-09-10: «ровно
      // посередине смотрелось тупо») — но у самой рубашки
      // (back_side_card_final.png) узор — сходящийся крест, и у него
      // СВОЯ пустота ровно посередине (проверено по PNG); искра поверх
      // штриха узора и есть та «грязь», о которой шла речь, а не сам факт
      // центра. Возвращено на true center — совпадает с cy (центр флипа
      // чуть выше, уже посчитан). Лучи «расходятся» — длина по циклу
      // растёт и убывает, вертикальные длиннее. Проступает через
      // STAR_DELAY, гаснет с началом переворота.
      const starCy = cy;
      let starA = 0;
      let grow = 1;
      if (state === 'waiting' && idleT > STAR_DELAY) {
        const ph = (idleT - STAR_DELAY) / STAR_PERIOD;
        const pulse = 0.3 + 0.7 * (0.5 - 0.5 * Math.cos(ph * Math.PI * 2));
        grow = 0.5 - 0.5 * Math.cos(ph * Math.PI * 2);
        starA = Math.min(1, (idleT - STAR_DELAY) / 0.4) * pulse;
      } else if (state === 'flipping') {
        starA = Math.max(0, 1 - t / STAR_FADE) * 0.7;
      }
      if (starA > 0) {
        const reachV = 5 + Math.round(grow * 7);  // 5..12 арт-px
        const reachH = 4 + Math.round(grow * 4);  // 4..8
        drawTapStar(ctx, cx, starCy, starA, reachV, reachH);
      }
    },
  };
}

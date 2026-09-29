// Под предсказанием Башни: куча обломков приезжает со сцены мини-игры и
// лежит у нижней кромки, как у Шута лежит дорога. Когда предсказание уже
// пошло, куча РАСТВОРЯЕТСЯ тем же пиксельным уходом, каким уходит в темноту
// оракул (core/oracle.js), и на её месте проступает знак вопроса: дальше
// решать тому, кто читает (правка в чате). Земля под кучей остаётся —
// растворяется только то, что упало.

import { drawPixelReveal } from '../../core/pixelReveal.js';
import { rubbleSnapshot, clearRubble, drawRubble, drawGround, drawCrown } from './blocks.js';

const RUBBLE_HOLD = 1.4;       // сек: сначала читается текст, куча ещё цела
const RUBBLE_DISSOLVE = 1.6;   // сколько растворяется
const MARK_REVEAL = 1.0;       // сколько проступает знак вопроса
const RUBBLE_CELL = 4;         // ячейка растворения — как у оракула
const MARK_SIZE = 96;
// Шрифт заголовков (правка 29.09), ровно ×2 от кегля title (text.js, 46):
// пиксель шрифта ложится тем же шагом, что у заголовка над ним.
const MARK_FONT = '92px Kingdom';

export function createReleaseAfterscene() {
  let rubbleBuf = null;  // куча, снятая в буфер: её растворяем целиком
  let markBuf = null;    // знак вопроса на её месте
  let bufKey = '';

  /** Куча и знак вопроса — в буферы: пиксельное растворение работает по
   * готовой картинке, ровно как у фигуры оракула. */
  function buildBuffers(w, h) {
    const key = `${w}x${h}x${rubbleSnapshot.blocks.length}`;
    if (bufKey === key) return;
    bufKey = key;
    const baseX = Math.round(w / 2);
    const baseY = h - rubbleSnapshot.oyFromBottom;
    const top = baseY - 280;   // куча до 6 слоёв (pile.js) и корона сверху

    rubbleBuf = document.createElement('canvas');
    rubbleBuf.width = w;
    rubbleBuf.height = Math.max(1, h - top);
    const rc = rubbleBuf.getContext('2d');
    rc.imageSmoothingEnabled = false;
    drawRubble(rc, baseX, baseY - top, rubbleSnapshot.blocks);
    if (rubbleSnapshot.crown) drawCrown(rc, baseX, baseY - top, rubbleSnapshot.crown, 0, false);
    rubbleBuf.top = top;
    markBuf = null;
  }

  /** Знак рисуется в буфер один раз — поэтому только когда Kingdom уже
   * загружен, иначе в буфере навсегда останется запасной serif. */
  function markReady() {
    if (markBuf) return true;
    if (!document.fonts.check(MARK_FONT)) { document.fonts.load(MARK_FONT); return false; }
    markBuf = document.createElement('canvas');
    markBuf.width = MARK_SIZE;
    markBuf.height = MARK_SIZE;
    const mc = markBuf.getContext('2d');
    mc.imageSmoothingEnabled = false;
    mc.fillStyle = '#EBA331';   // акцент: дальше решать тому, кто читает
    mc.textAlign = 'center';
    mc.textBaseline = 'middle';
    mc.font = MARK_FONT;
    mc.fillText('?', MARK_SIZE / 2, MARK_SIZE / 2 + 2);
    return true;
  }

  return {
    exit() {
      clearRubble();
    },

    draw(ctx, w, h, t) {
      if (!rubbleSnapshot.blocks.length) return;
      buildBuffers(w, h);
      const baseY = h - rubbleSnapshot.oyFromBottom;
      drawGround(ctx, Math.round(w / 2), baseY, 4);
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
      if (markT > 0 && markReady()) {
        drawPixelReveal(
          ctx, markBuf,
          Math.round(w / 2 - MARK_SIZE / 2), Math.round(baseY - MARK_SIZE / 2),
          MARK_SIZE, MARK_SIZE,
          Math.min(1, markT / MARK_REVEAL), RUBBLE_CELL, 0.5, 0.5,
        );
      }
    },
  };
}

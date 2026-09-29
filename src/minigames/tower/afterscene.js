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

// Знак — шрифт заголовков Kingdom (правка 29.09), но не кеглем, а его
// родной сеткой: Kingdom нарисован по 20 пикселей на кегль (unitsPerEm
// 2000, шаг контура 100). Набираем в 20 px, полупрозрачные края срезаем
// и увеличиваем целым MARK_SCALE без сглаживания — знак чёткий, а не
// мыльный, как был при 92 px. Проступает ячейкой в пиксель шрифта.
const MARK_FONT = '20px Kingdom';
const MARK_SCALE = 2;

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
    const src = document.createElement('canvas');
    src.width = 16;
    src.height = 20;
    const sc = src.getContext('2d');
    sc.font = MARK_FONT;
    sc.textBaseline = 'alphabetic';
    sc.fillStyle = '#EBA331';   // акцент: дальше решать тому, кто читает
    sc.fillText('?', 2, 17);
    const img = sc.getImageData(0, 0, src.width, src.height);
    let x0 = src.width; let y0 = src.height; let x1 = -1; let y1 = -1;
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        const i = (y * src.width + x) * 4 + 3;
        img.data[i] = img.data[i] >= 128 ? 255 : 0;
        if (img.data[i]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      }
    }
    if (x1 < 0) return false;
    sc.putImageData(img, 0, 0);
    markBuf = document.createElement('canvas');
    markBuf.width = (x1 - x0 + 1) * MARK_SCALE;
    markBuf.height = (y1 - y0 + 1) * MARK_SCALE;
    const mc = markBuf.getContext('2d');
    mc.imageSmoothingEnabled = false;
    mc.drawImage(src, x0, y0, x1 - x0 + 1, y1 - y0 + 1, 0, 0, markBuf.width, markBuf.height);
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
        const mx = Math.round((w / 2 - markBuf.width / 2) / 2) * 2;
        const my = Math.round((baseY - markBuf.height / 2) / 2) * 2;
        drawPixelReveal(
          ctx, markBuf, mx, my, markBuf.width, markBuf.height,
          Math.min(1, markT / MARK_REVEAL), MARK_SCALE, 0.5, 0.5,
        );
      }
    },
  };
}

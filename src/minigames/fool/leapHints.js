// Подсказки Шута (BUILD-SPEC-04 задача 3 + правки в чате 2026-08-31): две
// строки чуть выше головы, со знаком жеста справа. WALK — сразу на старте;
// SWIPE — после первого шага, первые SWIPE_HINT_PLATES плит (половина
// дороги, правка 2026-10-24); HOLD TO JUMP — на последнем краю, не пропадает
// во время удержания, справа проявляется кольцо.

import { drawHintStack } from '../../core/hints.js';
import { uiScale } from '../../core/text.js';
import { drawHoldRing, drawSwipeTick } from '../../core/gestureGlyph.js';
import { clamp01 } from '../../core/ease.js';
import { PLAYER_H } from './actors.js';
import { t as str } from '../../data/strings.js';

// Подсказка свайпа держится первую половину дороги (правка в чате
// 2026-10-24: «подольше»), а не только на первой плите. Плит 9.
const SWIPE_HINT_PLATES = 4;

export function drawLeapHints(ctx, w, camX, camY, { state, stateT, t, movedEver, idx, lean, player, swipeLinger }) {
  const scale = uiScale(w);
  const at = {
    figX: Math.round(player.x - camX),
    headTop: Math.round(player.y - camY - PLAYER_H),
    w, t, scale,
  };
  if (state === 'charge' || state === 'wait_leap') {
    const box = drawHintStack(ctx, str('fool.hold'), { ...at, fadeIn: stateT / 0.3 });
    if (state === 'charge' && lean > 0.02) {
      // Кольцо справа от надписи на уровне середины двух строк (правка
      // 29.09) — середина между базовыми линиями минус полвысоты заглавной.
      const rx = Math.round(at.figX + box.widest / 2 + 30);
      const ry = Math.round((box.bottom - (box.count - 1) * box.lineH / 2 - 8 * scale) / 2) * 2;
      drawHoldRing(ctx, rx, ry, Math.min(lean, 0.999), clamp01(lean / 0.12), 8);
    }
  } else if (state === 'walk' && !movedEver) {
    // Первая подсказка — практически сразу.
    drawHintStack(ctx, str('fool.walk'), { ...at, fadeIn: t / 0.2 });
  } else if (movedEver && ((state === 'walk' && idx < SWIPE_HINT_PLATES) || (swipeLinger && (state === 'walk' || state === 'air')))) {
    const box = drawHintStack(ctx, str('fool.swipe'), at);
    // Центр знака — на базовой линии нижней строки, не по середине стека.
    drawSwipeTick(ctx, Math.round(at.figX + box.widest / 2 + 28), Math.round(box.bottom), 1, t);
  }
}

// Куча обломков после обвала и её снимок для экрана предсказания (общий
// вход — ../blocks.js).

import { drawBlock } from './block.js';

/** Куча лежащих обломков — от дальних к ближним, иначе ближние уходят под
 * дальние. Тот же порядок и на сцене, и на предсказании. */
export function drawRubble(ctx, ox, oy, blocks) {
  [...blocks]
    .sort((a, b) => (a.z - b.z) || ((a.x + a.y) - (b.x + b.y)))
    .forEach((b) => drawBlock(ctx, ox, oy, b, false));
}

// Снимок последней кучи: сцена кладёт сюда обломки и точку, где они
// замерли, предсказание читает. Пусто — Башню в этой сессии не играли.
export const rubbleSnapshot = { blocks: [], ox: 0, oyFromBottom: 0, crown: null };

export function saveRubble(blocks, ox, oyFromBottom, crown = null) {
  rubbleSnapshot.blocks = blocks.map((b) => ({ x: b.x, y: b.y, z: b.z, dx: b.dx, dy: b.dy, tone: b.tone }));
  rubbleSnapshot.ox = ox;
  rubbleSnapshot.oyFromBottom = oyFromBottom;
  rubbleSnapshot.crown = crown ? { x: crown.x, y: crown.y, z: crown.z } : null;
}

/** Куча показана — снимок больше не нужен. */
export function clearRubble() {
  rubbleSnapshot.blocks = [];
  rubbleSnapshot.crown = null;
}

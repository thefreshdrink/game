// Отрисовка одного бруска: спрайт по тону или, если спрайта нет, грани
// линиями (общий вход — ../blocks.js).

import { BODY, LINE, LINE2, TEX, FAR, UI, ACCENT, facesOf, poly, edge, blockRect } from './iso.js';
import { sprites } from './tones.js';

/** Силуэт бруска — обводка поверх спрайта, когда он под пальцем. */
function strokeSilhouette(ctx, ox, oy, o, color) {
  const f = facesOf(ox, oy, o);
  edge(ctx, f.top[0], f.top[1], color);
  edge(ctx, f.top[1], f.top[2], color);
  edge(ctx, f.top[2], f.top[3], color);
  edge(ctx, f.top[3], f.top[0], color);
  edge(ctx, f.right[1], f.right[2], color);
  edge(ctx, f.right[2], f.right[3], color);
  edge(ctx, f.front[2], f.front[3], color);
  edge(ctx, f.front[3], f.front[0], color);
}

function spriteFor(o) {
  return sprites[o.tone ?? 'mid'] ?? sprites.mid ?? sprites.light ?? sprites.dark;
}

function crossSpriteFor(o) {
  return sprites[`${o.tone ?? 'mid'}Cross`] ?? null;
}

/** Брусок: верхняя грань светлее — по ней читается глубина; тело темнее
 * воздуха (design-system §2). `hot` — брусок под пальцем, акцент значит
 * ровно «это можно тронуть». */
export function drawBlock(ctx, ox, oy, o, hot) {
  const blockSprite = spriteFor(o);
  if (blockSprite) {
    const r = blockRect(ox, oy, o);
    const cross = o.dy > o.dx ? crossSpriteFor(o) : null;
    if (cross) {
      ctx.drawImage(cross, r.x, r.y, r.w, r.h);
    } else if (o.dy > o.dx) {          // поперечный ряд — тот же спрайт зеркально
      ctx.save();
      ctx.translate(r.x + r.w, r.y);
      ctx.scale(-1, 1);
      ctx.drawImage(blockSprite, 0, 0, r.w, r.h);
      ctx.restore();
    } else {
      ctx.drawImage(blockSprite, r.x, r.y, r.w, r.h);
    }
    if (hot) strokeSilhouette(ctx, ox, oy, o, ACCENT);
    return;
  }
  drawBlockFaces(ctx, ox, oy, o, hot);
}

function drawBlockFaces(ctx, ox, oy, o, hot) {
  const f = facesOf(ox, oy, o);
  poly(ctx, f.top, FAR);
  poly(ctx, f.front, UI);
  poly(ctx, f.right, BODY);

  const cx = (f.top[0][0] + f.top[2][0]) / 2;
  const cy = (f.top[0][1] + f.top[2][1]) / 2;
  ctx.fillStyle = TEX;                       // пунктирная фактура, §1
  ctx.fillRect(Math.round(cx - 6), Math.round(cy), 2, 2);
  ctx.fillRect(Math.round(cx + 4), Math.round(cy - 4), 2, 2);

  const L = hot ? ACCENT : LINE;
  const L2 = hot ? ACCENT : LINE2;
  edge(ctx, f.top[0], f.top[1], L2);
  edge(ctx, f.top[1], f.top[2], L);
  edge(ctx, f.top[2], f.top[3], L);
  edge(ctx, f.top[3], f.top[0], L2);
  edge(ctx, f.right[1], f.right[2], L);
  edge(ctx, f.right[2], f.right[3], L);
  edge(ctx, f.front[2], f.front[3], L);
  edge(ctx, f.front[3], f.front[0], L2);
}

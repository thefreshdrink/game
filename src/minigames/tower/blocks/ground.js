// Пол под башней: изометрические плиты и тень (общий вход — ../blocks.js).

import { BODY, FAR, UI, project, poly, edge } from './iso.js';

/** Земля — те же каменные плиты дороги Шута, только в изометрии (решение
 * в чате: не заводить под Башню свою землю, а связать карты одним миром). */
export function drawGround(ctx, ox, oy, radius = 4, shadowRows = 0) {
  for (let gx = -radius; gx <= radius + 2; gx++) {
    for (let gy = -radius; gy <= radius + 2; gy++) {
      const q = [
        project(ox, oy, gx, gy, 0), project(ox, oy, gx + 1, gy, 0),
        project(ox, oy, gx + 1, gy + 1, 0), project(ox, oy, gx, gy + 1, 0),
      ];
      poly(ctx, q, (gx + gy) % 2 ? UI : '#1C1C1C');
      edge(ctx, q[0], q[1], FAR, 1);
      edge(ctx, q[0], q[3], FAR, 1);
    }
  }
  if (shadowRows > 0) drawShadow(ctx, ox, oy, shadowRows);
}

/** Тень башни на полу — свет слева, тень ложится вправо (по +x) на длину,
 * растущую с высотой. Пиксельным растром 2×2 чёрного: палитра без альфы,
 * а сплошная чернота съела бы сетку пола. Даёт башне опору и глубину. */
function drawShadow(ctx, ox, oy, rows) {
  const len = 3 + rows * 0.35;
  const q = [
    project(ox, oy, 3, 0, 0), project(ox, oy, 3 + len, 0, 0),
    project(ox, oy, 3 + len, 3, 0), project(ox, oy, 3, 3, 0),
  ];
  ctx.save();
  ctx.beginPath();
  q.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.clip();
  const xs = q.map((p) => p[0]);
  const ys = q.map((p) => p[1]);
  ctx.fillStyle = BODY;
  for (let y = Math.floor(Math.min(...ys) / 2) * 2; y < Math.max(...ys); y += 2) {
    for (let x = Math.floor(Math.min(...xs) / 2) * 2 + ((y / 2) % 2) * 2; x < Math.max(...xs); x += 4) {
      ctx.fillRect(x, y, 2, 2);
    }
  }
  ctx.restore();
}

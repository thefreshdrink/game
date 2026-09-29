// Декорации дороги Шута (правка в чате 2026-09-29): дальний фон — горы в
// тумане с замком на гребне — и облака слоями сверху и в пропасти. Всё на
// сетке 2 экранных на арт-пиксель, как фигуры. Глубина — скоростью слоёв:
// фон почти стоит, облака плывут и сдвигаются с камерой тем сильнее, чем
// ближе.
//
// Облака нарезаны из генерации (tools/cut-sprites.py) в двух тонах: near —
// светлее, far — почти туман. Из них собраны ФОРМАЦИИ (правка в чате
// 2026-09-29: «большие с маленькими рядышком»): крупное облако, за ним
// дальнее тёмное, спереди мелкие светлые. Раскладка задана руками, как в
// Фигме; формация зеркалится целиком.

const GRAIN = 2;
export const CLOUD_IDS = Array.from({ length: 11 }, (_, i) => `p_${String(i + 1).padStart(2, '0')}`);

// Части формации: [облако, сдвиг x, сдвиг y (арт-px), тон]. Порядок — от
// дальнего к ближнему.
const FORMATIONS = {
  heap: [['p_03', 26, -4, 'far'], ['p_08', 0, 0, 'near'], ['p_05', 52, 14, 'near'], ['p_04', -10, 20, 'near']],
  ridge: [['p_11', 0, 6, 'far'], ['p_02', 8, 0, 'near'], ['p_06', 54, 2, 'near']],
  pair: [['p_10', 0, 0, 'far'], ['p_09', 18, 6, 'near'], ['p_01', -18, 14, 'near']],
  puffs: [['p_07', 0, 0, 'near'], ['p_04', 26, 6, 'near']],
};

// Слои: формации на периоде period px, высота — доля кадра, параллакс к
// камере и снос. Верх — две полосы, пропасть — две.
const TOP = [
  { period: 820, parallax: 0.08, drift: 3, items: [['ridge', 40, 0.05, false], ['puffs', 470, 0.13, true]] },
  { period: 760, parallax: 0.18, drift: 6, items: [['heap', 180, 0.09, false], ['pair', 560, 0.17, true]] },
];
const BOTTOM = [
  { period: 780, parallax: 0.22, drift: 5, items: [['ridge', 60, 0.84, true], ['pair', 430, 0.82, false]] },
  { period: 700, parallax: 0.35, drift: 9, items: [['heap', 250, 0.9, true], ['puffs', 600, 0.95, false]] },
];

function formationBounds(parts, images) {
  let x0 = Infinity;
  let x1 = -Infinity;
  parts.forEach(([id, dx, , tone]) => {
    const img = images[`cloud_${tone}_${id}`];
    if (!img) return;
    x0 = Math.min(x0, dx);
    x1 = Math.max(x1, dx + img.width);
  });
  return [x0, x1];
}

function drawFormation(ctx, images, name, x, y, flip) {
  const parts = FORMATIONS[name];
  const [x0, x1] = formationBounds(parts, images);
  parts.forEach(([id, dx, dy, tone]) => {
    const img = images[`cloud_${tone}_${id}`];
    if (!img) return;
    const w = img.width * GRAIN;
    const h = img.height * GRAIN;
    const ox = flip ? (x1 - dx - img.width) : (dx - x0);
    const px = Math.round((x + ox * GRAIN) / 2) * 2;
    const py = Math.round((y + dy * GRAIN) / 2) * 2;
    if (flip) {
      ctx.save();
      ctx.translate(px + w, py);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0, w, h);
      ctx.restore();
    } else {
      ctx.drawImage(img, px, py, w, h);
    }
  });
}

function drawLayer(ctx, images, L, w, h, camX, t) {
  const shift = camX * L.parallax + t * L.drift;
  L.items.forEach(([name, x, yFrac, flip]) => {
    const base = (((x - shift) % L.period) + L.period) % L.period;
    for (let fx = base - L.period; fx < w + 200; fx += L.period) {
      if (fx + 200 < 0) continue;
      drawFormation(ctx, images, name, fx, h * yFrac, flip);
    }
  });
}

/** Дальний фон: низ картинки у низа кадра, выше — её верхний тон. Почти
 * не движется (parallax 0.04 по x, 0.03 по y). Вширь повторяется зеркально —
 * у отражения стык незаметен. */
export function drawBackdrop(ctx, images, w, h, camX, camY) {
  const img = images.foolBackdrop;
  if (!img) return;
  const bw = img.width * GRAIN;
  const bh = img.height * GRAIN;
  const top = Math.round((h - bh + Math.min(40, Math.max(-40, -camY * 0.03))) / 2) * 2;
  if (images.foolBackdropTop) {
    ctx.fillStyle = images.foolBackdropTop;
    ctx.fillRect(0, 0, w, Math.max(0, top));
  }
  const period = bw * 2;
  const base = ((((-camX * 0.04) % period) + period) % period) - period;
  for (let x = Math.round(base / 2) * 2; x < w; x += bw) {
    const mirrored = Math.round((x - base) / bw) % 2 === 1;
    if (mirrored) {
      ctx.save();
      ctx.translate(x + bw, top);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0, bw, bh);
      ctx.restore();
    } else {
      ctx.drawImage(img, x, top, bw, bh);
    }
  }
}

export function drawCloudsTop(ctx, images, w, h, camX, t) {
  TOP.forEach((L) => drawLayer(ctx, images, L, w, h, camX, t));
}

export function drawCloudsBottom(ctx, images, w, h, camX, t) {
  BOTTOM.forEach((L) => drawLayer(ctx, images, L, w, h, camX, t));
}

// Декорации дороги Шута (правка в чате 2026-09-29): дальний фон — горы в
// тумане с замком на гребне — и облака слоями сверху и в пропасти. Всё на
// сетке 2 экранных на арт-пиксель, как фигуры. Глубина — скоростью слоёв:
// фон почти стоит, облака плывут и сдвигаются с камерой тем сильнее, чем
// ближе.
//
// Облака нарезаны из генерации (tools/cut-sprites.py) в двух тонах: near —
// светлее, ближний слой; far — почти туман. Композиция собирается из них
// кодом: разные облачка, часть зеркально, постоянный разброс.

const GRAIN = 2;
export const CLOUD_IDS = [
  ...Array.from({ length: 15 }, (_, i) => `a_${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 5 }, (_, i) => `b_${String(i + 1).padStart(2, '0')}`),
];

// Постоянный псевдослучай: раскладка одинакова при каждом заходе.
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/** Слой облаков: count штук на периоде period px по x, в полосе высоты
 * [y0, y1] (доли кадра), тон, параллакс к камере и собственный снос. */
function layout({ seed, count, period, y0, y1, tone, parallax, drift }) {
  const r = rng(seed);
  return {
    period, tone, parallax, drift,
    items: Array.from({ length: count }, (_, k) => ({
      id: CLOUD_IDS[Math.floor(r() * CLOUD_IDS.length)],
      x: (k + r() * 0.7) * (period / count),
      yFrac: y0 + r() * (y1 - y0),
      flip: r() < 0.5,
    })),
  };
}

const TOP = [
  layout({ seed: 11, count: 5, period: 900, y0: 0.03, y1: 0.16, tone: 'far', parallax: 0.08, drift: 3 }),
  layout({ seed: 23, count: 4, period: 760, y0: 0.06, y1: 0.24, tone: 'near', parallax: 0.18, drift: 6 }),
];
const BOTTOM = [
  layout({ seed: 37, count: 6, period: 820, y0: 0.80, y1: 0.90, tone: 'far', parallax: 0.22, drift: 5 }),
  layout({ seed: 41, count: 5, period: 700, y0: 0.86, y1: 0.97, tone: 'near', parallax: 0.35, drift: 9 }),
];

function drawLayer(ctx, images, L, w, h, camX, t) {
  const shift = camX * L.parallax + t * L.drift;
  L.items.forEach((c) => {
    const img = images[`cloud_${L.tone}_${c.id}`];
    if (!img) return;
    const cw = img.width * GRAIN;
    const ch = img.height * GRAIN;
    const base = (((c.x - shift) % L.period) + L.period) % L.period;
    for (let x = base - L.period; x < w + cw; x += L.period) {
      if (x + cw < 0) continue;
      const px = Math.round(x / 2) * 2;
      const py = Math.round((h * c.yFrac) / 2) * 2;
      if (c.flip) {
        ctx.save();
        ctx.translate(px + cw, py);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0, cw, ch);
        ctx.restore();
      } else {
        ctx.drawImage(img, px, py, cw, ch);
      }
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

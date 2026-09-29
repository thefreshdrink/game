// Пиксельное проявление картинки, расходящееся от точки origin (глаза
// оракула) — правка в чате: хотели именно «пиксельно», но чтобы шло
// плавной волной от головы, а не равномерным случайным шумом по всей
// фигуре и не полосами. Порог ячейки = расстояние от origin + немного
// случайного джиттера — край волны органический, не идеальный круг.
// progress 0..1; тот же вызов с progress от 1 к 0 стягивает картинку
// обратно в точку origin — уход в темноту.

const jitterCache = new Map();
const scratchCache = new Map();

/** Буфер картинки и маска ячеек под размер — один раз на размер. */
function scratch(bufW, bufH, cols, rows) {
  const key = `${bufW}x${bufH}:${cols}x${rows}`;
  let s = scratchCache.get(key);
  if (!s) {
    const buf = document.createElement('canvas');
    buf.width = bufW;
    buf.height = bufH;
    const bctx = buf.getContext('2d');
    bctx.imageSmoothingEnabled = false;
    const mask = document.createElement('canvas');
    mask.width = cols;
    mask.height = rows;
    const mctx = mask.getContext('2d');
    s = { buf, bctx, mask, mctx, imgData: mctx.createImageData(cols, rows) };
    scratchCache.set(key, s);
  }
  return s;
}

function getJitterGrid(cols, rows) {
  const key = `${cols}x${rows}`;
  let grid = jitterCache.get(key);
  if (!grid) {
    grid = new Float32Array(cols * rows);
    for (let i = 0; i < grid.length; i++) grid[i] = Math.random();
    jitterCache.set(key, grid);
  }
  return grid;
}

export function drawPixelReveal(
  ctx, image, x, y, w, h, progress,
  cellSize = 4, originXFrac = 0.5, originYFrac = 0.4, jitter = 0.3,
) {
  if (progress <= 0) return;
  if (progress >= 1) {
    ctx.drawImage(image, Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    return;
  }

  const bufW = Math.round(w);
  const bufH = Math.round(h);
  const cols = Math.ceil(bufW / cellSize);
  const rows = Math.ceil(bufH / cellSize);
  // Холсты переиспользуются: новый canvas на каждый кадр — мусор, на
  // котором iPhone подтормаживал растворение кучи Башни (правка 29.09).
  const { buf, bctx, mask, mctx, imgData } = scratch(bufW, bufH, cols, rows);
  bctx.globalCompositeOperation = 'source-over';
  bctx.clearRect(0, 0, bufW, bufH);
  bctx.drawImage(image, 0, 0, bufW, bufH);

  const jitterGrid = getJitterGrid(cols, rows);

  const originX = originXFrac * cols;
  const originY = originYFrac * rows;
  const maxDist = Math.hypot(
    Math.max(originX, cols - originX),
    Math.max(originY, rows - originY),
  ) || 1;

  for (let ry = 0; ry < rows; ry++) {
    for (let rx = 0; rx < cols; rx++) {
      const i = ry * cols + rx;
      const dist = Math.hypot(rx - originX, ry - originY) / maxDist;
      const threshold = dist * (1 - jitter) + jitterGrid[i] * jitter;
      imgData.data[i * 4 + 3] = threshold <= progress ? 255 : 0;
    }
  }
  mctx.putImageData(imgData, 0, 0);

  bctx.globalCompositeOperation = 'destination-in';
  bctx.drawImage(mask, 0, 0, cols, rows, 0, 0, bufW, bufH);

  ctx.drawImage(buf, Math.round(x), Math.round(y));
}

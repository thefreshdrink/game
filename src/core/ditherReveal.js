// Пиксельное проявление картинки из темноты — случайный шум, не
// упорядоченный узор Bayer (тот давал заметный «крестовый орнамент» —
// правка в чате). Каждая ячейка получает свой случайный порог один раз
// и кэшируется, чтобы при неизменном размере шум не мигал по кадрам —
// только прогресс двигает порог. progress 0..1, cellSize — экранных px
// на ячейку (меньше — мельче пиксели, ближе к размеру самого арта).

const noiseCache = new Map();

function getNoiseGrid(cols, rows) {
  const key = `${cols}x${rows}`;
  let grid = noiseCache.get(key);
  if (!grid) {
    grid = new Float32Array(cols * rows);
    for (let i = 0; i < grid.length; i++) grid[i] = Math.random();
    noiseCache.set(key, grid);
  }
  return grid;
}

export function drawDitherReveal(ctx, image, x, y, w, h, progress, cellSize = 2) {
  if (progress <= 0) return;
  if (progress >= 1) {
    ctx.drawImage(image, Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    return;
  }

  const bufW = Math.round(w);
  const bufH = Math.round(h);
  const buf = document.createElement('canvas');
  buf.width = bufW;
  buf.height = bufH;
  const bctx = buf.getContext('2d');
  bctx.imageSmoothingEnabled = false;
  bctx.drawImage(image, 0, 0, bufW, bufH);

  const cols = Math.ceil(bufW / cellSize);
  const rows = Math.ceil(bufH / cellSize);
  const grid = getNoiseGrid(cols, rows);

  const maskSmall = document.createElement('canvas');
  maskSmall.width = cols;
  maskSmall.height = rows;
  const mctx = maskSmall.getContext('2d');
  const imgData = mctx.createImageData(cols, rows);
  for (let i = 0; i < cols * rows; i++) {
    imgData.data[i * 4 + 3] = grid[i] < progress ? 255 : 0;
  }
  mctx.putImageData(imgData, 0, 0);

  bctx.globalCompositeOperation = 'destination-in';
  bctx.drawImage(maskSmall, 0, 0, cols, rows, 0, 0, bufW, bufH);

  ctx.drawImage(buf, Math.round(x), Math.round(y));
}

// Загрузка PNG и нарезка горизонтальных полос кадров на отдельные canvas.
// Кэш по src, чтобы одна и та же карта/спрайт не грузились дважды.

const cache = new Map();

export function loadImage(src) {
  if (cache.has(src)) return cache.get(src);
  const promise = new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Sprite failed to load: ${src}`));
    img.src = src;
  });
  cache.set(src, promise);
  return promise;
}

/** manifest: { name: '/assets/...png' } → { name: HTMLImageElement } */
export async function loadSprites(manifest) {
  const entries = Object.entries(manifest);
  const images = await Promise.all(entries.map(([, src]) => loadImage(src)));
  const result = {};
  entries.forEach(([name], i) => { result[name] = images[i]; });
  return result;
}

/**
 * Режет горизонтальную полосу кадров (см. ASSETS.md, файлы вида
 * *_NNxMM.png) на отдельные кадры-canvas готовые к drawImage.
 */
export function sliceStrip(image, frameWidth, frameHeight) {
  const count = Math.floor(image.width / frameWidth);
  const frames = [];
  for (let i = 0; i < count; i++) {
    const frame = document.createElement('canvas');
    frame.width = frameWidth;
    frame.height = frameHeight;
    const fctx = frame.getContext('2d');
    fctx.imageSmoothingEnabled = false;
    fctx.drawImage(
      image,
      i * frameWidth, 0, frameWidth, frameHeight,
      0, 0, frameWidth, frameHeight,
    );
    frames.push(frame);
  }
  return frames;
}

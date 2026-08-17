// Владеет <canvas>: подгонка под DPR, ресайз под окно, пиксель-арт без
// сглаживания. Логические координаты, в которых рисуют сцены, — это
// CSS-пиксели окна (те самые «экранные px» из CLAUDE.md).

const MAX_DPR = 2;

export function createCanvas(canvasEl) {
  const ctx = canvasEl.getContext('2d');
  let width = 0;
  let height = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    width = window.innerWidth;
    height = window.innerHeight;
    canvasEl.width = Math.floor(width * dpr);
    canvasEl.height = Math.floor(height * dpr);
    canvasEl.style.width = width + 'px';
    canvasEl.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false; // никогда не сглаживаем пиксель-арт
  }

  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);
  resize();

  return {
    ctx,
    resize,
    get width() { return width; },
    get height() { return height; },
  };
}

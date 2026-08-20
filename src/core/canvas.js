// Владеет <canvas>: подгонка под DPR, ресайз под логический стейдж,
// пиксель-арт без сглаживания. Логические координаты, в которых рисуют
// сцены, — это CSS-пиксели стейджа (те самые «экранные px» из CLAUDE.md).
//
// Стейдж — не окно (BUILD-SPEC-02, задача 1): на широких экранах (десктоп)
// сцены масштабировали фигуру оракула и карту от ширины окна, и на 1440px
// в кадре оставались одни рога — портретная композиция ломалась. Канвас
// теперь всегда портретная полоса ≤480px шириной, центрированная гридом
// `#app` (index.html), поле вокруг — чёрное тело объекта, сам стейдж —
// воздух `#111111`. На телефонах (ширина окна и так ≤480px) стейдж
// совпадает с окном, поведение не меняется.

const MAX_DPR = 2;
const STAGE_MAX_W = 480;
const STAGE_ASPECT = 2.3; // stageH ≤ stageW × 2.3 — портретная полоса, не во весь высокий экран

export function createCanvas(canvasEl) {
  const ctx = canvasEl.getContext('2d');
  let width = 0;
  let height = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    width = Math.min(window.innerWidth, STAGE_MAX_W);
    height = Math.min(window.innerHeight, Math.round(width * STAGE_ASPECT));
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

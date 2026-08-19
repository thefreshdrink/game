// Физика прыжка — значения взяты из рабочего прототипа
// (../../fool-minigame-prototype.html, объект PHYS), CLAUDE.md прямо
// разрешает подсматривать оттуда «уже подобранные рабочие значения», хотя
// сам файл не импортируется. Переменная гравитация (медленнее вверх,
// быстрее вниз, зависание у пика) — это и есть «сочность» прыжка без
// дополнительной анимации.

export const PHYS = {
  gRise: 2350, gFall: 3150, gHang: 1500, hangSpeed: 150,
  vTap: 620, vMax: 1000, // вертикальная скорость прыжка: тап…полный свайп
  hTap: 132, hMax: 240, // горизонтальная скорость: тап…полный свайп
  walk: 165,
};

// Голый тап — «самый маленький прыжок» (BUILD-SPEC), но не буквально нулевой:
// подобрано так, чтобы даже он гарантированно перекрывал GAP_JUMP из
// platforms.js — «промахнуться нельзя» это про подбор чисел, а не про
// код-подстраховку.
export const TAP_UP_POW = 0.15;
export const TAP_SIDE_POW = 0.5;

/** Гравитация в текущий момент по вертикальной скорости — медленнее у пика. */
export function gravityFor(vy) {
  if (Math.abs(vy) < PHYS.hangSpeed) return PHYS.gHang;
  return vy < 0 ? PHYS.gRise : PHYS.gFall;
}

/** dirX всегда вперёд (+1) — уровень линейный, назад прыгать некуда. */
export function jumpVelocity(upPow, sidePow) {
  return {
    vy: -(PHYS.vTap + (PHYS.vMax - PHYS.vTap) * upPow),
    vx: PHYS.hTap + (PHYS.hMax - PHYS.hTap) * sidePow,
  };
}

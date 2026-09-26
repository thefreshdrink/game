// Камера мини-игры: мягкое следование за героем и перевод world → screen.
//
// Цель камеры — точка героя, сдвинутая так, чтобы он стоял на доле кадра
// (leadX, leadY) от левого верхнего угла. Скорость догона — rate в секунду,
// кадрово-независимо только приблизительно (как было в leap.js — не
// «чиним», иначе поменяется ощущение).

export function createFollowCamera({ leadX = 0.5, leadY = 0.5, rate = 6 } = {}) {
  const cam = {
    x: 0,
    y: 0,

    /** Шаг следования за точкой (tx, ty) при кадре w×h. */
    follow(tx, ty, w, h, dt) {
      const targetX = tx - w * leadX;
      const targetY = ty - h * leadY;
      const k = Math.min(1, rate * dt);
      cam.x += (targetX - cam.x) * k;
      cam.y += (targetY - cam.y) * k;
    },

    /** Сразу в цель, без догона (респавн, старт сцены). */
    snap(tx, ty, w, h) {
      cam.x = tx - w * leadX;
      cam.y = ty - h * leadY;
    },

    reset(x = 0, y = 0) {
      cam.x = x;
      cam.y = y;
    },

    sx(wx) { return wx - cam.x; },
    sy(wy) { return wy - cam.y; },
  };
  return cam;
}

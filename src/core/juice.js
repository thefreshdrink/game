// «Сочность» мини-игр: частицы, вспышка кадра, дрожь. Всё
// процедурное, без ассетов (ASSETS.md). Цвета — из палитры CLAUDE.md.

export function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

/** Частицы в экранно-мировых координатах: пыль, осколки, искры. Каждая —
 * { x, y, vx, vy, t, life, s, g? }, g — своя гравитация (по умолчанию 220). */
export function createParticles() {
  const list = [];

  return {
    list,

    push(p) { list.push(p); },

    clear() { list.length = 0; },

    /** Облачко пыли из точки: разлёт в стороны и вверх, короткая жизнь. */
    burst(x, y, n, { spreadX = 70, liftY = 40, life = 0.35, lifeJitter = 0.2 } = {}) {
      for (let i = 0; i < n; i++) {
        list.push({
          x, y,
          vx: (Math.random() - 0.5) * spreadX,
          vy: -Math.random() * liftY,
          t: 0, life: life + Math.random() * lifeJitter,
          s: Math.random() < 0.5 ? 2 : 3,
        });
      }
    },

    update(dt) {
      for (let i = list.length - 1; i >= 0; i--) {
        const d = list[i];
        d.t += dt;
        if (d.t >= d.life) { list.splice(i, 1); continue; }
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.vy += (d.g ?? 220) * dt;
      }
    },

    /** Пыль тонами дальней детали: светлее в первой половине жизни. */
    draw(ctx, camX, camY) {
      list.forEach((d) => {
        const a = 1 - d.t / d.life;
        ctx.fillStyle = a > 0.5 ? '#808080' : '#4A4A4A';
        ctx.fillRect(Math.round(d.x - camX), Math.round(d.y - camY - d.s), d.s, d.s);
      });
    },
  };
}

/** Короткая вспышка кадра цветом (респавн — «моргнул и снова на плите»). */
export function createFlash(duration, color = '#000000') {
  let left = 0;
  return {
    trigger() { left = duration; },
    reset() { left = 0; },
    update(dt) { if (left > 0) left = Math.max(0, left - dt); },
    draw(ctx, w, h) {
      if (left <= 0) return;
      ctx.globalAlpha = clamp01(left / duration);
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    },
  };
}

/** Дрожь кадра: сдвигает контекст на случайные целые пиксели в пределах
 * amount. Вызывать между ctx.save() и ctx.restore(). */
export function applyShake(ctx, amount) {
  if (!amount) return;
  ctx.translate(
    Math.round((Math.random() * 2 - 1) * amount),
    Math.round((Math.random() * 2 - 1) * amount),
  );
}

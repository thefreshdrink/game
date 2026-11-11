// Каждая щель дороги Шута берётся полным свайпом с края (бэклог 31).
// Шаг полёта повторяет leap.js (состояние 'air'): гравитация по скорости,
// x и y по dt, приземление — когда нога за кадр пересекла верх плиты.
// Без браузера: node:test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPlatforms, platformAt } from '../src/minigames/fool/platforms.js';
import { PHYS, gravityFor, jumpVelocity } from '../src/minigames/fool/physics.js';

const DT = 1 / 60;

// Прыжок с x0 на высоте y0; возвращает плиту приземления или null.
function fly(platforms, x0, y0, upPow, sidePow) {
  const v = jumpVelocity(upPow, sidePow);
  let x = x0, y = y0, vx = v.vx, vy = v.vy;
  for (let k = 0; k < 600; k++) {
    const prevY = y;
    vy += gravityFor(vy) * DT;
    x += vx * DT;
    y += vy * DT;
    if (vy > 0) {
      const p = platformAt(platforms, x, prevY - 2, y + 2);
      if (p) return { p, x };
    }
    if (y - y0 > 2000) return null;
  }
  return null;
}

const platforms = buildPlatforms(0);

// Пределы свайпа — как в leap/flick.js: вверх 0.2…1.3, вбок 0.35…1.
const UPS = [0.2, 0.5, 0.8, 1, 1.3];
const SIDES = [0.35, 0.5, 0.75, 1];

test('с края каждой плиты высокий свайп (вверх 1, вбок 0.5) садит на следующую', () => {
  for (let i = 0; i < platforms.length - 1; i++) {
    const from = platforms[i];
    const r = fly(platforms, from.x + from.w, from.y, 1, 0.5);
    assert.ok(r, `с плиты ${i + 1}: улетел мимо всех плит`);
    assert.equal(platforms.indexOf(r.p), i + 1,
      `с плиты ${i + 1}: сел на плиту ${platforms.indexOf(r.p) + 1}, а не на ${i + 2}`);
  }
});

// Сильнейший свайп с плиты 2 садит сразу на 4-ю (перескок через 3-ю) —
// это не сломано (land() берёт индекс плиты), но решение дизайна, поэтому
// тест проверяет только, что приземление всегда впереди.
test('любой свайп с края садит только вперёд, не на ту же плиту', () => {
  for (let i = 0; i < platforms.length - 1; i++) {
    const from = platforms[i];
    for (const u of UPS) for (const s of SIDES) {
      const r = fly(platforms, from.x + from.w, from.y, u, s);
      if (r) assert.ok(platforms.indexOf(r.p) > i,
        `с плиты ${i + 1} свайпом ${u}/${s}: сел на плиту ${platforms.indexOf(r.p) + 1}`);
    }
  }
});

test('гравитация: зависание у пика, медленнее вверх, быстрее вниз', () => {
  assert.equal(gravityFor(0), PHYS.gHang);
  assert.equal(gravityFor(-PHYS.hangSpeed - 1), PHYS.gRise);
  assert.equal(gravityFor(PHYS.hangSpeed + 1), PHYS.gFall);
});

// Кадр обычной сцены Шута — фон, морось, дорога, Шут с псом,
// подсказки. Такты 2–3 падения рисует fallScene.js. Вынесено из leap.js
// (задача 8 бэклога агента) без изменения поведения — строки кадра и
// комментарии перенесены как были.

import { clamp01 } from '../../../core/ease.js';
import { platformAt, drawPlatform } from '../platforms.js';
import { drawDrizzle } from '../weather.js';
import { drawBackdrop, drawCloudsTop, drawCloudsBottom } from '../scenery.js';
import { drawPlayer, drawDog } from '../actors.js';
import { drawLeapHints } from '../leapHints.js';
import { RESPAWN_DROP } from './tuning.js';

export function drawWorld(ctx, w, h, {
  images, platforms, idx, state, stateT, t, camX, camY, player, dog, dust, ghost,
  lean, deepestY, movedEver, swipeHintUntil, respawnFlash,
}) {
  const last = platforms[platforms.length - 1];
  // Дождевые облака наверху + пропасть с облачками внизу (правка 2026-09-10).
  // Дальний фон, облака сверху, облака в пропасти — от дальнего к
  // ближнему (правка в чате 2026-09-29). Туман пропасти убран
  // (правка 2026-10-24): холмы фона сами дают градиент.
  drawBackdrop(ctx, images, w, h, camX, camY);
  drawCloudsTop(ctx, images, w, h, camX, t);
  drawCloudsBottom(ctx, images, w, h, camX, t);
  // Морось — всю дорогу до финального прыжка (правка в чате 2026-09-10),
  // позади плит (правка 2026-10-24: передний план без дождя).
  if (state === 'walk' || state === 'air' || state === 'wait_leap' || state === 'charge') {
    drawDrizzle(ctx, w, h, t, camX);
  }
  platforms.forEach((p) => drawPlatform(ctx, images, p, camX, camY));
  ghost.draw(ctx, last, camX, camY);

  // Наклон идёт РЕЗЧЕ К КОНЦУ, чем растёт кольцо (правка в чате
  // 2026-08-29: «не в унисон»): lean² — Шут сперва «сопротивляется».
  const leanV = lean * lean;

  // Обычное падение мимо всех плит — низ кадра затягивает чернотой, пока
  // не сработает респавн. Порог высокий: только НАСТОЯЩИЙ провал, иначе
  // чернота мигала на дуге обычного прыжка (правка в чате 2026-08-30).
  const fellBelow = deepestY - (platforms[idx] ? platforms[idx].y : 0);
  const voidStart = RESPAWN_DROP * 0.6;
  if (state === 'air' && player.vy > 0 && fellBelow > voidStart) {
    const k = clamp01((fellBelow - voidStart) / (RESPAWN_DROP - voidStart));
    const voidH = Math.round(h * (0.08 + k * 0.5));
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, h - voidH, w, voidH);
  }

  dust.draw(ctx, camX, camY);

  // Пёс поверх Шута (правка в чате 2026-08-27). Плиты под ногами — для
  // клэмпа спрайтов по краям; пёс у края может стоять на соседней плите.
  const standPlat = platforms[idx] || null;
  const dogPlat = platformAt(platforms, dog.x, -Infinity, Infinity) || standPlat;
  drawPlayer(ctx, images, player, camX, camY, state, t, standPlat, leanV,
    standPlat === platforms[platforms.length - 1]);
  drawDog(ctx, images, dog, camX, camY, dogPlat);

  drawLeapHints(ctx, w, camX, camY, {
    state, stateT, t, movedEver, idx, lean, player, swipeLinger: t < swipeHintUntil,
  });
  respawnFlash.draw(ctx, w, h);
}

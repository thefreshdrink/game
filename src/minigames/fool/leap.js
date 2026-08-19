// Экран 5 — мини-игра «Leap». Идёшь по дороге вправо, дорога кончается, и
// последний шаг — тот же самый, что и все предыдущие (BUILD-SPEC). Ходьба
// вдоль плиты — автоматическая; свайп нужен только чтобы перепрыгнуть щель;
// у последнего края — одно удержание вместо прыжка. Проиграть нельзя.
//
// Анимация — «сначала процедурно, руками только то, что код не умеет»
// (ASSETS.md): нет отдельных кадров ходьбы/наклона у края/«пёс
// оглядывается»/парного падения — вместо них здесь squash-and-stretch,
// программный наклон и позиционирование по существующим позам (idle/fall,
// walk/sit/look_down/jump у пса).

import { setFont } from '../../core/text.js';
import { PHYS, TAP_UP_POW, TAP_SIDE_POW, gravityFor, jumpVelocity } from './physics.js';
import { buildPlatforms, platformAt, drawPlatform, drawGhostRoad, PLATE_H } from './platforms.js';

const PLAYER_W = 42;
const PLAYER_H = 50;
const DOG_W = 18;
const DOG_H = 14;
const DOG_LAG = 46; // насколько пёс отстаёт по x в обычной ходьбе

const HOLD_T1 = 1.6; // первые 75% полоски
const HOLD_T2 = 1.0; // последние 25% — заметно медленнее (BUILD-SPEC)
const HOLD_TOTAL = HOLD_T1 + HOLD_T2; // «~2,6 сек»

const FALL_G = 900;
const FALL_VMAX = 760;
const FALL_DEPTH = 900; // экранных px падения до касания земли

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function holdProgress(elapsed) {
  if (elapsed <= HOLD_T1) return (elapsed / HOLD_T1) * 0.75;
  return 0.75 + clamp01((elapsed - HOLD_T1) / HOLD_T2) * 0.25;
}

export function createLeapScreen({ input, images, goto }) {
  let offHandlers = [];
  let platforms = [];
  let idx = 0; // индекс текущей/последней плиты под ногами
  let state = 'walk'; // walk | air | wait_jump | wait_leap | charge | fall | landed
  let t = 0;
  let stateT = 0;
  let deepestY = 0;
  let camX = 0, camY = 0;
  let hintAlpha = 1;

  const player = { x: 0, y: 0, vx: 0, vy: 0, face: 1, sqx: 1, sqy: 1, pose: 'idle' };
  const dog = { x: 0, y: 0, state: 'follow', pose: 'walk', frameT: 0 };
  const dust = [];

  function startPlatform() {
    return platforms[0];
  }

  function spawnDust(x, y, n) {
    for (let i = 0; i < n; i++) {
      dust.push({
        x, y,
        vx: (Math.random() - 0.5) * 70,
        vy: -Math.random() * 40,
        t: 0, life: 0.35 + Math.random() * 0.2,
        s: Math.random() < 0.5 ? 2 : 3,
      });
    }
  }

  function updateDust(dt) {
    for (let i = dust.length - 1; i >= 0; i--) {
      const d = dust[i];
      d.t += dt;
      if (d.t >= d.life) { dust.splice(i, 1); continue; }
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.vy += 220 * dt;
    }
  }

  function land(p) {
    player.y = p.y;
    player.vx = 0;
    player.vy = 0;
    player.sqx = 1.22;
    player.sqy = 0.8;
    idx = platforms.indexOf(p);
    state = 'walk';
    stateT = 0;
    spawnDust(player.x, player.y, 5);
  }

  function beginJump(upPow, sidePow) {
    if (state !== 'wait_jump') return;
    const v = jumpVelocity(upPow, sidePow);
    player.vy = v.vy;
    player.vx = v.vx;
    player.sqx = 0.8;
    player.sqy = 1.24;
    state = 'air';
    stateT = 0;
    hintAlpha = 0;
    spawnDust(player.x, player.y, 4);
  }

  function commitLeap() {
    state = 'fall';
    stateT = 0;
    player.vx = 60;
    player.vy = -120;
    dog.state = 'leap';
    dog.vy = -200;
  }

  return {
    enter() {
      t = 0;
      stateT = 0;
      idx = 0;
      state = 'walk';
      deepestY = 0;
      hintAlpha = 1;
      dust.length = 0;

      const startY = 0;
      platforms = buildPlatforms(startY);
      const p0 = startPlatform();
      player.x = p0.x + 40;
      player.y = p0.y;
      player.vx = 0;
      player.vy = 0;
      player.face = 1;
      player.pose = 'idle';
      dog.x = player.x - DOG_LAG;
      dog.y = player.y;
      dog.state = 'follow';
      dog.pose = 'walk';
      dog.frameT = 0;
      camX = 0;
      camY = 0;

      offHandlers = [
        input.on('swipe', (e) => {
          if (state !== 'wait_jump') return;
          beginJump(e.up, Math.min(1, Math.abs(e.side)));
        }),
        input.on('tap', () => {
          if (state !== 'wait_jump') return;
          beginJump(TAP_UP_POW, TAP_SIDE_POW);
        }),
        input.on('holdstart', () => {
          if (state !== 'wait_leap') return;
          state = 'charge';
          stateT = 0;
        }),
        input.on('holdend', () => {
          if (state !== 'charge') return;
          if (stateT >= HOLD_TOTAL) commitLeap();
          else { state = 'wait_leap'; stateT = 0; } // отпустил раньше — просто ждём снова
        }),
      ];
    },

    exit() {
      offHandlers.forEach((off) => off());
      offHandlers = [];
    },

    update(dt, w = 430, h = 932) {
      t += dt;
      stateT += dt;
      updateDust(dt);

      // Камера: портрет, фигура держится на трети сверху; по x с лёгким
      // упреждением вправо (BUILD-SPEC: «камера портрет»).
      const targetCamX = player.x - w * 0.38;
      const targetCamY = player.y - h * 0.33;
      const camRate = Math.min(1, 6 * dt);
      camX += (targetCamX - camX) * camRate;
      camY += (targetCamY - camY) * camRate;

      const last = platforms[platforms.length - 1];

      if (state === 'walk') {
        player.x += PHYS.walk * dt;
        player.sqx += (1 - player.sqx) * Math.min(1, dt * 10);
        player.sqy += (1 - player.sqy) * Math.min(1, dt * 10);
        const p = platforms[idx];
        const edgeX = p.x + p.w;
        if (player.x >= edgeX) {
          player.x = edgeX;
          if (p === last) {
            state = 'wait_leap';
            stateT = 0;
          } else {
            const next = platforms[idx + 1];
            if (next.jumpIn) {
              state = 'wait_jump';
              stateT = 0;
            } else {
              // «Сходит с края» — без прыжка, гравитация и текущая
              // скорость ходьбы сами переносят через узкую щель.
              player.vx = PHYS.walk;
              player.vy = 0;
              state = 'air';
              stateT = 0;
            }
          }
        }
      } else if (state === 'air') {
        const prevY = player.y;
        player.vy += gravityFor(player.vy) * dt;
        player.x += player.vx * dt;
        player.y += player.vy * dt;
        deepestY = Math.max(deepestY, player.y);
        // Пересечение уровня плиты за кадр, не узкое окно — иначе на
        // большой скорости падения нога проскакивает сквозь плиту, не
        // задев её ни в одном кадре (баг, пойман вживую при тесте).
        if (player.vy > 0) {
          const p = platformAt(platforms, player.x, prevY - 2, player.y + 2);
          if (p) land(p);
        }
      } else if (state === 'wait_jump' || state === 'wait_leap') {
        player.sqx += (1 - player.sqx) * Math.min(1, dt * 8);
        player.sqy += (1 - player.sqy) * Math.min(1, dt * 8);
      } else if (state === 'charge') {
        // полоска считается в draw() из stateT — тут только поза/пёс.
      } else if (state === 'fall') {
        player.vy = Math.min(FALL_VMAX, player.vy + FALL_G * dt);
        player.x += player.vx * dt;
        player.y += player.vy * dt;
        deepestY = Math.max(deepestY, player.y);
        if (dog.state === 'leap') {
          dog.vy += FALL_G * dt;
          dog.x += 55 * dt;
          dog.y += dog.vy * dt;
        }
        if (player.y - last.y >= FALL_DEPTH) {
          state = 'landed';
          stateT = 0;
          spawnDust(player.x, player.y, 14);
        }
      } else if (state === 'landed') {
        // ждём короткий такт, потом уходим на предсказание.
        if (stateT >= 1.1) goto('prediction');
      }

      // Пёс следует за игроком, пока не наступает его собственная реплика
      // у финального края (BUILD-SPEC: обгоняет, садится, оглядывается).
      if (dog.state === 'follow') {
        const targetX = player.x - DOG_LAG;
        dog.x += (targetX - dog.x) * Math.min(1, dt * 6);
        const p = platformAt(platforms, dog.x, -Infinity, Infinity) || platforms[idx];
        dog.y += (p.y - dog.y) * Math.min(1, dt * 10);
        dog.frameT += dt;
        if (state === 'wait_leap' || state === 'charge') {
          dog.state = 'overtake';
        }
      } else if (dog.state === 'overtake') {
        const targetX = player.x + 30;
        dog.x += (targetX - dog.x) * Math.min(1, dt * 5);
        dog.y += (player.y - dog.y) * Math.min(1, dt * 8);
        dog.frameT += dt;
        if (Math.abs(dog.x - targetX) < 2) { dog.state = 'sit'; dog.pose = 'sit'; dog.frameT = 0; }
      } else if (dog.state === 'sit') {
        dog.pose = state === 'charge' ? 'lookdown' : 'sit';
        dog.frameT += dt;
      }
    },

    draw(ctx, w, h) {
      const scale = Math.min(Math.max(w / 430, 0.75), 1.25);

      ctx.fillStyle = '#111111';
      ctx.fillRect(0, 0, w, h);

      const last = platforms[platforms.length - 1];
      platforms.forEach((p) => drawPlatform(ctx, images, p, camX, camY, scale));
      // Дорога за пропастью — видна, не интерактивна (BUILD-SPEC «решение B»).
      drawGhostRoad(ctx, last.x + last.w + 40, last.y, 140, camX, camY, scale);

      // Пустота — чем глубже забрались, тем больше съедает низ кадра.
      const voidFrac = clamp01(deepestY / (FALL_DEPTH * 0.9));
      const voidH = Math.round(h * (0.15 + voidFrac * 0.55));
      const ramp = ['#161616', '#1C1C1C', '#212121', '#252525', '#2A2A2A', '#2E2E2E'];
      const bandH = Math.max(2, Math.round(3 * scale));
      ramp.forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.fillRect(0, h - voidH - (ramp.length - i) * bandH, w, bandH);
      });
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, h - voidH, w, voidH);

      // Пыль.
      dust.forEach((d) => {
        const a = 1 - d.t / d.life;
        ctx.fillStyle = a > 0.5 ? '#808080' : '#4A4A4A';
        ctx.fillRect(Math.round(d.x - camX), Math.round(d.y - camY - d.s), d.s, d.s);
      });

      if (state !== 'fall' && state !== 'landed') {
        drawDog(ctx, images, dog, camX, camY, scale);
        drawPlayer(ctx, images, player, camX, camY, scale, state);
      } else {
        drawPlayer(ctx, images, player, camX, camY, scale, state);
        if (dog.state === 'leap') drawDog(ctx, images, dog, camX, camY, scale);
      }

      // Белая линия земли — проступает в момент касания, не раньше.
      if (state === 'landed') {
        const lineY = Math.round(player.y - camY + PLAYER_H * scale * 0.9);
        ctx.fillStyle = '#FFFFFF';
        ctx.globalAlpha = clamp01(stateT / 0.15);
        ctx.fillRect(0, lineY, w, Math.max(2, Math.round(2 * scale)));
        ctx.globalAlpha = 1;
      }

      // Подсказка — тот же стиль, что и на других экранах.
      setFont(ctx, 'menuOption', scale);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#EBA331';
      const marginTop = Math.round(48 * scale);
      if (state === 'wait_jump' || state === 'walk') {
        ctx.globalAlpha = hintAlpha;
        ctx.fillText('SWIPE TO JUMP', w / 2, marginTop);
        ctx.globalAlpha = 1;
      } else if (state === 'wait_leap' || state === 'charge') {
        ctx.fillText('HOLD', w / 2, marginTop);
      }

      if (state === 'charge') {
        const p = clamp01(holdProgress(stateT));
        const barW = Math.round(160 * scale);
        const barX = Math.round(w / 2 - barW / 2);
        const barY = marginTop + Math.round(16 * scale);
        const barH = Math.max(3, Math.round(4 * scale));
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX + 0.5, barY + 0.5, barW, barH);
        ctx.fillStyle = '#EBA331';
        ctx.fillRect(barX, barY, Math.round(barW * p), barH);
      }
    },
  };
}

function poseImage(images, name) {
  return name === 'fall' ? images.foolFall : images.foolIdle;
}

function drawPlayer(ctx, images, p, camX, camY, scale, state) {
  const pose = state === 'air' || state === 'fall' ? 'fall' : 'idle';
  const img = poseImage(images, pose);
  const w = Math.round(PLAYER_W * scale * p.sqx);
  const h = Math.round(PLAYER_H * scale * p.sqy);
  const x = Math.round(p.x - camX - w / 2);
  const y = Math.round(p.y - camY - h);

  ctx.save();
  if (state === 'wait_leap' || state === 'charge') {
    // Наклон у края — процедурно, отдельного кадра нет (ASSETS.md).
    ctx.translate(x + w / 2, y + h);
    ctx.rotate(0.10);
    ctx.translate(-(x + w / 2), -(y + h));
  }
  ctx.drawImage(img, x, y, w, h);
  ctx.restore();
}

function drawDog(ctx, images, d, camX, camY, scale) {
  let frames = images.dogWalkFrames;
  let idx = Math.floor(d.frameT * 6) % frames.length;
  if (d.pose === 'sit') { frames = images.dogSitFrames; idx = Math.floor(d.frameT * 2) % frames.length; }
  else if (d.pose === 'lookdown') { frames = [images.dogLookDown]; idx = 0; }
  else if (d.pose === 'jump') { frames = [images.dogJump]; idx = 0; }
  if (d.state === 'leap') { frames = [images.dogJump]; idx = 0; }

  const img = frames[idx];
  const w = Math.round(DOG_W * scale);
  const h = Math.round(DOG_H * scale);
  const x = Math.round(d.x - camX - w / 2);
  const y = Math.round(d.y - camY - h);
  ctx.drawImage(img, x, y, w, h);
}

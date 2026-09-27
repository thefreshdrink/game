// Фигуры дороги Шута: сам Шут и пёс. Размеры, поведение пса, отрисовка.
// Анимация — «сначала процедурно, руками только то, что код не умеет»
// (ASSETS.md): squash-and-stretch, программный наклон и позиционирование
// по существующим позам.

import { clamp01 } from '../../core/ease.js';
import { platformAt } from './platforms.js';

// Спрайты — 44×48 и 18×14 арт-px (ASSETS.md). Правило сетки CLAUDE.md —
// 1 арт-пиксель = ровно 2 экранных. Значения ниже уже удвоены и рисуются
// ФИКСИРОВАННЫМ ×2 без uiScale (BUILD-SPEC-03 задача 2) — иначе арт-пиксель
// занимает то 1, то 2 экранных, и контур рвётся.
export const PLAYER_W = 88;
export const PLAYER_H = 96;
// Парный спрайт падения (Шут+пёс, BUILD-SPEC-03 задача 3) шире соло-поз —
// своя ширина, та же высота (48×48 арт-px → ×2 экранных, см. ASSETS.md).
export const PAIR_W = 96;
export const IDLE_FPS = 6; // темп смены кадров дыхания (4 кадра)
export const DOG_W = 36;
export const DOG_H = 28;
export const DOG_LAG = 46; // насколько пёс отстаёт по x в обычной ходьбе


// Прыжок пса за игроком — процедурная дуга по Y, не смена спрайта саму
// по себе (правка в чате: «не похоже, что он прыгает за ним» — раньше
// просто менялась поза, а сам пёс продолжал ровно скользить к цели).
// Пёс не считает щели сам — просто подпрыгивает следом с небольшой
// задержкой реакции каждый раз, когда игрок уходит в 'air'.
const DOG_HOP_DELAY = 0.1; // реакция чуть позже, чем прыгнул игрок
const DOG_HOP_DURATION = 0.32;
const DOG_HOP_HEIGHT = 34;


/** hopDelay > 0 — отсчитывает задержку реакции; hopT >= 0 — идёт сама
 * дуга прыжка (см. DOG_HOP_*); hopT === -1 — пёс не прыгает. */
export function createDog() {
  return {
    x: 0, y: 0, state: 'follow', pose: 'walk', frameT: 0, hopDelay: 0, hopT: -1, peekT: 0,
    stillT: 0, // сколько пёс стоит на месте — за порогом садится и виляет хвостом
  };
}

/** Пёс рядом с Шутом, идёт следом (старт сцены, респавн). */
export function placeDog(dog, player) {
  dog.x = player.x - DOG_LAG;
  dog.y = player.y;
  dog.state = 'follow';
  dog.pose = 'walk';
  dog.stillT = 0;
}

/** Squash-and-stretch отпускает к 1 с темпом k в секунду. */
export function relaxSquash(p, dt, k) {
  p.sqx += (1 - p.sqx) * Math.min(1, dt * k);
  p.sqy += (1 - p.sqy) * Math.min(1, dt * k);
}

export function scheduleDogHop(dog) {
  dog.hopDelay = DOG_HOP_DELAY;
  dog.hopT = -1;
}

/** Шаг пса. s — { player, platforms, idx, state, walking } сцены. */
export function updateDog(dog, dt, { player, platforms, idx, state, walking }) {
  // Пёс следует за игроком, пока не наступает его собственная реплика
  // у финального края (BUILD-SPEC: обгоняет, садится, оглядывается).
  if (dog.state === 'follow') {
    const targetX = player.x - DOG_LAG;
    dog.x += (targetX - dog.x) * Math.min(1, dt * 6);
    const p = platformAt(platforms, dog.x, -Infinity, Infinity) || platforms[idx];
    dog.y += (p.y - dog.y) * Math.min(1, dt * 10);
    dog.frameT += dt;
    // Настоящая дуга прыжка, не просто смена спрайта (правка в чате,
    // 2026-08-27: «не похоже, что он прыгает за ним»). Задержка —
    // реакция чуть позже игрока, потом синус-дуга вверх-вниз
    // (hopOffset читает drawDog); щель под собой пёс не считает,
    // просто подпрыгивает следом каждый раз, когда игрок в 'air'.
    if (dog.hopDelay > 0) {
      dog.hopDelay -= dt;
      if (dog.hopDelay <= 0) dog.hopT = 0;
    } else if (dog.hopT >= 0) {
      dog.hopT += dt;
      if (dog.hopT >= DOG_HOP_DURATION) dog.hopT = -1;
    }
    dog.hopOffset = dog.hopT >= 0
      ? -Math.sin(clamp01(dog.hopT / DOG_HOP_DURATION) * Math.PI) * DOG_HOP_HEIGHT
      : 0;
    // Стоит на месте (игрок не идёт, пёс догнал, не в прыжке) — через
    // 0.3 с садится и виляет хвостом (кадр dog_sit — это анимация
    // хвоста), а не топчется в цикле ходьбы (правка в чате 2026-08-30).
    const still = !walking && dog.hopT < 0 && Math.abs(dog.x - targetX) < 6;
    dog.stillT = still ? dog.stillT + dt : 0;
    dog.pose = dog.hopT >= 0 ? 'jump' : (dog.stillT > 0.3 ? 'sit' : 'walk');
    if (state === 'wait_leap' || state === 'charge') {
      dog.state = 'overtake';
    }
  } else if (dog.state === 'overtake') {
    // Пёс обгоняет и доходит ДО САМОЙ кромки финальной плиты (dog.x —
    // центр, см. drawDog; держим не дальше кромки минус полуширина).
    const lastEdge = platforms[platforms.length - 1].x + platforms[platforms.length - 1].w;
    const targetX = Math.min(player.x + 30, lastEdge - DOG_W / 2 - 2);
    dog.x += (targetX - dog.x) * Math.min(1, dt * 5);
    dog.y += (player.y - dog.y) * Math.min(1, dt * 8);
    dog.frameT += dt;
    if (Math.abs(dog.x - targetX) < 2) { dog.state = 'peek'; dog.pose = 'lookdown'; dog.peekT = 0; }
  } else if (dog.state === 'peek') {
    // Заглядывает вниз с кромки ~0.8 с.
    dog.peekT += dt;
    dog.frameT += dt;
    if (dog.peekT >= 0.8) { dog.state = 'sit'; dog.pose = 'sit'; dog.frameT = 0; }
  } else if (dog.state === 'sit') {
    // Садится и «оглядывается» на игрока — отступив от Шута, чтобы не
    // накладываться на наклоняющуюся фигуру (правка в чате 2026-08-29:
    // «отодвинуть собаку назад»). Отдельного кадра «оглядывается» нет —
    // обходимся sit.
    dog.pose = 'sit';
    dog.frameT += dt;
    const sitX = player.x - 56; // позади Шута, чисто от наклона фигуры
    dog.x += (sitX - dog.x) * Math.min(1, dt * 4);
    dog.y += (player.y - dog.y) * Math.min(1, dt * 8);
  }
}

// Обычный прыжок (state 'air', короткая щель между плитами) читается по
// фазе дуги — вверх и вниз разными позами, не одной статичной (правка в
// чате, 2026-08-26): 'rise', пока vy < 0 (ещё поднимается), 'fall' — как
// только пошёл вниз. Финальный leap через пропасть рисует не эта функция,
// а drawFallSequence (три такта, задача 7) — сюда доходит только стоп-кадр
// 'brace', и он идёт по общей ветке idle, повёрнутой на leanV.
export function drawPlayer(ctx, images, p, camX, camY, state, t, standPlat, lean = 0, finalEdge = false) {
  let pose;
  let img;
  if (state === 'air') {
    pose = p.vy < 0 ? 'rise' : 'fall';
    img = pose === 'rise' ? images.foolRise : images.foolFall;
  } else {
    pose = 'idle';
    const frames = images.foolIdleFrames;
    img = frames[Math.floor(t * IDLE_FPS) % frames.length];
  }
  const baseW = PLAYER_W;
  // Фиксированный ×2 (BUILD-SPEC-03 задача 2): PLAYER_W/H уже удвоены,
  // никакого uiScale. sqx/sqy — намеренный squash анимации, остаются.
  const w = Math.round(baseW * p.sqx);
  const h = Math.round(PLAYER_H * p.sqy);
  // Спрайт центрируется на p.x, но у него есть ширина — на последнем
  // отрезке платформы (ещё в 'walk', не только стоя у края) правая
  // половина заходила за физический край плиты (правка в чате: «выходит
  // за край», «на первой платформе заходит за край» — ловилось уже во
  // время ходьбы, не только в статичных позах ожидания). Первая попытка
  // трогала только 3 «стоячих» состояния и потому не спасала сам подход
  // к краю. Клэмп по фактическому краю ТЕКУЩЕЙ плиты (standEdgeX) решает
  // это на любом расстоянии сразу: пока до края далеко — сдвига нет
  // совсем, чем ближе — тем плавнее подъезжает, у самого края спрайт
  // просто не залезает правым краем дальше физической границы плиты.
  // В воздухе ('air') не клэмпим — там за пределами плиты находиться и
  // есть смысл состояния. На земле — держим спрайт целиком над плитой,
  // ни левым, ни правым краем не свисает (правка 2026-08-28). ИСКЛЮЧЕНИЕ:
  // последняя плита (finalEdge) — правый клэмп снят, Шут подходит носком
  // к самому обрыву (правка в чате 2026-08-31, отмена оранжевой кромки —
  // см. decisions-log).
  const isGrounded = state === 'walk'
    || state === 'wait_leap' || state === 'charge';
  let x = Math.round(p.x - camX - w / 2);
  if (isGrounded && standPlat) {
    const minLeft = Math.round(standPlat.x - camX);
    if (x < minLeft) x = minLeft;
    if (!finalEdge) {
      const maxRight = Math.round(standPlat.x + standPlat.w - camX);
      if (x + w > maxRight) x = maxRight - w;
    }
  }
  const y = Math.round(p.y - camY - h);

  ctx.save();
  if (lean > 0) {
    // Наклон вперёд у финального края (задача 6, вместо полоски заряда):
    // поворот вокруг точки у ног, угол 0 → 32° по lean. Отдельного кадра
    // нет (ASSETS.md). lean уже несёт кривую holdProgress и выпрямление.
    ctx.translate(x + w / 2, y + h);
    ctx.rotate(lean * 0.559); // 32° в радианах
    ctx.translate(-(x + w / 2), -(y + h));
  }
  ctx.drawImage(img, x, y, w, h);
  ctx.restore();
}

export function drawDog(ctx, images, d, camX, camY, dogPlat) {
  let frames = images.dogWalkFrames;
  let idx = Math.floor(d.frameT * 6) % frames.length;
  if (d.pose === 'sit') { frames = images.dogSitFrames; idx = Math.floor(d.frameT * 4) % frames.length; } // 2 кадра = хвост вверх/вниз, ~2 виляния/с
  else if (d.pose === 'lookdown') { frames = [images.dogLookDown]; idx = 0; }
  else if (d.pose === 'jump') { frames = [images.dogJump]; idx = 0; }

  const img = frames[idx];
  // Фиксированный ×2 (BUILD-SPEC-03 задача 2) — DOG_W/H уже удвоены.
  const w = DOG_W;
  const h = DOG_H;
  let x = Math.round(d.x - camX - w / 2);
  // Пёс не свисает за край плиты (правка 2026-08-28). Во время прыжка
  // (pose 'jump', над щелью) — можно, там смысл в том, что он в воздухе.
  if (dogPlat && d.pose !== 'jump') {
    const minLeft = Math.round(dogPlat.x - camX);
    const maxRight = Math.round(dogPlat.x + dogPlat.w - camX);
    if (x + w > maxRight) x = maxRight - w;
    if (x < minLeft) x = minLeft;
  }
  const hopY = Math.round(d.hopOffset || 0);
  const y = Math.round(d.y - camY - h) + hopY;
  ctx.drawImage(img, x, y, w, h);
}

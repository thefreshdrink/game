// Единый источник ввода: тап, свайп, удержание. Один Pointer Events
// слушатель на весь экран — сцены подписываются через on(type, handler) и
// сами решают, что делать с жестом.
//
// Свайп: порог 16px, нормировка по 120px — значения из прототипа
// (см. BUILD-SPEC.md, функция swipeJump).
// Удержание: жест распознаётся, если палец не отпущен HOLD_DELAY мс —
// после этого момента holdstart/holdmove/holdend несут длительность,
// проценты и тайминг полоски считает сама мини-игра (там своя кривая,
// с замедлением последней четверти).
//
// press{start,move,end} — низкоуровневый сигнал «палец сейчас здесь»,
// без классификации на тап/свайп/холд и без задержек. Нужен экранам для
// подсветки UI при касании (на тач-устройствах нет hover) — например,
// пункт меню подсвечивается акцентом, пока на нём палец, независимо от
// того, чем жест кончится.

const SWIPE_THRESHOLD = 16;
const SWIPE_NORMALIZE = 120;
const TAP_MAX_DURATION = 250;
const TAP_MAX_DISTANCE = 10;
const HOLD_DELAY = 250;

export function createInput(target) {
  const handlers = {
    tap: [], swipe: [], holdstart: [], holdmove: [], holdend: [],
    pressstart: [], pressmove: [], pressend: [],
  };

  let pointerActive = false;
  let holdActive = false;
  let startX = 0, startY = 0, startTime = 0;
  let holdTimer = null;

  function on(type, handler) {
    handlers[type].push(handler);
    return () => {
      handlers[type] = handlers[type].filter((h) => h !== handler);
    };
  }

  function emit(type, payload) {
    for (const h of handlers[type]) h(payload);
  }

  function onDown(e) {
    pointerActive = true;
    holdActive = false;
    startX = e.clientX;
    startY = e.clientY;
    startTime = performance.now();
    try { target.setPointerCapture?.(e.pointerId); } catch { /* платформа отказала — не критично */ }
    emit('pressstart', { x: startX, y: startY });

    clearTimeout(holdTimer);
    holdTimer = setTimeout(() => {
      if (!pointerActive) return;
      holdActive = true;
      emit('holdstart', { x: startX, y: startY });
    }, HOLD_DELAY);
  }

  function onMove(e) {
    if (!pointerActive) return;
    emit('pressmove', { x: e.clientX, y: e.clientY });
    if (!holdActive) return;
    emit('holdmove', {
      x: e.clientX,
      y: e.clientY,
      dx: e.clientX - startX,
      dy: e.clientY - startY,
      duration: performance.now() - startTime,
    });
  }

  function onUp(e) {
    if (!pointerActive) return;
    pointerActive = false;
    clearTimeout(holdTimer);
    emit('pressend', { x: e.clientX, y: e.clientY });

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const dist = Math.hypot(dx, dy);
    const duration = performance.now() - startTime;

    if (holdActive) {
      holdActive = false;
      emit('holdend', { x: e.clientX, y: e.clientY, dx, dy, duration });
      return;
    }

    if (dist >= SWIPE_THRESHOLD) {
      emit('swipe', {
        dx,
        dy,
        up: Math.max(-dy, 0) / SWIPE_NORMALIZE,   // 0..1+, только «вверх»
        side: dx / SWIPE_NORMALIZE,               // -1..1+, знак = направление
        distance: dist,
        duration,
      });
      return;
    }

    if (duration <= TAP_MAX_DURATION && dist <= TAP_MAX_DISTANCE) {
      emit('tap', { x: e.clientX, y: e.clientY });
    }
  }

  target.addEventListener('pointerdown', onDown);
  target.addEventListener('pointermove', onMove);
  target.addEventListener('pointerup', onUp);
  target.addEventListener('pointercancel', onUp);

  return { on };
}

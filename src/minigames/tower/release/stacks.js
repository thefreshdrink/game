// Стопки Башни: вынутый брусок перелетает дугой в стопку сбоку. Вынесено
// из release.js (задача 6 бэклога агента) без изменения поведения —
// значения и комментарии перенесены как были.

// Вынутый брусок не падает куда придётся, а перелетает в стопку сбоку
// (правка 29.09): поперечные — в левую стопку, продольные — в правую,
// каждый в своей ориентации. Видно, сколько уже отпустила, и ничего не
// прячется под башней. Стопки стоят ЗА башней по бокам (x = −2 / y = −2):
// перед ней они закрыли бы нижние ряды, за которые и хватаются, а на
// 390 px брусок (128 px) рядом с башней без перекрытия не встаёт.
const FLY_TIME = 0.5;       // сек перелёта в стопку
const FLY_ARC = 1.6;        // высота дуги, в рядах
const STACKS = {
  left: { x: -2, y: 0, dx: 1, dy: 3 },
  right: { x: 0, y: -2, dx: 3, dy: 1 },
};

/** Брусок вышел из кладки — летит дугой на верх своей стопки. */
export function sendToStack(flying, stackH, o) {
  const side = o.dx >= o.dy ? 'right' : 'left';
  const to = { ...STACKS[side], z: stackH[side]++ };
  flying.push({ from: { x: o.x, y: o.y, z: o.z }, to, tone: o.tone, k: 0 });
}

/** Шаг перелёта. Долетевший отдаётся в land(d) — уже лежащим бруском;
 * возвращает тех, кто ещё в воздухе. */
export function stepFlying(flying, dt, land) {
  return flying.filter((f) => {
    f.k = Math.min(1, f.k + dt / FLY_TIME);
    if (f.k < 1) return true;
    land({ ...f.to, tone: f.tone, vx: 0, vy: 0, vz: 0, rest: true });
    return false;
  });
}

export function flyingPos(f) {
  const e = f.k * f.k * (3 - 2 * f.k);
  const L = (a, b) => a + (b - a) * e;
  return {
    x: L(f.from.x, f.to.x),
    y: L(f.from.y, f.to.y),
    z: L(f.from.z, f.to.z) + Math.sin(Math.PI * f.k) * FLY_ARC,
    dx: f.to.dx, dy: f.to.dy, tone: f.tone,
  };
}

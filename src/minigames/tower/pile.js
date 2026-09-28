// Куча обломков Башни: куда ложится упавший брусок. Плотно — место ищем
// по спирали от центра основания и складываем слоями, а не разбрасываем по
// всей земле (правка в чате — «куча плотнее»). Радиус 2 и до 6 слоёв: при
// 16 рядах (48 брусков) куча растёт вверх, а не расползается за кадр.

const RING_MAX = 2;
const LAYER_MAX = 6;

function cellKeys(d) {
  const out = [];
  for (let a = 0; a < Math.round(d.dx); a++) {
    for (let b = 0; b < Math.round(d.dy); b++) {
      out.push(`${Math.round(d.x) + a},${Math.round(d.y) + b},${Math.round(d.z)}`);
    }
  }
  return out;
}

export function createPile() {
  const taken = new Set();
  const freeAt = (d, x, y, z) => cellKeys({ ...d, x, y, z }).every((k) => !taken.has(k));

  return {
    reset() { taken.clear(); },

    /** Кладёт брусок d на ближайшее к центру свободное место с опорой. */
    settle(d) {
      const cx = 1.5;
      const cy = 1.5;
      let best = null;
      for (let z = 0; z <= LAYER_MAX && !best; z++) {
        for (let ring = 0; ring <= RING_MAX && !best; ring++) {
          for (let dx = -ring; dx <= ring && !best; dx++) {
            for (let dy = -ring; dy <= ring && !best; dy++) {
              if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
              const x = Math.round(cx - d.dx / 2) + dx;
              const y = Math.round(cy - d.dy / 2) + dy;
              if (!freeAt(d, x, y, z)) continue;
              // На весу не висим: либо земля, либо есть опора снизу.
              if (z > 0 && freeAt(d, x, y, z - 1)) continue;
              best = { x, y, z };
            }
          }
        }
      }
      const spot = best ?? { x: Math.round(d.x), y: Math.round(d.y), z: 0 };
      d.x = spot.x; d.y = spot.y; d.z = spot.z;
      cellKeys(d).forEach((k) => taken.add(k));
    },
  };
}

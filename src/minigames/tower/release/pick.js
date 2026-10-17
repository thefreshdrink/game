// Ввод Башни: какой брусок под пальцем. Вынесено из release.js (задача 6
// бэклога агента) без изменения поведения.

import { ROWS, facesOf } from '../blocks.js';
import { cellPos } from './masonry.js';

/** Брусок под пальцем — тот, что виден в этой точке: обход в порядке
 * отрисовки (ряды снизу вверх, в ряду по x + y), побеждает последний
 * попавший. Выбор по одной глубине x + y отдавал касание верхней грани
 * бруска рядом ниже — она лежит на экране там же, где передняя грань
 * бруска над ним, — и видимые бруски не вытягивались (правка 30.09). */
export function pickAt(rows, pulling, baseX, baseY, px, py) {
  let found = null;
  for (let r = 0; r < ROWS; r++) {
    const list = [];
    rows[r].slots.forEach((v, i) => { if (v) list.push({ i, o: cellPos(rows, pulling, r, i) }); });
    list.sort((a, b) => (a.o.x + a.o.y) - (b.o.x + b.o.y));
    list.forEach(({ i, o }) => {
      const f = facesOf(baseX, baseY, o);
      if (inPoly(px, py, f.top) || inPoly(px, py, f.front) || inPoly(px, py, f.right)) found = { r, i };
    });
  }
  return found;
}

function inPoly(px, py, pts) {
  let hit = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

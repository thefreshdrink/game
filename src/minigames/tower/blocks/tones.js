// Тона брусков: спрайты трёх тонов камня и золота и раскладка тонов по
// кладке (общий вход — ../blocks.js).

import { ROWS, COLS } from './iso.js';

// Спрайты брусков: три тона камня (светлый / серый / тёмный). Кладка
// набирается ими по фиксированному узору — так она читается как кладка, а
// не рябит случайностью; ровно этим живёт референс, присланный в чате.
// Поперечный ряд — свой спрайт (`<тон>Cross`): свет на референсе идёт слева,
// и у зеркального бруска он перевернулся бы. Нет своего — тот же спрайт
// зеркально: в изометрии 2:1 это поворот на 90°.
//
// Золотые бруски есть в кладке — решение 2026-09-28 (референс из чата):
// в Башне золото — это ценность, которую держит кладка, а не знак «можно
// тронуть». Брусок под пальцем по-прежнему обводится акцентом.
export const TONES = ['light', 'mid', 'dark', 'black', 'gold'];

// Доли тонов — как на референсе из чата (2026-09-28): белых и тёмных
// больше, серых меньше, контраст между соседями сильный.
// Правка 29.09: чёрного меньше, серого больше — чёрный брусок на фоне и на
// плитах пола пропадал. Золото — то же число (5), доля им понравилась.
const TONE_WEIGHTS = { light: 9, mid: 7, dark: 8, black: 3, gold: 3 };

// Семьи тонов для правила соседства: dark и black на глаз один тёмный
// (#4A4A4A/#232323 против #2E2E2E/#1C1C1C), рядом они сливались в пятно.
const FAMILY = { light: 'L', mid: 'M', dark: 'D', black: 'D', gold: 'G' };
const FLOOR_ROWS = 2;   // нижние ряды — без тёмных: плиты пола #232323/#1C1C1C
export const sprites = {};

export function setBlockSprites(imgs) {
  TONES.forEach((t) => {
    sprites[t] = imgs?.[t] ?? null;
    sprites[`${t}Cross`] = imgs?.[`${t}Cross`] ?? null;
  });
}

/** Золото — равномерно по высоте, не на верхнем ряду: ряды через равный
 * шаг, место в ряду по кругу (внешнее, среднее, заднее). */
function goldSpots(rows, cols, count) {
  const spots = new Map();
  const usable = rows - 1;
  const order = [cols - 1, 1, 0];
  for (let k = 0; k < count; k++) {
    const r = Math.floor(((k + 0.5) * usable) / count);
    spots.set(r, order[k % order.length] % cols);
  }
  return spots;
}

/** Раскладка тонов на всю башню, считается один раз: доли TONE_WEIGHTS,
 * золото — по goldSpots. Остальным тон подбирается штрафом: та же семья,
 * что у соседа по ряду или у бруска того же места рядом ниже, тот же тон
 * через ряд (там брусок той же ориентации — выстроились бы столбиком) и
 * тёмная семья у пола. Из равных берётся тон с бо́льшим остатком доли.
 * Порядок кандидатов крутится постоянным шагом — башня одинаковая при
 * каждом заходе. */
function buildToneGrid(rows, cols) {
  const total = rows * cols;
  const sum = Object.values(TONE_WEIGHTS).reduce((a, n) => a + n, 0);
  const left = {};
  TONES.forEach((t) => { left[t] = Math.round((TONE_WEIGHTS[t] / sum) * total); });
  const gold = goldSpots(rows, cols, left.gold);
  const grid = [];
  let step = 0;
  for (let r = 0; r < rows; r++) {
    grid.push([]);
    for (let i = 0; i < cols; i++) {
      if (gold.get(r) === i) { grid[r].push('gold'); continue; }
      const fam = (t) => FAMILY[t];
      const penalty = (t) => 3 * (fam(t) === fam(grid[r][i - 1]))
        + 2 * (fam(t) === fam(grid[r - 1]?.[i]))
        + 2 * (t === grid[r - 2]?.[i])
        + 3 * (r < FLOOR_ROWS && fam(t) === 'D');
      const order = TONES.filter((t) => t !== 'gold').map((_, k, a) => a[(k + step) % a.length]);
      step += 3;
      const pick = order.slice().sort((x, y) => (penalty(x) - penalty(y)) || (left[y] - left[x]))[0];
      left[pick] = Math.max(0, left[pick] - 1);
      grid[r].push(pick);
    }
  }
  return grid;
}

const TONE_GRID = buildToneGrid(ROWS, COLS);

/** Тон бруска по его месту в кладке. */
export function toneOf(r, i) {
  return TONE_GRID[r]?.[i] ?? 'mid';
}

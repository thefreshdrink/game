// Геометрия и отрисовка изометрической башни-дженги. Общее для сцены
// мини-игры (release.js) и экрана предсказания (screens/prediction.js):
// после обвала на предсказании лежит ТА ЖЕ куча, в тех же координатах —
// иначе на склейке 5→6 композиция прыгает.
//
// Ракурс изометрический, а не сбоку, как у Шута — решение в чате: в лоб
// кладка крест-накрест читается кирпичной стеной, дженга узнаётся только
// под углом.
//
// Всё в единицах бруска: короткая сторона 1, длинная 3, высота ряда 1.
// Экранные шаги чётные (CLAUDE.md: 1 арт-пиксель = 2 экранных).
//
// Файл — общий вход; части лежат рядом, в blocks/ (разделено 2026-10-17,
// без изменения поведения): iso.js — сетка, палитра, проекция и грани;
// tones.js — спрайты и раскладка тонов; block.js — отрисовка бруска;
// top.js — крепость, корона, искры; ground.js — пол и тень; rubble.js —
// куча обломков и её снимок для предсказания.

export { U, HU, ZH, ROWS, COLS, project, cellsOf, facesOf, blockRect } from './blocks/iso.js';
export { TONES, setBlockSprites, toneOf } from './blocks/tones.js';
export { drawBlock } from './blocks/block.js';
export {
  SPARKLE_REACH, drawSparkles, setTowerTop, crownLift, towerReach, drawCastle, drawCrown,
} from './blocks/top.js';
export { drawGround } from './blocks/ground.js';
export { drawRubble, rubbleSnapshot, saveRubble, clearRubble } from './blocks/rubble.js';

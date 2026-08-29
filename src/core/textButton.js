// Текстовая кнопка проекта — это только текст (двойной линии/скобы/пунктира
// тут нет, кнопка — сам лейбл), но у неё должна быть человеческая хит-зона:
// шире надписи с запасом и не тоньше пальца. Раньше формула была
// скопирована в question.js / reveal.js / prediction.js тремя чуть разными
// вариантами (±10, ±12, высота «< 22» от базовой линии) — BUILD-SPEC-03
// задача 9 сводит их в одну.
//
// Зона считается для текста, нарисованного с `textAlign = 'left'` от
// (x, baselineY). Ширину надписи меряет вызывающий код
// (`ctx.measureText(label).width`) — здесь шрифт не трогаем.

const PAD_X = 12;                 // запас слева и справа от ширины текста, px
const MIN_HEIGHT = 44;            // не тоньше комфортного тапа (iOS HIG), px
const CENTER_ABOVE_BASELINE = 8;  // центр зоны на (базовая линия − 8px)

/**
 * @param {number} x          левый край текста (px стейджа)
 * @param {number} baselineY  базовая линия текста (px стейджа)
 * @param {number} textW      измеренная ширина надписи
 * @param {number} lineHeight line-height роли (из setFont) — нижняя граница высоты
 * @returns прямоугольник зоны {x0, y0, x1, y1} + сама baselineY
 */
export function textButtonZone(x, baselineY, textW, lineHeight = 0) {
  const height = Math.max(MIN_HEIGHT, lineHeight);
  const cy = baselineY - CENTER_ABOVE_BASELINE;
  return {
    x0: Math.round(x - PAD_X),
    x1: Math.round(x + textW + PAD_X),
    y0: Math.round(cy - height / 2),
    y1: Math.round(cy + height / 2),
    baselineY,
  };
}

/** Точка (px, py) внутри зоны? */
export function zoneHit(zone, px, py) {
  return !!zone
    && px >= zone.x0 && px <= zone.x1
    && py >= zone.y0 && py <= zone.y1;
}

// Общая типографика экранов. Alagard — заголовки и имена карт, Pixelify
// Sans — текст и метки (docs/design-system.md, §3). Кегли заданы для
// референсного холста 430 экранных px (docs/interfaces/*.png) и
// приводятся к реальной ширине окна через uiScale.

const REFERENCE_WIDTH = 430;

export function uiScale(width) {
  return Math.min(Math.max(width / REFERENCE_WIDTH, 0.75), 1.15);
}

// Заголовки экранов переведены на Kingdom (решение в чате): он покрывает
// все пять языков продукта, Alagard — только латиницу. Лицо карты пока
// осталось на Alagard, там замена ещё не решена.
const FONT_TITLE = 'Kingdom, serif';
const FONT_DISPLAY = 'Alagard, serif';
const FONT_BODY = '"Pixelify Sans", monospace';

const ROLES = {
  // letterSpacing 0 — выбрано на прототипе, разрядку не добавляем.
  title:      { family: FONT_TITLE, size: 46, lineHeight: 46, letterSpacing: 0 },
  // Номер и имя на раскрытой карте — по Figma: Alagard Medium 30,
  // letter-spacing −4% (правка в чате). У нас только один статичный файл
  // Alagard (index.html, без отдельного начертания Medium) — вес всё
  // равно выставляем для точности, браузер отрисует единственным
  // доступным начертанием, если синтеза нет.
  cardNumeral: { family: FONT_DISPLAY, size: 30, lineHeight: 34, weight: 500, letterSpacing: -0.04 },
  // Имя мельче номера (26 против фигмовских 30) — правка в чате: на длинных
  // именах строка вставала в бирку впритык. Номер остался на 30: его бирка
  // вдвое уже, но и строка в ней максимум три знака.
  cardName:   { family: FONT_DISPLAY, size: 26, lineHeight: 30, weight: 500, letterSpacing: -0.04 },
  body:       { family: FONT_BODY,    size: 16, lineHeight: 26 },
  caption:    { family: FONT_BODY,    size: 12, lineHeight: 18 },
  // Пункты меню категорий — отдельная роль от body: крупнее (22 —
  // значение из Figma), правка в чате. Была semibold, вернули обратно
  // на regular (тоже правка в чате). Трогает только меню, не остальной
  // body-текст на других экранах.
  menuOption: { family: FONT_BODY, size: 22, lineHeight: 30 },
};

/** Ставит ctx.font для роли на данном масштабе, возвращает line-height в px. */
export function setFont(ctx, role, scale) {
  const t = ROLES[role];
  const weight = t.weight ?? 400;
  const px = Math.round(t.size * scale);
  ctx.font = `${weight} ${px}px ${t.family}`;
  ctx.letterSpacing = t.letterSpacing ? `${(px * t.letterSpacing).toFixed(2)}px` : '0px';
  return Math.round(t.lineHeight * scale);
}

/**
 * Ставит ctx.font для роли, ужимая кегль, пока строка не влезет в maxWidth.
 * Начинает с кегля роли и спускается по целому пикселю — дробные кегли на
 * пиксельном шрифте дают разную толщину штриха у соседних букв.
 *
 * Нужен там, где ширина контейнера задана картинкой и не тянется: имя карты
 * лежит в бирке рамки, и длинное имя («Wheel of Fortune») уезжало под рамку
 * с обеих сторон. Отступ внутри контейнера считает вызывающий — сюда
 * приходит уже чистая ширина под текст.
 *
 * Возвращает line-height, пересчитанный в той же пропорции, что и кегль.
 */
export function setFontFitted(ctx, role, scale, text, maxWidth, minSize = 12) {
  const t = ROLES[role];
  const weight = t.weight ?? 400;
  const floor = Math.max(1, Math.round(minSize * scale));
  let px = Math.max(Math.round(t.size * scale), floor);
  for (;;) {
    // letterSpacing влияет на measureText, поэтому ставится до замера
    ctx.font = `${weight} ${px}px ${t.family}`;
    ctx.letterSpacing = t.letterSpacing ? `${(px * t.letterSpacing).toFixed(2)}px` : '0px';
    if (px <= floor || ctx.measureText(text).width <= maxWidth) break;
    px -= 1;
  }
  return Math.round(t.lineHeight * (px / t.size));
}

/**
 * Разбивает строку на строки по ширине maxWidth (жадный word-wrap).
 * ctx.font должен быть уже выставлен (setFont) — дисплейные шрифты не
 * моноширинные, на глаз переносы не угадываются, только через measureText.
 */
export function wrapLines(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

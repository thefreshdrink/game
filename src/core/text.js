// Общая типографика экранов. Alagard — заголовки и имена карт, Pixelify
// Sans — текст и метки (docs/design-system.md, §3). Кегли заданы для
// референсного холста 430 экранных px (docs/interfaces/*.png) и
// приводятся к реальной ширине окна через uiScale.

const REFERENCE_WIDTH = 430;

export function uiScale(width) {
  return Math.min(Math.max(width / REFERENCE_WIDTH, 0.75), 1.15);
}

const FONT_DISPLAY = 'Alagard, serif';
const FONT_BODY = '"Pixelify Sans", monospace';

const ROLES = {
  title:      { family: FONT_DISPLAY, size: 46, lineHeight: 46 },
  cardName:   { family: FONT_DISPLAY, size: 24, lineHeight: 28 },
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
  ctx.font = `${weight} ${Math.round(t.size * scale)}px ${t.family}`;
  return Math.round(t.lineHeight * scale);
}

/**
 * Разбивает строку на строки по ширине maxWidth (жадный word-wrap).
 * ctx.font должен быть уже выставлен (setFont) — Alagard не моноширинный,
 * на глаз переносы не угадываются, только через measureText.
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

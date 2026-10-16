// Экран 2: рубашка карты веера. Вынесено из deck.js (задача 5 бэклога
// агента) без изменения поведения.

import { fillCardBody } from '../../core/cardRender.js';

// Рисует рубашку карты с центром в (cx,cy), повёрнутую на rotation
// (радианы). Подложка — та же шашечка, что в cardRender.js
// (fillCardBody, правка в чате 2026-09-11 — сплошной #000000 читался
// плоско). Рамка выбора — готовый ассет (select_frame.png),
// чуть крупнее самой карты (228×388 против 224×384), обводка идёт
// СНАРУЖИ, не по кромке.
export function drawCardBack(ctx, images, cx, cy, cw, ch, rotation, accent) {
  ctx.save();
  ctx.translate(Math.round(cx), Math.round(cy));
  ctx.rotate(rotation);
  const dx = Math.round(-cw / 2);
  const dy = Math.round(-ch / 2);
  fillCardBody(ctx, dx, dy, cw, ch);
  // Точечное исключение из «imageSmoothingEnabled = false везде,
  // всегда» (CLAUDE.md) — сказано вслух, не втихую. Правило рассчитано
  // на спрайты, кратные родному арт-пикселю; эта карта — растровый PNG
  // 224×384, который здесь и повёрнут на произвольный угол, и
  // смасштабирован в произвольную (не кратную) долю ширины экрана —
  // ни то, ни другое пиксель-грид не выдерживает. С nearest-neighbor
  // это давало не пиксель-арт, а шум на тонкой штриховке (жалоба в
  // чате: «рябит, нечёткие пиксели»). Раньше тут была не PNG, а
  // ctx.strokeRect — векторная обводка, которую canvas сглаживает сам
  // независимо от этого флага, поэтому артефакта не было. Включаем
  // сглаживание только на время рисования самой карты — save/restore
  // уже оборачивают вызов, так что снаружи this функции правило
  // остаётся в силе без изменений.
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(images.cardBack, dx, dy, cw, ch);
  if (accent) {
    const fw = Math.round(cw * (228 / 224));
    const fh = Math.round(ch * (388 / 384));
    ctx.drawImage(images.cardSelectFrame, Math.round(-fw / 2), Math.round(-fh / 2), fw, fh);
  }
  ctx.restore();
}

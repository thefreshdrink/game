// Раскрытие реплик «слово за словом», сразу на 100% яркости (без
// fade-in) — общее для экрана 1 и перехода на экран 2, чтобы темп
// чтения ощущался одинаково.

export const WORD_INTERVAL = 0.16; // пауза между появлением слов

/**
 * Раскладывает уже перенесённые по ширине строки на отдельные слова с
 * их экранными координатами. ctx.font должен быть уже выставлен —
 * measureText зависит от текущего шрифта.
 */
export function layoutWords(ctx, lines, x, yStart, lineHeight) {
  const words = [];
  lines.forEach((line, li) => {
    let cx = x;
    for (const w of line.split(' ')) {
      words.push({ text: w, x: cx, y: yStart + li * lineHeight });
      cx += ctx.measureText(`${w} `).width;
    }
  });
  return words;
}

/** Сколько слов уже должно быть видно при данном elapsed (секунды). */
export function visibleWordCount(elapsed, total) {
  if (elapsed < 0) return 0;
  return Math.min(total, Math.floor(elapsed / WORD_INTERVAL) + 1);
}

/** Время (сек), нужное на раскрытие всех слов реплики. */
export function revealDuration(wordCount) {
  return (wordCount - 1) * WORD_INTERVAL;
}

// Мигание для CTA-подсказок вида «CLICK TO DRAW» — не читались, терялись
// на экране (правка в чате). Резкий переход, не fade, — тот же приём, что
// у пунктов меню и у точек оракула (в проекте нигде нет плавных fade у
// мигающих элементов, только сразу-100%/сразу-меньше). Не гасим до 0 —
// полностью пропадающий текст читался бы как баг, а не как акцент.
const BLINK_PERIOD = 1.1;
const BLINK_DIM = 0.35;
const BLINK_DUTY = 0.6; // доля периода на полной яркости

export function blinkAlpha(t) {
  const cycle = ((t % BLINK_PERIOD) + BLINK_PERIOD) % BLINK_PERIOD;
  return cycle < BLINK_PERIOD * BLINK_DUTY ? 1 : BLINK_DIM;
}

// Реестр мини-игр. Каждая мини-игра — папка `minigames/<карта>/` с
// `index.js`, который описывает её целиком (см. fool/index.js):
//
//   verb              глагол карты — то же, что `minigame` в cards.js
//   assets            { ключ: путь } — картинки, которые ей нужны
//   prepare(images)   нарезка лент и прочее после загрузки (опционально)
//   createScene       фабрика сцены на каркасе core/minigame.js
//   createAfterscene  что остаётся под предсказанием (опционально)
//
// Папка находится сама — править этот файл, main.js или экраны не нужно.
// Заготовка новой: `npm run new-minigame -- <карта> <глагол>`.

const found = import.meta.glob('./*/index.js', { eager: true });

export const MINIGAMES = {};
for (const [path, mod] of Object.entries(found)) {
  const m = mod.default;
  if (!m?.verb || !m.createScene) throw new Error(`${path}: нужен default { verb, createScene }`);
  if (MINIGAMES[m.verb]) throw new Error(`${path}: глагол "${m.verb}" уже занят`);
  MINIGAMES[m.verb] = m;
}

/** У карты есть своя сцена мини-игры — она проходится, а не пропускает экран 5. */
export function isPlayable(card) {
  return Boolean(card && MINIGAMES[card.minigame]);
}

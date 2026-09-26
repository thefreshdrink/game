// Реестр мини-игр: глагол карты (`card.minigame` в cards.js) → фабрика
// сцены. Новая карта — файл сцены на каркасе `core/minigame.js` и одна
// строка здесь; main.js регистрирует всё отсюда сам.

import { createLeapScreen } from './fool/leap.js';
import { createReleaseScene } from './tower/release.js';

export const MINIGAMES = {
  leap: createLeapScreen,
  release: createReleaseScene,
};

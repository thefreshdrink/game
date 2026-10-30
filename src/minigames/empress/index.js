// The Empress — мини-игра «Bloom». Паспорт для реестра (minigames/index.js).

import { createBloomScene } from './bloom.js';

export default {
  verb: 'bloom',

  // Макет flow_iso7 (25.10). Клетки земли и рамка — кодом по сетке 2:1
  // (tools/empress-plots.py, empress-ring.py); ростки, растения, рощица, зонтик, корзинка —
  // Pro Flash с палитрой серых; Императрица — портрет с карты (лежит ×4,
  // в сцене рисуется ×2, как Шут). Исходники — incoming/empress/td/.
  assets: {
    empressPlotsDry: 'assets/empress/plots_dry.png',
    empressPlotsWet: 'assets/empress/plots_wet.png',
    empressPlotsRing: 'assets/empress/plots_ring.png',
    empressStage1: 'assets/empress/stage_1.png',
    empressStage3: 'assets/empress/stage_3.png',
    empressStage4: 'assets/empress/stage_4.png',
    empressCrop1: 'assets/empress/crop_1.png',
    empressCrop2: 'assets/empress/crop_2.png',
    empressCrop3: 'assets/empress/crop_3.png',
    empressCrop4: 'assets/empress/crop_4.png',
    empressCrop5: 'assets/empress/crop_5.png',
    empressGrove: 'assets/empress/grove.png',
    empressParasol: 'assets/empress/parasol.png',
    empressBasket: 'assets/empress/basket.png',
    empressFigure: 'assets/card/empress_on_the_card.png',
  },

  createScene: createBloomScene,
};

// The Empress — мини-игра «Bloom». Паспорт для реестра (minigames/index.js).

import { createBloomScene } from './bloom.js';

export default {
  verb: 'bloom',

  // Черновой арт 25.10: Pro Flash с палитрой серых (кусты, плоды, корзина,
  // луна, грядка, растения), золотой плод — с золотом и его тенью; капли —
  // оттуда же; фон — tools/backdrop-hills.py. Исходники — incoming/empress/.
  assets: {
    empressBackdrop: 'assets/empress/backdrop.png',
    empressBed: 'assets/empress/bed.png',
    empressBush1: 'assets/empress/bush_1.png',
    empressBush2: 'assets/empress/bush_2.png',
    empressFruitPlain: 'assets/empress/fruit_plain.png',
    empressFruitWet: 'assets/empress/fruit_wet.png',
    empressFruitMoon: 'assets/empress/fruit_moon.png',
    empressFruitGold: 'assets/empress/fruit_gold.png',
    empressBasket: 'assets/empress/basket.png',
    empressMoon: 'assets/empress/moon.png',
    empressTulip: 'assets/empress/tulip.png',
    empressWheat: 'assets/empress/wheat.png',
    empressPomegranate: 'assets/empress/pomegranate.png',
    empressDrop1: 'assets/empress/drop_1.png',
    empressDrop2: 'assets/empress/drop_2.png',
    empressDrop3: 'assets/empress/drop_3.png',
    empressDrop4: 'assets/empress/drop_4.png',
  },

  prepare(images) {
    // Под фоном — тон его нижнего ряда, чтобы поле не обрывалось.
    const bd = images.empressBackdrop;
    const c = document.createElement('canvas');
    c.width = 1; c.height = 1;
    const g = c.getContext('2d');
    g.drawImage(bd, Math.floor(bd.width / 2), bd.height - 1, 1, 1, 0, 0, 1, 1);
    const [r, gg, b] = g.getImageData(0, 0, 1, 1).data;
    images.empressBackdropBottom = `rgb(${r}, ${gg}, ${b})`;
  },

  createScene: createBloomScene,
};

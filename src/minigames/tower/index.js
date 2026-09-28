// The Tower — мини-игра «Release». Паспорт для реестра (minigames/index.js).

import { createReleaseScene } from './release.js';
import { createReleaseAfterscene } from './afterscene.js';
import { setBlockSprites, setTowerTop, TONES } from './blocks.js';

export default {
  verb: 'release',

  // Кладка по референсу: четыре тона × (вдоль, поперёк) — рисует скрипт,
  // без генерации: python3 tools/iso-block.py --ref-set public/assets/tower
  assets: {
    ...Object.fromEntries(TONES.flatMap((t) => [
      [`towerBlock_${t}`, `assets/tower/block_${t}.png`],
      [`towerBlock_${t}_cross`, `assets/tower/block_${t}_cross.png`],
    ])),
    // Крепость и корона на крыше — pixflux, приведённые к палитре (2026-09-28).
    towerCastle: 'assets/tower/castle.png',
    towerCrown: 'assets/tower/crown.png',
  },

  prepare(images) {
    setBlockSprites(Object.fromEntries(TONES.flatMap((t) => [
      [t, images[`towerBlock_${t}`]],
      [`${t}Cross`, images[`towerBlock_${t}_cross`]],
    ])));
    setTowerTop({ castle: images.towerCastle, crown: images.towerCrown });
  },

  createScene: createReleaseScene,
  createAfterscene: createReleaseAfterscene,
};

// The Tower — мини-игра «Release». Паспорт для реестра (minigames/index.js).

import { createReleaseScene } from './release.js';
import { createReleaseAfterscene } from './afterscene.js';
import { setBlockSprites } from './blocks.js';

export default {
  verb: 'release',

  // Три тона бруска — из block.png скриптом (docs/pixel-assets-howto.md §4.1, --flat).
  assets: {
    towerBlockLight: 'assets/tower/block_light.png',
    towerBlockMid: 'assets/tower/block_mid.png',
    towerBlockDark: 'assets/tower/block_dark.png',
  },

  prepare(images) {
    setBlockSprites({
      light: images.towerBlockLight,
      mid: images.towerBlockMid,
      dark: images.towerBlockDark,
    });
  },

  createScene: createReleaseScene,
  createAfterscene: createReleaseAfterscene,
};

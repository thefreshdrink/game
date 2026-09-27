// The Fool — мини-игра «Leap». Паспорт для реестра (minigames/index.js):
// глагол карты, свои ассеты, подготовка спрайтов, сцена и то, что остаётся
// под предсказанием.

import { sliceStrip } from '../../core/sprites.js';
import { createLeapScreen } from './leap.js';
import { createLeapAfterscene } from './afterscene.js';

export default {
  verb: 'leap',

  assets: {
    foolIdleStrip: 'assets/fool/strips/fool_idle_4f_44x48.png',
    foolRise: 'assets/fool/strips/fool_rise_1f_44x48.png',
    foolFall: 'assets/fool/strips/fool_fall_1f_44x48.png',
    foolDogFall: 'assets/fool/strips/fool_dog_fall_1f_48x48.png',
    roadTiles: 'assets/road/plat_tiles.png',
    dogWalkStrip: 'assets/dog/strips/dog_walk_3f_18x14.png',
    dogSitStrip: 'assets/dog/strips/dog_sit_2f_18x14.png',
    dogLookDown: 'assets/dog/strips/dog_look_down_1f_18x14.png',
    dogJump: 'assets/dog/strips/dog_jump_1f_18x14.png',
  },

  prepare(images) {
    images.dogWalkFrames = sliceStrip(images.dogWalkStrip, 18, 14);
    images.dogSitFrames = sliceStrip(images.dogSitStrip, 18, 14);
    images.foolIdleFrames = sliceStrip(images.foolIdleStrip, 44, 48);
  },

  createScene: createLeapScreen,
  createAfterscene: createLeapAfterscene,
};

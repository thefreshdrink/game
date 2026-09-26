// Каркас мини-игры (BUILD-SPEC-07 задача 1): жизненный цикл, общий для
// всех карт. Сцена карты описывает только своё — сброс, ввод, шаг, кадр, —
// а подписку на ввод, отписку и выход на экран предсказания берёт отсюда.
//
//   export function createXScene({ input, images, goto }) {
//     return defineMinigame({ input, goto }, {
//       enter() { … },                        // сброс состояния
//       input: { tap(e) { … }, swipe(e) { … } },
//       update(dt, w, h, finish) { … finish(); },
//       draw(ctx, w, h) { … },
//     });
//   }
//
// Сцена регистрируется одной строкой в `minigames/index.js` под глаголом
// карты (`card.minigame`), и reveal.js уводит в неё сам.

/** Экран, на который уходит любая мини-игра, когда её такт закончен. */
export const MINIGAME_EXIT = 'prediction';

export function defineMinigame({ input, goto }, spec) {
  let off = [];
  const finish = () => goto(MINIGAME_EXIT);

  return {
    enter(prevName) {
      spec.enter?.(prevName);
      // Подписка ПОСЛЕ сброса: обработчик не должен увидеть старое состояние.
      off = Object.entries(spec.input ?? {}).map(([type, h]) => input.on(type, h));
    },

    exit() {
      off.forEach((unsubscribe) => unsubscribe?.());
      off = [];
      spec.exit?.();
    },

    update(dt, w, h) {
      spec.update?.(dt, w, h, finish);
    },

    draw(ctx, w, h) {
      spec.draw(ctx, w, h);
    },
  };
}

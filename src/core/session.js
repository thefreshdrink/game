// Состояние одного прохождения ритуала: категория с экрана 1 и вытянутая
// карта с экрана 2. Обоим нужно дожить только до экрана 6 (BUILD-SPEC).

export const session = {
  category: null,
  cardId: null,
};

export function resetSession() {
  session.category = null;
  session.cardId = null;
}

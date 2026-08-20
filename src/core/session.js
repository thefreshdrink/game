// Состояние одного прохождения ритуала: категория с экрана 1 и вытянутая
// карта с экрана 2. Обоим нужно дожить только до экрана 6 (BUILD-SPEC).
//
// seenIntro — флаг короткого входа на возврате (BUILD-SPEC-02, задача 2):
// живёт в памяти на всю СЕССИЮ (не в localStorage — хранилища прогресса
// в продукте нет, решение 2026-08-20), поэтому resetSession() его НЕ
// трогает — иначе каждый круг снова играл бы полное интро. Перезагрузка
// страницы = новый модуль = снова false, это ожидаемо.

export const session = {
  category: null,
  cardId: null,
  seenIntro: false,
};

export function resetSession() {
  session.category = null;
  session.cardId = null;
}

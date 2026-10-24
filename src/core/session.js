// Состояние одного прохождения ритуала: категория с экрана 1 и вытянутая
// карта с экрана 2. Обоим нужно дожить только до экрана 6 (BUILD-SPEC).
//
// seenIntro — флаг короткого входа на возврате (BUILD-SPEC-02, задача 2):
// живёт в памяти на всю СЕССИЮ (не в localStorage — хранилища прогресса
// в продукте нет, решение 2026-08-20), поэтому resetSession() его НЕ
// трогает — иначе каждый круг снова играл бы полное интро. Перезагрузка
// страницы = новый модуль = снова false, это ожидаемо.

// Исключение: перезапуск после смены языка (strings.js, cycleLang) — игрок
// уже на экране 1, полное интро ему ни к чему.
function switchedLang() {
  try {
    const v = sessionStorage.getItem('tj.langSwitched');
    sessionStorage.removeItem('tj.langSwitched');
    return v === '1';
  } catch { return false; }
}

export const session = {
  category: null,
  cardId: null,
  seenIntro: switchedLang(),
};

export function resetSession() {
  session.category = null;
  session.cardId = null;
}

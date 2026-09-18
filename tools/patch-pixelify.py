#!/usr/bin/env python3
"""
@summary Чинит три отсутствующие заглавные в Pixelify Sans и кладёт шрифт
         самохостом в public/assets. Закрывает пункт 3 задачи 5 BUILD-SPEC-07
         (единственный рантайм-запрос в сеть) и разблокирует кириллицу.
@route   python3 tools/patch-pixelify.py [--selftest]
@verdict Пишет public/assets/pixelify-sans.ttf; ненулевой код возврата, если
         после патча хоть один символ пяти языков не находится в шрифте.
@example python3 tools/patch-pixelify.py --selftest

В Pixelify Sans 574 глифа и полная строчная кириллица, но три ЗАГЛАВНЫЕ не
имеют кодпоинта: О (U+041E), П (U+041F) и украинская І (U+0406). Контуры для
них в файле есть — это латинские O и I и греческая Pi, совпадающие по форме
знак в знак. Пропущены только записи в cmap. Поэтому правка не рисует ничего:
она доставляет три ссылки на уже существующие глифы, и потому одинаково верна
на всех начертаниях вариативной оси wght.
"""
import sys, subprocess, pathlib

UPSTREAM = ("https://raw.githubusercontent.com/google/fonts/main/ofl/"
            "pixelifysans/PixelifySans%5Bwght%5D.ttf")

# кодпоинт без глифа -> имя глифа той же формы, уже лежащего в файле
ALIASES = {0x041E: "O", 0x041F: "Pi", 0x0406: "I"}

# строки пяти языков продукта: чем проверяем, что шрифт больше не рвётся
ALPHABETS = {
    "ru": "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюя",
    "uk": "АБВГДЕЄЖЗИІЇЙКЛМНОПРСТУФХЦЧШЩЬЮЯҐабвгдеєжзиіїйклмнопрстуфхцчшщьюяґ",
    "es": "ÁÉÍÓÚÜÑ¿¡áéíóúüñ",
    "pt": "ÁÂÃÀÇÉÊÍÓÔÕÚáâãàçéêíóôõú",
    "en": "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
}

ROOT = pathlib.Path(__file__).resolve().parent.parent
CACHE = ROOT / "tools" / ".pixelify-upstream.ttf"
OUT = ROOT / "public" / "assets" / "pixelify-sans.ttf"


def _coverage(font):
    """@returns множество кодпоинтов, доступных в шрифте"""
    cp = set()
    for t in font["cmap"].tables:
        cp |= set(t.cmap.keys())
    return cp


def _download():
    """@returns bytes исходного шрифта, с диска если уже скачан

    Качаем через curl, а не из Python: интерпретатор с python.org идёт без
    корневых сертификатов и рвёт https на проверке цепочки, а curl берёт
    доверенные корни из связки ключей macOS.
    """
    if CACHE.exists():
        return CACHE.read_bytes()
    subprocess.run(["curl", "-fsSL", "-o", str(CACHE), UPSTREAM], check=True)
    return CACHE.read_bytes()


def _report(font, label):
    """@param font TTFont @param label строка для вывода @returns список дыр"""
    cp = _coverage(font)
    holes = []
    for lang, chars in ALPHABETS.items():
        miss = "".join(c for c in chars if ord(c) not in cp)
        print(f"  {label} {lang}: {'полно' if not miss else 'НЕТ ' + miss}")
        if miss:
            holes.append((lang, miss))
    return holes


def main():
    from fontTools.ttLib import TTFont
    import io

    src = TTFont(io.BytesIO(_download()))
    print("до патча:")
    _report(src, "")

    order = set(src.getGlyphOrder())
    for cp, glyph in ALIASES.items():
        assert glyph in order, (
            f"глифа {glyph!r} нет в файле — шрифт вышел новой версией и форму "
            f"для U+{cp:04X} больше нельзя одолжить; сверь имена глифов заново"
        )
        for table in src["cmap"].tables:
            table.cmap[cp] = glyph

    print("после патча:")
    holes = _report(src, "")
    if holes:
        print("\nшрифт всё ещё рвётся: " +
              "; ".join(f"{l} не хватает {m}" for l, m in holes))
        return 1

    OUT.parent.mkdir(parents=True, exist_ok=True)
    src.save(OUT)
    print(f"\nзаписан {OUT.relative_to(ROOT)} — {OUT.stat().st_size // 1024} КБ")
    return 0


if __name__ == "__main__":
    sys.exit(main())

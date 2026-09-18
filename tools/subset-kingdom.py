#!/usr/bin/env python3
"""
@summary Режет Kingdom до знаков, которые игра реально рисует, и кладёт
         сабсет в public/assets. Полный файл в репозиторий не попадает
         никогда: репозиторий публичный, а лицензия запрещает отдавать
         шрифт извлекаемым отдельно от игры.
@route   python3 tools/subset-kingdom.py [--check]
@verdict Пишет public/assets/kingdom.ttf; ненулевой код возврата, если
         исходник не найден или в сабсете не хватает заявленных знаков.
@example python3 tools/subset-kingdom.py

Исходный файл живёт ВНЕ репозитория — там, куда его поставила покупка
(~/Library/Fonts). Это не неудобство, а условие: в git уезжает только
фрагмент. Когда появится слой строк для локализации, CHARSET расширяется
кириллицей, и скрипт гоняется заново.
"""
import sys, pathlib, subprocess

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "assets" / "kingdom.ttf"
SOURCES = [
    pathlib.Path.home() / "Library/Fonts/Kingdom_v1.4.ttf",
    pathlib.Path.home() / "Downloads/Kingdom v1.4 Pixel Font/Kingdom_v1.4.ttf",
]

# Что игра рисует дисплейным шрифтом сегодня: заголовки экранов на английском.
# Цифры и римские номера — для номера аркана. Многоточие и средняя точка —
# из копирайта экранов 2 и 3.
CHARSET = (
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    "abcdefghijklmnopqrstuvwxyz"
    "0123456789"
    " .,!?:;'\"()[]-–—…·&"
)


def _source():
    """@returns путь к купленному шрифту @raises SystemExit если его нет"""
    for p in SOURCES:
        if p.exists():
            return p
    print("Не найден исходный Kingdom. Ожидался один из:")
    for p in SOURCES:
        print("   ", p)
    print("\nЭто нормально на машине, где шрифт не покупали: сабсет в репозитории\n"
          "уже лежит, пересобирать его нужно только при смене набора знаков.")
    raise SystemExit(1)


def main():
    from fontTools.ttLib import TTFont

    src = _source()
    chars = sorted(set(CHARSET))
    txt = ROOT / "tools" / ".kingdom-charset.txt"
    txt.write_text("".join(chars))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run([
        sys.executable, "-m", "fontTools.subset", str(src),
        f"--text-file={txt}", "--layout-features=*", f"--output-file={OUT}",
    ], check=True)

    got = set()
    for t in TTFont(OUT)["cmap"].tables:
        got |= set(t.cmap.keys())
    missing = [c for c in chars if ord(c) not in got and c != " "]
    if missing:
        print("в сабсете не хватает знаков:", "".join(missing))
        return 1

    full = src.stat().st_size
    cut = OUT.stat().st_size
    print(f"источник {full // 1024} КБ, {len(TTFont(src).getGlyphOrder())} глифов")
    print(f"сабсет   {cut // 1024} КБ, {len(got)} знаков — {cut * 100 // full}% от исходника")
    print(f"записан {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

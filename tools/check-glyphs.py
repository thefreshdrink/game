#!/usr/bin/env python3
"""
@summary Каждая буква текстов игры есть в шрифте, которым её рисуют.
@route   npm run check-glyphs  |  python3 tools/check-glyphs.py
@verdict Печатает итог по шрифтам; ненулевой код возврата, если хоть одной
         буквы нет в шрифте.
@example python3 tools/check-glyphs.py

Зачем: в игру уходит сабсет Kingdom (tools/subset-kingdom.py), и буквы,
которой нет в сабсете, браузер молча подставит из запасного шрифта —
в пиксельном заголовке встанет чужая гладкая буква. С переводами (пять
языков) это первое, что сломается. Здесь то же ловится при сборке.

Что каким шрифтом проверяется (core/text.js):
- строки интерфейса (src/data/strings.js, все языки), имя карты и её
  реплика `arrival` — и в Kingdom, и в Pixelify Sans: одна и та же
  строка бывает и заголовком, и подписью, а оба шрифта по канону
  покрывают все пять языков;
- `intro` и тексты предсказаний `reading` — в Pixelify Sans;
- номер карты `numeral` — в Alagard.
Глифы, которые экраны рисуют прямо в коде (`›`, `?` Башни), не
проверяются — их нет в данных.
"""
import json, pathlib, subprocess, sys

from fontTools.ttLib import TTFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
ASSETS = ROOT / "public" / "assets"
FONTS = {
    "Kingdom": ASSETS / "kingdom.ttf",
    "Pixelify Sans": ASSETS / "pixelify-sans.ttf",
    "Alagard": ASSETS / "alagard.ttf",
}

# Данные берутся из самих модулей, а не разбором текста: как их видит игра.
DUMP = """
const s = await import(process.argv[1]);
const c = await import(process.argv[2]);
const strings = [];
for (const [lang, d] of Object.entries(s.DICTS))
  for (const [k, v] of Object.entries(d))
    for (const line of [].concat(v)) strings.push([`strings ${lang}: ${k}`, line]);
const cards = Object.values(c.CARDS).map((k) => ({
  id: k.id, numeral: k.numeral ?? '', name: k.name ?? '', arrival: k.arrival ?? '',
  intro: k.intro ?? '', reading: k.reading ?? {},
}));
console.log(JSON.stringify({ strings, cards }));
"""


def load_texts():
    """@returns список (где, текст, [шрифты])"""
    out = subprocess.run(
        ["node", "--input-type=module", "-e", DUMP,
         (ROOT / "src/data/strings.js").as_uri(), (ROOT / "src/data/cards.js").as_uri()],
        check=True, capture_output=True, text=True,
    ).stdout
    data = json.loads(out)
    both = ["Kingdom", "Pixelify Sans"]
    texts = [(where, line, both) for where, line in data["strings"]]
    for k in data["cards"]:
        texts.append((f"cards {k['id']}: name", k["name"], both))
        texts.append((f"cards {k['id']}: arrival", k["arrival"], both))
        texts.append((f"cards {k['id']}: intro", k["intro"], ["Pixelify Sans"]))
        for cat, line in k["reading"].items():
            texts.append((f"cards {k['id']}: reading.{cat}", line, ["Pixelify Sans"]))
        texts.append((f"cards {k['id']}: numeral", k["numeral"], ["Alagard"]))
    return texts


def main():
    cmaps = {name: set(TTFont(path).getBestCmap()) for name, path in FONTS.items()}
    checked = {name: 0 for name in FONTS}
    bad = []
    for where, text, fonts in load_texts():
        chars = sorted({ch for ch in text if not ch.isspace()})
        for font in fonts:
            checked[font] += len(chars)
            missing = [ch for ch in chars if ord(ch) not in cmaps[font]]
            if missing:
                shown = " ".join(f"«{ch}» U+{ord(ch):04X}" for ch in missing)
                bad.append(f"{where}: нет в {font} — {shown}")
    for line in bad:
        print(f"check-glyphs: {line}", file=sys.stderr)
    summary = ", ".join(f"{name} {n}" for name, n in checked.items())
    print(f"check-glyphs: проверено букв по шрифтам — {summary}; без глифа {len(bad)}")
    if bad:
        print("check-glyphs: новые буквы Kingdom — только через tools/subset-kingdom.py",
              file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

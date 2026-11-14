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

Глифы, которые экраны рисуют прямо в коде (`›` у кнопок, `?` Башни,
`loading…`), — вторым проходом по src/ (кроме data/): весь текст
литерала, который сразу уходит в fillText, и не-ASCII буквы любого
другого литерала (`›${str(…)}`). Шрифт литерала — последний, выставленный
выше в том же файле: `setFont`/`setFontFitted(ctx, '<роль>'…)` (роль из
ROLES в core/text.js) или `.font = '…'` / `.font = КОНСТАНТА`. Это
эвристика по тексту, не разбор исполнения: шрифт, выставленный в другой
функции или другом файле, она не видит. Литерал с не-ASCII буквами, перед
которым шрифт не выставлен, — тоже ошибка: не понять, чем его рисуют.
Сообщения разработчику (`throw new Error(…)`, `console.…(…)`) пропускаются.
"""
import json, pathlib, re, subprocess, sys

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


def lex(src):
    """Код без комментариев (пробелы на их месте, переносы строк целы) и
    литералы: [начало, текст без ${…}]. Внутри ${…} строки и вложенные
    шаблоны тоже находятся. Регэксп-литерал узнаётся по символу перед `/`,
    как у парсера, и пропускается."""
    code = list(src)
    lits = []
    tpl = []  # открытые ${…}: [глубина фигурных скобок, индекс литерала шаблона]
    i, n = 0, len(src)

    def blank(a, b):
        for k in range(a, b):
            if code[k] != "\n":
                code[k] = " "

    def template_chunk(j, idx):
        """Текст шаблона от j до ` или ${ дописывается в литерал idx."""
        buf = []
        while j < n:
            ch = src[j]
            if ch == "\\":
                buf.append(src[j + 1:j + 2])
                j += 2
            elif ch == "`":
                lits[idx][1] += "".join(buf)
                return j + 1
            elif src.startswith("${", j):
                lits[idx][1] += "".join(buf)
                tpl.append([0, idx])
                return j + 2
            else:
                buf.append(ch)
                j += 1
        lits[idx][1] += "".join(buf)
        return j

    while i < n:
        ch = src[i]
        if src.startswith("//", i):
            j = src.find("\n", i)
            j = n if j < 0 else j
            blank(i, j)
            i = j
        elif src.startswith("/*", i):
            j = src.find("*/", i + 2)
            j = n if j < 0 else j + 2
            blank(i, j)
            i = j
        elif ch in "'\"":
            j, buf = i + 1, []
            while j < n and src[j] != ch:
                if src[j] == "\\":
                    buf.append(src[j + 1:j + 2])
                    j += 2
                else:
                    buf.append(src[j])
                    j += 1
            lits.append([i, "".join(buf)])
            i = j + 1
        elif ch == "`":
            lits.append([i, ""])
            i = template_chunk(i + 1, len(lits) - 1)
        elif ch == "{" and tpl:
            tpl[-1][0] += 1
            i += 1
        elif ch == "}" and tpl:
            if tpl[-1][0] == 0:
                i = template_chunk(i + 1, tpl.pop()[1])
            else:
                tpl[-1][0] -= 1
                i += 1
        elif ch == "/":
            prev = "".join(code[max(0, i - 8):i]).rstrip()
            if not prev or prev[-1] in "(,=:[!&|?{};+-*%<>~^" or prev.endswith("return"):
                j, in_class = i + 1, False
                while j < n and (in_class or src[j] != "/"):
                    if src[j] == "\\":
                        j += 1
                    elif src[j] == "[":
                        in_class = True
                    elif src[j] == "]":
                        in_class = False
                    j += 1
                i = j + 1
            else:
                i += 1
        else:
            i += 1
    return "".join(code), lits


def family_of(spec):
    """Первый из трёх шрифтов игры, названный в font-строке, или None."""
    hits = [(spec.find(name), name) for name in FONTS if name in spec]
    return min(hits)[1] if hits else None


def role_fonts():
    """Роль setFont → шрифт, из ROLES и констант FONT_* в core/text.js."""
    src = (ROOT / "src/core/text.js").read_text()
    consts = dict(re.findall(r"const (FONT_\w+) = '([^']*)'", src))
    return {role: family_of(consts[c])
            for role, c in re.findall(r"(\w+):\s*\{\s*family:\s*(FONT_\w+)", src)}


SET_ROLE = re.compile(r"\bsetFont(?:Fitted)?\(\s*\w+\s*,\s*$")
SET_FONT = re.compile(r"\.font\s*=\s*$")
SET_FONT_CONST = re.compile(r"\.font\s*=\s*([A-Z_][A-Z0-9_]*)\b")
CONST = re.compile(r"\bconst ([A-Z_][A-Z0-9_]*)\s*=\s*$")
FILL = re.compile(r"\.fillText\(\s*$")
# сообщения разработчику (throw, console) на экран не рисуются
MESSAGE = re.compile(r"\b(?:Error|console\.\w+)\(")


def load_code_texts():
    """@returns список (где, текст, [шрифт]) и список ошибок разбора."""
    roles = role_fonts()
    texts, bad = [], []
    for path in sorted((ROOT / "src").rglob("*.js")):
        rel = path.relative_to(ROOT).as_posix()
        if rel.startswith("src/data/") or rel == "src/core/text.js":
            continue
        src = path.read_text()
        code, lits = lex(src)
        consts = {}
        events = []  # (позиция, шрифт): где в файле выставлен шрифт
        for start, text in lits:
            before = code[max(0, start - 60):start]
            m = CONST.search(before)
            if m:
                consts[m.group(1)] = text
            if SET_ROLE.search(before) and text in roles:
                events.append((start, roles[text]))
            elif SET_FONT.search(before):
                events.append((start, family_of(text)))
        for m in SET_FONT_CONST.finditer(code):
            if m.group(1) in consts:
                events.append((m.start(), family_of(consts[m.group(1)])))
        events.sort()
        for start, text in lits:
            drawn = FILL.search(code[max(0, start - 30):start]) is not None
            chars = text if drawn else "".join(ch for ch in text if ord(ch) > 127)
            line_start = code.rfind("\n", 0, start) + 1
            if not chars.strip() or MESSAGE.search(code[line_start:start]):
                continue
            where = f"{rel}:{src.count(chr(10), 0, start) + 1}"
            font = next((f for pos, f in reversed(events) if pos < start), None)
            if font is None:
                bad.append(f"{where}: не понять, каким шрифтом рисуется «{chars}»"
                           " — выставь шрифт выше в том же файле")
                continue
            texts.append((where, chars, [font]))
    return texts, bad


def main():
    cmaps = {name: set(TTFont(path).getBestCmap()) for name, path in FONTS.items()}
    checked = {name: 0 for name in FONTS}
    code_texts, bad = load_code_texts()
    for where, text, fonts in load_texts() + code_texts:
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

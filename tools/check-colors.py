"""Цвета в коде — только из палитры (tools/palette.py).

Автоматизирует пункт «grep -n "#" src -r» из проверки перед «готово»
(CLAUDE.md): ищет hex-цвета (#RGB, #RRGGBB, #RRGGBBAA) и rgb()/rgba()
с числами в src/, index.html и public/manifest.webmanifest. Цвет вне
ALLOWED — строка с файлом и номером, выход с кодом 1.

rgb() со вставкой `${…}` не проверяется: такой цвет вычисляется из
пикселей ассета, а ассеты проверяет check-asset.py.

    python3 tools/check-colors.py
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from palette import ALLOWED  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FILES = ['index.html', 'public/manifest.webmanifest']
EXTS = ('.js', '.mjs', '.css', '.html')

HEX = re.compile(r'#([0-9A-Fa-f]{8}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})\b')
RGB = re.compile(r'rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)')


def parse_hex(h):
    if len(h) == 3:
        h = ''.join(c * 2 for c in h)
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def targets():
    for f in FILES:
        p = os.path.join(ROOT, f)
        if os.path.exists(p):
            yield p
    for d, _, names in os.walk(os.path.join(ROOT, 'src')):
        for n in sorted(names):
            if n.endswith(EXTS):
                yield os.path.join(d, n)


def main():
    bad = seen = 0
    for path in targets():
        rel = os.path.relpath(path, ROOT)
        with open(path, encoding='utf-8') as fh:
            for ln, line in enumerate(fh, 1):
                found = [(m.group(0), parse_hex(m.group(1))) for m in HEX.finditer(line)]
                found += [(m.group(0) + ')', tuple(int(x) for x in m.groups()))
                          for m in RGB.finditer(line)]
                for text, rgb in found:
                    seen += 1
                    if rgb not in ALLOWED:
                        bad += 1
                        print(f'{rel}:{ln}: {text} — нет в палитре')
    print(f'цвета в коде: {seen - bad} из {seen} в палитре')
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()

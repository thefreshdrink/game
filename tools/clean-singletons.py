#!/usr/bin/env python3
"""Чистка одиночных пикселей — с показом до и после.

Одиночный — арт-пиксель, у которого ни один из четырёх соседей не того же
цвета. Он перекрашивается в самый частый цвет соседей (прозрачных соседей
не считаем, контур не трогаем: пиксель на краю силуэта остаётся как есть).

Решение 2026-10-25: чистить можно автоматически, но каждый раз Алисе
показывается до и после, оставляет она. Поэтому скрипт **не трогает**
исходник: пишет почищенную копию `<имя>.clean.png` и лист
`<имя>.before-after.png` (слева до, справа после, точки чистки — золотом
на третьей картинке). В игру копию кладут только после её «да».

    python3 tools/clean-singletons.py public/assets/card/tower_on_the_card.png
    python3 tools/clean-singletons.py файл.png --grain 2 --out папка/
"""
import argparse
import os
import sys
from collections import Counter
from PIL import Image

CARD_GRAIN = 4  # портреты лежат ×4, как в check-asset.py
NEAR = ((1, 0), (-1, 0), (0, 1), (0, -1))


def clean(art):
    """Возвращает почищенную копию и список (x, y) перекрашенных пикселей."""
    src = art.load()
    out = art.copy()
    dst = out.load()
    w, h = art.size
    fixed = []
    for y in range(h):
        for x in range(w):
            c = src[x, y]
            if c[3] == 0:
                continue
            near = [src[x + dx, y + dy] for dx, dy in NEAR
                    if 0 <= x + dx < w and 0 <= y + dy < h]
            if any(o == c for o in near):
                continue
            if len(near) < 4 or any(o[3] == 0 for o in near):
                continue  # край силуэта — это контур, его не трогаем
            dst[x, y] = Counter(near).most_common(1)[0][0]
            fixed.append((x, y))
    return out, fixed


def sheet(before, after, fixed, scale):
    """До | после | где чистили — на фоне воздуха #111111."""
    w, h = before.size
    gap = 8 * scale
    marks = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    for x, y in fixed:
        marks.putpixel((x, y), (235, 163, 49, 255))
    dim = after.copy()
    dim.putalpha(dim.getchannel('A').point(lambda a: a // 3))
    dim.alpha_composite(marks)
    big = [im.resize((w * scale, h * scale), Image.NEAREST) for im in (before, after, dim)]
    s = Image.new('RGBA', (3 * w * scale + 4 * gap, h * scale + 2 * gap), (17, 17, 17, 255))
    for i, im in enumerate(big):
        s.alpha_composite(im, (gap + i * (w * scale + gap), gap))
    return s


def main(argv):
    ap = argparse.ArgumentParser(description='чистка одиночных пикселей с листом до/после')
    ap.add_argument('src')
    ap.add_argument('--grain', type=int, help='экранных px на арт-пиксель (портрет — 4)')
    ap.add_argument('--out', help='папка для копии и листа (по умолчанию рядом с исходником)')
    a = ap.parse_args(argv)

    im = Image.open(a.src).convert('RGBA')
    grain = a.grain or (CARD_GRAIN if a.src.endswith('_on_the_card.png') else 1)
    if im.width % grain or im.height % grain:
        print(f'✗ {im.width}×{im.height} не делится на зерно {grain}')
        return 1
    art = im.resize((im.width // grain, im.height // grain), Image.NEAREST)
    after, fixed = clean(art)

    base = os.path.splitext(os.path.basename(a.src))[0]
    folder = a.out or os.path.dirname(a.src)
    os.makedirs(folder, exist_ok=True)
    clean_path = os.path.join(folder, base + '.clean.png')
    sheet_path = os.path.join(folder, base + '.before-after.png')
    after.resize(im.size, Image.NEAREST).save(clean_path)
    sheet(art, after, fixed, max(2, 8 // grain) * grain).save(sheet_path)
    solid = sum(n for n, c in art.getcolors(1 << 20) if c[3])
    print(f'перекрашено {len(fixed)} из {solid} арт-пикселей ({len(fixed) / max(solid, 1):.0%})')
    print(f'копия: {clean_path}')
    print(f'до/после: {sheet_path} — показать Алисе, исходник не тронут')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))

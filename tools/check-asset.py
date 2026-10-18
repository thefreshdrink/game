#!/usr/bin/env python3
"""Проверяет ассет на соответствие канону игры — и после генерации, и после
ручной правки в редакторе.

Что проверяется (всё из CLAUDE.md и docs/design-system.md):

  1. цвета только из палитры (плюс каменное исключение дороги);
  2. альфа только 0 или 255 — полупрозрачных пикселей быть не должно,
     они появляются от антиалиасинга и в игре дают грязную кайму;
  3. размеры чётные — иначе спрайт не ложится на сетку;
  4. картинка не увеличена: если каждый «пиксель» на самом деле блок
     2×2 или 4×4, файл надо ужать до нативного размера, иначе он весит
     лишнее и мылится при масштабировании;
  5. портрет карты (*_on_the_card.png) лежит ровно ×4 — зерно у всех
     портретов одно.

    python3 tools/check-asset.py public/assets/tower/block.png
    python3 tools/check-asset.py public/assets/**/*.png
    python3 tools/check-asset.py --all      # все PNG в public/assets + итог
                                            # (то же: npm run check-assets)
"""
import os
import sys
from PIL import Image

from palette import ALLOWED as PALETTE  # единая палитра, tools/palette.py


CARD_GRAIN = 4  # экранных px на арт-пиксель у портрета карты


def block_factor(im, maxf=8):
    """Во сколько раз картинка — целочисленный апскейл пиксель-арта."""
    px = im.load()
    w, h = im.size
    best = 1
    for f in range(2, maxf + 1):
        if w % f or h % f:
            continue
        ok = True
        for y in range(0, h, f):
            for x in range(0, w, f):
                a = px[x, y]
                if any(px[x + dx, y + dy] != a for dy in range(f) for dx in range(f)):
                    ok = False
                    break
            if not ok:
                break
        if ok:
            best = f
    return best


def check(path):
    im = Image.open(path).convert('RGBA')
    problems = []
    w, h = im.size

    if w % 2 or h % 2:
        problems.append(f'нечётный размер {w}×{h} — сетка требует чётных')

    alphas = {c[1][3] for c in im.getcolors(1 << 20)}
    bad_alpha = alphas - {0, 255}
    if bad_alpha:
        problems.append(f'полупрозрачные пиксели (альфа {sorted(bad_alpha)[:5]}) — снять антиалиасинг')

    off = {c[1][:3] for c in im.getcolors(1 << 20) if c[1][3] == 255} - PALETTE
    if off:
        show = ', '.join(f'#{r:02X}{g:02X}{b:02X}' for r, g, b in sorted(off)[:6])
        problems.append(f'{len(off)} цветов вне палитры: {show}')

    f = block_factor(im)
    note = None
    if path.endswith('_on_the_card.png'):
        # Портреты карт ЛЕЖАТ увеличенными сознательно: код рисует их ×1
        # (ASSETS.md). Зерно у всех портретов одно — CARD_GRAIN экранных
        # на арт-пиксель (решение 2026-09-28), иначе на месте портрета
        # соседствуют разные размеры пикселя.
        if f != CARD_GRAIN:
            problems.append(f'зерно портрета ×{f}, нужно ×{CARD_GRAIN} — '
                            f'посадить на сетку: tools/pixel-grid.py --grain {CARD_GRAIN} --scale {CARD_GRAIN}')
    elif f > 1:
        if '/card/' in path:
            note = f'увеличена ×{f} — так и задумано для рамок карты (рисуются ×1)'
        else:
            problems.append(f'картинка увеличена ×{f} — сохранить в нативном размере {w // f}×{h // f}')

    name = path.split('/')[-1]
    if problems:
        print(f'✗ {name} ({w}×{h})')
        for p in problems:
            print(f'    {p}')
        return False
    print(f'✓ {name} ({w}×{h}) — палитра, альфа, сетка в порядке')
    if note:
        print(f'    примечание: {note}')
    return True


ASSETS = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets')


def all_assets():
    """Все PNG в public/assets по порядку. Сам обходит папки, поэтому
    имена с пробелами не ломаются, как при раскрытии шаблона в shell."""
    root = os.path.normpath(ASSETS)
    found = []
    for d, _, files in os.walk(root):
        found += [os.path.join(d, f) for f in files if f.lower().endswith('.png')]
    return sorted(found)


def main(argv):
    if not argv:
        print(__doc__)
        return 1
    if argv == ['--all']:
        paths = all_assets()
        bad = [p for p in paths if not check(p)]
        print(f'\nитого: {len(paths) - len(bad)} из {len(paths)} в порядке')
        for p in bad:
            print(f'  ✗ {os.path.relpath(p)}')
        return 1 if bad else 0
    ok = all([check(p) for p in argv])
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))

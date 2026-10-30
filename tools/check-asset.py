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
     портретов одно;
  6. миксели — пиксели разного размера: картинка почти вся из блоков 2×2
     (или 4×4), но часть блоков рваная. Это брак, ассет не проходит;
  7. одиночные пиксели — цвет, которого нет ни у одного из четырёх соседей
     (считается на арт-пикселях). Это примечание, не брак: в кладке и на
     обломках они бывают нарочно, решение по автоочистке не принято.

Сравнение двух скриншотов (эталон и новый кадр той же сцены):

    python3 tools/check-asset.py --diff эталон.png новый.png [--out разница.png]

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


def mixel_share(im, f):
    """Доля рваных блоков f×f среди непрозрачных: 0 — сетка чистая."""
    px = im.load()
    w, h = im.size
    total = bad = 0
    for y in range(0, h - h % f, f):
        for x in range(0, w - w % f, f):
            block = {px[x + dx, y + dy] for dy in range(f) for dx in range(f)}
            if all(c[3] == 0 for c in block):
                continue
            total += 1
            if len(block) > 1:
                bad += 1
    return bad / total if total else 0.0


MIXEL_SUSPECT = 0.85   # блоков чистых не меньше этого — значит, зерно задумано


def singletons(im, f):
    """Одиночные арт-пиксели: ни один из четырёх соседей не того же цвета."""
    if f > 1:
        im = im.resize((im.width // f, im.height // f), Image.NEAREST)
    px = im.load()
    w, h = im.size
    n = solid = 0
    for y in range(h):
        for x in range(w):
            c = px[x, y]
            if c[3] == 0:
                continue
            solid += 1
            near = [px[x + dx, y + dy] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
                    if 0 <= x + dx < w and 0 <= y + dy < h]
            if all(o != c for o in near):
                n += 1
    return n, solid


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

    grain = CARD_GRAIN if path.endswith('_on_the_card.png') else f
    if f == 1:
        for g in (4, 2):
            share = mixel_share(im, g)
            if share and share <= 1 - MIXEL_SUSPECT:
                problems.append(f'миксели: {share:.1%} блоков {g}×{g} рваные — '
                                f'пиксели разного размера, посадить на сетку: tools/pixel-grid.py --grain {g}')
                break
    lone, solid = singletons(im, grain)
    if solid and lone / solid > 0.05:
        extra = f'одиночных пикселей {lone} ({lone / solid:.0%} фигуры)'
        note = f'{note}; {extra}' if note else extra

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


def diff(args):
    """Сравнение скриншотов: доля отличающихся пикселей и рамка, где они."""
    if len(args) not in (2, 4) or (len(args) == 4 and args[2] != '--out'):
        print('    python3 tools/check-asset.py --diff эталон.png новый.png [--out разница.png]')
        return 1
    a = Image.open(args[0]).convert('RGBA')
    b = Image.open(args[1]).convert('RGBA')
    if a.size != b.size:
        print(f'✗ размеры разные: {a.size} и {b.size} — снимать в одном окне')
        return 1
    from PIL import ImageChops
    d = ImageChops.difference(a, b).convert('L').point(lambda v: 255 if v else 0)
    changed = d.histogram()[255]
    share = changed / (a.width * a.height)
    box = d.getbbox()
    if len(args) == 4:
        out = a.convert('RGB').point(lambda v: v // 3)
        out.paste((235, 163, 49), mask=d)
        out.save(args[3])
    if not box:
        print('✓ кадры совпадают до пикселя')
        return 0
    print(f'✗ отличается {changed} px ({share:.2%}), область x {box[0]}…{box[2] - 1}, y {box[1]}…{box[3] - 1}')
    return 1


ASSETS = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets')


# Файлы в игре, которые проверку пока не проходят — сознательно, до
# переделки (решение 2026-10-18). Сборка их пропускает с предупреждением;
# новые файлы так не пройдут.
EXCEPTIONS = {
    'card/back_side_card_final.png': 'рубашка карты: 12 серых вне палитры, переделать',
    'card/fool_on_the_card.png': 'портрет Шута: сглаженный, зерно ×1, переделать по рецепту',
    'future_teller/oracle_body.png': 'оракул: сглаженные края, переделать',
    'future_teller/oracle_eyes.png': 'глаза оракула: сглаженные края, переделать',
}


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
    if argv and argv[0] == '--diff':
        return diff(argv[1:])
    if argv == ['--all']:
        paths = all_assets()
        root = os.path.normpath(ASSETS)
        known = {p for p in paths if os.path.relpath(p, root) in EXCEPTIONS}
        bad = [p for p in paths if p not in known and not check(p)]
        print(f'\nитого: {len(paths) - len(bad) - len(known)} из {len(paths)} в порядке, '
              f'{len(known)} в исключениях')
        for p in sorted(known):
            print(f'  ⚠ {os.path.relpath(p, root)} — {EXCEPTIONS[os.path.relpath(p, root)]}')
        for p in bad:
            print(f'  ✗ {os.path.relpath(p)}')
        return 1 if bad else 0
    ok = all([check(p) for p in argv])
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))

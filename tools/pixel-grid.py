#!/usr/bin/env python3
"""Сажает «почти пиксель-арт» на ровную сетку: генератор или апскейл дают
пиксели разного размера и съехавшие края, в игре это видно как рябь рядом с
чистыми ассетами (портрет Шута — 4 экранных, но без сетки).

Что делает:
  1. ищет сдвиг сетки (0..grain-1 по x и y), при котором клетки grain×grain
     внутри себя однороднее всего;
  2. каждую клетку сводит к её самому частому цвету (прозрачность — если
     прозрачна хотя бы половина клетки);
  3. снапит цвета в палитру игры (design-system/tarot-journey.hex);
  4. пишет либо нативный размер (1 клетка = 1 пиксель), либо --scale N.

--ramp вместо п.3: цветную генерацию (фон по цветным референсам) не снапить
по ближайшему цвету — синее и оранжевое схлопнутся в одно серое. Цвета
сортируются по яркости и раскладываются по лесенке тонов равными долями
площади: порядок «дальше — светлее» и все кромки остаются.

    python3 tools/pixel-grid.py вход.png выход.png --grain 4 --scale 4
    python3 tools/pixel-grid.py вход.png выход.png --grain auto
    python3 tools/pixel-grid.py фон.png выход.png --grain 1 --ramp 111111,161616,1C1C1C,212121,2E2E2E,4A4A4A
    python3 tools/pixel-grid.py --selftest
"""
import argparse
import os
import sys
from collections import Counter
from PIL import Image

HEX = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'design-system', 'tarot-journey.hex')


def palette():
    with open(HEX) as f:
        return [tuple(int(l.strip()[i:i + 2], 16) for i in (0, 2, 4)) for l in f if l.strip()]


def nearest(c, pal):
    return min(pal, key=lambda p: (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2)


def cell_votes(px, w, h, g, ox, oy):
    """Клетки сетки с шагом g и сдвигом (ox, oy): список (cx, cy, Counter)."""
    out = []
    for cy, y0 in enumerate(range(oy - g if oy else 0, h, g)):
        for cx, x0 in enumerate(range(ox - g if ox else 0, w, g)):
            c = Counter()
            for y in range(max(0, y0), min(h, y0 + g)):
                for x in range(max(0, x0), min(w, x0 + g)):
                    p = px[x, y]
                    c[(0, 0, 0, 0) if p[3] < 128 else p[:3] + (255,)] += 1
            out.append((cx, cy, c))
    return out


def purity(px, w, h, g, ox, oy):
    """Доля пикселей, совпавших с главным цветом своей клетки."""
    hit = tot = 0
    for _, _, c in cell_votes(px, w, h, g, ox, oy):
        n = sum(c.values())
        if not n or (len(c) == 1 and (0, 0, 0, 0) in c):
            continue
        hit += c.most_common(1)[0][1]
        tot += n
    return hit / tot if tot else 0


def best_offset(px, w, h, g):
    return max(((purity(px, w, h, g, ox, oy), ox, oy) for ox in range(g) for oy in range(g)))


def luma(c):
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


def ramp_map(colors, ramp):
    """Counter цветов → {цвет: тон лесенки}: по яркости, равными долями площади."""
    total = sum(colors.values())
    out = {}
    acc = 0
    for col, n in sorted(colors.items(), key=lambda kv: luma(kv[0])):
        mid = (acc + n / 2) / total
        out[col] = ramp[min(len(ramp) - 1, int(mid * len(ramp)))]
        acc += n
    return out


def snap(im, g, scale, ramp=None):
    im = im.convert('RGBA')
    px = im.load()
    w, h = im.size
    score, ox, oy = best_offset(px, w, h, g)
    pal = palette()
    cells = cell_votes(px, w, h, g, ox, oy)
    cw = max(c[0] for c in cells) + 1
    ch = max(c[1] for c in cells) + 1
    out = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
    op = out.load()
    picked = []
    for cx, cy, c in cells:
        n = sum(c.values())
        if c[(0, 0, 0, 0)] * 2 >= n:
            continue
        picked.append((cx, cy, next(k for k, _ in c.most_common() if k[3])[:3]))
    tone = ramp_map(Counter(col for _, _, col in picked), ramp) if ramp else None
    for cx, cy, col in picked:
        op[cx, cy] = (tone[col] if tone else nearest(col, pal)) + (255,)
    bbox = out.getbbox()
    if bbox:
        out = out.crop(bbox)
    if scale > 1:
        out = out.resize((out.width * scale, out.height * scale), Image.NEAREST)
    return out, score, (ox, oy)


def selftest():
    import random
    random.seed(1)
    pal = palette()
    art = Image.new('RGBA', (12, 14), (0, 0, 0, 0))
    for y in range(14):
        for x in range(12):
            if random.random() < 0.7:
                art.putpixel((x, y), random.choice(pal) + (255,))
    # апскейл ×4 со сдвигом на 2 и «съеденными» краями
    big = Image.new('RGBA', (52, 60), (0, 0, 0, 0))
    big.paste(art.resize((48, 56), Image.NEAREST), (2, 2))
    for y in range(0, 60, 7):
        big.putpixel((min(51, y % 52), y), (128, 128, 128, 255))
    out, score, off = snap(big, 4, 1)
    ref = art.crop(art.getbbox())
    same = sum(out.getpixel((x, y)) == ref.getpixel((x, y))
               for y in range(ref.height) for x in range(ref.width)) if out.size == ref.size else 0
    ok = out.size == ref.size and same / (ref.width * ref.height) > 0.95 and off == (2, 2)
    print(f"selftest {'ok' if ok else 'FAIL'} — размер {out.size} vs {ref.size}, совпало {same}, сдвиг {off}")
    # --ramp: тёмное остаётся тёмным, порядок яркости сохраняется
    grad = Image.new('RGBA', (4, 1))
    for x, c in enumerate([(10, 20, 90), (200, 60, 30), (90, 160, 220), (250, 240, 200)]):
        grad.putpixel((x, 0), c + (255,))
    rout, _, _ = snap(grad, 1, 1, ramp=[(17, 17, 17), (46, 46, 46), (128, 128, 128), (255, 255, 255)])
    got = [rout.getpixel((x, 0))[0] for x in range(4)]
    rok = got == sorted(got) and got[0] == 17 and got[-1] == 255
    print(f"selftest ramp {'ok' if rok else 'FAIL'} — {got}")
    return ok and rok


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src', nargs='?')
    ap.add_argument('dst', nargs='?')
    ap.add_argument('--grain', default='4', help='размер клетки в пикселях входа или auto (2..8)')
    ap.add_argument('--scale', type=int, default=1, help='множитель вывода (4 → как портреты карт)')
    ap.add_argument('--ramp', default='', help='тоны по яркости вместо снапа: 111111,2E2E2E,4A4A4A')
    ap.add_argument('--selftest', action='store_true')
    a = ap.parse_args()
    if a.selftest:
        sys.exit(0 if selftest() else 1)
    if not a.src or not a.dst:
        ap.error('нужны вход и выход')
    im = Image.open(a.src).convert('RGBA')
    if a.grain == 'auto':
        px = im.load()
        cands = [(best_offset(px, *im.size, g)[0] - 0.02 * g, g) for g in range(2, 9)]
        g = max(cands)[1]
    else:
        g = int(a.grain)
    ramp = [tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) for h in a.ramp.split(',')] if a.ramp else None
    out, score, off = snap(im, g, a.scale, ramp)
    out.save(a.dst)
    print(f'{a.dst}: клетка {g}, сдвиг {off}, однородность {score:.0%}, {out.size[0]}×{out.size[1]}')


if __name__ == '__main__':
    main()

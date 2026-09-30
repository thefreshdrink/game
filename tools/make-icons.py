#!/usr/bin/env python3
"""Иконки приложения (PWA) из портрета карты: портрет на воздухе #111111,
увеличение целым множителем без сглаживания — пиксель остаётся пикселем.
Портрет вписывается в 80% стороны: безопасная зона maskable-иконки,
Android обрезает края кругом или скруглённым квадратом.

    python3 tools/make-icons.py                       # Шут → public/icons/
    python3 tools/make-icons.py --src public/assets/card/tower_on_the_card.png
    python3 tools/make-icons.py --selftest
"""
import argparse
import os
import sys
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
AIR = (0x11, 0x11, 0x11, 255)
SIZES = {'icon-192.png': 192, 'icon-512.png': 512, 'apple-touch-icon.png': 180}
CARD_GRAIN = 4   # портрет карты лежит ×4 (check-asset.py)
SAFE = 0.8


def native(portrait):
    """Портрет ×CARD_GRAIN → родные арт-пиксели, по силуэту."""
    im = portrait.convert('RGBA')
    im = im.crop(im.getbbox())
    return im.resize((max(1, im.width // CARD_GRAIN), max(1, im.height // CARD_GRAIN)), Image.NEAREST)


def icon(art, side):
    k = max(1, int(side * SAFE) // max(art.width, art.height))
    big = art.resize((art.width * k, art.height * k), Image.NEAREST)
    out = Image.new('RGBA', (side, side), AIR)
    out.alpha_composite(big, ((side - big.width) // 2, (side - big.height) // 2))
    return out.convert('RGB')


def selftest():
    art = Image.new('RGBA', (40, 44), (0, 0, 0, 0))
    for y in range(4, 40):
        art.putpixel((20, y), (255, 255, 255, 255))
    portrait = art.resize((160, 176), Image.NEAREST)
    n = native(portrait)
    ok = n.size == (1, 36)
    for name, side in SIZES.items():
        im = icon(n, side)
        colors = {c for _, c in im.getcolors(1 << 16)}
        ok &= im.size == (side, side) and colors <= {AIR[:3], (255, 255, 255)}
    print(f"selftest {'ok' if ok else 'FAIL'} — родной размер {n.size}")
    return ok


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default=os.path.join(ROOT, 'public/assets/card/fool_on_the_card.png'))
    ap.add_argument('--out', default=os.path.join(ROOT, 'public/icons'))
    ap.add_argument('--selftest', action='store_true')
    a = ap.parse_args()
    if a.selftest:
        sys.exit(0 if selftest() else 1)
    art = native(Image.open(a.src))
    os.makedirs(a.out, exist_ok=True)
    for name, side in SIZES.items():
        icon(art, side).save(os.path.join(a.out, name), optimize=True)
        print(f'{name}: {side}×{side}')


if __name__ == '__main__':
    main()

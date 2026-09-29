#!/usr/bin/env python3
"""Режет лист генерации на отдельные спрайты: каждая связная непрозрачная
фигура — свой файл, обрезанный по силуэту. Мелочь (меньше --min пикселей)
выкидывается. По желанию перекрашивает тона по карте --tones.

Генератор отдаёт наборы (облака, камни, травинки) одним листом; в игре они
нужны по отдельности, чтобы собирать из них композиции и зеркалить.

    python3 tools/cut-sprites.py лист.png public/assets/fool/clouds/cloud --min 40
    python3 tools/cut-sprites.py лист.png out/cloud --tones FF:80,B8:4A
    python3 tools/cut-sprites.py --selftest

Пишет <префикс>_01.png, <префикс>_02.png … (слева направо, сверху вниз).
"""
import argparse
import sys
from PIL import Image


def components(im, min_px):
    """Связные области непрозрачных пикселей (8-связность) — bbox и пиксели."""
    px = im.load()
    w, h = im.size
    seen = bytearray(w * h)
    out = []
    for y0 in range(h):
        for x0 in range(w):
            if seen[y0 * w + x0] or px[x0, y0][3] < 128:
                continue
            stack = [(x0, y0)]
            seen[y0 * w + x0] = 1
            pts = []
            while stack:
                x, y = stack.pop()
                pts.append((x, y))
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and px[nx, ny][3] >= 128:
                            seen[ny * w + nx] = 1
                            stack.append((nx, ny))
            if len(pts) >= min_px:
                xs = [p[0] for p in pts]
                ys = [p[1] for p in pts]
                out.append(((min(xs), min(ys), max(xs) + 1, max(ys) + 1), pts))
    # слева направо по рядам: сначала верх, внутри ряда — x
    out.sort(key=lambda c: (c[0][1] // 16, c[0][0]))
    return out


def parse_tones(spec):
    m = {}
    for pair in (spec or '').split(','):
        if not pair:
            continue
        a, b = pair.split(':')
        m[int(a, 16)] = int(b, 16)
    return m


def cut(im, min_px, tones):
    im = im.convert('RGBA')
    src = im.load()
    sprites = []
    for (x0, y0, x1, y1), pts in components(im, min_px):
        # чётные стороны (сетка проекта): добивка прозрачной полосой справа и
        # сверху — низ фигуры остаётся на месте
        pw, ph = (x1 - x0) % 2, (y1 - y0) % 2
        sp = Image.new('RGBA', (x1 - x0 + pw, y1 - y0 + ph), (0, 0, 0, 0))
        op = sp.load()
        y0 -= ph
        for x, y in pts:
            r, g, b, a = src[x, y]
            if tones:
                k = min(tones, key=lambda v: abs(v - r))
                r = g = b = tones[k]
            op[x - x0, y - y0] = (r, g, b, 255)
        sprites.append(sp)
    return sprites


def selftest():
    im = Image.new('RGBA', (20, 10), (0, 0, 0, 0))
    for x in range(2, 6):
        for y in range(2, 5):
            im.putpixel((x, y), (255, 255, 255, 255))
    for x in range(10, 18):
        for y in range(4, 8):
            im.putpixel((x, y), (184, 184, 184, 255))
    im.putpixel((0, 9), (255, 255, 255, 255))            # мелочь — выкинуть
    sp = cut(im, 4, parse_tones('FF:80,B8:4A'))
    ok = len(sp) == 2 and sp[0].size == (4, 4) and sp[1].size == (8, 4) \
        and sp[0].getpixel((0, 1))[:3] == (128, 128, 128) and sp[1].getpixel((0, 0))[:3] == (74, 74, 74)
    print(f"selftest {'ok' if ok else 'FAIL'} — фигур {len(sp)}")
    return ok


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src', nargs='?')
    ap.add_argument('prefix', nargs='?')
    ap.add_argument('--min', type=int, default=24, help='минимум пикселей в фигуре')
    ap.add_argument('--tones', default='', help='перекраска серых: FF:80,B8:4A')
    ap.add_argument('--selftest', action='store_true')
    a = ap.parse_args()
    if a.selftest:
        sys.exit(0 if selftest() else 1)
    if not a.src or not a.prefix:
        ap.error('нужны лист и префикс')
    sprites = cut(Image.open(a.src), a.min, parse_tones(a.tones))
    for i, sp in enumerate(sprites, 1):
        path = f'{a.prefix}_{i:02d}.png'
        sp.save(path)
        print(f'{path}: {sp.size[0]}×{sp.size[1]}')


if __name__ == '__main__':
    main()

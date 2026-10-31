#!/usr/bin/env python3
"""Поворот части картинки на угол — без дорисовки.

Кусок (например, корона) увеличивается ×8 Nearest, поворачивается, и
каждый арт-пиксель берёт самый частый цвет своего блока 8×8. Новых цветов
не появляется, форма меняется только геометрией.

Решение 2026-10-25: поворот скриптом разрешён Алисой (корона Башни, 25°).
Как и чистка одиночных пикселей — результат показывается ей, оставляет она.
Исходник не трогается: пишется `<имя>.rot<угол>.png`.

    python3 tools/rotate-part.py incoming/tower_v2/crown6.png --box 27,14,13,20 --deg 25
"""
import argparse
import os
import sys
from collections import Counter
from PIL import Image

K = 8  # во сколько раз увеличиваем перед поворотом


def rotate(part, deg):
    w, h = part.size
    big = part.resize((w * K, h * K), Image.NEAREST).rotate(-deg, resample=Image.NEAREST)
    px = big.load()
    out = Image.new('RGBA', (w, h))
    for y in range(h):
        for x in range(w):
            c = Counter(px[x * K + i, y * K + j] for i in range(K) for j in range(K)).most_common(1)[0][0]
            out.putpixel((x, y), c if c[3] else (0, 0, 0, 0))
    return out


def main(argv):
    ap = argparse.ArgumentParser(description='поворот части картинки без дорисовки')
    ap.add_argument('src', help='картинка в арт-пикселях (не увеличенная)')
    ap.add_argument('--box', required=True, help='x,y,ширина,высота куска')
    ap.add_argument('--deg', type=float, required=True, help='угол по часовой')
    a = ap.parse_args(argv)
    x, y, w, h = (int(v) for v in a.box.split(','))
    im = Image.open(a.src).convert('RGBA')
    part = rotate(im.crop((x, y, x + w, y + h)), a.deg)
    im.paste(Image.new('RGBA', (w, h), (0, 0, 0, 0)), (x, y))
    im.alpha_composite(part, (x, y))
    out = f'{os.path.splitext(a.src)[0]}.rot{a.deg:g}.png'
    im.save(out)
    print(f'готово: {out} — показать Алисе, исходник не тронут')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))

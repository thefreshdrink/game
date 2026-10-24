#!/usr/bin/env python3
"""Минималистичный фон из слоёв холмов — рисуется кодом, без генератора.

Слои — плоские силуэты с плавными гребнями (сумма синусов), дальние светлее,
ближние темнее (воздушная перспектива). Небо и каждый слой мягко переходят
в соседний тон точечным дизерингом 4×4 (Байер) — как рамп пропасти в
design-system. Только тоны пустоты #111111…#2E2E2E: фон не спорит с Шутом.

    python3 tools/backdrop-hills.py out.png [--style soft|peaks|mixed] [--seed N]

Пишет нативный размер 200×320 (зерно 2 → 400×640 на экране).
"""
import argparse
import math
import random

from PIL import Image

W, H = 200, 320
BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]


def rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def mix(a, b, f, x, y):
    """Дизеринг: доля f тона b поверх a, порог по матрице Байера."""
    return b if f * 16 > BAYER[y % 4][x % 4] + 0.5 else a


def ridge(seed, base, amp, style):
    r = random.Random(seed)
    waves = [(r.uniform(0.6, 1.0) * amp, r.uniform(0.008, 0.02), r.uniform(0, 6.3)),
             (r.uniform(0.2, 0.45) * amp, r.uniform(0.025, 0.05), r.uniform(0, 6.3))]
    if style in ('peaks', 'mixed'):
        waves.append((r.uniform(0.15, 0.3) * amp, r.uniform(0.06, 0.09), r.uniform(0, 6.3)))
    def y(x):
        v = sum(a * math.sin(f * x * math.tau / 2 + p) for a, f, p in waves)
        if style == 'peaks':
            v = -abs(v) * 1.1  # острее кверху
        return round(base + v)
    return y


def render(style, seed):
    # тоны: небо тёмное сверху → светлее у горизонта; слои — от светлого к тёмному
    sky_top, sky_low = rgb('#111111'), rgb('#1C1C1C')
    layers = [  # (база гребня, амплитуда, тон верха, тон низа)
        (185, 12, '#2E2E2E', '#252525'),
        (215, 16, '#252525', '#1C1C1C'),
        (248, 18, '#1C1C1C', '#161616'),
        (285, 16, '#161616', '#111111'),
    ]
    im = Image.new('RGB', (W, H))
    px = im.load()
    horizon = 190
    for y in range(H):
        f = min(1, max(0, (y - 20) / (horizon - 20)))
        for x in range(W):
            px[x, y] = mix(sky_top, sky_low, f, x, y)
    for i, (base, amp, top, low) in enumerate(layers):
        ry = ridge(seed * 10 + i, base, amp, style if i < 3 or style != 'mixed' else 'soft')
        top, low = rgb(top), rgb(low)
        for x in range(W):
            y0 = max(0, ry(x))
            for y in range(y0, H):
                f = min(1, (y - y0) / 28)  # туман: светлее у гребня, темнее вниз
                px[x, y] = mix(top, low, f, x, y)
    return im


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('out')
    ap.add_argument('--style', default='soft', choices=['soft', 'peaks', 'mixed'])
    ap.add_argument('--seed', type=int, default=1)
    a = ap.parse_args()
    render(a.style, a.seed).save(a.out)
    print(f'{a.out}: {W}×{H}, {a.style}, seed {a.seed}')


if __name__ == '__main__':
    main()

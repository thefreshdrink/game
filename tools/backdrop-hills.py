#!/usr/bin/env python3
"""Минималистичный фон из слоёв холмов — рисуется кодом, без генератора.

Слои — плоские силуэты с плавными гребнями (сумма синусов), дальние светлее,
ближние темнее (воздушная перспектива). Небо и каждый слой мягко переходят
в соседний тон точечным дизерингом 4×4 (Байер) — как рамп пропасти в
design-system. Только тоны пустоты #111111…#2E2E2E: фон не спорит с Шутом.

    python3 tools/backdrop-hills.py out.png [--style soft|peaks|mixed] [--layers 2..7] [--seed N]

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


RAMP = ['#2E2E2E', '#2A2A2A', '#252525', '#212121', '#1C1C1C', '#161616', '#111111']


def render(style, seed, n=4):
    """n слоёв (2–7): гребни равномерно от y_top до y_bot, тоны — ступени
    RAMP от светлого (дальний) к тёмному (ближний); каждый слой туманом
    переходит в следующий тон вниз."""
    # тоны: небо тёмное сверху → светлее у горизонта
    sky_top, sky_low = rgb('#111111'), rgb('#1C1C1C')
    y_top, y_bot = 180, 296
    step = (len(RAMP) - 1) / max(1, n - 1) if n > 1 else 0
    tones = [RAMP[min(len(RAMP) - 1, round(i * step))] for i in range(n)]
    layers = []
    for i in range(n):
        base = y_top + (y_bot - y_top) * i / max(1, n - 1)
        low = RAMP[min(len(RAMP) - 1, RAMP.index(tones[i]) + 1)]
        layers.append((base, 10 + 8 * i / max(1, n - 1), tones[i], low))
    im = Image.new('RGB', (W, H))
    px = im.load()
    horizon = y_top
    for y in range(H):
        f = min(1, max(0, (y - 20) / (horizon - 20)))
        for x in range(W):
            px[x, y] = mix(sky_top, sky_low, f, x, y)
    fog = max(10, (y_bot - y_top) / max(1, n - 1))
    for i, (base, amp, top, low) in enumerate(layers):
        ry = ridge(seed * 10 + i, base, amp, style if i < n - 1 or style != 'mixed' else 'soft')
        top, low = rgb(top), rgb(low)
        for x in range(W):
            y0 = max(0, ry(x))
            for y in range(y0, H):
                f = min(1, (y - y0) / fog)  # туман: светлее у гребня, темнее вниз
                px[x, y] = mix(top, low, f, x, y)
    return im


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('out')
    ap.add_argument('--style', default='soft', choices=['soft', 'peaks', 'mixed'])
    ap.add_argument('--seed', type=int, default=1)
    ap.add_argument('--layers', type=int, default=4, help='число слоёв холмов, 2–7')
    a = ap.parse_args()
    render(a.style, a.seed, a.layers).save(a.out)
    print(f'{a.out}: {W}×{H}, {a.style}, слоёв {a.layers}, seed {a.seed}')


if __name__ == '__main__':
    main()

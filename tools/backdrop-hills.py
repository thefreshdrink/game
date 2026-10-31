#!/usr/bin/env python3
"""Минималистичный фон из слоёв холмов — рисуется кодом, без генератора.

Слои — плоские силуэты с плавными гребнями (сумма синусов), дальние светлее,
ближние темнее (воздушная перспектива). Небо и каждый слой мягко переходят
в соседний тон точечным дизерингом 4×4 (Байер) — как рамп пропасти в
design-system. Только тоны пустоты #111111…#2E2E2E: фон не спорит с Шутом.

    python3 tools/backdrop-hills.py out.png [--style soft|peaks|mixed] [--layers 2..7] [--seed N]
    … --front 1 front.png   # + слои с 1-го на прозрачном (солнце между слоями)

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


def ridge(seed, base, amp, style, rag=0.0, size=1.0):
    """rag 0..1 — дальний гребень из круглых бугров разной высоты и ширины:
    сумма плавных «шапок» (cos²) поверх длинной волны. Без зубцов и пиков."""
    r = random.Random(seed)
    waves = [(r.uniform(0.6, 1.0) * amp, r.uniform(0.008, 0.02), r.uniform(0, 6.3)),
             (r.uniform(0.2, 0.45) * amp, r.uniform(0.025, 0.05), r.uniform(0, 6.3))]
    if style in ('peaks', 'mixed'):
        waves.append((r.uniform(0.15, 0.3) * amp, r.uniform(0.06, 0.09), r.uniform(0, 6.3)))
    bumps = []
    if rag:
        x = r.uniform(-30, 0)
        while x < W + 30:
            w = r.uniform(26, 60) * size  # size — масштаб бугров: крупнее и реже
            bumps.append((x + w / 2, w, r.uniform(0.4, 1.0) * rag * amp * 1.6 * size ** 0.7))
            x += w * r.uniform(0.55, 0.85)  # бугры заходят друг на друга

    def y(x):
        v = sum(a * math.sin(f * x * math.tau / 2 + p) for a, f, p in waves)
        if style == 'peaks':
            v = -abs(v) * 1.1  # острее кверху
        for c, w, h in bumps:
            d = (x - c) / (w / 2)
            if abs(d) < 1:
                v -= h * math.cos(d * math.pi / 2) ** 1.2  # круглая шапка, мягкий край
        return round(base + v)
    return y


RAMP = ['#2E2E2E', '#2A2A2A', '#252525', '#212121', '#1C1C1C', '#161616', '#111111']


def render(style, seed, n=4, y_top=180, y_bot=296, rag=0.0, size=1.0, near_lift=0, front_from=None, soft=False):
    """n слоёв (2–7): гребни равномерно от y_top до y_bot, тоны — ступени
    RAMP от светлого (дальний) к тёмному (ближний); каждый слой туманом
    переходит в следующий тон вниз."""
    # тоны: небо тёмное сверху → светлее у горизонта
    sky_top, sky_low = rgb('#111111'), rgb('#1C1C1C')
    step = (len(RAMP) - 1) / max(1, n - 1) if n > 1 else 0
    tones = [RAMP[min(len(RAMP) - 1, round(i * step))] for i in range(n)]
    layers = []
    for i in range(n):
        base = y_top + (y_bot - y_top) * i / max(1, n - 1)
        if i == n - 1:
            base -= near_lift  # только ближний, самый тёмный слой
        low = RAMP[min(len(RAMP) - 1, RAMP.index(tones[i]) + 1)]
        layers.append((base, 10 + 8 * i / max(1, n - 1), tones[i], low))
    im = Image.new('RGB', (W, H))
    px = im.load()
    owner = [[-1] * W for _ in range(H)]  # какой слой нарисовал пиксель (−1 — небо)
    horizon = y_top
    for y in range(H):
        f = min(1, max(0, (y - 20) / (horizon - 20)))
        for x in range(W):
            px[x, y] = mix(sky_top, sky_low, f, x, y)
    fog = max(10, (y_bot - y_top) / max(1, n - 1))
    if soft:
        fog *= 1.8  # туман тянется дальше вниз — переход длиннее и мягче
    EDGE = 6 if soft else 0  # мягкий гребень: столько строк проступает дизером
    for i, (base, amp, top, low) in enumerate(layers):
        ry = ridge(seed * 10 + i, base, amp,
                   style if i < n - 1 or style != 'mixed' else 'soft',
                   rag if i == 0 else 0, size)  # бугры — только дальний гребень
        top, low = rgb(top), rgb(low)
        for x in range(W):
            y0 = max(0, ry(x))
            for y in range(max(0, y0 - EDGE), H):
                if y < y0:
                    # над гребнем слой проступает точками поверх того, что
                    # за ним, — кромка без резкой линии (как у мягкого солнца)
                    k = (y0 - y) / (EDGE + 1)
                    if BAYER[y % 4][x % 4] + 0.5 < (1 - k) * 8:
                        px[x, y] = top
                        owner[y][x] = i
                    continue
                f = min(1, (y - y0) / fog)  # туман: светлее у гребня, темнее вниз
                px[x, y] = mix(top, low, f, x, y)
                owner[y][x] = i
    if front_from is None:
        return im
    # Передний план: слои front_from… на прозрачном — кладётся поверх того,
    # что должно выходить из-за холма (восход на экране предсказания).
    front = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    fp = front.load()
    for y in range(H):
        for x in range(W):
            if owner[y][x] >= front_from:
                fp[x, y] = px[x, y] + (255,)
    return im, front


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('out')
    ap.add_argument('--style', default='soft', choices=['soft', 'peaks', 'mixed'])
    ap.add_argument('--seed', type=int, default=1)
    ap.add_argument('--layers', type=int, default=4, help='число слоёв холмов, 2–7')
    ap.add_argument('--top', type=int, default=180, help='гребень дальнего слоя, арт-px сверху')
    ap.add_argument('--bottom', type=int, default=296, help='гребень ближнего слоя')
    ap.add_argument('--rag', type=float, default=0.0, help='неровность дальнего гребня, 0..1')
    ap.add_argument('--size', type=float, default=1.0, help='размер бугров дальнего гребня')
    ap.add_argument('--near-lift', type=int, default=0, help='поднять только ближний слой, арт-px')
    ap.add_argument('--soft', action='store_true', help='мягкие гребни и длинный туман')
    ap.add_argument('--front', nargs=2, metavar=('СЛОЙ', 'ФАЙЛ'),
                    help='ещё и передний план: слои с номера СЛОЙ (0 — дальний) на прозрачном')
    a = ap.parse_args()
    front_from = int(a.front[0]) if a.front else None
    out = render(a.style, a.seed, a.layers, a.top, a.bottom, a.rag, a.size, a.near_lift, front_from, a.soft)
    if a.front:
        out[0].save(a.out)
        out[1].save(a.front[1])
        print(f'{a.front[1]}: передний план со слоя {front_from}')
    else:
        out.save(a.out)
    print(f'{a.out}: {W}×{H}, {a.style}, слоёв {a.layers}, seed {a.seed}')


if __name__ == '__main__':
    main()

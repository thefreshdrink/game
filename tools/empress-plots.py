#!/usr/bin/env python3
"""Клетки земли Императрицы: шесть ромбов 3×2 вплотную на точной сетке 2:1.

    python3 tools/empress-plots.py 32 DIR   # → DIR/block_dry.png, DIR/block_wet.png

В игре — public/assets/empress/plots_dry.png и plots_wet.png."""
import sys
from PIL import Image, ImageDraw
U, NI, NJ, SIDE = int(sys.argv[1]) if len(sys.argv) > 1 else 32, 3, 2, 6
OX, OY = NJ * U, 0
W, H = (NI + NJ) * U, (NI + NJ) * U // 2 + SIDE
def P(i, j): return (OX + (i - j) * U, OY + (i + j) * U // 2)
def hx(h): return tuple(int(h[k:k + 2], 16) for k in (1, 3, 5)) + (255,)
def render(top, fur, dot, seam, left, right, lip):
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    # боковые стенки блока — только снаружи (передние края)
    a, b = P(0, NJ), P(NI, NJ); d.polygon([a, b, (b[0], b[1] + SIDE), (a[0], a[1] + SIDE)], fill=hx(left))
    a, b = P(NI, 0), P(NI, NJ); d.polygon([a, b, (b[0], b[1] + SIDE), (a[0], a[1] + SIDE)], fill=hx(right))
    d.line([(P(0, NJ)[0], P(0, NJ)[1] + SIDE), (P(NI, NJ)[0], P(NI, NJ)[1] + SIDE), (P(NI, 0)[0], P(NI, 0)[1] + SIDE)], fill=hx(lip), width=1)
    d.polygon([P(0, 0), P(NI, 0), P(NI, NJ), P(0, NJ)], fill=hx(top))
    for i in range(NI):
        for j in range(NJ):
            # борозды — пунктиром вдоль оси i, три на клетку
            for k in (0.25, 0.5, 0.75):
                for t in range(3, U - 3, 3):
                    x0, y0 = P(i, j + k); x = x0 + t; y = y0 + t // 2
                    d.point((x, y), fill=hx(fur)); d.point((x + 1, y), fill=hx(fur))
            cx, cy = P(i + 0.5, j + 0.5)
            d.point((int(cx) - 6, int(cy) + 1), fill=hx(dot)); d.point((int(cx) + 5, int(cy) - 2), fill=hx(dot))
    # швы между клетками — тонко, тоном борозды
    for i in range(1, NI): d.line([P(i, 0), P(i, NJ)], fill=hx(seam))
    for j in range(1, NJ): d.line([P(0, j), P(NI, j)], fill=hx(seam))
    return im
render('#4A4A4A', '#2E2E2E', '#808080', '#2E2E2E', '#2E2E2E', '#1C1C1C', '#000000').save(sys.argv[2] + '/block_dry.png')
render('#2E2E2E', '#1C1C1C', '#4A4A4A', '#1C1C1C', '#1C1C1C', '#161616', '#000000').save(sys.argv[2] + '/block_wet.png')
print(W, H)

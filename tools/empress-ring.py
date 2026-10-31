#!/usr/bin/env python3
"""Светлая рамка-дорожка вокруг клеток Императрицы (кольцо в одну клетку).

    python3 tools/empress-ring.py 32 public/assets/empress/plots_ring.png"""
import sys, random
from PIL import Image, ImageDraw
U, NI, NJ = int(sys.argv[1]), 5, 4          # блок 3×2 + кольцо в одну клетку
OX = NJ * U; W, H = (NI + NJ) * U, (NI + NJ) * U // 2
def P(i, j): return (OX + (i - j) * U, (i + j) * U // 2)
def hx(h): return tuple(int(h[k:k + 2], 16) for k in (1, 3, 5)) + (255,)
im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im); r = random.Random(4)
for i in range(NI):
    for j in range(NJ):
        if 1 <= i <= 3 and 1 <= j <= 2: continue
        d.polygon([P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)], fill=hx('#252525'))
        for _ in range(40):  # камешки по пикселю внутри ромба
            u, v = r.uniform(0.15, 0.85), r.uniform(0.15, 0.85)
            x, y = P(i + u, j + v); x, y = int(x), int(y)
            c = hx(r.choice(['#2E2E2E', '#2E2E2E', '#1C1C1C']))
            d.point((x, y), fill=c)
im.save(sys.argv[2]); print(W, H)

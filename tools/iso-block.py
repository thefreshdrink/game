#!/usr/bin/env python3
"""Сажает сгенерированный брусок на ТОЧНУЮ изометрическую сетку 2:1.

Зачем. Генератор рисует «на глаз»: диагональ у него идёт то 2 пикселя вбок
на 1 вниз, то 3 на 1, и рёбра гуляют. В кладке это видно сразу — башня
собирается кривой. Сетка проекта не терпит полутонов (CLAUDE.md), поэтому
силуэт задаётся арифметикой, а не рисунком.

Что берётся из генерации: тон каждой грани и фактура внутри неё.
Что задаётся скриптом: силуэт, рёбра и палитра — то же «приведение к
канону», что делает card-art.py для портретов карт.

Геометрия бруска (арт-пиксели, всё чётное, в игре рисуется ×2):

    U0 = 16   шаг вправо на единицу глубины
    HU0 = 8   он же вниз — ровно 2:1
    ZH0 = 20  высота ряда

Длинный брусок 3×1 занимает 64×52 арт-пикселя.

    python3 tools/iso-block.py вход.png public/assets/tower/block.png
    python3 tools/iso-block.py --selftest
"""
import argparse
import sys
from PIL import Image, ImageDraw

# Зерно бруска задаётся одним числом — шагом U0. Крупнее зерно = меньше
# арт-пикселей и крупнее пиксель на экране: U0=8 даёт брусок 32×26,
# который в игре рисуется ×4 (как портреты карт), U0=16 — 64×52 на ×2.
U0, HU0, ZH0 = 8, 4, 10
DX, DY = 3, 1
W = H = OX = OY = 0


def set_unit(u):
    global U0, HU0, ZH0, W, H, OX, OY
    U0, HU0, ZH0 = u, u // 2, (u * 5) // 4
    W = (DX + DY) * U0
    H = (DX + DY) * HU0 + ZH0
    OX, OY = DY * U0, ZH0

PALETTE = [
    (0, 0, 0), (17, 17, 17), (35, 35, 35), (74, 74, 74),
    (128, 128, 128), (184, 184, 184), (255, 255, 255),
]
LINE = (255, 255, 255)
LINE2 = (184, 184, 184)

set_unit(8)


def P(x, y, z):
    """Точка мира в арт-пиксели. Целые числа по построению."""
    return (OX + (x - y) * U0, OY + (x + y) * HU0 - z * ZH0)


def faces():
    """Три видимые грани бруска: верх, передняя (слева), боковая (справа)."""
    top = [P(0, 0, 1), P(DX, 0, 1), P(DX, DY, 1), P(0, DY, 1)]
    front = [P(0, DY, 1), P(DX, DY, 1), P(DX, DY, 0), P(0, DY, 0)]
    right = [P(DX, 0, 1), P(DX, DY, 1), P(DX, DY, 0), P(DX, 0, 0)]
    return top, front, right


def silhouette():
    return [P(0, 0, 1), P(DX, 0, 1), P(DX, 0, 0), P(DX, DY, 0), P(0, DY, 0), P(0, DY, 1)]


def mask_of(poly):
    m = Image.new('L', (W, H), 0)
    ImageDraw.Draw(m).polygon(poly, fill=255)
    return m


def snap(c):
    lum = int(0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2])
    return min(PALETTE, key=lambda p: abs(p[0] - lum))


def median_tone(src, mask):
    """Основной тон грани по генерации — медиана яркости под маской."""
    vals = []
    sp, mp = src.load(), mask.load()
    for y in range(H):
        for x in range(W):
            if mp[x, y] < 128:
                continue
            r, g, b, a = sp[x, y]
            if a < 128:
                continue
            vals.append(int(0.3 * r + 0.59 * g + 0.11 * b))
    if not vals:
        return (35, 35, 35)
    vals.sort()
    return snap((vals[len(vals) // 2],) * 3)


def normalize(src):
    """Генерация → брусок ровно по сетке."""
    src = src.convert('RGBA').resize((W, H), Image.NEAREST)
    top, front, right = faces()
    out = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    op, sp = out.load(), src.load()

    for poly in (top, front, right):
        m = mask_of(poly)
        tone = median_tone(src, m)
        mp = m.load()
        for y in range(H):
            for x in range(W):
                if mp[x, y] < 128:
                    continue
                r, g, b, a = sp[x, y]
                # Фактура генерации сохраняется как есть — плоская заливка
                # тоном шла бы против стиля карт, где плоскость всегда с
                # крошкой. Тоном добиваются только дыры: там, где генератор
                # не дорисовал грань до края сетки.
                op[x, y] = (snap((r, g, b)) + (255,)) if a >= 128 else (tone + (255,))

    d = ImageDraw.Draw(out)
    d.line(silhouette() + [silhouette()[0]], fill=LINE + (255,), width=1)
    # Внутреннее ребро — вертикаль, где сходятся две видимые грани.
    d.line([P(DX, DY, 1), P(DX, DY, 0)], fill=LINE2 + (255,), width=1)
    d.line([P(0, DY, 1), P(DX, DY, 1)], fill=LINE2 + (255,), width=1)
    d.line([P(DX, 0, 1), P(DX, DY, 1)], fill=LINE2 + (255,), width=1)
    return out


def draw_block():
    """Рисует брусок по сетке — без генератора.

    Роли тонов сняты с уже существующего арта игры: дорога
    (`road/plat_tiles.png`) и портрет Башни держатся на тёмном теле
    `#232323`/`#4A4A4A`, светлой каменной верхушке `#808080` и белом
    контуре. Тот же набор и здесь, поэтому брусок читается как камень
    того же мира, а не как прозрачная коробка.
    """
    top, front, right = faces()
    out = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(out)
    d.polygon(top, fill=(128, 128, 128, 255))     # верх — свет
    d.polygon(front, fill=(74, 74, 74, 255))      # передняя грань — полутон
    d.polygon(right, fill=(35, 35, 35, 255))      # боковая — тень

    # Фактура камня: точки постоянные, не случайные от запуска к запуску.
    seed = 0
    op = out.load()

    def dot(x, y, c):
        if 0 <= x < W and 0 <= y < H and op[x, y][3] == 255:
            op[x, y] = c + (255,)

    for i in range(24):
        seed = (seed * 1103515245 + 12345) % (1 << 31)
        x = 3 + seed % (W - 6)
        seed = (seed * 1103515245 + 12345) % (1 << 31)
        y = 3 + seed % (H - 6)
        base = op[x, y][:3]
        if base == (128, 128, 128):
            dot(x, y, (184, 184, 184))            # блик на верхушке
        elif base == (74, 74, 74):
            dot(x, y, (128, 128, 128))
        elif base == (35, 35, 35):
            dot(x, y, (74, 74, 74))

    # Контур: белый силуэт и вторая линия под верхним ребром — двойная
    # линия из графического языка проекта (design-system §1).
    d.line(silhouette() + [silhouette()[0]], fill=LINE + (255,), width=1)
    d.line([P(0, DY, 1), P(DX, DY, 1)], fill=LINE + (255,), width=1)
    d.line([P(DX, 0, 1), P(DX, DY, 1)], fill=LINE + (255,), width=1)
    x0, y0 = P(0, DY, 1)
    x1, y1 = P(DX, DY, 1)
    d.line([(x0, y0 + 1), (x1, y1 + 1)], fill=LINE2 + (255,), width=1)
    d.line([P(DX, DY, 1), P(DX, DY, 0)], fill=LINE2 + (255,), width=1)
    return out


def selftest():
    set_unit(8)
    """Проверяем ровно то, ради чего скрипт существует: сетку и палитру."""
    im = draw_block()
    assert im.size == (W, H), im.size
    cols = {c[1][:3] for c in im.getcolors(9999) if c[1][3] == 255}
    assert cols <= set(PALETTE), f'цвет вне палитры: {cols - set(PALETTE)}'
    alphas = {c[1][3] for c in im.getcolors(9999)}
    assert alphas <= {0, 255}, f'полупрозрачные пиксели: {alphas}'
    # Главное: каждая диагональ идёт ровно 2 пикселя вбок на 1 вниз.
    # Шаг 1 допустим только в двух точках — там, где диагональ переходит
    # в вертикальную стенку бруска (левый и правый углы силуэта).
    px = im.load()
    left = []
    for y in range(H):
        xs = [x for x in range(W) if px[x, y][3] == 255]
        if xs:
            left.append(min(xs))
    steps = [abs(left[i + 1] - left[i]) for i in range(len(left) - 1)]
    assert set(steps) <= {0, 1, 2}, f'рваный край, шаги: {sorted(set(steps))}'
    corners = steps.count(1)
    assert corners <= 2, f'диагональ не 2:1: шагов по 1 пикселю — {corners}'
    print(f'selftest ok — {W}×{H}, палитра чистая, диагонали 2:1 (углов: {corners})')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src', nargs='?')
    ap.add_argument('dst', nargs='?')
    ap.add_argument('--selftest', action='store_true')
    ap.add_argument('--unit', type=int, default=8, help='шаг сетки: 8 → 32×26 (×4), 16 → 64×52 (×2)')
    ap.add_argument('--draw', action='store_true', help='нарисовать брусок по сетке, без генерации')
    a = ap.parse_args()
    set_unit(a.unit)
    if a.selftest:
        selftest()
        return
    if a.draw:
        if not a.dst and a.src:
            a.dst = a.src
        if not a.dst:
            ap.error('нужен выходной файл')
        draw_block().save(a.dst)
        print(f'{a.dst}: {W}×{H}, нарисован по сетке')
        return
    if not a.src or not a.dst:
        ap.error('нужны вход и выход')
    normalize(Image.open(a.src)).save(a.dst)
    print(f'{a.dst}: {W}×{H}')


if __name__ == '__main__':
    sys.exit(main())

#!/usr/bin/env python3
"""Плиты дороги из сгенерированного островка: одна команда от PNG генератора
до атласа столбиков и превью дороги рядом с Шутом.

Островок (вид сбоку, ровный верх) режется на столбики по 16 арт-px: первые
--cap — левый торец, последние --cap — правый. Середины — только столбики
ровной части низа, поэтому дорога любой длины = торец + середины + торец, и
плавное брюхо не ломается ступеньками. Для рваного низа хватает --cap 1. Ничего не дорисовывается: только кроп, выравнивание по
верху и раскладка столбиков (правило «никакой дорисовки руками»).

    python3 tools/island-tiles.py incoming/road/is1.png               # превью
    python3 tools/island-tiles.py incoming/road/is1.png --out public/assets/road/island_tiles.png

Атлас: [cap_l | mid_1 … mid_N | cap_r], ячейка 16 × высота островка.
Превью кладётся рядом с атласом: <имя>_preview.png (×4, фон #111111).
"""
import argparse
import random
from pathlib import Path

from PIL import Image

from palette import ALLOWED as PALETTE

CELL = 16
ROOT = Path(__file__).resolve().parent.parent
FOOL = ROOT / 'public/assets/fool/strips/fool_idle_4f_44x48.png'


def columns(im):
    """Обрезать островок по содержимому и разрезать на столбики CELL."""
    im = im.crop(im.getbbox())
    w, h0 = im.size
    h = h0 + h0 % 2  # высота чётная: прозрачная строка снизу
    n = max(3, round(w / CELL))
    # ширину приводим к n*CELL: лишнее срезаем поровну с краёв, нехватку
    # добираем прозрачным полем — пиксели не растягиваются
    canvas = Image.new('RGBA', (n * CELL, h), (0, 0, 0, 0))
    canvas.alpha_composite(im, ((n * CELL - w) // 2, 0)) if n * CELL >= w else \
        canvas.alpha_composite(im.crop(((w - n * CELL) // 2, 0, (w - n * CELL) // 2 + n * CELL, h)))
    return [canvas.crop((i * CELL, 0, (i + 1) * CELL, h)) for i in range(n)]


def check(cols):
    """Палитра и альфа — то же, что check-asset.py, но по столбикам."""
    bad = set()
    for c in cols:
        for p in c.get_flattened_data():
            if p[3] not in (0, 255):
                bad.add(f'альфа {p[3]}')
            elif p[3] == 255 and tuple(p[:3]) not in PALETTE:
                bad.add('#%02X%02X%02X' % p[:3])
    return sorted(bad)


def middles(cols, cap):
    """Середины: только ровная часть брюха. Столбики между торцами, у
    которых нижний край не дальше 2 px от самого глубокого, — так плавный
    низ не ломается ступеньками при случайной раскладке."""
    inner = cols[cap:len(cols) - cap] or cols[1:-1]
    depth = [c.getbbox()[3] if c.getbbox() else 0 for c in inner]
    best = max(depth)
    return [c for c, d in zip(inner, depth) if best - d <= 2]


def road(cols, mids, rng, cap=1):
    """Одна плита: торец (cap столбиков) + mids середин + торец."""
    pool = middles(cols, cap)
    parts = cols[:cap] + [rng.choice(pool) for _ in range(mids)] + cols[len(cols) - cap:]
    h = cols[0].height
    out = Image.new('RGBA', (CELL * len(parts), h), (0, 0, 0, 0))
    for i, p in enumerate(parts):
        out.alpha_composite(p, (i * CELL, 0))
    return out


def preview(cols, seed, cap=1):
    rng = random.Random(seed)
    fool = Image.open(FOOL).convert('RGBA').crop((0, 0, 44, 48))
    h = cols[0].height
    plates = [road(cols, m, rng, cap) for m in (1, 4, 2, 5)]
    W, H = 215, 48 + 2 * (h + 24) + 8
    scene = Image.new('RGBA', (W, H), '#111111')
    # дорога вниз-вправо, как у Шута: две плиты в ряд, ниже ещё две
    y = 48 + 4
    scene.alpha_composite(fool, (12, y - 48))
    scene.alpha_composite(plates[0], (4, y))
    scene.alpha_composite(plates[1], (4 + plates[0].width + 24, y + 12))
    y2 = y + h + 20
    scene.alpha_composite(plates[2], (30, y2))
    scene.alpha_composite(plates[3], (30 + plates[2].width + 20, y2 + 10))
    return scene.resize((W * 4, H * 4), Image.NEAREST)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src')
    ap.add_argument('--out', help='куда положить атлас (по умолчанию рядом с src)')
    ap.add_argument('--seed', type=int, default=1)
    ap.add_argument('--cap', type=int, default=1,
                    help='ширина торца в столбиках: 2–3 для плавного брюха, весь изгиб уходит в торец')
    a = ap.parse_args()
    src = Path(a.src)
    cols = columns(Image.open(src).convert('RGBA'))
    bad = check(cols)
    out = Path(a.out) if a.out else src.with_name(src.stem + '_tiles.png')
    atlas = Image.new('RGBA', (CELL * len(cols), cols[0].height), (0, 0, 0, 0))
    for i, c in enumerate(cols):
        atlas.alpha_composite(c, (i * CELL, 0))
    atlas.save(out)
    prev = out.with_name(out.stem + '_preview.png')
    preview(cols, a.seed, a.cap).save(prev)
    print(f'{"✗" if bad else "✓"} {out.name}: {len(cols)} столбиков '
          f'(торцы по {a.cap}, ровных середин {len(middles(cols, a.cap))}), {atlas.width}×{atlas.height}'
          + (f'; чужое: {", ".join(bad)}' if bad else ''))
    print(f'  превью: {prev}')


if __name__ == '__main__':
    main()

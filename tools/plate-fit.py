#!/usr/bin/env python3
"""Целые плиты дороги Шута: одна команда от PNG генератора до плиты ровно
нужной ширины и превью всей дороги.

Плиты не собираются из кусочков — у каждой ширины дороги своя плита целиком,
поэтому форма низа не ломается на стыках. Генератор рисует плиту на холсте
чуть шире нужного; скрипт обрезает пустое поле, проверяет, что ширина плиты
отличается от нужной не больше чем на --tol арт-px, и кладёт её по центру
холста ровно нужной ширины. Пиксели не растягиваются и не дорисовываются.

Линия ходьбы — первая строка сверху, где непрозрачно больше половины ширины.
Всё, что выше неё, — выступы над поверхностью; их быть не должно (плита
«чистая сверху»), скрипт об этом предупреждает.

    python3 tools/plate-fit.py 64 incoming/road/plates/p64_a.png
    python3 tools/plate-fit.py 64 вход.png --out public/assets/road/plate_64_a.png
    python3 tools/plate-fit.py --road incoming/road/plates/fit   # превью дороги

Ширины дороги (арт-px) — из src/minigames/fool/platforms.js: 64, 80, 112, 192.
"""
import argparse
import re
from pathlib import Path

from PIL import Image

from palette import ALLOWED as PALETTE

ROOT = Path(__file__).resolve().parent.parent
FOOL = ROOT / 'public/assets/fool/strips/fool_idle_4f_44x48.png'
PLATFORMS = ROOT / 'src/minigames/fool/platforms.js'


def walk_line(im):
    """Первая строка, где плита занимает больше половины ширины."""
    w, h = im.size
    px = im.load()
    for y in range(h):
        if sum(px[x, y][3] == 255 for x in range(w)) > w // 2:
            return y
    return 0


def fit(target, src, tol):
    im = Image.open(src).convert('RGBA')
    box = im.getbbox()
    problems = []
    if box[0] == 0 or box[2] == im.width:
        problems.append('плита касается края холста — генератор её обрезал, перегенерировать')
    im = im.crop(box)
    w, h = im.size
    if abs(w - target) > tol:
        problems.append(f'ширина {w}, нужна {target} (±{tol}) — перегенерировать')
    top = walk_line(im)
    if top > 0:
        problems.append(f'над линией ходьбы {top} строк выступов — сверху должно быть чисто')
    for p in im.get_flattened_data():
        if p[3] not in (0, 255):
            problems.append('полупрозрачные пиксели')
            break
        if p[3] == 255 and tuple(p[:3]) not in PALETTE:
            problems.append('#%02X%02X%02X не из палитры' % p[:3])
            break
    out = Image.new('RGBA', (target, h + h % 2), (0, 0, 0, 0))
    out.alpha_composite(im.crop(((w - target) // 2, 0, (w - target) // 2 + target, h))
                        if w > target else im, (max(0, (target - w) // 2), 0))
    return out, top, problems


def road_layout():
    """dy и ширины плит из platforms.js (экранные px → арт-px)."""
    src = PLATFORMS.read_text()
    p1 = int(re.search(r'P1_WIDTH = (\d+)', src).group(1))
    gaps = {k: int(v) for k, v in re.findall(r'const (G_[AB]) = (\d+)', src)}
    rows = []
    for m in re.finditer(r'\{ dy: (-?\d+),\s+w: (\w+)(?:, gap: (G_[AB]))?', src):
        dy, w, g = m.groups()
        rows.append((int(dy) // 2, (p1 if w == 'P1_WIDTH' else int(w)) // 2,
                     gaps.get(g, 0) // 2))
    return rows


def road_preview(folder):
    """Вся дорога Шута: на каждую плиту — подогнанный файл её ширины
    (варианты _a, _b чередуются), Шут на первой."""
    files = {}
    for f in sorted(Path(folder).glob('plate_*_*.png')):
        files.setdefault(int(f.stem.split('_')[1]), []).append(Image.open(f).convert('RGBA'))
    rows = road_layout()
    xs, ys, x, y = [], [], 8, 0
    for dy, w, gap in rows:
        x += gap
        y += dy
        xs.append(x)
        ys.append(y)
        x += w
    top = min(ys)
    H = max(ys) - top + 48 + 64
    scene = Image.new('RGBA', (x + 8, H), '#111111')
    used = {}
    for (dy, w, gap), px, py in zip(rows, xs, ys):
        pool = files.get(w)
        if not pool:
            continue
        i = used.get(w, 0)
        used[w] = i + 1
        plate = pool[i % len(pool)]
        scene.alpha_composite(plate, (px, py - top + 52 - walk_line(plate)))
    fool = Image.open(FOOL).convert('RGBA').crop((0, 0, 44, 48))
    scene.alpha_composite(fool, (xs[0] + 16, ys[0] - top + 52 - 48))
    return scene.resize((scene.width * 2, scene.height * 2), Image.NEAREST)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('width', nargs='?', type=int)
    ap.add_argument('src', nargs='?')
    ap.add_argument('--out')
    ap.add_argument('--tol', type=int, default=6)
    ap.add_argument('--road', metavar='ПАПКА', help='превью всей дороги из plate_<ширина>_*.png')
    a = ap.parse_args()
    if a.road:
        out = Path(a.road) / 'road_preview.png'
        road_preview(a.road).save(out)
        print(f'превью дороги: {out}')
        return
    src = Path(a.src)
    plate, top, problems = fit(a.width, src, a.tol)
    out = Path(a.out) if a.out else src.with_name(f'plate_{a.width}_{src.stem}.png')
    plate.save(out)
    print(f'{"✗" if problems else "✓"} {out.name}: {plate.width}×{plate.height}, '
          f'линия ходьбы y={top}' + (''.join(f'\n    {p}' for p in problems)))


if __name__ == '__main__':
    main()

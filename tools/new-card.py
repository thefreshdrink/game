#!/usr/bin/env python3
"""Портрет новой карты: одна команда от скачанного PNG генератора до файла
в public/assets/card/<id>_on_the_card.png, прошедшего check-asset.py.

Рецепт и выбор инструмента — docs/art-recipe.md. Делает то же, что
design-system/card-art.py --scale 4 из архива, но внутри проекта и с
палитрой из tools/palette.py:

  1. снимает целочисленный апскейл генератора;
  2. альфа только 0/255;
  3. --invert: светлое тело → тёмное (акцент не трогается);
  4. снап в палитру; --accent-above добирает акцент, если его нет вовсе;
  5. кроп по силуэту, чётные размеры, ×4 Nearest (зерно портрета);
  6. проверяет, что портрет влезает в окно карты 188×212;
  7. пишет файл и прогоняет check-asset.py.

Несколько PNG без --pick — контактный лист art-source/wip/<id>_grid.png
с номерами, файл в игру не пишется. С --pick N — берётся N-й (с 1).

    python3 tools/new-card.py hermit скачанный.png
    python3 tools/new-card.py hermit a.png b.png c.png          # лист
    python3 tools/new-card.py hermit a.png b.png c.png --pick 2
    python3 tools/new-card.py --selftest
"""
import argparse
import importlib.util
import os
import sys
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..'))
sys.path.insert(0, HERE)
from palette import CANON, STONE_DARK, ACCENT  # tools/palette.py

GRAIN = 4                 # экранных px на арт-пиксель портрета (2026-09-28)
WINDOW = (188, 212)       # окно портрета на лице карты, ASSETS.md
PAL = sorted(CANON | {STONE_DARK})


def _check_asset():
    spec = importlib.util.spec_from_file_location('check_asset', os.path.join(HERE, 'check-asset.py'))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


CHECK = _check_asset()


def nearest(c, pal):
    """@param c RGB  @returns ближайший цвет палитры"""
    return min(pal, key=lambda p: (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2)


def process(im, invert=False, accent_above=None, keep_accent=True):
    """@returns (портрет в арт-пикселях, найденный апскейл входа)"""
    pal = PAL if keep_accent else [p for p in PAL if p != ACCENT]
    im = im.convert('RGBA')
    f = CHECK.block_factor(im)
    if f > 1:
        im = im.resize((im.width // f, im.height // f), Image.NEAREST)
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            px[x, y] = (r, g, b, 255) if a >= 128 else (0, 0, 0, 0)

    # акцент «это можно тронуть» не зависит от тона — ни инверсии, ни снапа
    accent = {(x, y) for y in range(h) for x in range(w)
              if px[x, y][3] and nearest(px[x, y][:3], pal) == ACCENT}
    if invert:
        for y in range(h):
            for x in range(w):
                r, g, b, a = px[x, y]
                if a and (x, y) not in accent:
                    px[x, y] = (255 - r, 255 - g, 255 - b, 255)
    if accent_above is not None and not accent:
        cut = int(h * accent_above)
        lum = [(0.299 * px[x, y][0] + 0.587 * px[x, y][1] + 0.114 * px[x, y][2], x, y)
               for y in range(cut) for x in range(w) if px[x, y][3]]
        if lum:
            hi = max(l for l, _, _ in lum)
            accent |= {(x, y) for l, x, y in lum if l >= hi - 24}
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a:
                px[x, y] = (*ACCENT, 255) if (x, y) in accent else (*nearest((r, g, b), pal), 255)

    bb = im.getbbox()
    if bb:
        im = im.crop(bb)
        pw, ph = im.width + im.width % 2, im.height + im.height % 2
        if (pw, ph) != im.size:
            pad = Image.new('RGBA', (pw, ph), (0, 0, 0, 0))
            pad.alpha_composite(im)
            im = pad
    return im, f


def portrait(path, a):
    """@returns портрет ×GRAIN, готовый к записи"""
    art, f = process(Image.open(path), invert=a.invert, accent_above=a.accent_above,
                     keep_accent=not a.no_accent)
    out = art.resize((art.width * GRAIN, art.height * GRAIN), Image.NEAREST)
    print(f'  {os.path.basename(path)}: вход ×{f} → {art.width}×{art.height} арт-px → {out.width}×{out.height}')
    return out


def contact_sheet(card_id, imgs):
    """@returns путь к листу с номерами"""
    pad, cw, ch = 16, WINDOW[0], WINDOW[1]
    sheet = Image.new('RGB', (pad + len(imgs) * (cw + pad), ch + 2 * pad + 20), (0x11, 0x11, 0x11))
    d = ImageDraw.Draw(sheet)
    for i, im in enumerate(imgs):
        x = pad + i * (cw + pad)
        d.rectangle([x, pad, x + cw - 1, pad + ch - 1], fill=(0x1C, 0x1C, 0x1C))
        sheet.paste(im, (x + (cw - im.width) // 2, pad + (ch - im.height) // 2), im)
        d.text((x + cw // 2 - 4, pad + ch + 4), str(i + 1), fill=(0xFF, 0xFF, 0xFF))
    out = os.path.join(ROOT, 'art-source', 'wip', f'{card_id}_grid.png')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    sheet.save(out)
    return out


def selftest():
    """Готовый портрет из игры, снова прогнанный через конвейер, не меняется."""
    ok = True
    for card_id in ('magician', 'wheel', 'empress', 'tower'):
        src = os.path.join(ROOT, 'public', 'assets', 'card', f'{card_id}_on_the_card.png')
        before = Image.open(src).convert('RGBA')
        art, f = process(before)
        after = art.resize((art.width * GRAIN, art.height * GRAIN), Image.NEAREST)
        same = after.size == before.size and after.tobytes() == before.tobytes()
        print(f'{card_id}: вход ×{f}, {"совпало" if same else "РАЗОШЛОСЬ"} {before.size} → {after.size}')
        ok &= same and f == GRAIN
    print('SELFTEST', 'PASS' if ok else 'FAIL')
    return 0 if ok else 1


def main():
    ap = argparse.ArgumentParser(description='PNG генератора → портрет карты в public/assets/card/')
    ap.add_argument('id', nargs='?', help='id карты из cards.js: hermit, star …')
    ap.add_argument('src', nargs='*', help='скачанные PNG')
    ap.add_argument('--pick', type=int, help='номер кадра из контактного листа (с 1)')
    ap.add_argument('--invert', action='store_true', help='светлое тело → тёмное')
    ap.add_argument('--accent-above', type=float, default=None,
                    help='доля высоты сверху, где самое светлое красится в акцент, если его нет')
    ap.add_argument('--no-accent', action='store_true', help='убрать акцент из палитры снапа')
    ap.add_argument('--force', action='store_true', help='перезаписать существующий портрет')
    ap.add_argument('--selftest', action='store_true')
    a = ap.parse_args()
    if a.selftest:
        return selftest()
    if not (a.id and a.src):
        ap.error('нужны id карты и хотя бы один PNG')

    if len(a.src) > 1 and not a.pick:
        sheet = contact_sheet(a.id, [portrait(p, a) for p in a.src])
        print(f'лист: {os.path.relpath(sheet, ROOT)}\nвыбор: та же команда с --pick N')
        return 0
    src = a.src[(a.pick or 1) - 1]
    out = portrait(src, a)
    if out.width > WINDOW[0] or out.height > WINDOW[1]:
        print(f'✗ {out.width}×{out.height} не влезает в окно {WINDOW[0]}×{WINDOW[1]} — '
              f'фигура больше {WINDOW[0] // GRAIN}×{WINDOW[1] // GRAIN} арт-px, нужен холст меньше')
        return 1
    dst = os.path.join(ROOT, 'public', 'assets', 'card', f'{a.id}_on_the_card.png')
    if os.path.exists(dst) and not a.force:
        print(f'✗ {os.path.relpath(dst, ROOT)} уже есть — заменить: --force')
        return 1
    out.save(dst)
    if not CHECK.check(dst):
        os.remove(dst)
        print('✗ проверка не пройдена — файл не оставлен')
        return 1
    cards = open(os.path.join(ROOT, 'src', 'data', 'cards.js')).read()
    if f"id: '{a.id}'" not in cards:
        print(f'  записи {a.id} в src/data/cards.js нет — тексты нужны до раздачи')
    print(f'готово: {os.path.relpath(dst, ROOT)}')
    return 0


if __name__ == '__main__':
    sys.exit(main())

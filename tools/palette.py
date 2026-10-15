"""Палитра проекта — один источник для всех скриптов в tools/.

Канон — таблица в CLAUDE.md и docs/design-system.md; если она меняется,
правится этот файл, а не копии в скриптах. Цвета — RGB-кортежи, имена —
роли из таблицы.
"""


def _rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


AIR = _rgb('#111111')          # фон / воздух
BODY = _rgb('#000000')         # тело объекта, темнее воздуха
LINE = _rgb('#FFFFFF')         # главный контур
LINE2 = _rgb('#B8B8B8')        # вторая линия двойного контура
FAR = _rgb('#4A4A4A')          # дальняя деталь
TEXTURE = _rgb('#808080')      # текстура, пунктир
VOID = tuple(_rgb(h) for h in (  # градации пустоты
    '#161616', '#1C1C1C', '#212121', '#252525', '#2A2A2A', '#2E2E2E'))
ACCENT = _rgb('#EBA331')       # «это можно тронуть»
GOLD_SHADE = _rgb('#B07A1C')   # тень золота — бруски и корона Башни, 2026-09-28

# Исключения, принятые сознательно (CLAUDE.md, «Визуал»)
STONE_DARK = _rgb('#232323')   # каменный тайлсет дороги, 2026-08-27
STONE_LIGHT = _rgb('#A0A0A0')  # он же

CANON = {AIR, BODY, LINE, LINE2, FAR, TEXTURE, *VOID, ACCENT, GOLD_SHADE}
EXCEPTIONS = {STONE_DARK, STONE_LIGHT}
ALLOWED = CANON | EXCEPTIONS   # всё, что может встретиться в ассете

# Серая лестница, к которой iso-block.py приводит тон грани бруска
# (по яркости, от тёмного к светлому). Подмножество ALLOWED.
GREY_RAMP = [BODY, AIR, STONE_DARK, FAR, TEXTURE, LINE2, LINE]

assert set(GREY_RAMP) <= ALLOWED

# -*- coding: utf-8 -*-
from PIL import Image

SRC = r"d:\Program Files\code\new_game\日式治愈系校园图标风格指南.png"
im = Image.open(SRC).convert("RGB")
w, h = im.size
pix = im.load()

print("size", w, h)
for y in range(0, h, 4):
    blue = 0
    content = 0
    n = 0
    for x in range(450, min(1500, w)):
        r, g, b = pix[x, y]
        n += 1
        if b > 140 and b > r + 15 and b > g - 10:
            blue += 1
        if (r + g + b) / 3 < 245:
            content += 1
    br = blue / n
    cr = content / n
    if br > 0.025 or cr > 0.32:
        print(f"y={y:4d} blue={br:.3f} content={cr:.3f}")

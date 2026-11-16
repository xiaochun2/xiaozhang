# -*- coding: utf-8 -*-
"""Crop campus soft icons from the style guide sheet."""
from __future__ import annotations

import os
from PIL import Image, ImageOps, ImageFilter, ImageChops

SRC = r"d:\Program Files\code\new_game\日式治愈系校园图标风格指南.png"
OUT = r"d:\Program Files\code\new_game\public\game-assets\assets\icons\campus"
os.makedirs(OUT, exist_ok=True)

im = Image.open(SRC).convert("RGB")

for f in os.listdir(OUT):
    if f.endswith(".png"):
        os.remove(os.path.join(OUT, f))


def trim_content(img: Image.Image, threshold: int = 250, pad: int = 2) -> Image.Image:
    gray = img.convert("L")
    mask = gray.point(lambda p: 255 if p < threshold else 0)
    bbox = mask.getbbox()
    if not bbox:
        return img
    x0, y0, x1, y1 = bbox
    return img.crop(
        (
            max(0, x0 - pad),
            max(0, y0 - pad),
            min(img.width, x1 + pad),
            min(img.height, y1 + pad),
        )
    )


def export_square(img: Image.Image, path: str, size: int = 128) -> None:
    img = trim_content(img).convert("RGBA")
    datas = []
    for r, g, b, a in img.getdata():
        if r > 248 and g > 248 and b > 248:
            datas.append((255, 255, 255, 0))
        else:
            datas.append((r, g, b, a))
    img.putdata(datas)
    img = ImageOps.contain(img, (size, size), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(img, ((size - img.width) // 2, (size - img.height) // 2), img)
    canvas.save(path)


def find_icon_boxes(band: Image.Image, expected: int, min_gap: int = 8) -> list[tuple[int, int, int, int]]:
    """Find roughly equal icon clusters by column content density."""
    gray = band.convert("L")
    w, h = gray.size
    # icon area only (drop labels)
    icon_h = int(h * 0.78)
    cols = []
    for x in range(w):
        dark = 0
        for y in range(icon_h):
            if gray.getpixel((x, y)) < 245:
                dark += 1
        cols.append(dark / max(1, icon_h))

    # smooth
    smooth = cols[:]
    for i in range(2, w - 2):
        smooth[i] = sum(cols[i - 2 : i + 3]) / 5

    threshold = 0.08
    regions = []
    in_run = False
    start = 0
    for x, v in enumerate(smooth):
        if v >= threshold and not in_run:
            in_run = True
            start = x
        elif v < threshold and in_run:
            in_run = False
            if x - start >= 18:
                regions.append((start, x))
    if in_run and w - start >= 18:
        regions.append((start, w))

    # merge nearby
    merged = []
    for a, b in regions:
        if not merged or a - merged[-1][1] > min_gap:
            merged.append([a, b])
        else:
            merged[-1][1] = b

    # if too many, keep widest `expected`
    merged = sorted(merged, key=lambda ab: ab[1] - ab[0], reverse=True)[:expected]
    merged = sorted(merged, key=lambda ab: ab[0])

    boxes = []
    for a, b in merged:
        pad = 4
        boxes.append((max(0, a - pad), 0, min(w, b + pad), icon_h))
    return boxes


def split_and_save(x0: int, x1: int, y0: int, y1: int, names: list[str], tag: str) -> None:
    band = im.crop((x0, y0, x1, y1))
    band.save(os.path.join(OUT, f"_band_{tag}.png"))
    boxes = find_icon_boxes(band, len(names))
    print(tag, "boxes", len(boxes), "expected", len(names))
    # fallback equal split if detection fails
    if len(boxes) != len(names):
        bw, bh = band.size
        n = len(names)
        icon_h = int(bh * 0.78)
        boxes = []
        for i in range(n):
            cx0 = int(bw * i / n) + 2
            cx1 = int(bw * (i + 1) / n) - 2
            boxes.append((cx0, 0, cx1, icon_h))
    for name, box in zip(names, boxes):
        cell = band.crop(box)
        export_square(cell, os.path.join(OUT, f"{name}.png"))
        print("saved", name)


split_and_save(470, 1490, 148, 228, ["nav-overview", "nav-tasks", "nav-school", "nav-teachers", "nav-apply"], "nav")
split_and_save(60, 1510, 495, 590, ["home", "search", "filter", "settings", "notice", "calendar", "reward", "help", "help-alt", "more"], "base")
split_and_save(60, 1510, 685, 790, ["education", "build", "recruit", "train", "growth", "assess", "funds", "coop", "mail"], "game")
split_and_save(60, 1510, 880, 975, ["ok", "warn", "error", "star", "heart", "progress", "wait", "play", "pause"], "status")

# back from left arrow in more
more = Image.open(os.path.join(OUT, "more.png"))
export_square(more.crop((0, 0, more.width // 2 + 8, more.height)), os.path.join(OUT, "back.png"))

aliases = {
    "cap": "education",
    "coin": "funds",
    "score": "star",
    "teachers": "nav-teachers",
    "school": "nav-school",
    "tasks": "nav-tasks",
    "apply": "nav-apply",
    "overview": "nav-overview",
    "teach": "train",
    "book": "train",
    "inspect": "search",
    "office": "nav-tasks",
    "students": "recruit",
    "donate": "funds",
    "gov": "coop",
    "world": "growth",
    "campus": "build",
    "go": "play",
    "voice": "mail",
    "shield": "ok",
}
for alias, src in aliases.items():
    Image.open(os.path.join(OUT, f"{src}.png")).save(os.path.join(OUT, f"{alias}.png"))

print("done")

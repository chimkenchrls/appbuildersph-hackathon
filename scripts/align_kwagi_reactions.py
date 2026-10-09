"""Align the web reaction atlas with the forward-facing direction frame.

Run after rebuilding the atlases with the page-mascot skill, so Kwagi does not shift or
change size when a click swaps the direction frame for a reaction frame.
Needs Pillow and NumPy:  python3 scripts/align_kwagi_reactions.py
"""
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent / "public" / "mascots"
CELL = 360
FORWARD = 4  # centre cell of the directions atlas
PLAIN = [0, 3, 4, 5, 6, 7, 8]  # reaction cells with no symbol above the head


def box(cell):
    ys, xs = np.where(np.array(cell)[:, :, 3] > 40)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def crop(sheet, index):
    x, y = (index % 3) * CELL, (index // 3) * CELL
    return sheet.crop((x, y, x + CELL, y + CELL))


def main():
    directions = Image.open(ROOT / "kwagi-directions.webp").convert("RGBA")
    reactions = Image.open(ROOT / "kwagi-reactions.webp").convert("RGBA")
    target = box(crop(directions, FORWARD))
    boxes = np.array([box(crop(reactions, i)) for i in PLAIN], dtype=float)
    left, top, right, bottom = np.median(boxes, axis=0)
    scale = (target[2] - target[0]) / (right - left)
    # Match the horizontal centre and the bottom edge, where he stands.
    dx = (target[0] + target[2]) / 2 - scale * (left + right) / 2
    dy = target[3] - scale * bottom
    if abs(scale - 1) < 0.004 and abs(dx) < 0.75 and abs(dy) < 0.75:
        print("already aligned")
        return
    out = Image.new("RGBA", reactions.size, (0, 0, 0, 0))
    for i in range(9):
        # Inverse map for Image.transform: source = (output - offset) / scale.
        moved = crop(reactions, i).transform(
            (CELL, CELL), Image.Transform.AFFINE,
            (1 / scale, 0, -dx / scale, 0, 1 / scale, -dy / scale), resample=Image.Resampling.BICUBIC,
        )
        out.paste(moved, ((i % 3) * CELL, (i // 3) * CELL))
    out.save(ROOT / "kwagi-reactions.webp", quality=92, method=6)
    print(f"aligned: scale {scale:.3f}, shift {dx:.1f}, {dy:.1f}")


if __name__ == "__main__":
    main()

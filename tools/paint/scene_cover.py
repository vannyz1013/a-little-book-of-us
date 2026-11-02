"""Home page art: the garden, and the book's painted cover."""
import math

import numpy as np

import botanicals as b
from watercolor import Canvas, hex_rgb, smooth, transform


def blob(w, h, x, y, rng, points=9):
    angles = np.linspace(0, 2 * math.pi, points + 1)[:-1]
    radii = rng.uniform(0.82, 1.12, points)
    return smooth(np.stack([np.cos(angles) * w * radii + x, np.sin(angles) * h * radii + y], 1), steps=3)


def hill(c, width, base, peaks, color, color2, strength, height, clear=0.0):
    top = [(-60, base)] + [(x * width, base - rise * height) for x, rise in peaks] + [(width + 60, base)]
    curve = smooth(top, closed=False, steps=10)
    polygon = np.concatenate([curve, [(width + 60, c.h + 60), (-60, c.h + 60)]])
    if clear:
        # Thin the sky behind it, so cool colours don't mix to grey.
        c.lift(polygon + np.array([0, 14], np.float32), clear, soft=12)
    c.wash(polygon, color, color2, strength=strength, wobble=0.006, layers=10, edge=0.3, bloom=0.5, direction=1.57)


def tree(c, x, y, spread, rng, tones):
    trunk = smooth([(x - 7, y), (x - 3, y - spread * 0.7), (x + 4, y - spread * 1.1)], closed=False, steps=6)
    c.wash(b.ribbon(trunk, spread * 0.06, spread * 0.02), b.SLATE_SOFT, b.MINT_DEEP, strength=0.35, layers=5, wobble=0.01)
    for _ in range(26):
        angle = rng.uniform(0, 2 * math.pi)
        distance = rng.uniform(0.1, 1.0) ** 0.6
        px = x + math.cos(angle) * spread * distance * 1.05
        py = y - spread * 1.45 + math.sin(angle) * spread * distance * 0.85
        size = spread * rng.uniform(0.2, 0.42)
        tone = tones[rng.integers(len(tones))]
        c.wash(blob(size, size * 0.8, px, py, rng), tone[0], tone[1], strength=rng.uniform(0.16, 0.32), wobble=0.07, layers=8, edge=0.45, bloom=0.7)


def meadow(c, width, ground, rng, scale):
    """Light drifts of wildflowers at both edges; the middle stays open."""
    bottom = c.h
    for i in range(78):
        side = i % 2
        reach = rng.uniform(0, 1) ** 1.3 * 0.42
        x = (reach if side == 0 else 1 - reach) * width
        depth = rng.uniform(0, 1) ** 0.7
        y = ground + depth * (bottom - ground) + 30
        # Flowers grow taller and larger towards the viewer.
        nearness = 0.55 + 0.75 * depth
        height = rng.uniform(100, 230) * scale * nearness
        lean = rng.uniform(-0.2, 0.2) + (0.12 if side == 0 else -0.12)
        size = nearness * scale
        kind = rng.integers(8)
        if kind <= 1:
            b.lavender(c, x, y, height * 1.2, lean)
        elif kind == 2:
            b.flowering_stem(c, x, y, height, lean, b.cosmos, rng.uniform(24, 34) * size)
        elif kind == 3:
            b.flowering_stem(c, x, y, height, lean, b.cosmos, rng.uniform(22, 32) * size, b.POWDER, b.POWDER_DEEP)
        elif kind == 4:
            b.flowering_stem(c, x, y, height, lean, b.forget_me_not, rng.uniform(26, 38) * size)
        elif kind == 5:
            b.flowering_stem(c, x, y, height, lean, b.daisy, rng.uniform(18, 28) * size)
        elif kind == 6:
            b.fern(c, [(x, y), (x + height * lean, y - height * 0.6), (x + height * lean * 2.2, y - height * 1.05)], leaf_size=30 * size, count=9, color=b.MINT_SOFT, color2=b.MINT_DEEP)
        else:
            b.eucalyptus(c, [(x, y), (x + height * lean, y - height * 0.55), (x + height * lean * 2, y - height)], leaf_size=22 * size, count=6, color=b.MINT_SOFT, color2=b.MINT)


def fade_to_paper(c, start):
    """The painting dissolves into bare paper, the way a vignette is painted."""
    ramp = np.clip((np.arange(c.h, dtype=np.float32) - start) / max(c.h - start, 1), 0, 1)
    ramp = ramp * ramp * (3 - 2 * ramp)
    noise = c._tile(c.coarse, c.h, c.w)
    keep = np.clip(1 - ramp[:, None] * (1.05 + (noise - 0.5) * 0.9), 0, 1)
    c.D *= keep[..., None]


def paint_garden(path, width, height, seed, scale=1.0):
    c = Canvas(width, height, seed)
    rng = c.rng
    horizon = int(height * 0.6)

    # Sky: powder blue melting into lavender, with clouds lifted out of the wash.
    c.wash([(-80, -80), (width + 80, -80), (width + 80, horizon + 90), (-80, horizon + 90)], b.POWDER, b.PALE_LAVENDER, strength=0.72, wobble=0.012, layers=8, edge=0.08, bloom=0.4, direction=1.57)
    for _ in range(7):
        c.lift(blob(width * rng.uniform(0.1, 0.24), height * rng.uniform(0.03, 0.06), rng.uniform(0, width), rng.uniform(0.08, 0.42) * height, rng), 0.6, soft=26)

    hill(c, width, horizon + 8, [(0.12, 0.8), (0.34, 0.42), (0.6, 0.72), (0.86, 0.5)], b.LAVENDER, b.POWDER, 0.55, height * 0.1, clear=0.7)
    hill(c, width, horizon + 58, [(0.2, 0.5), (0.52, 0.9), (0.8, 0.46)], b.POWDER, b.MINT_PALE, 0.5, height * 0.08, clear=0.85)

    tones = [(b.MINT_PALE, b.POWDER), (b.PALE_LAVENDER, b.LAVENDER), (b.MINT_SOFT, b.MINT)]
    tree(c, width * 0.06, horizon + 70, width * 0.075, rng, tones)
    tree(c, width * 0.95, horizon + 76, width * 0.085, rng, tones)

    ground = horizon + int(height * 0.05)
    hill(c, width, ground + 44, [(0.16, 0.7), (0.5, 0.35), (0.84, 0.75)], b.MINT, b.MINT_PALE, 0.62, height * 0.08, clear=0.92)
    fade_to_paper(c, ground + 40)

    meadow(c, width, ground + int(height * 0.1), rng, scale)
    c.save(path, opaque=True, quality=80)


def paint_book_cover(path):
    width, height = 760, 1000
    c = Canvas(width, height, 41)
    c.wash([(-40, -40), (width + 40, -40), (width + 40, height + 40), (-40, height + 40)], b.PALE_LAVENDER, b.LAVENDER, strength=1.05, wobble=0.012, layers=8, edge=0.1, bloom=0.3, direction=1.2)

    # Reserve an oval of bare paper for the title.
    cx, cy = width / 2, height / 2
    rx, ry = 262, 356
    angles = np.linspace(0, 2 * math.pi, 49)[:-1]
    c.lift(np.stack([np.cos(angles) * rx + cx, np.sin(angles) * ry + cy], 1), 0.97, soft=7)

    def on_wreath(angle):
        return cx + math.cos(angle) * (rx + 8), cy + math.sin(angle) * (ry + 8)

    # A slim wreath of mint leaves.
    for i in range(46):
        angle = 2 * math.pi * i / 46 + c.rng.uniform(-0.02, 0.02)
        x, y = on_wreath(angle)
        tangent = angle + math.pi / 2
        for side in (-1, 1):
            b.leaf(c, x, y, c.rng.uniform(42, 64), c.rng.uniform(12, 17), tangent + side * c.rng.uniform(0.25, 0.7), b.MINT, b.MINT_DARK, vein=False)
    for angle, size, kind in [
        (-2.5, 48, "violet"), (-2.2, 34, "forget"), (-0.62, 40, "forget"), (-0.36, 46, "blue"),
        (0.66, 42, "daisy"), (0.98, 56, "violet"), (1.3, 40, "forget"), (1.68, 46, "blue"),
        (2.05, 42, "daisy"), (2.42, 54, "violet"),
    ]:
        x, y = on_wreath(angle)
        if kind == "violet":
            b.cosmos(c, x, y, size, b.LAVENDER, b.VIOLET)
        elif kind == "blue":
            b.cosmos(c, x, y, size, b.POWDER, b.POWDER_DEEP)
        elif kind == "forget":
            b.forget_me_not(c, x, y, size)
        else:
            b.daisy(c, x, y, size)
    c.save(path, opaque=True, quality=84)


def paint_book_page(path):
    """A small sprig for the page revealed when the cover swings open."""
    c = Canvas(520, 520, 77)
    b.eucalyptus(c, [(60, 470), (190, 330), (280, 210), (440, 70)], leaf_size=58, count=10)
    b.cosmos(c, 110, 400, 46)
    b.forget_me_not(c, 196, 446, 48)
    c.save(path)


def main(out):
    paint_garden(f"{out}/cover/garden-wide.webp", 2000, 1250, 11, 1.25)
    paint_garden(f"{out}/cover/garden-tall.webp", 1000, 1600, 12, 0.9)
    paint_book_cover(f"{out}/cover/book-cover.webp")
    paint_book_page(f"{out}/cover/book-page.webp")

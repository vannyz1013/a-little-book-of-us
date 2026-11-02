"""Home page art: the garden, and the book's painted cover."""
import math

import numpy as np

import botanicals as b
from watercolor import Canvas, hex_rgb, smooth, transform


def blob(w, h, x, y, rng, points=9):
    angles = np.linspace(0, 2 * math.pi, points + 1)[:-1]
    radii = rng.uniform(0.82, 1.12, points)
    return smooth(np.stack([np.cos(angles) * w * radii + x, np.sin(angles) * h * radii + y], 1), steps=3)


def hill(c, width, base, peaks, color, color2, strength, height):
    top = [(-60, base)] + [(x * width, base - rise * height) for x, rise in peaks] + [(width + 60, base)]
    curve = smooth(top, closed=False, steps=10)
    polygon = np.concatenate([curve, [(width + 60, c.h + 60), (-60, c.h + 60)]])
    c.wash(polygon, color, color2, strength=strength, wobble=0.006, layers=10, edge=0.35, bloom=0.65, direction=1.57)


def tree(c, x, y, spread, rng, tones):
    trunk = smooth([(x - 7, y), (x - 3, y - spread * 0.7), (x + 4, y - spread * 1.1)], closed=False, steps=6)
    c.wash(b.ribbon(trunk, spread * 0.09, spread * 0.03), b.UMBER, b.SAGE_DEEP, strength=0.75, layers=5, wobble=0.01)
    for _ in range(26):
        angle = rng.uniform(0, 2 * math.pi)
        distance = rng.uniform(0.1, 1.0) ** 0.6
        px = x + math.cos(angle) * spread * distance * 1.05
        py = y - spread * 1.45 + math.sin(angle) * spread * distance * 0.85
        size = spread * rng.uniform(0.2, 0.42)
        tone = tones[rng.integers(len(tones))]
        c.wash(blob(size, size * 0.8, px, py, rng), tone[0], tone[1], strength=rng.uniform(0.3, 0.6), wobble=0.07, layers=8, edge=0.45, bloom=0.7)


def bush(c, x, y, spread, rng):
    for _ in range(9):
        px = x + rng.uniform(-1, 1) * spread
        py = y + rng.uniform(-0.55, 0.3) * spread * 0.7
        size = spread * rng.uniform(0.35, 0.55)
        c.wash(blob(size, size * 0.7, px, py, rng), b.SAGE, b.SAGE_DEEP, strength=rng.uniform(0.5, 0.8), wobble=0.07, layers=8, bloom=0.7)
    for _ in range(7):
        px = x + rng.uniform(-0.9, 0.9) * spread
        py = y + rng.uniform(-0.6, 0.15) * spread * 0.7
        b.rose(c, px, py, spread * rng.uniform(0.13, 0.2), b.ROSE, b.ROSE_DEEP)


def meadow(c, width, ground, rng, scale):
    """Dense flower banks at both edges; the middle stays calm for the book."""
    bottom = c.h
    for i in range(170):
        side = i % 2
        reach = rng.uniform(0, 1) ** 1.25 * 0.5
        x = (reach if side == 0 else 1 - reach) * width
        depth = rng.uniform(0, 1) ** 0.7
        y = ground + depth * (bottom - ground) + 30
        # Flowers grow taller and larger towards the viewer.
        nearness = 0.55 + 0.75 * depth
        height = rng.uniform(90, 220) * scale * nearness
        lean = rng.uniform(-0.2, 0.2) + (0.12 if side == 0 else -0.12)
        size = nearness * scale
        kind = rng.integers(7)
        if kind <= 1:
            b.flowering_stem(c, x, y, height, lean, b.daisy, rng.uniform(26, 40) * size)
        elif kind == 2:
            b.flowering_stem(c, x, y, height, lean, b.cosmos, rng.uniform(24, 36) * size)
        elif kind == 3:
            b.flowering_stem(c, x, y, height, lean, b.rose, rng.uniform(22, 34) * size)
        elif kind == 4:
            b.lavender(c, x, y, height * 1.15, lean)
        elif kind == 5:
            b.fern(c, [(x, y), (x + height * lean, y - height * 0.6), (x + height * lean * 2.2, y - height * 1.05)], leaf_size=38 * size, count=11)
        else:
            b.eucalyptus(c, [(x, y), (x + height * lean, y - height * 0.55), (x + height * lean * 2, y - height)], leaf_size=26 * size, count=8)


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
    horizon = int(height * 0.58)

    # Sky: pale wet wash, warmer towards the horizon, with loose clouds.
    c.wash([(-80, -80), (width + 80, -80), (width + 80, horizon + 80), (-80, horizon + 80)], b.SKY, b.BUTTER, strength=0.72, wobble=0.012, layers=8, edge=0.12, bloom=0.75, direction=1.57)
    for _ in range(6):
        c.wash(blob(width * rng.uniform(0.12, 0.26), height * 0.035, rng.uniform(0, width), rng.uniform(0.06, 0.34) * height, rng), b.SKY, strength=0.32, wobble=0.09, layers=8, soft=7, edge=0.1)

    hill(c, width, horizon + 5, [(0.12, 0.8), (0.34, 0.42), (0.6, 0.72), (0.86, 0.5)], b.MIST, b.SAGE, 0.55, height * 0.12)
    hill(c, width, horizon + 62, [(0.2, 0.5), (0.52, 0.9), (0.8, 0.46)], b.SAGE, b.OLIVE, 0.48, height * 0.1)

    greens = [(b.SAGE, b.SAGE_DEEP), (b.MIST, b.SAGE), (b.OLIVE, b.SAGE_DEEP)]
    tree(c, width * 0.07, horizon + 65, width * 0.085, rng, greens)
    tree(c, width * 0.94, horizon + 75, width * 0.095, rng, greens)
    tree(c, width * 0.8, horizon + 42, width * 0.05, rng, [(b.MIST, b.SAGE), (b.ROSE, b.SAGE)])
    tree(c, width * 0.2, horizon + 40, width * 0.045, rng, [(b.MIST, b.SAGE), (b.BUTTER, b.SAGE)])

    ground = horizon + int(height * 0.05)
    hill(c, width, ground + 40, [(0.16, 0.7), (0.5, 0.35), (0.84, 0.75)], b.SAGE, b.OLIVE, 0.5, height * 0.09)
    fade_to_paper(c, ground + 50)

    bush(c, width * 0.13, ground + height * 0.05, width * 0.1, rng)
    bush(c, width * 0.87, ground + height * 0.06, width * 0.11, rng)

    meadow(c, width, ground + int(height * 0.08), rng, scale)

    b.butterfly(c, width * 0.74, height * 0.31, 26 * scale, b.ROSE, b.OCHRE)
    b.butterfly(c, width * 0.24, height * 0.42, 20 * scale, b.BUTTER, b.OCHRE, 0.25)
    c.save(path, opaque=True, quality=80)


def paint_book_cover(path):
    width, height = 760, 1000
    c = Canvas(width, height, 41)
    c.wash([(-40, -40), (width + 40, -40), (width + 40, height + 40), (-40, height + 40)], b.MIST, b.SAGE, strength=1.0, wobble=0.012, layers=8, edge=0.1, bloom=0.32, direction=1.2)

    # Reserve an oval of bare paper for the title.
    cx, cy = width / 2, height / 2
    rx, ry = 262, 356
    angles = np.linspace(0, 2 * math.pi, 49)[:-1]
    c.lift(np.stack([np.cos(angles) * rx + cx, np.sin(angles) * ry + cy], 1), 0.97, soft=7)

    for i in range(56):
        angle = 2 * math.pi * i / 56 + c.rng.uniform(-0.02, 0.02)
        x, y = cx + math.cos(angle) * (rx + 8), cy + math.sin(angle) * (ry + 8)
        tangent = angle + math.pi / 2
        for side in (-1, 1):
            b.leaf(c, x, y, c.rng.uniform(46, 72), c.rng.uniform(14, 21), tangent + side * c.rng.uniform(0.25, 0.75), b.SAGE, b.SAGE_DEEP, vein=False)
    for angle, size, kind in [
        (-2.5, 62, "rose"), (-2.15, 42, "cosmos"), (-1.85, 34, "daisy"), (-0.72, 44, "daisy"), (-0.42, 56, "rose"),
        (0.62, 46, "cosmos"), (0.98, 66, "rose"), (1.32, 46, "daisy"), (1.72, 52, "cosmos"), (2.12, 62, "rose"), (2.5, 44, "daisy"),
    ]:
        x, y = cx + math.cos(angle) * (rx + 8), cy + math.sin(angle) * (ry + 8)
        if kind == "rose":
            b.rose(c, x, y, size)
        elif kind == "cosmos":
            b.cosmos(c, x, y, size)
        else:
            b.daisy(c, x, y, size)
    c.save(path, opaque=True, quality=84)


def paint_book_page(path):
    """A small sprig for the page revealed when the cover swings open."""
    c = Canvas(520, 520, 77)
    b.eucalyptus(c, [(60, 470), (190, 330), (280, 210), (440, 70)], leaf_size=58, count=10)
    b.cosmos(c, 110, 400, 46)
    b.rose(c, 190, 450, 54)
    c.save(path)


def main(out):
    paint_garden(f"{out}/cover/garden-wide.webp", 2000, 1250, 11, 1.25)
    paint_garden(f"{out}/cover/garden-tall.webp", 1000, 1600, 12, 0.9)
    paint_book_cover(f"{out}/cover/book-cover.webp")
    paint_book_page(f"{out}/cover/book-page.webp")

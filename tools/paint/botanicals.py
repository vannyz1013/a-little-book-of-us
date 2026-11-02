"""Reusable watercolour plants, all sharing one palette so the art matches."""
import math

import numpy as np

from watercolor import hex_rgb, ribbon, smooth, transform

LAVENDER = hex_rgb("#C8BCE8")
VIOLET = hex_rgb("#9D8FD0")
PALE_LAVENDER = hex_rgb("#E9E3F5")
SPIKE = hex_rgb("#BFB2E6")
POWDER = hex_rgb("#B9D1E8")
POWDER_DEEP = hex_rgb("#8DB1DA")
PALE_BLUE = hex_rgb("#E6EFF7")
SKY = hex_rgb("#D4E3F1")
MINT = hex_rgb("#BFD8C5")
MINT_DEEP = hex_rgb("#8DB8A0")
MINT_DARK = hex_rgb("#74A18B")
MINT_SOFT = hex_rgb("#CFE3D6")
MINT_PALE = hex_rgb("#DCEBE1")
SLATE_SOFT = hex_rgb("#9298AE")
INK = hex_rgb("#55566B")
# The only warm notes: tiny flower centres, kept very pale.
POLLEN = hex_rgb("#DDD6AE")
POLLEN_PALE = hex_rgb("#F4F0D8")


def leaf(c, x, y, length, width, angle, color=MINT, color2=MINT_DEEP, bend=0.0, vein=True, strength=1.0):
    half = width / 2
    outline = smooth(
        [
            (0, 0),
            (length * 0.28, half * 0.9 + bend * length),
            (length * 0.62, half + bend * length),
            (length, bend * length * 0.2),
            (length * 0.62, -half * 0.75 + bend * length),
            (length * 0.28, -half * 0.8 + bend * length),
        ],
        steps=4,
    )
    points = transform(outline, x, y, angle)
    c.wash(points, color, color2, strength=strength, wobble=0.035, layers=8, direction=angle, edge=0.55)
    if vein and length > 24:
        rib = smooth(
            [(length * 0.04, 0), (length * 0.5, bend * length * 0.9), (length * 0.9, bend * length * 0.3)],
            closed=False,
            steps=5,
        )
        c.line(transform(rib, x, y, angle), width=1, color=color2, strength=0.4, wobble=0.25)


def stem(c, path, width=4.0, color=MINT_DEEP, color2=MINT_SOFT, strength=0.9):
    curve = smooth(path, closed=False, steps=8)
    c.wash(ribbon(curve, width, width * 0.35), color, color2, strength=strength, wobble=0.004, layers=5, edge=0.3)
    return curve


def point_along(curve, t):
    index = min(int(t * (len(curve) - 1)), len(curve) - 2)
    a, b = curve[index], curve[index + 1]
    return float(a[0]), float(a[1]), math.atan2(float(b[1] - a[1]), float(b[0] - a[0]))


def eucalyptus(c, path, leaf_size=46, count=11, color=MINT_PALE, color2=MINT_DEEP, width=3.5):
    curve = stem(c, path, width=width)
    for i in range(count):
        t = 0.08 + 0.9 * i / count
        x, y, angle = point_along(curve, t)
        scale = 1 - 0.55 * t
        for side in (-1, 1):
            size = leaf_size * scale * c.rng.uniform(0.85, 1.12)
            direction = angle + side * c.rng.uniform(0.75, 1.15)
            leaf(c, x, y, size, size * 0.74, direction, color, color2, vein=False, strength=c.rng.uniform(0.8, 1.15))


def fern(c, path, leaf_size=64, count=16, color=MINT, color2=MINT_DARK, width=3.0):
    curve = stem(c, path, width=width, color=color2)
    for i in range(count):
        t = 0.1 + 0.88 * i / count
        x, y, angle = point_along(curve, t)
        scale = math.sin(math.pi * (0.16 + 0.8 * t)) * (1 - 0.3 * t)
        for side in (-1, 1):
            size = leaf_size * scale * c.rng.uniform(0.85, 1.1)
            leaf(c, x, y, size, size * 0.24, angle + side * 0.95, color, color2, side * 0.05, vein=False)


def olive_sprig(c, path, leaf_size=70, count=9, color=MINT_SOFT, color2=MINT_DEEP, berries=True):
    curve = stem(c, path, width=3.5, color=SLATE_SOFT, color2=MINT_DEEP)
    for i in range(count):
        t = 0.08 + 0.92 * i / count
        x, y, angle = point_along(curve, t)
        side = -1 if i % 2 else 1
        size = leaf_size * (1 - 0.4 * t) * c.rng.uniform(0.85, 1.15)
        leaf(c, x, y, size, size * 0.3, angle + side * c.rng.uniform(0.45, 0.8), color, color2, side * 0.05)
        if berries and i % 3 == 1:
            berry(c, x + side * 9, y - 9, size * 0.11, LAVENDER, VIOLET)


def berry(c, x, y, r, color=LAVENDER, color2=VIOLET, strength=1.0):
    angles = np.linspace(0, 2 * math.pi, 11)[:-1]
    circle = np.stack([np.cos(angles), np.sin(angles)], 1) * r + (x, y)
    c.wash(circle, color, color2, strength=strength, wobble=0.05, layers=6, direction=0.8, edge=0.8)


def lavender(c, x, y, height, lean=0.1, color=SPIKE, color2=VIOLET):
    top = (x + height * lean, y - height)
    curve = stem(c, [(x, y), (x + height * lean * 0.3, y - height * 0.55), top], width=2.6)
    for i in range(14):
        t = 0.62 + 0.38 * i / 14
        px, py, angle = point_along(curve, t)
        for side in (-1, 1):
            spread = (1 - t) * 0.5 + 0.1
            size = height * 0.085
            leaf(c, px, py, size, size * 0.62, angle + side * (0.5 + spread), color, color2, vein=False, strength=0.36)


def reserve(c, x, y, r, squash=1.0, amount=0.92):
    angles = np.linspace(0, 2 * math.pi, 15)[:-1]
    c.lift(np.stack([np.cos(angles) * r + x, np.sin(angles) * r * squash + y], 1), amount, soft=r * 0.05 + 1)


def daisy(c, x, y, r, tilt=0.0, squash=0.8):
    reserve(c, x, y, r * 0.8, squash, 0.85)
    petals = int(c.rng.integers(11, 14))
    for i in range(petals):
        angle = 2 * math.pi * i / petals + c.rng.uniform(-0.09, 0.09)
        size = r * c.rng.uniform(0.9, 1.08)
        outline = smooth(
            [
                (r * 0.1, 0),
                (size * 0.5, size * 0.13),
                (size * 0.92, size * 0.11),
                (size, 0),
                (size * 0.92, -size * 0.11),
                (size * 0.5, -size * 0.13),
            ],
            steps=3,
        )
        local = transform(outline, 0, 0, angle) * np.array([1, squash], np.float32)
        points = transform(local, x, y, tilt)
        c.wash(points, hex_rgb("#EEF0F6"), hex_rgb("#CBD2E3"), strength=0.65, wobble=0.03, layers=6, edge=0.9, direction=angle + math.pi)
    centre(c, x, y, r * 0.24, squash)


def centre(c, x, y, r, squash=0.85):
    angles = np.linspace(0, 2 * math.pi, 13)[:-1]
    disc = np.stack([np.cos(angles), np.sin(angles) * squash], 1) * r + (x, y)
    c.wash(disc, POLLEN_PALE, POLLEN, strength=1.25, wobble=0.05, layers=7, direction=1.2, edge=0.8)
    for _ in range(int(r * 1.4) + 4):
        angle = c.rng.uniform(0, 2 * math.pi)
        distance = r * c.rng.uniform(0.1, 0.95)
        px = x + math.cos(angle) * distance
        py = y + math.sin(angle) * distance * squash
        c.wash(transform([(-1.6, 0), (0, 1.6), (1.6, 0), (0, -1.6)], px, py), SLATE_SOFT, strength=0.75, layers=3, wobble=0.1)


def cosmos(c, x, y, r, color=LAVENDER, color2=VIOLET, squash=0.85, tilt=0.0):
    reserve(c, x, y, r * 0.82, squash, 0.85)
    petals = 8
    for i in range(petals):
        angle = 2 * math.pi * i / petals + c.rng.uniform(-0.1, 0.1)
        outline = smooth(
            [
                (r * 0.12, 0),
                (r * 0.5, r * 0.3),
                (r * 0.95, r * 0.25),
                (r * 1.03, 0),
                (r * 0.95, -r * 0.25),
                (r * 0.5, -r * 0.3),
            ],
            steps=4,
        )
        local = transform(outline, 0, 0, angle) * np.array([1, squash], np.float32)
        c.wash(transform(local, x, y, tilt), color, color2, strength=c.rng.uniform(0.5, 0.72), wobble=0.03, layers=7, direction=angle + math.pi, edge=0.6)
    centre(c, x, y, r * 0.2, squash)


def rose(c, x, y, r, color=LAVENDER, color2=VIOLET):
    """Loose wet-in-wet garden rose: soft outer petals, darker heart."""
    reserve(c, x, y, r * 0.9, 0.92, 0.88)
    for i in range(7):
        angle = 2 * math.pi * i / 7 + c.rng.uniform(-0.2, 0.2)
        px = x + math.cos(angle) * r * 0.58
        py = y + math.sin(angle) * r * 0.5
        outline = smooth(
            [(-0.72, -0.1), (-0.3, 0.42), (0.34, 0.5), (0.75, 0.05), (0.3, -0.45), (-0.34, -0.45)],
            steps=4,
        )
        points = transform(outline, px, py, angle + math.pi / 2, r * 0.68)
        c.wash(points, PALE_LAVENDER, color, strength=c.rng.uniform(0.6, 0.85), wobble=0.04, layers=8, direction=angle + math.pi, edge=0.7, bloom=0.6)
    for ring, size, count in ((0.34, 0.4, 5), (0.15, 0.27, 3)):
        for i in range(count):
            angle = 2 * math.pi * i / count + ring * 4 + c.rng.uniform(-0.2, 0.2)
            px = x + math.cos(angle) * r * ring
            py = y + math.sin(angle) * r * ring * 0.9
            outline = smooth([(-0.8, 0), (-0.25, 0.5), (0.5, 0.4), (0.8, -0.1), (0.1, -0.5)], steps=4)
            points = transform(outline, px, py, angle + 1.2, r * size)
            c.wash(points, color, color2, strength=0.5, wobble=0.04, layers=6, direction=angle, edge=0.85)
    heart = smooth([(-0.5, 0), (0, 0.5), (0.5, 0), (0, -0.5)], steps=3)
    c.wash(transform(heart, x, y, 0, r * 0.2), color2, strength=0.7, wobble=0.05, layers=5, edge=0.9)
    arc = smooth([(-r * 0.3, 0.05 * r), (-r * 0.05, r * 0.26), (r * 0.27, r * 0.08)], closed=False, steps=5)
    c.line(transform(arc, x, y), width=1.4, color=color2, strength=0.5, wobble=0.3)


def forget_me_not(c, x, y, r, color=POWDER, color2=POWDER_DEEP):
    """A loose cluster of tiny five-petalled flowers."""
    reserve(c, x, y, r * 0.9, 0.9, 0.8)
    florets = 7
    for i in range(florets):
        angle = c.rng.uniform(0, 2 * math.pi)
        distance = r * 0.72 * math.sqrt((i + 0.5) / florets)
        px = x + math.cos(angle) * distance
        py = y + math.sin(angle) * distance * 0.85
        size = r * c.rng.uniform(0.17, 0.23)
        for petal in range(5):
            turn = 2 * math.pi * petal / 5 + angle
            berry(c, px + math.cos(turn) * size, py + math.sin(turn) * size, size * 0.72, color, color2, strength=0.42)
        berry(c, px, py, size * 0.34, POLLEN_PALE, POLLEN)


def bud(c, x, y, size, angle, color=LAVENDER, color2=VIOLET):
    outline = smooth([(0, 0), (size * 0.5, size * 0.3), (size, 0), (size * 0.5, -size * 0.3)], steps=4)
    c.wash(transform(outline, x, y, angle), color, color2, wobble=0.04, layers=7, direction=angle + math.pi, edge=0.7)
    for side in (-1, 1):
        leaf(c, x, y, size * 0.5, size * 0.2, angle + side * 0.42, MINT, MINT_DEEP, vein=False)


def flowering_stem(c, x, y, height, lean, flower, *args, **kwargs):
    """A flower on a stem, rising from (x, y). Returns the bloom position."""
    tip = (x + height * lean, y - height)
    mid = (x + height * lean * 0.2 + c.rng.uniform(-8, 8), y - height * 0.55)
    curve = stem(c, [(x, y), mid, tip], width=3.2)
    for t, side in ((0.32, 1), (0.52, -1)):
        px, py, angle = point_along(curve, t)
        leaf(c, px, py, height * 0.2, height * 0.05, angle + side * 0.55, MINT, MINT_DEEP, side * 0.05)
    flower(c, tip[0], tip[1], *args, **kwargs)
    return tip


def butterfly(c, x, y, size, color=LAVENDER, color2=POLLEN, angle=-0.3):
    wing_top = smooth([(0, 0), (0.45, -0.55), (1.0, -0.72), (1.02, -0.2), (0.5, 0.05)], steps=4)
    wing_low = smooth([(0, 0.02), (0.55, 0.1), (0.72, 0.5), (0.34, 0.68), (0.05, 0.3)], steps=4)
    for wing, squeeze in ((wing_top, 1.0), (wing_low, 0.9)):
        for mirror, breadth in ((1, 1.0), (-1, 0.62)):
            local = wing * np.array([mirror * breadth * squeeze, 1], np.float32)
            c.wash(transform(local, x, y, angle, size), color, color2, strength=0.7, wobble=0.04, layers=7, direction=angle, edge=0.7)
    body = transform([(0, -0.3), (0, 0.42)], x, y, angle, size)
    c.line(body, width=2.2, color=INK, strength=0.8, wobble=0.15)
    for offset in (-0.32, 0.2):
        antenna = smooth([(0, -0.3), (offset * 0.4, -0.62), (offset, -0.78)], closed=False, steps=4)
        c.line(transform(antenna, x, y, angle, size), width=1, color=INK, strength=0.55, wobble=0.12)

"""Birthday Letter art: cake, envelope layers, bunting and flowers.

Candle-top coordinates are printed by `paint_cake` for the CSS flames, which
are positioned as percentages of this image.
"""
import math

import numpy as np

import botanicals as b
from watercolor import Canvas, hex_rgb, smooth

CREAM = hex_rgb("#F6EAD6")
ENVELOPE = hex_rgb("#F6EEDF")
ENVELOPE_SHADE = hex_rgb("#E6D8C5")


def ellipse_arc(cx, cy, rx, ry, start, end, count=24):
    angles = np.linspace(start, end, count)
    return np.stack([np.cos(angles) * rx + cx, np.sin(angles) * ry + cy], 1)


def tier(c, cx, top, half_width, height, tone, tone2, rim=26):
    bottom = top + height
    front = np.concatenate(
        [
            ellipse_arc(cx, top, half_width, rim, math.pi, 0, 18)[::-1][::-1],
            ellipse_arc(cx, bottom, half_width, rim, 0, math.pi, 22),
        ]
    )
    c.lift(front, 0.96, soft=1.5)
    c.wash(front, tone, tone2, strength=0.9, wobble=0.005, layers=7, edge=0.4, direction=0.1)
    # Rounded shading on both sides of the drum.
    for x, width in ((cx + half_width * 0.68, half_width * 0.34), (cx - half_width * 0.98, half_width * 0.18)):
        side = [(x, top + 8), (x + width, top + 8), (x + width, bottom + 6), (x, bottom + 12)]
        c.wash(side, tone2, strength=0.32, wobble=0.02, layers=6, soft=6, edge=0.05)
    lid = ellipse_arc(cx, top, half_width, rim, 0, 2 * math.pi, 30)
    c.wash(lid, hex_rgb("#FBF3E6"), tone, strength=0.75, wobble=0.004, layers=6, edge=0.5, direction=1.57)


def drips(c, cx, y, half_width, rim, color, color2):
    """Icing drips along the front of a tier."""
    xs = np.linspace(-1, 1, 11)
    top = [(cx + x * half_width, y + math.sqrt(1 - min(x * x, 1)) * rim) for x in xs]
    lower = []
    for i, x in enumerate(xs[::-1]):
        base = y + math.sqrt(1 - min(x * x, 1)) * rim
        drop = 26 if i % 2 else 58
        lower.append((cx + x * half_width, base + drop * (1 - abs(x) * 0.5)))
    outline = smooth(top + lower, steps=4)
    c.wash(outline, color, color2, strength=0.85, wobble=0.004, layers=7, edge=0.7, direction=0.3)


def candle(c, x, base, height, tone, tone2):
    body = [(x - 11, base), (x - 9, base - height), (x + 9, base - height), (x + 11, base)]
    c.wash(body, tone, tone2, strength=0.95, wobble=0.01, layers=6, direction=0.0, edge=0.5)
    for step in range(1, 4):
        y = base - height * step / 4
        stripe = [(x - 10, y + 6), (x + 10, y - 7), (x + 10, y - 16), (x - 10, y - 3)]
        c.wash(stripe, hex_rgb("#FBF6EC"), strength=0.3, wobble=0.015, layers=4, edge=0.1)
    wick = [(x, base - height), (x + 1, base - height - 15)]
    c.line(wick, width=3, color=b.INK, strength=0.85, wobble=0.1)
    return x, base - height - 15


def paint_cake(path):
    width, height = 900, 900
    c = Canvas(width, height, 51)
    cx = width / 2

    plate = ellipse_arc(cx, 776, 372, 58, 0, 2 * math.pi, 36)
    c.wash(plate, hex_rgb("#E9E2D5"), b.BEIGE, strength=0.85, wobble=0.004, layers=7, edge=0.7, direction=1.57)

    tier(c, cx, 548, 292, 212, CREAM, b.BEIGE, rim=44)
    drips(c, cx, 548, 292, 44, b.BLUSH, b.ROSE)
    tier(c, cx, 356, 196, 186, b.BLUSH, b.ROSE, rim=32)
    drips(c, cx, 356, 196, 32, hex_rgb("#FBF3E6"), b.BEIGE)

    tops = []
    for x, tall, tone, tone2 in (
        (cx - 106, 118, b.SAGE, b.SAGE_DEEP),
        (cx, 136, b.ROSE, b.ROSE_DEEP),
        (cx + 106, 118, b.BUTTER, b.OCHRE),
    ):
        tops.append(candle(c, x, 366, tall, tone, tone2))

    # Fresh flowers tucked round the cake.
    b.eucalyptus(c, [(cx - 300, 730), (cx - 140, 800), (cx + 30, 790)], leaf_size=56, count=8)
    b.eucalyptus(c, [(cx + 318, 660), (cx + 240, 770), (cx + 90, 806)], leaf_size=54, count=8)
    b.rose(c, cx - 214, 736, 70)
    b.rose(c, cx - 96, 772, 48, b.BLUSH, b.ROSE)
    b.daisy(c, cx + 188, 760, 58)
    b.cosmos(c, cx + 288, 680, 50)
    for x in np.linspace(cx - 160, cx + 160, 9):
        offset = 362 + 26 * (1 - ((x - cx) / 196) ** 2)
        b.berry(c, float(x), float(offset), 8, b.ROSE, b.ROSE_DEEP)
    c.save(path)
    print("cake candle tips (% of image):", [(round(x / width * 100, 1), round(y / height * 100, 1)) for x, y in tops])


def envelope_shape(c, polygon, strength=1.0, shade=ENVELOPE_SHADE):
    c.wash(polygon, ENVELOPE, shade, strength=strength, wobble=0.0015, layers=5, edge=0.3, bloom=0.22, direction=1.2)


def paint_envelope(out):
    width, height = 900, 600
    pad = 10

    back = Canvas(width, height, 52)
    back.wash([(pad, pad), (width - pad, pad), (width - pad, height - pad), (pad, height - pad)], ENVELOPE_SHADE, strength=0.9, wobble=0.0015, layers=5, edge=0.15, bloom=0.2)
    back.wash([(pad, pad), (width - pad, pad), (width / 2, height * 0.62)], b.BLUSH, b.ROSE, strength=0.6, wobble=0.003, layers=5, edge=0.2, bloom=0.25, direction=1.57)
    back.save(f"{out}/envelope-back.webp", solid=[(pad, pad), (width - pad, pad), (width - pad, height - pad), (pad, height - pad)])

    front = Canvas(width, height, 53)
    middle = (width / 2, height * 0.56)
    pocket = [(pad, pad), middle, (width - pad, pad), (width - pad, height - pad), (pad, height - pad)]
    front.wash(pocket, ENVELOPE, ENVELOPE_SHADE, strength=1.0, wobble=0.0012, layers=5, edge=0.22, bloom=0.2, direction=1.2)
    # The folded seams, drawn rather than painted, so they stay delicate.
    for corner in ((pad + 4, height - pad - 4), (width - pad - 4, height - pad - 4)):
        front.line(np.linspace(middle, corner, 50), width=1.5, color=b.UMBER, strength=0.2, wobble=0.25)
    b.olive_sprig(front, [(30, 572), (110, 540), (190, 530), (262, 498)], leaf_size=52, count=7)
    b.olive_sprig(front, [(870, 574), (790, 544), (710, 532), (640, 502)], leaf_size=50, count=7)
    b.cosmos(front, 84, 520, 40)
    b.daisy(front, 816, 524, 40)
    front.save(f"{out}/envelope-front.webp", solid=pocket)

    flap = Canvas(width, height, 54)
    triangle = [(pad - 4, pad), (width - pad + 4, pad), (width / 2 + 20, height * 0.6), (width / 2, height * 0.625), (width / 2 - 20, height * 0.6)]
    envelope_shape(flap, triangle, 1.2)
    # A soft cast shadow so the closed flap sits above the pocket.
    edge = np.array([(pad, pad + 6), (width / 2, height * 0.645), (width - pad, pad + 6)], np.float32)
    flap.line(np.concatenate([np.linspace(edge[0], edge[1], 40), np.linspace(edge[1], edge[2], 40)]), width=2, color=b.UMBER, strength=0.3, wobble=0.3)
    flap.save(f"{out}/envelope-flap.webp", solid=triangle)

    seal = Canvas(220, 220, 55)
    angles = np.linspace(0, 2 * math.pi, 15)[:-1]
    radii = 88 + seal.rng.uniform(-7, 7, 14)
    disc = smooth(np.stack([np.cos(angles) * radii + 110, np.sin(angles) * radii + 110], 1), steps=4)
    seal.wash(disc, b.ROSE, b.ROSE_DEEP, strength=1.45, wobble=0.006, layers=7, edge=0.8, direction=0.8)
    ring = np.stack([np.cos(np.linspace(0, 6.3, 40)) * 58 + 110, np.sin(np.linspace(0, 6.3, 40)) * 58 + 110], 1)
    seal.line(ring, width=2, color=b.ROSE_DEEP, strength=0.7, wobble=0.5)
    for i in range(6):
        b.leaf(seal, 110, 110, 44, 19, i * math.pi / 3 + 0.3, b.ROSE_DEEP, b.ROSE_DEEP, vein=False, strength=0.65)
    seal.save(f"{out}/wax-seal.webp")


def bunting(path):
    width, height = 1400, 300
    c = Canvas(width, height, 56)
    string = smooth([(-20, 30), (350, 124), (700, 60), (1050, 124), (1420, 30)], closed=False, steps=26)
    c.line(string, width=2, color=b.UMBER, strength=0.6, wobble=0.3)
    tones = [(b.SAGE, b.SAGE_DEEP), (b.ROSE, b.ROSE_DEEP), (b.BEIGE, b.UMBER), (b.BUTTER, b.OCHRE)]
    flags = 15
    for i in range(flags):
        t = (i + 0.5) / flags
        index = int(t * (len(string) - 1))
        x, y = string[index]
        tone = tones[i % len(tones)]
        half = 42
        tail = float(c.rng.uniform(102, 116))
        flag = [(x - half, y + 2), (x + half, y + 2), (x + 3, y + tail)]
        c.wash(flag, tone[0], tone[1], strength=0.8, wobble=0.012, layers=7, edge=0.6, direction=1.57)
    c.save(path)


def table_flowers(path, seed, mirror=False):
    c = Canvas(760, 620, seed)
    x = lambda value: 760 - value if mirror else value
    b.fern(c, [(x(90), 600), (x(90), 420), (x(40), 240), (x(30), 40)], leaf_size=86, count=14)
    b.eucalyptus(c, [(x(180), 600), (x(240), 420), (x(360), 300), (x(560), 170)], leaf_size=66, count=10)
    b.olive_sprig(c, [(x(140), 590), (x(300), 510), (x(480), 480), (x(690), 380)], leaf_size=68, count=9)
    b.lavender(c, x(170), 590, 400, 0.12 if not mirror else -0.12)
    b.rose(c, x(128), 468, 100)
    b.rose(c, x(278), 516, 74, b.BLUSH, b.ROSE)
    b.cosmos(c, x(214), 334, 66)
    b.daisy(c, x(380), 460, 70)
    b.daisy(c, x(90), 300, 52)
    b.bud(c, x(420), 336, 50, -0.7 if not mirror else -2.4)
    c.splatter(x(380), 240, 90, 14, b.ROSE, strength=0.5)
    c.save(path)


def main(out):
    birthday = f"{out}/birthday"
    paint_cake(f"{birthday}/cake.webp")
    paint_envelope(birthday)
    bunting(f"{birthday}/bunting.webp")
    table_flowers(f"{birthday}/flowers-left.webp", 57)
    table_flowers(f"{birthday}/flowers-right.webp", 58, mirror=True)

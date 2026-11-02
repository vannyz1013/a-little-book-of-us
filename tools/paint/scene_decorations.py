"""Scrapbook bits: pressed flowers, washi tape, sprigs, photo placeholders, paper."""
import math

import numpy as np
from PIL import Image

import botanicals as b
from watercolor import Canvas, PAPER, hex_rgb, smooth


def sprig_eucalyptus(path):
    c = Canvas(900, 560, 21)
    b.eucalyptus(c, [(20, 520), (240, 380), (520, 300), (870, 90)], leaf_size=86, count=13)
    b.olive_sprig(c, [(60, 530), (260, 470), (520, 460), (790, 340)], leaf_size=92, count=11)
    c.save(path)


def sprig_floral(path):
    """A corner bouquet; the rest of the page stays calm around it."""
    c = Canvas(760, 760, 22)
    b.eucalyptus(c, [(30, 30), (150, 110), (330, 130), (720, 80)], leaf_size=72, count=11)
    b.fern(c, [(40, 40), (110, 180), (130, 380), (70, 720)], leaf_size=86, count=15)
    b.olive_sprig(c, [(50, 60), (200, 220), (340, 300), (530, 480)], leaf_size=74, count=9)
    b.rose(c, 112, 118, 86)
    b.rose(c, 262, 86, 56, b.BLUSH, b.ROSE)
    b.cosmos(c, 104, 280, 60)
    b.daisy(c, 228, 212, 56)
    b.bud(c, 392, 170, 44, 0.4)
    c.save(path)


def pressed_fern(path):
    c = Canvas(420, 620, 23)
    b.fern(c, [(250, 600), (205, 400), (225, 200), (175, 25)], leaf_size=120, count=18, color=b.OLIVE, color2=b.UMBER, width=3)
    c.save(path)


def pressed_daisy(path):
    c = Canvas(420, 620, 24)
    curve = b.stem(c, [(240, 610), (200, 420), (214, 190)], width=4, color=b.UMBER)
    b.leaf(c, *b.point_along(curve, 0.35)[:2], 130, 34, -2.5, b.OLIVE, b.UMBER, 0.05)
    b.leaf(c, *b.point_along(curve, 0.58)[:2], 110, 28, -0.7, b.OLIVE, b.UMBER, -0.05)
    b.daisy(c, 214, 156, 118, squash=0.96)
    c.save(path)


def pressed_cosmos(path):
    c = Canvas(460, 460, 25)
    b.cosmos(c, 230, 230, 190, b.ROSE, b.ROSE_DEEP, squash=0.96, tilt=0.3)
    c.save(path)


def washi(path, base, base2, pattern, seed):
    width, height = 520, 118
    c = Canvas(width, height, seed)
    teeth_left = [(14 + 9 * (i % 2), 8 + i * 8.4) for i in range(13)]
    teeth_right = [(width - 14 - 9 * (i % 2), 8 + i * 8.4) for i in range(13)]
    shape = np.array(teeth_left[::-1] + teeth_right, np.float32)
    c.wash(shape, base, base2, strength=0.74, wobble=0.0015, layers=4, edge=0.25, bloom=0.5, direction=0.1)
    if pattern == "dots":
        for x in range(48, width - 30, 50):
            for row, y in enumerate((35, 83)):
                b.berry(c, x + row * 25, y, 7, hex_rgb("#FBF6EC"), hex_rgb("#EFE4D2"))
    elif pattern == "stripes":
        for x in range(30, width - 30, 26):
            slant = np.array([(x, 10), (x + 9, 10), (x + 22, 108), (x + 13, 108)], np.float32)
            c.wash(slant, base2, strength=0.42, wobble=0.004, layers=4, edge=0.2)
    else:
        for x in range(48, width - 34, 66):
            b.leaf(c, x, 74, 40, 16, -1.0, b.SAGE_DEEP, b.MOSS, vein=False, strength=0.7)
            b.leaf(c, x + 10, 62, 34, 13, -0.2, b.SAGE_DEEP, b.MOSS, vein=False, strength=0.7)
    c.save(path)


def divider(path):
    c = Canvas(760, 110, 26)
    b.olive_sprig(c, [(380, 56), (240, 46), (120, 60), (20, 52)], leaf_size=44, count=8, berries=False)
    b.olive_sprig(c, [(380, 56), (520, 66), (640, 50), (740, 58)], leaf_size=44, count=8, berries=False)
    b.rose(c, 380, 56, 28)
    c.save(path)


def placeholder(path, tone, tone2, seed):
    """Deliberately blank: a tinted wash with a pencil-drawn photo icon.

    It must never read as a real memory, so there are no people or places.
    """
    width, height = 900, 900
    c = Canvas(width, height, seed)
    c.wash([(-30, -30), (width + 30, -30), (width + 30, height + 30), (-30, height + 30)], tone, tone2, strength=0.7, wobble=0.02, layers=8, edge=0.15, bloom=0.32, direction=0.9)
    cx, cy = width / 2, height / 2 - 40
    frame = np.array([(cx - 120, cy - 86), (cx + 120, cy - 86), (cx + 120, cy + 86), (cx - 120, cy + 86), (cx - 120, cy - 86)], np.float32)
    dense = np.concatenate([np.linspace(frame[i], frame[i + 1], 24) for i in range(4)])
    c.line(dense, width=3, color=b.INK, strength=0.55, wobble=0.6)
    mountain = smooth([(cx - 104, cy + 64), (cx - 40, cy - 8), (cx + 6, cy + 34), (cx + 44, cy + 8), (cx + 104, cy + 64)], closed=False, steps=4)
    c.line(mountain, width=3, color=b.INK, strength=0.5, wobble=0.5)
    angles = np.linspace(0, 2 * math.pi, 16)
    c.line(np.stack([np.cos(angles) * 19 + cx + 56, np.sin(angles) * 19 + cy - 42], 1), width=3, color=b.INK, strength=0.5, wobble=0.3)
    c.save(path, opaque=True, quality=74)


def paper(path):
    """Seamless cream paper tooth, tiled by CSS behind every page."""
    size = 512
    c = Canvas(size, size, 27)

    def periodic(cells, amplitude):
        grid = c.rng.random((cells, cells), dtype=np.float32)
        tile = np.block([[grid, grid], [grid, grid]])
        doubled = Image.fromarray(tile, mode="F").resize((size * 2, size * 2), Image.BICUBIC)
        centre = np.asarray(doubled)[size // 2 : size // 2 + size, size // 2 : size // 2 + size]
        return (centre - 0.5) * amplitude

    tooth = periodic(256, 0.035) + periodic(120, 0.02) + periodic(40, 0.006)
    base = np.array(hex_rgb("#F7F4EC"), np.float32)
    rgb = np.clip(base[None, None, :] * (1 + tooth[..., None]), 0, 1)
    Image.fromarray((rgb * 255).astype(np.uint8), "RGB").save(path, quality=72, method=6)


def main(out):
    decorations = f"{out}/decorations"
    sprig_eucalyptus(f"{decorations}/sprig-eucalyptus.webp")
    sprig_floral(f"{decorations}/sprig-floral.webp")
    pressed_fern(f"{decorations}/pressed-fern.webp")
    pressed_daisy(f"{decorations}/pressed-daisy.webp")
    pressed_cosmos(f"{decorations}/pressed-cosmos.webp")
    washi(f"{decorations}/washi-sage.webp", b.SAGE, b.MIST, "dots", 31)
    washi(f"{decorations}/washi-rose.webp", b.ROSE, b.BLUSH, "stripes", 32)
    washi(f"{decorations}/washi-beige.webp", b.BEIGE, hex_rgb("#E7DCCB"), "leaves", 33)
    divider(f"{decorations}/divider.webp")
    paper(f"{decorations}/paper.webp")
    memories = f"{out}/memories"
    placeholder(f"{memories}/placeholder-sage.webp", b.MIST, b.SAGE, 34)
    placeholder(f"{memories}/placeholder-rose.webp", b.BLUSH, b.ROSE, 35)
    placeholder(f"{memories}/placeholder-beige.webp", hex_rgb("#EADFD0"), b.BEIGE, 36)

"""A tiny procedural watercolour painter.

Every shape is painted the way real pigment behaves: a polygon is randomly
deformed many times and the layers are averaged (soft, uneven edges), pigment
pools at the rim (edge darkening), drifts in blooms (low-frequency noise) and
settles into the paper tooth (granulation). Colour is stored as optical
density, so overlapping washes darken each other like transparent paint.
"""
import math

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


def hex_rgb(value):
    value = value.lstrip("#")
    return tuple(int(value[i : i + 2], 16) / 255 for i in (0, 2, 4))


PAPER = hex_rgb("#FFFDF7")


def smooth(ctrl, closed=True, steps=6):
    """Catmull-Rom spline through control points."""
    p = np.asarray(ctrl, dtype=np.float32)
    n = len(p)
    out = []
    count = n if closed else n - 1
    for i in range(count):
        if closed:
            p0, p1, p2, p3 = p[(i - 1) % n], p[i], p[(i + 1) % n], p[(i + 2) % n]
        else:
            p0, p1, p2, p3 = p[max(i - 1, 0)], p[i], p[i + 1], p[min(i + 2, n - 1)]
        for t in np.linspace(0, 1, steps, endpoint=False):
            t2, t3 = t * t, t * t * t
            out.append(
                0.5
                * (
                    2 * p1
                    + (p2 - p0) * t
                    + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
                    + (3 * p1 - p0 - 3 * p2 + p3) * t3
                )
            )
    if not closed:
        out.append(p[-1])
    return np.asarray(out, dtype=np.float32)


def transform(pts, x, y, angle=0.0, scale=1.0):
    pts = np.asarray(pts, dtype=np.float32) * scale
    c, s = math.cos(angle), math.sin(angle)
    rot = np.array([[c, -s], [s, c]], dtype=np.float32)
    return pts @ rot.T + np.array([x, y], dtype=np.float32)


def ribbon(path, width_start, width_end):
    """A closed tapered polygon following an open path."""
    path = np.asarray(path, dtype=np.float32)
    tangent = np.gradient(path, axis=0)
    length = np.maximum(np.hypot(tangent[:, 0], tangent[:, 1]), 1e-3)
    normal = np.stack([-tangent[:, 1], tangent[:, 0]], 1) / length[:, None]
    widths = np.linspace(width_start, width_end, len(path))[:, None] / 2
    return np.concatenate([path + normal * widths, (path - normal * widths)[::-1]])


class Canvas:
    def __init__(self, width, height, seed=1):
        self.w, self.h = width, height
        self.rng = np.random.default_rng(seed)
        self.D = np.zeros((height, width, 3), dtype=np.float32)
        self.coarse = self._noise(1024, 150, 5)
        self.fine = self._noise(1024, 34, 4)
        self.grain = self._noise(1024, 5, 3)

    def _noise(self, size, scale, octaves):
        out = np.zeros((size, size), dtype=np.float32)
        amp = 1.0
        for octave in range(octaves):
            cells = max(2, int(size / scale * 2**octave))
            # Tile before resampling so the noise wraps without seams.
            small = np.tile(self.rng.random((cells, cells), dtype=np.float32), (3, 3))
            big = Image.fromarray(small, mode="F").resize((size * 3, size * 3), Image.BICUBIC)
            out += amp * np.asarray(big)[size : size * 2, size : size * 2]
            amp *= 0.55
        out -= out.min()
        return out / out.max()

    def _tile(self, tile, h, w):
        """Random crop of a noise tile (wrapped, so any size works)."""
        size = tile.shape[0]
        ys = (np.arange(h) + self.rng.integers(size)) % size
        xs = (np.arange(w) + self.rng.integers(size)) % size
        return tile[np.ix_(ys, xs)]

    def _deform(self, pts, rounds, amp):
        pts = np.asarray(pts, dtype=np.float32)
        for _ in range(rounds):
            following = np.roll(pts, -1, axis=0)
            edge = following - pts
            length = np.maximum(np.hypot(edge[:, 0], edge[:, 1]), 1e-3)
            normal = np.stack([-edge[:, 1], edge[:, 0]], 1) / length[:, None]
            # Some edges stay crisp, others bleed: that is what reads as paint.
            variance = self.rng.random(len(pts), dtype=np.float32) ** 2 * 2
            jitter = self.rng.normal(0, amp, len(pts)).astype(np.float32) * variance
            mid = (pts + following) / 2 + normal * jitter[:, None]
            merged = np.empty((len(pts) * 2, 2), dtype=np.float32)
            merged[0::2], merged[1::2] = pts, mid
            pts = merged
            amp *= 0.58
        return pts

    def wash(
        self,
        pts,
        color,
        color2=None,
        strength=1.0,
        wobble=0.05,
        layers=12,
        edge=0.5,
        bloom=0.5,
        direction=None,
        soft=0,
    ):
        """Paint one transparent wash. `wobble` is relative to shape size."""
        pts = np.asarray(pts, dtype=np.float32)
        low, high = pts.min(0), pts.max(0)
        size = float(max(high - low))
        if size < 1:
            return
        amp = size * wobble
        margin = int(amp * 3 + soft * 3 + 6)
        x0, y0 = np.maximum(np.floor(low).astype(int) - margin, 0)
        x1 = min(int(high[0]) + margin + 1, self.w)
        y1 = min(int(high[1]) + margin + 1, self.h)
        bw, bh = x1 - x0, y1 - y0
        if bw <= 1 or bh <= 1:
            return

        base = self._deform(pts, 2, amp) - np.array([x0, y0], dtype=np.float32)
        accumulated = np.zeros((bh, bw), dtype=np.float32)
        for _ in range(layers):
            polygon = self._deform(base, 2, amp * 0.7)
            image = Image.new("L", (bw, bh), 0)
            ImageDraw.Draw(image).polygon([tuple(p) for p in polygon.tolist()], fill=255)
            accumulated += np.asarray(image, dtype=np.float32) / 255
        mask = accumulated / layers

        image = Image.fromarray((mask * 255).astype(np.uint8), "L")
        if soft:
            image = image.filter(ImageFilter.GaussianBlur(soft))
            mask = np.asarray(image, dtype=np.float32) / 255
        else:
            mask = np.asarray(image.filter(ImageFilter.GaussianBlur(0.7)), np.float32) / 255
        wide = np.asarray(
            image.filter(ImageFilter.GaussianBlur(max(1.6, size * 0.035))), np.float32
        ) / 255
        rim = np.clip(mask - wide, 0, 1) * 2.2

        drift = self._tile(self.coarse if size > 160 else self.fine, bh, bw)
        density = mask * (1 - bloom + bloom * 2 * drift * 0.9) + edge * rim * mask

        absorb = -np.log(np.clip(np.array(color, np.float32), 0.02, 1))
        if color2 is None:
            colour = absorb[None, None, :]
        else:
            second = -np.log(np.clip(np.array(color2, np.float32), 0.02, 1))
            if direction is None:
                mix = drift
            else:
                c, s = math.cos(direction), math.sin(direction)
                ys, xs = np.mgrid[y0:y1, x0:x1].astype(np.float32)
                along = (xs * c + ys * s)
                ends = pts[:, 0] * c + pts[:, 1] * s
                mix = (along - ends.min()) / max(float(np.ptp(ends)), 1)
                mix = np.clip(mix + (drift - 0.5) * 0.55, 0, 1)
            colour = absorb[None, None, :] * (1 - mix[..., None]) + second[None, None, :] * mix[..., None]

        self.D[y0:y1, x0:x1] += density[..., None] * colour * strength

    def lift(self, pts, amount=0.9, soft=2.0):
        """Reserve the paper under a shape, as a painter paints around a bloom."""
        pts = np.asarray(pts, dtype=np.float32)
        x0, y0 = np.maximum(np.floor(pts.min(0)).astype(int) - 6, 0)
        x1 = min(int(pts[:, 0].max()) + 7, self.w)
        y1 = min(int(pts[:, 1].max()) + 7, self.h)
        if x1 <= x0 or y1 <= y0:
            return
        image = Image.new("L", (x1 - x0, y1 - y0), 0)
        offset = pts - np.array([x0, y0], dtype=np.float32)
        ImageDraw.Draw(image).polygon([tuple(p) for p in offset.tolist()], fill=255)
        mask = np.asarray(image.filter(ImageFilter.GaussianBlur(soft)), np.float32) / 255
        self.D[y0:y1, x0:x1] *= (1 - amount * mask)[..., None]

    def line(self, pts, width=1.4, color=(0.42, 0.42, 0.36), strength=0.55, wobble=0.5):
        """A hand-drawn pencil/brush line that lightens and breaks as it goes."""
        pts = np.asarray(pts, dtype=np.float32)
        pts = pts + self.rng.normal(0, wobble, pts.shape).astype(np.float32)
        low, high = pts.min(0), pts.max(0)
        margin = int(width * 3 + 4)
        x0, y0 = np.maximum(np.floor(low).astype(int) - margin, 0)
        x1 = min(int(high[0]) + margin + 1, self.w)
        y1 = min(int(high[1]) + margin + 1, self.h)
        if x1 <= x0 or y1 <= y0:
            return
        image = Image.new("L", (x1 - x0, y1 - y0), 0)
        offset = pts - np.array([x0, y0], dtype=np.float32)
        ImageDraw.Draw(image).line(
            [tuple(p) for p in offset.tolist()], fill=255, width=max(1, round(width))
        )
        mask = np.asarray(image.filter(ImageFilter.GaussianBlur(0.6)), np.float32) / 255
        mask = mask * (0.55 + 0.9 * self._tile(self.fine, *mask.shape))
        absorb = -np.log(np.clip(np.array(color, np.float32), 0.02, 1))
        self.D[y0:y1, x0:x1] += mask[..., None] * absorb[None, None, :] * strength

    def splatter(self, x, y, spread, count, color, strength=0.6, size=3.0):
        for _ in range(count):
            px = x + self.rng.normal(0, spread)
            py = y + self.rng.normal(0, spread * 0.8)
            radius = float(self.rng.uniform(0.6, 1.0) ** 3 * size + 0.8)
            angles = np.linspace(0, 2 * math.pi, 9)[:-1]
            circle = np.stack([np.cos(angles), np.sin(angles)], 1) * radius + (px, py)
            self.wash(circle, color, strength=strength, layers=4, wobble=0.15, edge=0.7)

    def _finish_rgb(self):
        grain = self._tile(self.grain, self.h, self.w)
        density = self.D * (0.86 + 0.28 * grain[..., None])
        return np.exp(-density)

    def save(self, path, opaque=False, quality=86, solid=None):
        """`solid` is a polygon that stays fully opaque, for layered paper."""
        rgb = self._finish_rgb()
        if opaque:
            out = np.clip(rgb * np.array(PAPER, np.float32), 0, 1)
            Image.fromarray((out * 255).astype(np.uint8), "RGB").save(path, quality=quality, method=6)
            return
        # Paint on white -> colour + alpha, so it sits on any paper tone.
        alpha = np.clip(1 - rgb.min(axis=2), 0, 1)
        safe = np.maximum(alpha, 1e-3)[..., None]
        colour = np.clip((rgb - (1 - alpha[..., None])) / safe, 0, 1)
        if solid is not None:
            image = Image.new("L", (self.w, self.h), 0)
            ImageDraw.Draw(image).polygon([tuple(map(float, p)) for p in solid], fill=255)
            cover = np.asarray(image.filter(ImageFilter.GaussianBlur(0.8)), np.float32) / 255
            paper_rgb = rgb * np.array(PAPER, np.float32)
            colour = colour * (1 - cover[..., None]) + paper_rgb * cover[..., None]
            alpha = np.maximum(alpha, cover)
        rgba = np.dstack([colour, alpha])
        Image.fromarray((rgba * 255).astype(np.uint8), "RGBA").save(
            path, quality=quality, method=6, alpha_quality=90
        )

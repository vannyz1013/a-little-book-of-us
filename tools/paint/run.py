"""Repaint every illustration into public/images.

    python tools/paint/run.py            # everything
    python tools/paint/run.py cover      # one group: cover | decorations | birthday
"""
import pathlib
import sys
import time

sys.path.insert(0, str(pathlib.Path(__file__).parent))

import scene_birthday
import scene_cover
import scene_decorations

OUT = pathlib.Path(__file__).resolve().parents[2] / "public" / "images"
GROUPS = {
    "cover": scene_cover.main,
    "decorations": scene_decorations.main,
    "birthday": scene_birthday.main,
}

for name in sys.argv[1:] or GROUPS:
    started = time.time()
    GROUPS[name](str(OUT).replace("\\", "/"))
    print(f"{name}: {time.time() - started:.0f}s")

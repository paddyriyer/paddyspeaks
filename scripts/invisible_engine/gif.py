"""Assemble animated GIFs of chosen scenes from their frame states.

    IE_DEPS=… CHROMIUM_PATH=… node scripts/invisible_engine/render.mjs --frames s09 s12 …
    python3 scripts/invisible_engine/gif.py s09 s12 …     # → invisible-engine/scenes/gif/sNN.gif

Only scenes where motion helps understanding get a GIF (GIF_SCENES); the SVG and its
Back/Next stepper stay the accessible source. Frames hold 1.6 s, the last one 3.5 s;
960 px wide; loops. Pages link a GIF automatically when the file exists (pages.py).
"""
from __future__ import annotations

import pathlib
import sys
import tempfile

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "invisible-engine" / "scenes" / "gif"
TMP = pathlib.Path(tempfile.gettempdir()) / "ie-frames"
# Scenes whose meaning is a sequence: power arriving, a reply, a whisper overheard,
# a sealed report travelling, the five-lane exchange, interference, Grover's steps.
GIF_SCENES = ["s09", "s12", "s13", "s25", "s36", "s38", "s63", "s66"]


def build(sid: str) -> pathlib.Path:
    frames = sorted(TMP.glob(f"{sid}-*.png"), key=lambda p: int(p.stem.split("-")[1]))
    if not frames:
        raise SystemExit(f"no frames for {sid}: run render.mjs --frames {sid} first")
    imgs = []
    for p in frames:
        im = Image.open(p).convert("RGB")
        im = im.resize((960, round(960 * im.height / im.width)), Image.LANCZOS)
        imgs.append(im.quantize(colors=128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE))
    durations = [1600] * (len(imgs) - 1) + [3500]
    OUT.mkdir(parents=True, exist_ok=True)
    out = OUT / f"{sid}.gif"
    imgs[0].save(out, save_all=True, append_images=imgs[1:], duration=durations, loop=0, optimize=True, disposal=1)
    return out


if __name__ == "__main__":
    for sid in sys.argv[1:] or GIF_SCENES:
        p = build(sid)
        print(f"  wrote {p.relative_to(ROOT)} ({p.stat().st_size // 1024} KB)")

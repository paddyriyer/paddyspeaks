#!/usr/bin/env python3
"""Encode the homepage hero painting into the files index.html serves.

    python3 scripts/hero_images.py            # from images/hero image.png

Needs Pillow with AVIF and WebP support (pip install pillow). Not part of
build.py (which is stdlib only): run it once whenever the painting changes,
then commit images/home/hero-*.

What it writes (docs/HOMEPAGE-MAP-REDESIGN.md §12):

  Desktop (the hero over 960px wide shows the whole painting, words in the sky):
    images/home/hero-painting-{1200,1916}.{avif,webp}

  Phones and tablets (up to 960px the painting is a band above the words):
    images/home/hero-mobile-{720,1080,1525}.{avif,webp}
    A deliberate crop of the painting, not the desktop image centred: the two
    figures at the left edge, the sunrise at the right, the sky above them.
    It is the window the old full-width image showed at 390px (object-position
    30%), so the phone downloads only what it displays — 25 KB instead of
    112 KB for the largest contentful paint.

AVIF first, WebP for browsers without it. Quality: AVIF 50, WebP 78 — a
painting, so gentle compression is invisible; check by eye after changing.
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "images" / "hero image.png"
OUT = ROOT / "images" / "home"

# The band the phone shows, in source pixels: aspect 1.857 (390 × 210), the
# window object-position 30% picked from the full painting at that width.
MOBILE_CROP = (117, 0, 1642, 821)
DESKTOP_WIDTHS = (1200, 1916)
MOBILE_WIDTHS = (720, 1080, 1525)
AVIF_Q = 50
WEBP_Q = 78


def save(img: Image.Image, stem: str) -> None:
    img.save(OUT / f"{stem}.avif", "AVIF", quality=AVIF_Q)
    img.save(OUT / f"{stem}.webp", "WEBP", quality=WEBP_Q, method=6)
    for ext in ("avif", "webp"):
        p = OUT / f"{stem}.{ext}"
        print(f"  {p.relative_to(ROOT)}  {img.size[0]}x{img.size[1]}  {p.stat().st_size // 1024} KB")


def resize(img: Image.Image, width: int) -> Image.Image:
    if img.size[0] == width:
        return img
    return img.resize((width, round(img.size[1] * width / img.size[0])), Image.LANCZOS)


def main() -> int:
    if not SOURCE.exists():
        print(f"missing {SOURCE}", file=sys.stderr)
        return 1
    src = Image.open(SOURCE).convert("RGB")
    if src.size != (1916, 821):
        print(f"note: painting is {src.size}, MOBILE_CROP was chosen for 1916x821 — re-check the band", file=sys.stderr)
    OUT.mkdir(parents=True, exist_ok=True)
    print("desktop")
    for w in DESKTOP_WIDTHS:
        save(resize(src, w), f"hero-painting-{w}")
    print("mobile band")
    band = src.crop(MOBILE_CROP)
    for w in MOBILE_WIDTHS:
        save(resize(band, w), f"hero-mobile-{w}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

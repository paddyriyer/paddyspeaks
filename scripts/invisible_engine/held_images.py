"""Correct Paddy's held illustrations (docs/INVISIBLE-ENGINE.md §3a) for the lesson.

    python3 scripts/invisible_engine/held_images.py          # write invisible-engine/art/*.webp
    python3 scripts/invisible_engine/held_images.py nfc1     # one image

The originals in images/ (nfc1.png, airtag.png, airtag1.png, quantum.png) stay untouched;
every correction is a patch listed here, applied to the original: a box painted with the
surrounding colour, then the corrected words set over it, and a footnote band added below
the picture. The lesson shows the corrected WebP with a note listing what was changed
(scripts/invisible_engine/content/inserts.py). Look at every output before committing.
"""
from __future__ import annotations

import pathlib
import statistics
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "invisible-engine" / "art"
FONTS = "/usr/share/fonts/truetype/crosextra/"
NAVY, INK, GREY = (27, 42, 74), (34, 40, 52), (88, 96, 110)


def font(size: float, weight: str = "Regular") -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(f"{FONTS}Carlito-{weight}.ttf", size)


def surround(im: Image.Image, box: tuple[int, int, int, int]) -> tuple[int, int, int]:
    """Median colour of the one-pixel ring just outside box: the paper the words sat on."""
    x0, y0, x1, y1 = box
    ring = [im.getpixel((x, y)) for x in range(x0, x1) for y in (y0 - 1, y1)]
    ring += [im.getpixel((x, y)) for y in range(y0, y1) for x in (x0 - 1, x1)]
    return tuple(int(statistics.median(c[i] for c in ring)) for i in range(3))


def apply(im: Image.Image, patches: list[tuple]) -> None:
    d = ImageDraw.Draw(im)
    for p in patches:
        kind = p[0]
        if kind == "clear":                          # ("clear", box[, colour])
            box = p[1]
            d.rectangle(box, fill=p[2] if len(p) > 2 else surround(im, box))
        elif kind == "blend":                        # ("blend", box): each row fades from its left to its right neighbour
            x0, y0, x1, y1 = p[1]
            for y in range(y0, y1):
                a, b = im.getpixel((x0 - 1, y)), im.getpixel((x1, y))
                for x in range(x0, x1):
                    t = (x - x0 + 1) / (x1 - x0 + 1)
                    im.putpixel((x, y), tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3)))
        elif kind == "text":                         # ("text", (x, y), text, size, weight, colour[, anchor, line])
            _, xy, text, size, weight, colour, *rest = p
            anchor = rest[0] if rest else "la"
            line = rest[1] if len(rest) > 1 else round(size * 1.22)
            for i, ln in enumerate(text.split("\n")):
                d.text((xy[0], xy[1] + i * line), ln, font=font(size, weight), fill=colour, anchor=anchor)
        elif kind == "globe":                        # ("globe", (cx, cy), r, colour)
            (cx, cy), r, c = p[1], p[2], p[3]
            d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=c, width=3)
            d.ellipse((cx - r * 0.45, cy - r, cx + r * 0.45, cy + r), outline=c, width=2)
            d.line((cx - r, cy, cx + r, cy), fill=c, width=2)
            d.line((cx, cy - r, cx, cy + r), fill=c, width=2)
            for f in (-0.5, 0.5):
                w = r * (1 - f * f) ** 0.5
                d.line((cx - w, cy + f * r, cx + w, cy + f * r), fill=c, width=2)


def footnote(im: Image.Image, lines: list[str]) -> Image.Image:
    """Add a white band below the picture with the corrections' footnote."""
    h = 18 + 24 * len(lines)
    out = Image.new("RGB", (im.width, im.height + h), (255, 255, 255))
    out.paste(im, (0, 0))
    d = ImageDraw.Draw(out)
    for i, ln in enumerate(lines):
        d.text((24, im.height + 8 + 24 * i), ln, font=font(19, "Italic"), fill=GREY)
    return out


# ── the corrections, one list per image ───────────────────────────────
IMAGES: dict[str, dict] = {
    "nfc1": {
        "out": "tap-to-pay-card-vs-wallet.webp",
        "patches": [
            # (2) real network logos → a generic card network
            ("clear", (444, 697, 682, 757)), ("globe", (563, 727), 24, NAVY),
            ("clear", (1170, 697, 1397, 757)), ("globe", (1283, 727), 24, NAVY),
            ("blend", (857, 430, 895, 452)),                           # the wallet card's logo
            # (3) the acquirer (merchant's bank) sits between merchant and network
            ("text", (624, 622), "via the acquirer\n(merchant’s bank)", 17, "Regular", NAVY, "ra", 21),
            ("text", (1328, 622), "via the acquirer\n(merchant’s bank)", 17, "Regular", NAVY, "ra", 21),
            # (4) the network's token service maps the token, not the issuer
            ("clear", (928, 766, 1122, 791)),
            ("text", (1024, 768), "Verify cryptogram and approve", 17, "Regular", NAVY, "ma"),
            ("clear", (912, 958, 1338, 1008)),
            ("text", (920, 962), "Validates the cryptogram. The network’s token service\nmaps the token to the real card number.", 19, "Regular", INK, "la", 23),
            # (1) the cryptogram stops replay, not tracking: a plastic card's number is static
            ("clear", (348, 1019, 846, 1062)),
            ("text", (355, 1018), "Dynamic cryptogram (prevents replay). The card number\nis static, so payments with one card can be linked.", 19, "Regular", INK, "la", 23),
        ],
        # (5) three-party schemes
        "note": ["Generic card, wallet and network. Simplified four-party flow; in three-party schemes (such as American Express)",
                 "the network is also the issuer. Corrected for The Invisible Engine; see the notes under the figure."],
    },
    "airtag": {
        "out": "how-an-item-tracker-works.webp",
        "patches": [
            # (1) the advertising interval is not published: no "every few seconds"
            ("blend", (48, 279, 418, 305)),
            ("text", (50, 276), "At intervals it wakes briefly and", 23.5, "Regular", (40, 54, 74)),
            # (2) Apple states "more than a year", not "up to about a year"
            ("clear", (35, 792, 187, 830)),
            ("text", (37, 791), "for more than a year\n(Apple’s figure).", 16.5, "Regular", (40, 55, 70), "la", 19),
            # (3) the board is drawn, not photographed
            ("text", (275, 796), "Illustrative layout,\nnot a teardown", 16, "Italic", GREY, "ma", 19),
            # (4) the lookup value (a hash of the public key) is not encrypted; location and time are
            ("blend", (1030, 574, 1222, 678)),
            ("text", (1032, 576), "The nearby phone encrypts\nits own location and a\ntimestamp, and files the\nreport under a hash of the\nAirTag’s rotating key.", 17, "Regular", (56, 62, 82), "la", 20.5),
        ],
        "note": ["Advertising interval and board layout are illustrative. Battery figure as Apple states it. Not produced by Apple.",
                 "Corrected for The Invisible Engine; see the notes under the figure."],
    },
    "airtag1": {
        "out": "three-tracker-experiences.webp",
        "patches": [
            # (2) the report is end-to-end encrypted, not only sent over an encrypted connection
            ("clear", (566, 568, 940, 609)),
            ("text", (569, 570), "The detecting device sends an end-to-end encrypted report;\nonly the owner’s devices can decrypt the location.", 16.5, "Regular", (104, 112, 116), "la", 19),
            # (1) Precision Finding needs ultra-wideband: no iPhone SE has it
            ("clear", (1098, 852, 1252, 875)),
            ("text", (1100, 853), "(iPhone 11 and later; not iPhone SE).", 16.5, "Regular", (120, 118, 146)),
        ],
        # (3) product depiction, not Apple's own image
        "note": ["Illustration by Paddy Iyer, not produced by or affiliated with Apple. Products and screens are simplified depictions.",
                 "Corrected for The Invisible Engine; see the notes under the figure."],
    },
    "quantum": {
        "out": "bits-to-interference-to-security.webp",
        "patches": [
            # (1) Shor would break RSA and ECC only on a machine that does not yet exist
            ("blend", (1252, 403, 1438, 468)),
            ("text", (1254, 404), "Would break RSA and ECC\non a large fault-tolerant\nquantum computer, which\ndoes not yet exist.", 14.5, "Regular", (34, 31, 64), "la", 15.5),
            # (3) Grover's halving is an idealised count; collisions differ
            ("blend", (1252, 600, 1438, 664)),
            ("text", (1254, 601), "In an idealised model,\nhalves key security\n(128-bit → ~64-bit);\ncollision resistance differs.", 14.5, "Regular", (34, 31, 64), "la", 15.5),
            # (2) standardised in August 2024, not "being standardized"
            ("blend", (1252, 808, 1438, 872)),
            ("text", (1254, 810), "Standardised by NIST\nin August 2024: ML-KEM,\nML-DSA, SLH-DSA\n(FIPS 203, 204, 205).", 14.5, "Regular", (34, 31, 64), "la", 15.5),
        ],
        "note": ["Nothing quantum here is broken today: Shor and Grover figures describe large, ideal machines that do not yet exist.",
                 "Corrected for The Invisible Engine; see the notes under the figure."],
    },
}


def build(name: str) -> pathlib.Path:
    spec = IMAGES[name]
    im = Image.open(ROOT / "images" / f"{name}.png").convert("RGB")
    apply(im, spec["patches"])
    im = footnote(im, spec["note"])
    OUT.mkdir(parents=True, exist_ok=True)
    out = OUT / spec["out"]
    im.save(out, quality=86)
    return out


if __name__ == "__main__":
    for n in sys.argv[1:] or list(IMAGES):
        p = build(n)
        print(f"  wrote {p.relative_to(ROOT)} {Image.open(p).size}")

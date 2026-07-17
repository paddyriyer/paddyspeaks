#!/usr/bin/env python3
"""
Render the OG/Twitter share image for Interview Studio.
Output: images/og-interview-bank.png  (1200×630, the spec for OG)

Run from repo root:
  python3 interview/scripts/make_og_image.py
"""

from PIL import Image, ImageDraw, ImageFont, ImageFilter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "images" / "og-interview-bank.png"

W, H = 1200, 630
INK = (15, 30, 46)
BLUE = (26, 79, 138)
LIGHT_BLUE = (168, 200, 232)
CREAM = (245, 240, 232)
MUTED = (136, 146, 168)
GREEN = (159, 214, 181)
RUST = (255, 176, 154)


def font(family, size, bold=False):
    candidates = []
    if family == "serif":
        candidates = [
            "LiberationSerif-Bold.ttf" if bold else "LiberationSerif-Regular.ttf",
            "FreeSerifBold.ttf" if bold else "FreeSerif.ttf",
            "DejaVuSerif-Bold.ttf" if bold else "DejaVuSerif.ttf",
        ]
    else:  # mono
        candidates = [
            "DejaVuSansMono-Bold.ttf" if bold else "DejaVuSansMono.ttf",
            "FreeMonoBold.ttf" if bold else "FreeMono.ttf",
        ]
    for c in candidates:
        try:
            for base in ("/usr/share/fonts/truetype/liberation",
                         "/usr/share/fonts/truetype/freefont",
                         "/usr/share/fonts/truetype/dejavu"):
                p = Path(base) / c
                if p.exists():
                    return ImageFont.truetype(str(p), size)
        except Exception:
            continue
    return ImageFont.load_default()


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    img = Image.new("RGB", (W, H), INK)
    d = ImageDraw.Draw(img)

    # Vertical gradient band on the left
    for y in range(H):
        t = y / H
        r = int(INK[0] + (BLUE[0] - INK[0]) * t)
        g = int(INK[1] + (BLUE[1] - INK[1]) * t)
        b = int(INK[2] + (BLUE[2] - INK[2]) * t)
        d.line([(0, y), (480, y)], fill=(r, g, b))

    # Soft glow circles
    for cx, cy, rad, fill in [
        (240, 200, 90, (168, 200, 232, 60)),
        (350, 450, 70, (255, 176, 154, 50)),
        (900, 100, 120, (168, 200, 232, 30)),
    ]:
        glow = Image.new("RGBA", (rad * 4, rad * 4), (0, 0, 0, 0))
        gd = ImageDraw.Draw(glow)
        gd.ellipse((rad, rad, rad * 3, rad * 3), fill=fill)
        glow = glow.filter(ImageFilter.GaussianBlur(40))
        img.paste(glow, (cx - rad * 2, cy - rad * 2), glow)
        d = ImageDraw.Draw(img)

    # Left big number
    f_huge = font("mono", 150, bold=True)
    d.text((100, 150), "1527", fill=LIGHT_BLUE, font=f_huge)

    f_label = font("mono", 22, bold=True)
    d.text((100, 350), "QUESTIONS", fill=MUTED, font=f_label)
    d.text((100, 385), "107 COMPANIES", fill=MUTED, font=f_label)

    # Pill row
    pills = [
        ("SQL", LIGHT_BLUE),
        ("PYTHON", CREAM),
        ("SNOWFLAKE", GREEN),
        ("GIT", RUST),
    ]
    f_pill = font("mono", 16, bold=True)
    x = 100
    for name, color in pills:
        bbox = d.textbbox((0, 0), name, font=f_pill)
        w = bbox[2] - bbox[0]
        d.rounded_rectangle((x - 12, 450, x + w + 12, 488), radius=18, outline=color, width=2)
        d.text((x, 458), name, fill=color, font=f_pill)
        x += w + 36

    # Right column: headline, paragraph, CTA
    f_eyebrow = font("mono", 20, bold=True)
    d.text((540, 100), "▸ FOR DATA & AI ENGINEERS", fill=LIGHT_BLUE, font=f_eyebrow)

    f_h1 = font("serif", 60, bold=True)
    d.text((540, 140), "Interview", fill=CREAM, font=f_h1)
    d.text((540, 210), "Studio", fill=CREAM, font=f_h1)

    f_body = font("serif", 24)
    body = [
        "1527 real interview questions across SQL, Python,",
        "Snowflake & system design from 107 companies —",
        "run every one in an in-browser playground.",
    ]
    for i, line in enumerate(body):
        d.text((540, 310 + i * 36), line, fill=(216, 228, 239), font=f_body)

    # CTA bar
    cta = "paddyspeaks.com/interview.app"
    f_cta = font("mono", 22, bold=True)
    bbox = d.textbbox((0, 0), cta, font=f_cta)
    w = bbox[2] - bbox[0]
    d.rounded_rectangle((540, 470, 540 + w + 32, 514), radius=4, fill=CREAM)
    d.text((556, 478), cta, fill=INK, font=f_cta)

    # Bottom-right brand mark
    f_brand = font("serif", 22, bold=True)
    d.text((540, 558), "PaddySpeaks", fill=LIGHT_BLUE, font=f_brand)
    f_brand_sub = font("mono", 14)
    d.text((540, 590), "Spirituality · Philosophy · Technology", fill=MUTED, font=f_brand_sub)

    img.save(OUT, "PNG", optimize=True)
    print(f"Wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size} bytes, {W}x{H})")


if __name__ == "__main__":
    main()

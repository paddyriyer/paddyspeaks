#!/usr/bin/env python3
"""Build the share card and sidebar poster for 'Can You Really Afford the Bay Area?'.

Re-run after: pip install cairosvg pillow
Outputs (relative to this file's parent directory):
  share-card.png   1200x630   Open Graph / Twitter / deck-card image
  poster.webp      800x860    homepage featured-sidebar thumbnail
Do not hand-edit the outputs; edit this script.
"""
from pathlib import Path
import cairosvg
from PIL import Image

OUT = Path(__file__).resolve().parent.parent
SRC = Path(__file__).resolve().parent

SERIF = "Liberation Serif, Times New Roman, serif"
SANS  = "Liberation Sans, Helvetica, sans-serif"
MONO  = "DejaVu Sans Mono, monospace"

PAPER, INK, INK3 = "#FCFBF7", "#14171C", "#787F8A"
BLUE, RED, GOLD  = "#23527C", "#A32B22", "#95681A"

HOUSE = """
  <g transform="translate({x} {y}) scale({s})">
    <path d="M2 42 L37 13 L72 42" fill="none" stroke="#14171C" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>
    <path d="M9 41 L9 84 L65 84 L65 41" fill="#FCFBF7" stroke="#14171C" stroke-width="2.6" stroke-linejoin="round"/>
    <rect x="17" y="50" width="13" height="12" fill="none" stroke="#14171C" stroke-width="1.7"/>
    <rect x="44" y="50" width="13" height="12" fill="none" stroke="#14171C" stroke-width="1.7"/>
    <path d="M31 84 L31 68 L44 68 L44 84" fill="none" stroke="#14171C" stroke-width="2" stroke-linejoin="round"/>
    <path d="M53 20 L53 8 L60 8 L60 26" fill="none" stroke="#14171C" stroke-width="2.1" stroke-linejoin="round"/>
  </g>"""


def stack(cx, ground, n, colour, pat, bw=64, bh=11):
    """A column of n banknote bundles growing upward from `ground`."""
    out = []
    for i in range(n):
        jitter = (-2, 1, -3, 2)[i % 4]
        y = ground - (i + 1) * bh
        out.append(
            f'<rect x="{cx - bw/2 + jitter:.0f}" y="{y}" width="{bw}" height="{bh-1}" rx="1.4" '
            f'fill="url(#{pat})" stroke="{colour}" stroke-width="1.4"/>'
        )
    return "\n    ".join(out)


def era(x, ground, n, colour, pat, year, price, year_col):
    """House on the left of the column, the money stack rising beside it on the right."""
    return f"""
  <g>
    {stack(x + 30, ground, n, colour, pat)}
    {HOUSE.format(x=x - 62, y=ground - 63, s=0.75)}
    <line x1="{x-66}" y1="{ground+2}" x2="{x+66}" y2="{ground+2}" stroke="{INK}" stroke-width="2" stroke-linecap="round"/>
    <text x="{x}" y="{ground+30}" text-anchor="middle" font-family="{MONO}" font-size="17" font-weight="bold" fill="{year_col}">{year}</text>
    <text x="{x}" y="{ground+50}" text-anchor="middle" font-family="{SANS}" font-size="12.5" fill="{INK3}">{price}</text>
  </g>"""


DEFS = f"""
  <defs>
    <pattern id="hb" width="7" height="7" patternTransform="rotate(38)" patternUnits="userSpaceOnUse">
      <line x1="0" y1="0" x2="0" y2="7" stroke="{BLUE}" stroke-width="1" opacity="0.32"/>
    </pattern>
    <pattern id="hr" width="7" height="7" patternTransform="rotate(-38)" patternUnits="userSpaceOnUse">
      <line x1="0" y1="0" x2="0" y2="7" stroke="{RED}" stroke-width="1" opacity="0.30"/>
    </pattern>
  </defs>"""

GROUND = 470
share = f"""<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="{PAPER}"/>{DEFS}
  <line x1="64" y1="58" x2="1136" y2="58" stroke="{INK}" stroke-width="2.4"/>
  <text x="64" y="44" font-family="{MONO}" font-size="14" letter-spacing="5" fill="{INK3}">PADDYSPEAKS</text>
  <text x="1136" y="44" text-anchor="end" font-family="{MONO}" font-size="14" letter-spacing="5" fill="{RED}">1960 &#8212; 2026</text>

  <text x="64" y="146" font-family="{SERIF}" font-size="70" font-weight="bold" fill="{INK}">CAN YOU REALLY</text>
  <text x="64" y="216" font-family="{SERIF}" font-size="70" font-weight="bold" fill="{INK}">AFFORD THE BAY</text>
  <text x="64" y="286" font-family="{SERIF}" font-size="70" font-weight="bold" fill="{INK}">AREA<tspan fill="{RED}">?</tspan></text>

  <text x="64" y="336" font-family="{SERIF}" font-size="25" font-style="italic" fill="#464C55">The house, the children, the career &#8212; and everything</text>
  <text x="64" y="368" font-family="{SERIF}" font-size="25" font-style="italic" fill="#464C55">life forgot to put in the budget.</text>

  {era(196, GROUND, 3,  BLUE, 'hb', '1960', '$19,000', INK)}
  {era(430, GROUND, 6,  BLUE, 'hb', '1980', '$118,000', INK)}
  {era(664, GROUND, 13, BLUE, 'hb', '2000', '$575,000', INK)}
  {era(940, GROUND, 28, RED,  'hr', '2026', '$2,300,000', RED)}
  <text x="970" y="{GROUND - 28*11 - 12}" text-anchor="middle" font-family="{MONO}" font-size="12" letter-spacing="2" fill="{RED}">10x</text>

  <line x1="64" y1="556" x2="1136" y2="556" stroke="#D6D2C6" stroke-width="1.6"/>
  <text x="64" y="592" font-family="{SANS}" font-size="17" fill="{GOLD}">Same house. Same street. Stacks drawn to scale, in 2026 dollars.</text>
  <text x="1136" y="592" text-anchor="end" font-family="{MONO}" font-size="14" letter-spacing="2.5" fill="{INK3}">paddyspeaks.com</text>
</svg>
"""

GROUND_P = 700
poster = f"""<svg xmlns="http://www.w3.org/2000/svg" width="800" height="860" viewBox="0 0 800 860">
  <rect width="800" height="860" fill="{PAPER}"/>{DEFS}
  <line x1="56" y1="86" x2="744" y2="86" stroke="{INK}" stroke-width="2.4"/>
  <text x="56" y="70" font-family="{MONO}" font-size="15" letter-spacing="5" fill="{RED}">1960 &#8212; 2026</text>
  <text x="56" y="188" font-family="{SERIF}" font-size="72" font-weight="bold" fill="{INK}">CAN YOU</text>
  <text x="56" y="260" font-family="{SERIF}" font-size="72" font-weight="bold" fill="{INK}">REALLY</text>
  <text x="56" y="332" font-family="{SERIF}" font-size="72" font-weight="bold" fill="{INK}">AFFORD THE</text>
  <text x="56" y="404" font-family="{SERIF}" font-size="72" font-weight="bold" fill="{INK}">BAY AREA<tspan fill="{RED}">?</tspan></text>
  <text x="56" y="456" font-family="{SERIF}" font-size="26" font-style="italic" fill="#464C55">One four-bedroom house, eight decades,</text>
  <text x="56" y="490" font-family="{SERIF}" font-size="26" font-style="italic" fill="#464C55">and everything life forgot to budget for.</text>
  {era(150, GROUND_P, 3,  BLUE, 'hb', '1960', '$19,000', INK)}
  {era(340, GROUND_P, 6,  BLUE, 'hb', '1980', '$118,000', INK)}
  {era(530, GROUND_P, 13, BLUE, 'hb', '2000', '$575,000', INK)}
  {era(700, GROUND_P, 28, RED,  'hr', '2026', '$2.3M', RED)}
  <line x1="56" y1="768" x2="744" y2="768" stroke="#D6D2C6" stroke-width="1.6"/>
  <text x="56" y="806" font-family="{SANS}" font-size="19" fill="{GOLD}">Stacks drawn to scale, in 2026 dollars.</text>
</svg>
"""

(SRC / "share-card.svg").write_text(share, encoding="utf-8")
(SRC / "poster.svg").write_text(poster, encoding="utf-8")

cairosvg.svg2png(bytestring=share.encode(), write_to=str(OUT / "share-card.png"),
                 output_width=1200, output_height=630)
cairosvg.svg2png(bytestring=poster.encode(), write_to=str(SRC / "poster.png"),
                 output_width=800, output_height=860)
Image.open(SRC / "poster.png").convert("RGB").save(OUT / "poster.webp", "WEBP", quality=88, method=6)
print("wrote", OUT / "share-card.png", (OUT / "share-card.png").stat().st_size, "bytes")
print("wrote", OUT / "poster.webp", (OUT / "poster.webp").stat().st_size, "bytes")

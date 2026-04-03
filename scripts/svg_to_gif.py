#!/usr/bin/env python3
"""Generate an animated GIF from the Decision Abyss cover SVG.

Manually interpolates the animation states at each frame since cairosvg
doesn't execute SMIL animations.
"""
import io, math
from PIL import Image

WIDTH, HEIGHT = 1200, 630
FPS = 15
DURATION = 7.0  # seconds
TOTAL_FRAMES = int(DURATION * FPS)

# ─── Easing helpers ───
def ease_out_expo(t):
    return 1 if t >= 1 else 1 - math.pow(2, -10 * t)

def clamp01(t):
    return max(0.0, min(1.0, t))

def lerp(a, b, t):
    return a + (b - a) * clamp01(t)

# ─── Animation definitions ───
# Each block: (start_time, duration, from_x, from_y, to_x, to_y, rotation, bob_amp, bob_period, bob_start)
BLOCKS = [
    # Cookies
    {"t0": 3.2, "dur": 0.8, "fx": -200, "fy": 195, "tx": 68,  "ty": 195, "rot": -3,  "bob": 6, "bp": 5.0, "bs": 4.0,
     "w": 190, "h": 105, "grad": "#FDDCCC", "grad2": "#F5C4A8", "label": "COOKIES & TRACKERS", "lc": "#9E6B3A",
     "detail": "3rd-party: blocked", "extra": "cookie"},
    # SEO
    {"t0": 3.5, "dur": 0.8, "fx": 1400, "fy": 185, "tx": 895, "ty": 185, "rot": 2,   "bob": 7, "bp": 6.0, "bs": 4.3,
     "w": 205, "h": 115, "grad": "#E0D4F0", "grad2": "#C8B8E0", "label": "SEO RANKING", "lc": "#6B4C8A",
     "detail": "Position tracking lost", "extra": "bars"},
    # CRM
    {"t0": 3.8, "dur": 0.9, "fx": -250, "fy": 340, "tx": 95,  "ty": 340, "rot": 1.5, "bob": 5, "bp": 7.0, "bs": 4.7,
     "w": 200, "h": 120, "grad": "#C4DDF0", "grad2": "#A0C4E0", "label": "CRM SILO", "lc": "#2E6090",
     "detail": "No purchase signal", "extra": "crm"},
    # AI
    {"t0": 3.4, "dur": 1.0, "fx": 440, "fy": 630, "tx": 440,  "ty": 265, "rot": -1,  "bob": 8, "bp": 5.5, "bs": 4.4,
     "w": 220, "h": 130, "grad": "#C8ECD8", "grad2": "#A8D8B8", "label": "AI RECOMMENDATION", "lc": "#2E6B40",
     "detail": "Source: opaque", "extra": "ai"},
    # ERP
    {"t0": 4.0, "dur": 0.9, "fx": 1400, "fy": 285, "tx": 755, "ty": 285, "rot": 2.5, "bob": 7, "bp": 6.5, "bs": 4.9,
     "w": 185, "h": 110, "grad": "#F0C8D0", "grad2": "#E0A8B8", "label": "ERP / INVENTORY", "lc": "#8A3050",
     "detail": "Stock ≠ demand data", "extra": None},
    # Social
    {"t0": 4.2, "dur": 0.9, "fx": -100, "fy": 700, "tx": 265, "ty": 435, "rot": -2,  "bob": 6, "bp": 5.8, "bs": 5.1,
     "w": 175, "h": 95, "grad": "#FBF0C8", "grad2": "#F0E0A0", "label": "SOCIAL SIGNAL", "lc": "#8A7020",
     "detail": "Reviews ≠ CRM record", "extra": None},
    # Analytics
    {"t0": 4.4, "dur": 0.9, "fx": 505, "fy": 750, "tx": 505, "ty": 450, "rot": 1,    "bob": 5, "bp": 6.2, "bs": 5.3,
     "w": 185, "h": 100, "grad": "#F8D0C0", "grad2": "#F0B8A0", "label": "WEB ANALYTICS", "lc": "#9E5030",
     "detail": "Bounce: 67% → why?", "extra": "sparkline"},
    # Warehouse
    {"t0": 4.6, "dur": 0.9, "fx": 1400, "fy": 430, "tx": 785, "ty": 430, "rot": -1.5, "bob": 5, "bp": 7.2, "bs": 5.5,
     "w": 175, "h": 95, "grad": "#D8C8F0", "grad2": "#BCA8E0", "label": "DATA WAREHOUSE", "lc": "#5A3D7A",
     "detail": "No join key", "extra": None},
]

CONNECTIONS = [
    (400, 155, 185, 225, "#C8956C", 0.25),
    (800, 155, 920, 210, "#6B4C8A", 0.25),
    (550, 155, 440, 280, "#4A7FB5", 0.2),
    (700, 155, 760, 295, "#C45C4A", 0.2),
    (600, 155, 600, 365, "#5A8A6C", 0.15),
]

PARTICLES = [
    (520, 220, 2, "#C8956C", 0.4, 4.0, 4),
    (680, 240, 1.5, "#6B4C8A", 0.35, 3.5, 4.3),
    (400, 310, 2, "#4A7FB5", 0.3, 5.0, 4.6),
    (780, 320, 1.5, "#C45C4A", 0.3, 4.2, 4.9),
    (600, 400, 2.5, "#5A8A6C", 0.25, 3.8, 5.2),
    (350, 420, 1.5, "#D4A054", 0.25, 4.5, 5.0),
    (850, 380, 2, "#8A3050", 0.2, 3.2, 5.3),
]

SEARCH_TEXT = "which is better — MacBook Air M4 or M5?"
TYPING_START = 0.1
TYPING_DUR = 3.3


def build_frame_svg(t):
    """Build an SVG string representing the animation state at time t."""
    lines = []
    lines.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {WIDTH} {HEIGHT}" width="{WIDTH}" height="{HEIGHT}">')

    # Background
    lines.append('<rect width="1200" height="630" fill="#1A1420"/>')
    lines.append('<rect width="1200" height="630" fill="#1C1730" opacity="0.5"/>')

    # Subtle ambient glows (very low opacity since no blur available)
    lines.append('<ellipse cx="350" cy="280" rx="180" ry="120" fill="#6B4C8A" opacity="0.03"/>')
    lines.append('<ellipse cx="850" cy="350" rx="150" ry="110" fill="#C8956C" opacity="0.02"/>')
    lines.append('<ellipse cx="600" cy="500" rx="200" ry="90" fill="#4A7FB5" opacity="0.02"/>')

    # Sparse dot pattern
    for dy in range(0, HEIGHT, 40):
        for dx in range(0, WIDTH, 40):
            lines.append(f'<circle cx="{dx+2}" cy="{dy+2}" r="0.6" fill="#6B4C8A" opacity="0.08"/>')

    # Connection lines (fade in after typing)
    conn_opacity_factor = clamp01((t - 2.8) / 1.2)
    if conn_opacity_factor > 0:
        for x1, y1, x2, y2, color, op in CONNECTIONS:
            lines.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{color}" stroke-width="1" stroke-dasharray="4,8" opacity="{op * conn_opacity_factor:.3f}"/>')

    # Search bar
    lines.append('<g transform="translate(250, 65)">')
    lines.append('<rect width="700" height="56" rx="28" fill="#FDFCFA" stroke="#E0DCD5" stroke-width="1"/>')
    lines.append('<circle cx="28" cy="28" r="5" fill="#4285F4" opacity="0.7"/>')
    lines.append('<circle cx="42" cy="28" r="5" fill="#EA4335" opacity="0.7"/>')
    lines.append('<circle cx="56" cy="28" r="5" fill="#FBBC05" opacity="0.7"/>')
    lines.append('<circle cx="70" cy="28" r="5" fill="#34A853" opacity="0.7"/>')
    lines.append('<circle cx="660" cy="28" r="10" fill="none" stroke="#9AA0A6" stroke-width="1.5"/>')
    lines.append('<line x1="667" y1="35" x2="674" y2="42" stroke="#9AA0A6" stroke-width="1.5" stroke-linecap="round"/>')

    # Typing text
    type_progress = clamp01((t - TYPING_START) / TYPING_DUR)
    chars_shown = int(type_progress * len(SEARCH_TEXT))
    visible_text = SEARCH_TEXT[:chars_shown]
    if visible_text:
        # Escape ampersand and special chars
        safe = visible_text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        lines.append(f'<text x="92" y="33" font-family="Helvetica, Arial, sans-serif" font-size="15" fill="#3C4043" letter-spacing="0.2">{safe}</text>')

    # Cursor
    cursor_x = 92 + chars_shown * 11.5
    cursor_x = min(cursor_x, 560)
    # Blink: on half the time
    blink_on = (int(t * 2) % 2 == 0)
    if blink_on:
        lines.append(f'<rect x="{cursor_x:.0f}" y="18" width="1.5" height="20" fill="#4285F4"/>')

    lines.append('</g>')  # end search bar

    # Floating blocks
    for b in BLOCKS:
        enter_t = clamp01((t - b["t0"]) / b["dur"])
        if enter_t <= 0:
            continue
        eased = ease_out_expo(enter_t)

        x = lerp(b["fx"], b["tx"], eased)
        y = lerp(b["fy"], b["ty"], eased)

        # Bob after arrival
        if t > b["t0"] + b["dur"]:
            bob_t = t - b["bs"]
            if bob_t > 0:
                y += b["bob"] * math.sin(2 * math.pi * bob_t / b["bp"])

        opacity = min(1.0, enter_t * 2.5)  # quick fade in
        rot = b["rot"]

        lines.append(f'<g transform="translate({x:.1f},{y:.1f}) rotate({rot})" opacity="{opacity:.2f}">')
        # Card shadow
        lines.append(f'<rect x="3" y="6" width="{b["w"]}" height="{b["h"]}" rx="12" fill="#000" opacity="0.15"/>')
        # Card body
        lines.append(f'<rect width="{b["w"]}" height="{b["h"]}" rx="12" fill="{b["grad"]}"/>')
        # Label
        safe_label = b["label"].replace("&", "&amp;")
        lines.append(f'<text x="16" y="28" font-family="monospace" font-size="9" fill="{b["lc"]}" letter-spacing="1.5" opacity="0.7">{safe_label}</text>')
        lines.append(f'<line x1="16" y1="36" x2="{min(b["w"]-30, 120)}" y2="36" stroke="{b["lc"]}" stroke-width="0.5" opacity="0.3"/>')

        # Placeholder content bars
        lines.append(f'<rect x="16" y="46" width="{b["w"]*0.5:.0f}" height="5" rx="2.5" fill="{b["lc"]}" opacity="0.2"/>')
        lines.append(f'<rect x="16" y="56" width="{b["w"]*0.35:.0f}" height="5" rx="2.5" fill="{b["lc"]}" opacity="0.15"/>')

        # SEO bars
        if b["extra"] == "bars":
            bar_heights = [24, 38, 52, 34, 26]
            for i, bh in enumerate(bar_heights):
                bx = 16 + i * 26
                by = 106 - bh
                op = 0.4 + (i == 2) * 0.3
                lines.append(f'<rect x="{bx}" y="{by}" width="20" height="{bh}" rx="2" fill="{b["lc"]}" opacity="{op:.1f}"/>')

        # AI chat bubble
        if b["extra"] == "ai":
            lines.append('<rect x="16" y="44" width="188" height="40" rx="8" fill="#FFF" opacity="0.5"/>')
            lines.append('<text x="24" y="59" font-family="Helvetica, Arial, sans-serif" font-size="10" fill="#2A4A30" opacity="0.7">"Based on your workflow, I\'d</text>')
            lines.append('<text x="24" y="73" font-family="Helvetica, Arial, sans-serif" font-size="10" fill="#2A4A30" opacity="0.7">recommend the M4 Air..."</text>')
            lines.append(f'<rect x="16" y="94" width="130" height="22" rx="6" fill="{b["lc"]}" opacity="0.12"/>')

        # CRM pipeline
        if b["extra"] == "crm":
            labels = ["Lead", "MQL", "SQL", "???"]
            for i, lbl in enumerate(labels):
                lx = 16 + i * 44
                op = 0.3 + (i < 3) * 0.15
                lines.append(f'<rect x="{lx}" y="78" width="38" height="14" rx="4" fill="{b["lc"]}" opacity="{op:.2f}"/>')
                lines.append(f'<text x="{lx+6}" y="88" font-family="monospace" font-size="7" fill="{b["lc"]}" opacity="0.7">{lbl}</text>')

        # Sparkline
        if b["extra"] == "sparkline":
            lines.append('<polyline points="16,70 35,55 55,62 75,48 95,52 115,44 135,58 155,40" fill="none" stroke="#C87050" stroke-width="1.5" opacity="0.5"/>')
            lines.append('<circle cx="155" cy="40" r="3" fill="#C87050" opacity="0.6"/>')

        # Cookie emoji
        if b["extra"] == "cookie":
            lines.append(f'<circle cx="{b["w"]-35}" cy="24" r="14" fill="{b["lc"]}" opacity="0.2"/>')

        # Detail text at bottom
        safe_detail = b["detail"].replace("≠", "!=").replace("→", "->")
        lines.append(f'<text x="16" y="{b["h"]-8}" font-family="monospace" font-size="8" fill="{b["lc"]}" opacity="0.5">{safe_detail}</text>')

        lines.append('</g>')

    # Particles
    for px, py, pr, pc, pop, pp, ps in PARTICLES:
        if t < ps:
            continue
        pt = t - ps
        pop_cur = pop * min(1, pt / 0.3)
        cy = py + 8 * math.sin(2 * math.pi * pt / pp)
        lines.append(f'<circle cx="{px}" cy="{cy:.1f}" r="{pr}" fill="{pc}" opacity="{pop_cur:.2f}"/>')

    # Title
    title_op = clamp01((t - 5.5) / 1.0) * 0.45
    subtitle_op = clamp01((t - 5.8) / 1.0) * 0.4
    if title_op > 0:
        lines.append(f'<text x="600" y="590" text-anchor="middle" font-family="Georgia, serif" font-size="17" font-weight="300" fill="#F5F0E8" letter-spacing="6" opacity="{title_op:.2f}">THE DECISION ABYSS</text>')
    if subtitle_op > 0:
        lines.append(f'<text x="600" y="612" text-anchor="middle" font-family="monospace" font-size="8" fill="#C8956C" letter-spacing="3" opacity="{subtitle_op:.2f}">A FIVE-PART EDITORIAL SERIES</text>')

    lines.append('</svg>')
    return '\n'.join(lines)


def main():
    import cairosvg
    frames = []
    for i in range(TOTAL_FRAMES):
        t = i / FPS
        svg_str = build_frame_svg(t)
        png_data = cairosvg.svg2png(bytestring=svg_str.encode('utf-8'), output_width=WIDTH, output_height=HEIGHT)
        img = Image.open(io.BytesIO(png_data)).convert('RGBA')
        # Convert to palette for GIF
        rgb = Image.new('RGB', img.size, (26, 20, 32))
        rgb.paste(img, mask=img.split()[3])
        frames.append(rgb)
        if (i + 1) % 15 == 0:
            print(f"  Frame {i+1}/{TOTAL_FRAMES} ({t:.1f}s)")

    out_path = '/home/user/paddyspeaks/images/articles/decision-abyss/cover.gif'
    frames[0].save(
        out_path,
        save_all=True,
        append_images=frames[1:],
        duration=int(1000 / FPS),
        loop=0,
        optimize=True,
    )
    print(f"\nDone! GIF saved to {out_path}")
    import os
    size_mb = os.path.getsize(out_path) / (1024 * 1024)
    print(f"File size: {size_mb:.1f} MB")


if __name__ == '__main__':
    main()

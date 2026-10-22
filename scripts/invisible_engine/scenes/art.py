"""Illustrated components for The Invisible Engine scenes (scaffolding only).

Every function returns an SVG fragment string. Coordinates are absolute in a
1600 x 900 canvas. Colours: step palette for panels/badges; arrow colours keep
the lesson's semantic meanings (see svgkit.COL).
"""
from xml.sax.saxutils import escape as esc

STEP = {  # (strong, light, border)
    'blue': ('#2563eb', '#eff6ff', '#93c5fd'),
    'green': ('#16a34a', '#f0fdf4', '#86efac'),
    'purple': ('#7c3aed', '#f5f3ff', '#c4b5fd'),
    'orange': ('#ea580c', '#fff7ed', '#fdba74'),
    'red': ('#dc2626', '#fef2f2', '#fca5a5'),
    'teal': ('#0d9488', '#f0fdfa', '#5eead4'),
    'amber': ('#b45309', '#fffbeb', '#fcd34d'),
    'slate': ('#334155', '#f8fafc', '#cbd5e1'),
}


def T(x, y, s, size=18, weight=400, fill='#1f2937', anchor='start', italic=False, mono=False):
    fam = "font-family:'JetBrains Mono',Menlo,Consolas,monospace;" if mono else ''
    it = 'font-style:italic;' if italic else ''
    lines = s.split('\n')
    if len(lines) == 1:
        return f'<text x="{x}" y="{y}" text-anchor="{anchor}" style="{fam}{it}font-size:{size}px;font-weight:{weight};fill:{fill}">{esc(s)}</text>'
    lh = round(size * 1.3)
    ts = ''.join(f'<tspan x="{x}" dy="{0 if i == 0 else lh}">{esc(l)}</tspan>' for i, l in enumerate(lines))
    return f'<text x="{x}" y="{y}" text-anchor="{anchor}" style="{fam}{it}font-size:{size}px;font-weight:{weight};fill:{fill}">{ts}</text>'


def badge(x, y, n, color='blue', r=24):
    c = STEP[color][0]
    return (f'<circle cx="{x}" cy="{y}" r="{r}" fill="{c}"/>'
            f'<text x="{x}" y="{y + r * 0.36:.0f}" text-anchor="middle" style="font-size:{r * 1.05:.0f}px;font-weight:800;fill:#ffffff">{esc(str(n))}</text>')


def panel(x, y, w, h, color='blue', n=None, title=None, sub=None, tsize=24):
    c, light, border = STEP[color]
    out = f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="18" fill="{light}" stroke="{border}" stroke-width="2"/>'
    tx = x + 24
    if n is not None:
        out += badge(x + 42, y + 44, n, color, 26)
        tx = x + 82
    if title:
        out += T(tx, y + 54 if n is not None else y + 44, title, tsize, 800, '#14213d')
    if sub:
        out += T(tx, y + 84 if n is not None else y + 72, sub, 17, 600, c)
    return out


def callout(x, y, w, h, title, body, color='blue', n=None, tsize=20, bsize=16.5):
    c, light, border = STEP[color]
    out = f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="12" fill="{light}" stroke="{border}" stroke-width="2"/>'
    tx = x + 16
    if n is not None:
        out += badge(x + 26, y + 30, n, color, 18)
        tx = x + 54
    out += T(tx, y + 36, title, tsize, 800, c)
    out += T(x + 16, y + 36 + tsize + 10, body, bsize, 400, '#334155')
    return out


def leader(x1, y1, x2, y2, color='#94a3b8'):
    return (f'<path d="M{x1},{y1} L{x2},{y2}" stroke="{color}" stroke-width="2"/>'
            f'<circle cx="{x2}" cy="{y2}" r="5" fill="{color}"/>')


def contactless(x, y, s=1.0, color='#ffffff', w=3):
    return ''.join(
        f'<path d="M{x + i * 9 * s:.1f},{y - (8 + i * 7) * s:.1f} q{(7 + i * 5) * s:.1f},{(8 + i * 7) * s:.1f} 0,{(16 + i * 14) * s:.1f}" '
        f'fill="none" stroke="{color}" stroke-width="{w}" stroke-linecap="round"/>' for i in range(3))


def chip_contacts(x, y, w, h):
    out = f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{h * 0.16:.0f}" fill="#fcd34d" stroke="#a16207" stroke-width="2"/>'
    out += f'<path d="M{x + w / 2},{y} L{x + w / 2},{y + h} M{x},{y + h / 3} L{x + w * 0.38},{y + h / 3} M{x + w * 0.62},{y + h / 3} L{x + w},{y + h / 3} M{x},{y + 2 * h / 3} L{x + w * 0.38},{y + 2 * h / 3} M{x + w * 0.62},{y + 2 * h / 3} L{x + w},{y + 2 * h / 3}" stroke="#a16207" stroke-width="1.6" fill="none"/>'
    out += f'<rect x="{x + w * 0.38}" y="{y + h * 0.22}" width="{w * 0.24}" height="{h * 0.56}" rx="3" fill="#fde68a" stroke="#a16207" stroke-width="1.4"/>'
    return out


def card(x, y, w=320, cut=False, number='•••• 1234', label='BANK', coil_turns=4):
    """A payment card. cut=True shows a cream cutaway with the antenna coil."""
    h = w * 0.63
    r = w * 0.05
    out = (f'<rect x="{x + 4}" y="{y + 6}" width="{w}" height="{h:.0f}" rx="{r:.0f}" fill="#0f172a" opacity="0.12"/>'
           f'<rect x="{x}" y="{y}" width="{w}" height="{h:.0f}" rx="{r:.0f}" fill="#1e3a8a"/>'
           f'<path d="M{x},{y + h * 0.62:.0f} Q{x + w * 0.5:.0f},{y + h * 0.45:.0f} {x + w},{y + h * 0.7:.0f} L{x + w},{y + h - r:.0f} Q{x + w},{y + h:.0f} {x + w - r:.0f},{y + h:.0f} L{x + r:.0f},{y + h:.0f} Q{x},{y + h:.0f} {x},{y + h - r:.0f} Z" fill="#1d4ed8" opacity="0.55"/>')
    if cut:
        m = w * 0.05
        out += f'<rect x="{x + m:.0f}" y="{y + m:.0f}" width="{w * 0.62:.0f}" height="{h - 2 * m:.0f}" rx="{r * 0.7:.0f}" fill="#fdf6e3" stroke="#d6c7a1" stroke-width="1.5"/>'
        for i in range(coil_turns):
            o = m + w * 0.025 + i * w * 0.018
            out += f'<rect x="{x + o:.1f}" y="{y + o:.1f}" width="{w * 0.62 - 2 * (o - m):.1f}" height="{h - 2 * o:.1f}" rx="{max(3, r * 0.6 - i * 2):.0f}" fill="none" stroke="#b45309" stroke-width="{max(1.6, w / 180):.1f}"/>'
    else:
        out += contactless(x + w * 0.80, y + h * 0.36, w / 260, '#ffffff', max(2, w / 110))
    out += chip_contacts(x + w * (0.27 if cut else 0.1), y + h * 0.33, w * 0.15, h * 0.24)
    if label:
        out += T(x + w - w * 0.06, y + h * 0.2, label, w * 0.07, 800, '#e0e7ff', 'end')
    if number:
        out += T(x + w * 0.1, y + h * 0.84, number, w * 0.065, 600, '#ffffff', mono=True)
    return out


def terminal(x, y, s=1.0, screen='Tap to pay', screen_fill='#e0f2fe', screen_ink='#0c4a6e'):
    """Countertop payment terminal, about 260 x 420 at s=1."""
    W, H = 260 * s, 420 * s
    out = (f'<rect x="{x + 6}" y="{y + 8}" width="{W:.0f}" height="{H:.0f}" rx="{30 * s:.0f}" fill="#0f172a" opacity="0.15"/>'
           f'<rect x="{x}" y="{y}" width="{W:.0f}" height="{H:.0f}" rx="{30 * s:.0f}" fill="#1f2937"/>'
           f'<rect x="{x + 6 * s:.0f}" y="{y + 6 * s:.0f}" width="{W - 12 * s:.0f}" height="{H - 12 * s:.0f}" rx="{26 * s:.0f}" fill="#374151"/>'
           f'<rect x="{x + 24 * s:.0f}" y="{y + 26 * s:.0f}" width="{W - 48 * s:.0f}" height="{150 * s:.0f}" rx="{12 * s:.0f}" fill="{screen_fill}" stroke="#0f172a" stroke-width="{3 * s:.1f}"/>')
    out += contactless(x + W / 2 - 14 * s, y + 80 * s, 1.15 * s, screen_ink, 3.2 * s)
    out += T(x + W / 2, y + 150 * s, screen, 22 * s, 800, screen_ink, 'middle')
    keys = ['#9ca3af'] * 9 + ['#ef4444', '#facc15', '#22c55e']
    for i, kc in enumerate(keys):
        cx = x + 40 * s + (i % 3) * 64 * s
        cy = y + 205 * s + (i // 3) * 46 * s
        out += f'<rect x="{cx:.0f}" y="{cy:.0f}" width="{52 * s:.0f}" height="{32 * s:.0f}" rx="{7 * s:.0f}" fill="{kc}" stroke="#111827" stroke-width="{1.5 * s:.1f}"/>'
    return out


def phone(x, y, w=170, h=340, screen='#ffffff'):
    r = w * 0.17
    return (f'<rect x="{x + 5}" y="{y + 7}" width="{w}" height="{h}" rx="{r:.0f}" fill="#0f172a" opacity="0.14"/>'
            f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r:.0f}" fill="#111827"/>'
            f'<rect x="{x + w * 0.06:.0f}" y="{y + w * 0.06:.0f}" width="{w * 0.88:.0f}" height="{h - w * 0.12:.0f}" rx="{r * 0.78:.0f}" fill="{screen}"/>'
            f'<rect x="{x + w * 0.36:.0f}" y="{y + w * 0.1:.0f}" width="{w * 0.28:.0f}" height="{w * 0.07:.0f}" rx="{w * 0.035:.0f}" fill="#111827"/>')


def tag(x, y, r=46):
    """A generic round tracker tag (no brand)."""
    return (f'<circle cx="{x + 3}" cy="{y + 5}" r="{r}" fill="#0f172a" opacity="0.13"/>'
            f'<circle cx="{x}" cy="{y}" r="{r}" fill="#f8fafc" stroke="#94a3b8" stroke-width="3"/>'
            f'<circle cx="{x}" cy="{y}" r="{r * 0.62:.0f}" fill="#e5e7eb" stroke="#cbd5e1" stroke-width="2"/>')


def bank(x, y, s=1.0, color='#64748b'):
    w = 120 * s
    out = f'<path d="M{x},{y + 30 * s} L{x + w / 2},{y} L{x + w},{y + 30 * s} Z" fill="{color}"/>'
    for i in range(4):
        out += f'<rect x="{x + 12 * s + i * 27 * s:.0f}" y="{y + 38 * s:.0f}" width="{14 * s:.0f}" height="{54 * s:.0f}" fill="{color}"/>'
    out += f'<rect x="{x}" y="{y + 94 * s:.0f}" width="{w:.0f}" height="{12 * s:.0f}" fill="{color}"/>'
    return out


def store(x, y, s=1.0, awning='#2563eb'):
    w = 140 * s
    out = f'<rect x="{x + 10 * s:.0f}" y="{y + 40 * s:.0f}" width="{w - 20 * s:.0f}" height="{80 * s:.0f}" fill="#e2e8f0" stroke="#475569" stroke-width="2"/>'
    for i in range(5):
        fill = awning if i % 2 == 0 else '#ffffff'
        out += f'<path d="M{x + i * w / 5:.0f},{y + 8 * s:.0f} L{x + (i + 1) * w / 5:.0f},{y + 8 * s:.0f} L{x + (i + 1) * w / 5:.0f},{y + 40 * s:.0f} Q{x + (i + 0.5) * w / 5:.0f},{y + 52 * s:.0f} {x + i * w / 5:.0f},{y + 40 * s:.0f} Z" fill="{fill}" stroke="#475569" stroke-width="1.5"/>'
    out += f'<rect x="{x + 28 * s:.0f}" y="{y + 64 * s:.0f}" width="{38 * s:.0f}" height="{30 * s:.0f}" fill="#bfdbfe" stroke="#475569" stroke-width="1.5"/>'
    out += f'<rect x="{x + 82 * s:.0f}" y="{y + 64 * s:.0f}" width="{30 * s:.0f}" height="{56 * s:.0f}" fill="#94a3b8" stroke="#475569" stroke-width="1.5"/>'
    return out


def globe(x, y, r=48, color='#2563eb'):
    return (f'<circle cx="{x}" cy="{y}" r="{r}" fill="#eff6ff" stroke="{color}" stroke-width="3"/>'
            f'<ellipse cx="{x}" cy="{y}" rx="{r * 0.45:.0f}" ry="{r}" fill="none" stroke="{color}" stroke-width="2.5"/>'
            f'<path d="M{x - r},{y} L{x + r},{y} M{x - r * 0.86:.0f},{y - r * 0.5:.0f} L{x + r * 0.86:.0f},{y - r * 0.5:.0f} M{x - r * 0.86:.0f},{y + r * 0.5:.0f} L{x + r * 0.86:.0f},{y + r * 0.5:.0f}" stroke="{color}" stroke-width="2"/>')


def lock(x, y, s=1.0, color='#7c3aed'):
    return (f'<path d="M{x + 10 * s:.0f},{y + 26 * s:.0f} L{x + 10 * s:.0f},{y + 16 * s:.0f} a{14 * s:.0f},{14 * s:.0f} 0 0 1 {28 * s:.0f},0 L{x + 38 * s:.0f},{y + 26 * s:.0f}" fill="none" stroke="{color}" stroke-width="{5 * s:.1f}"/>'
            f'<rect x="{x}" y="{y + 24 * s:.0f}" width="{48 * s:.0f}" height="{38 * s:.0f}" rx="{6 * s:.0f}" fill="{color}"/>'
            f'<circle cx="{x + 24 * s:.0f}" cy="{y + 40 * s:.0f}" r="{5 * s:.0f}" fill="#ffffff"/>'
            f'<rect x="{x + 22 * s:.0f}" y="{y + 42 * s:.0f}" width="{4 * s:.0f}" height="{10 * s:.0f}" fill="#ffffff"/>')


def shield(x, y, s=1.0, color='#16a34a'):
    return (f'<path d="M{x},{y + 10 * s:.0f} L{x + 30 * s:.0f},{y} L{x + 60 * s:.0f},{y + 10 * s:.0f} L{x + 60 * s:.0f},{y + 36 * s:.0f} Q{x + 60 * s:.0f},{y + 62 * s:.0f} {x + 30 * s:.0f},{y + 74 * s:.0f} Q{x},{y + 62 * s:.0f} {x},{y + 36 * s:.0f} Z" fill="{color}"/>'
            f'<path d="M{x + 17 * s:.0f},{y + 37 * s:.0f} L{x + 27 * s:.0f},{y + 47 * s:.0f} L{x + 45 * s:.0f},{y + 27 * s:.0f}" fill="none" stroke="#ffffff" stroke-width="{5 * s:.1f}" stroke-linecap="round" stroke-linejoin="round"/>')


def eye(x, y, s=1.0, color='#334155'):
    return (f'<path d="M{x},{y} Q{x + 40 * s:.0f},{y - 30 * s:.0f} {x + 80 * s:.0f},{y} Q{x + 40 * s:.0f},{y + 30 * s:.0f} {x},{y} Z" fill="#ffffff" stroke="{color}" stroke-width="{3 * s:.1f}"/>'
            f'<circle cx="{x + 40 * s:.0f}" cy="{y}" r="{12 * s:.0f}" fill="{color}"/>')


def battery(x, y, w=70, h=130, fill_frac=0.7, label=None):
    out = (f'<rect x="{x + w * 0.32:.0f}" y="{y - 12}" width="{w * 0.36:.0f}" height="14" rx="3" fill="#475569"/>'
           f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="12" fill="#ffffff" stroke="#334155" stroke-width="4"/>'
           f'<rect x="{x + 8}" y="{y + 8 + (h - 16) * (1 - fill_frac):.0f}" width="{w - 16}" height="{(h - 16) * fill_frac:.0f}" rx="6" fill="#4ade80"/>')
    if label:
        out += T(x + w / 2, y + h + 26, label, 16, 600, '#334155', 'middle')
    return out


def coin_cell(x, y, r=60):
    return (f'<circle cx="{x}" cy="{y}" r="{r}" fill="#e5e7eb" stroke="#6b7280" stroke-width="4"/>'
            f'<circle cx="{x}" cy="{y}" r="{r * 0.8:.0f}" fill="none" stroke="#9ca3af" stroke-width="2"/>'
            f'<text x="{x}" y="{y + 6}" text-anchor="middle" style="font-size:{r * 0.32:.0f}px;font-weight:700;fill:#374151">CR2032</text>')


def bulb(x, y, on=False):
    glass = '#fde047' if on else '#f1f5f9'
    out = ''
    if on:
        for a in range(8):
            import math
            ang = a * math.pi / 4
            out += f'<path d="M{x + 62 * math.cos(ang):.0f},{y + 62 * math.sin(ang):.0f} L{x + 82 * math.cos(ang):.0f},{y + 82 * math.sin(ang):.0f}" stroke="#f59e0b" stroke-width="5" stroke-linecap="round"/>'
    out += (f'<circle cx="{x}" cy="{y}" r="46" fill="{glass}" stroke="#334155" stroke-width="3"/>'
            f'<path d="M{x - 14},{y + 6} q7,-18 14,0 q7,18 14,0" fill="none" stroke="{"#b45309" if on else "#94a3b8"}" stroke-width="3"/>'
            f'<rect x="{x - 20}" y="{y + 42}" width="40" height="26" rx="4" fill="#9ca3af" stroke="#334155" stroke-width="2"/>')
    return out


def chip_box(x, y, w, h, title, body, color='slate', icon=None):
    c, light, border = STEP[color]
    out = f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10" fill="{light}" stroke="{c}" stroke-width="2"/>'
    out += T(x + 14, y + 30, title, 18, 800, '#14213d')
    out += T(x + 14, y + 54, body, 15.5, 400, '#475569')
    return out


def satellite(x, y, s=1.0):
    return (f'<rect x="{x - 14 * s:.0f}" y="{y - 10 * s:.0f}" width="{28 * s:.0f}" height="{20 * s:.0f}" rx="3" fill="#cbd5e1" stroke="#334155" stroke-width="2"/>'
            f'<rect x="{x - 58 * s:.0f}" y="{y - 8 * s:.0f}" width="{40 * s:.0f}" height="{16 * s:.0f}" fill="#93c5fd" stroke="#1e40af" stroke-width="2"/>'
            f'<rect x="{x + 18 * s:.0f}" y="{y - 8 * s:.0f}" width="{40 * s:.0f}" height="{16 * s:.0f}" fill="#93c5fd" stroke="#1e40af" stroke-width="2"/>')


def waves(x, y, n=3, color='#2563eb', s=1.0, dir=1):
    """Radio emission arcs (for a transmitter); label separately as illustrative."""
    return ''.join(
        f'<path d="M{x + dir * (14 + i * 14) * s:.0f},{y - (14 + i * 12) * s:.0f} q{dir * (10 + i * 6) * s:.0f},{(14 + i * 12) * s:.0f} 0,{(28 + i * 24) * s:.0f}" '
        f'fill="none" stroke="{color}" stroke-width="{4 * s:.1f}" stroke-linecap="round" opacity="{1 - i * 0.2:.2f}"/>' for i in range(n))


# ── shared objects for Modules 3–5 (phase 2) ─────────────────────────
def cloud(x, y, w=220, label=None, color='#64748b', fill='#f8fafc'):
    """A cloud service (relay, account service). (x, y) is the top-left of a w x 0.55w box."""
    h = w * 0.55
    out = (f'<path d="M{x + w * 0.22:.0f},{y + h:.0f} '
           f'a{w * 0.2:.0f},{w * 0.2:.0f} 0 0 1 {w * 0.02:.0f},{-h * 0.62:.0f} '
           f'a{w * 0.26:.0f},{w * 0.26:.0f} 0 0 1 {w * 0.5:.0f},{-h * 0.12:.0f} '
           f'a{w * 0.18:.0f},{w * 0.18:.0f} 0 0 1 {w * 0.04:.0f},{h * 0.74:.0f} Z" '
           f'fill="{fill}" stroke="{color}" stroke-width="3" stroke-linejoin="round"/>')
    if label:
        out += T(x + w * 0.5, y + h * 0.78, label, max(15, w * 0.075), 700, '#14213d', 'middle')
    return out


def server(x, y, s=1.0, label=None):
    """A small rack of servers, 120 x 150 at s=1."""
    out = ''
    for i in range(3):
        yy = y + i * 50 * s
        out += (f'<rect x="{x}" y="{yy:.0f}" width="{120 * s:.0f}" height="{42 * s:.0f}" rx="{6 * s:.0f}" fill="#e2e8f0" stroke="#334155" stroke-width="2.5"/>'
                f'<circle cx="{x + 18 * s:.0f}" cy="{yy + 21 * s:.0f}" r="{5 * s:.0f}" fill="#22c55e"/>'
                f'<rect x="{x + 40 * s:.0f}" y="{yy + 16 * s:.0f}" width="{64 * s:.0f}" height="{10 * s:.0f}" rx="3" fill="#94a3b8"/>')
    if label:
        out += T(x + 60 * s, y + 172 * s, label, 16, 700, '#334155', 'middle')
    return out


def suitcase(x, y, s=1.0, color='#0e7490'):
    """A wheeled suitcase, about 150 x 220 at s=1; (x, y) top-left of the body."""
    w, h = 150 * s, 190 * s
    return (f'<path d="M{x + w * 0.3:.0f},{y} L{x + w * 0.3:.0f},{y - 40 * s:.0f} L{x + w * 0.7:.0f},{y - 40 * s:.0f} L{x + w * 0.7:.0f},{y}" fill="none" stroke="#334155" stroke-width="{6 * s:.1f}"/>'
            f'<rect x="{x + 5}" y="{y + 7}" width="{w:.0f}" height="{h:.0f}" rx="{18 * s:.0f}" fill="#0f172a" opacity="0.13"/>'
            f'<rect x="{x}" y="{y}" width="{w:.0f}" height="{h:.0f}" rx="{18 * s:.0f}" fill="{color}"/>'
            + ''.join(f'<path d="M{x + w * k:.0f},{y + 14 * s:.0f} L{x + w * k:.0f},{y + h - 14 * s:.0f}" stroke="#ffffff" stroke-opacity="0.35" stroke-width="{5 * s:.1f}"/>' for k in (0.3, 0.5, 0.7))
            + f'<circle cx="{x + w * 0.2:.0f}" cy="{y + h + 12 * s:.0f}" r="{11 * s:.0f}" fill="#334155"/>'
              f'<circle cx="{x + w * 0.8:.0f}" cy="{y + h + 12 * s:.0f}" r="{11 * s:.0f}" fill="#334155"/>')


def person(x, y, s=1.0, color='#475569', phone_in_hand=False):
    """A simple standing figure, about 80 x 220 at s=1; (x, y) is the top of the head's centre."""
    out = (f'<circle cx="{x}" cy="{y + 24 * s:.0f}" r="{24 * s:.0f}" fill="{color}"/>'
           f'<path d="M{x - 34 * s:.0f},{y + 140 * s:.0f} L{x - 34 * s:.0f},{y + 80 * s:.0f} Q{x - 34 * s:.0f},{y + 56 * s:.0f} {x - 10 * s:.0f},{y + 56 * s:.0f} '
           f'L{x + 10 * s:.0f},{y + 56 * s:.0f} Q{x + 34 * s:.0f},{y + 56 * s:.0f} {x + 34 * s:.0f},{y + 80 * s:.0f} L{x + 34 * s:.0f},{y + 140 * s:.0f} Z" fill="{color}"/>'
           f'<rect x="{x - 26 * s:.0f}" y="{y + 132 * s:.0f}" width="{20 * s:.0f}" height="{88 * s:.0f}" rx="{8 * s:.0f}" fill="{color}"/>'
           f'<rect x="{x + 6 * s:.0f}" y="{y + 132 * s:.0f}" width="{20 * s:.0f}" height="{88 * s:.0f}" rx="{8 * s:.0f}" fill="{color}"/>')
    if phone_in_hand:
        out += f'<rect x="{x + 34 * s:.0f}" y="{y + 92 * s:.0f}" width="{18 * s:.0f}" height="{32 * s:.0f}" rx="{4 * s:.0f}" fill="#111827" stroke="#e5e7eb" stroke-width="1.5"/>'
    return out


def pin(x, y, s=1.0, color='#2563eb'):
    """A map pin whose point is at (x, y)."""
    return (f'<path d="M{x},{y} C{x - 34 * s:.0f},{y - 50 * s:.0f} {x - 34 * s:.0f},{y - 90 * s:.0f} {x},{y - 94 * s:.0f} '
            f'C{x + 34 * s:.0f},{y - 90 * s:.0f} {x + 34 * s:.0f},{y - 50 * s:.0f} {x},{y} Z" fill="{color}"/>'
            f'<circle cx="{x}" cy="{y - 64 * s:.0f}" r="{11 * s:.0f}" fill="#ffffff"/>')


def id_badge(x, y, w=150, label="STAFF", color="#0f766e"):
    """A staff ID badge on a clip (generic, fictional), w x 1.45w."""
    h = w * 1.45
    return (f'<rect x="{x + w * 0.38:.0f}" y="{y - 22}" width="{w * 0.24:.0f}" height="30" rx="6" fill="#94a3b8"/>'
            f'<rect x="{x + 4}" y="{y + 6}" width="{w}" height="{h:.0f}" rx="12" fill="#0f172a" opacity="0.12"/>'
            f'<rect x="{x}" y="{y}" width="{w}" height="{h:.0f}" rx="12" fill="#ffffff" stroke="#334155" stroke-width="3"/>'
            f'<rect x="{x}" y="{y}" width="{w}" height="{h * 0.2:.0f}" rx="12" fill="{color}"/>'
            f'<rect x="{x}" y="{y + h * 0.12:.0f}" width="{w}" height="{h * 0.08:.0f}" fill="{color}"/>'
            + T(x + w / 2, y + h * 0.15, label, w * 0.11, 800, '#ffffff', 'middle')
            + f'<circle cx="{x + w / 2:.0f}" cy="{y + h * 0.42:.0f}" r="{w * 0.17:.0f}" fill="#cbd5e1"/>'
              f'<rect x="{x + w * 0.2:.0f}" y="{y + h * 0.66:.0f}" width="{w * 0.6:.0f}" height="{h * 0.05:.0f}" rx="4" fill="#94a3b8"/>'
              f'<rect x="{x + w * 0.28:.0f}" y="{y + h * 0.76:.0f}" width="{w * 0.44:.0f}" height="{h * 0.04:.0f}" rx="4" fill="#cbd5e1"/>')


def wall_reader(x, y, s=1.0, led='#22c55e'):
    """A wall-mounted access-control reader, 110 x 170 at s=1."""
    return (f'<rect x="{x + 4}" y="{y + 6}" width="{110 * s:.0f}" height="{170 * s:.0f}" rx="{16 * s:.0f}" fill="#0f172a" opacity="0.14"/>'
            f'<rect x="{x}" y="{y}" width="{110 * s:.0f}" height="{170 * s:.0f}" rx="{16 * s:.0f}" fill="#1f2937"/>'
            f'<circle cx="{x + 55 * s:.0f}" cy="{y + 70 * s:.0f}" r="{30 * s:.0f}" fill="none" stroke="#9ca3af" stroke-width="{3 * s:.1f}"/>'
            + contactless(x + 42 * s, y + 70 * s, 0.7 * s, '#e5e7eb', 2.5 * s)
            + f'<circle cx="{x + 55 * s:.0f}" cy="{y + 140 * s:.0f}" r="{8 * s:.0f}" fill="{led}"/>')


def qr(x, y, size=120):
    """A QR-code-like pattern (decorative, not a real code)."""
    c = size / 7
    out = f'<rect x="{x}" y="{y}" width="{size}" height="{size}" fill="#ffffff" stroke="#334155" stroke-width="2"/>'
    for cx, cy in ((0, 0), (4, 0), (0, 4)):
        out += (f'<rect x="{x + cx * c + 2:.0f}" y="{y + cy * c + 2:.0f}" width="{3 * c - 4:.0f}" height="{3 * c - 4:.0f}" fill="none" stroke="#111827" stroke-width="{c * 0.5:.1f}"/>'
                f'<rect x="{x + (cx + 1) * c:.0f}" y="{y + (cy + 1) * c:.0f}" width="{c:.0f}" height="{c:.0f}" fill="#111827"/>')
    for i, j in ((4, 4), (5, 5), (6, 4), (4, 6), (6, 6), (5, 3), (3, 5)):
        out += f'<rect x="{x + i * c:.0f}" y="{y + j * c:.0f}" width="{c * 0.9:.0f}" height="{c * 0.9:.0f}" fill="#111827"/>'
    return out


def box_parcel(x, y, w=150, label=None):
    """A cardboard parcel (front face w x 0.7w) with a shipping label."""
    h = w * 0.7
    out = (f'<path d="M{x},{y} L{x + w * 0.2:.0f},{y - h * 0.25:.0f} L{x + w * 1.2:.0f},{y - h * 0.25:.0f} L{x + w},{y} Z" fill="#e9c38f" stroke="#92400e" stroke-width="2"/>'
           f'<path d="M{x + w},{y} L{x + w * 1.2:.0f},{y - h * 0.25:.0f} L{x + w * 1.2:.0f},{y + h * 0.75:.0f} L{x + w},{y + h:.0f} Z" fill="#c8964f" stroke="#92400e" stroke-width="2"/>'
           f'<rect x="{x}" y="{y}" width="{w}" height="{h:.0f}" fill="#d9a766" stroke="#92400e" stroke-width="2"/>'
           f'<rect x="{x + w * 0.45:.0f}" y="{y + h * 0.3:.0f}" width="{w * 0.45:.0f}" height="{h * 0.45:.0f}" fill="#ffffff" stroke="#92400e" stroke-width="1.5"/>')
    if label:
        out += T(x + w * 0.675, y + h * 0.58, label, w * 0.09, 700, '#334155', 'middle')
    return out


def tracker_box(x, y, s=1.0):
    """A generic GPS + cellular tracker: a larger box with an antenna stub, 160 x 100 at s=1."""
    return (f'<rect x="{x + 4}" y="{y + 6}" width="{160 * s:.0f}" height="{100 * s:.0f}" rx="{16 * s:.0f}" fill="#0f172a" opacity="0.13"/>'
            f'<rect x="{x}" y="{y}" width="{160 * s:.0f}" height="{100 * s:.0f}" rx="{16 * s:.0f}" fill="#334155"/>'
            f'<rect x="{x + 120 * s:.0f}" y="{y - 30 * s:.0f}" width="{12 * s:.0f}" height="{34 * s:.0f}" rx="4" fill="#334155"/>'
            f'<rect x="{x + 16 * s:.0f}" y="{y + 18 * s:.0f}" width="{70 * s:.0f}" height="{30 * s:.0f}" rx="5" fill="#0ea5e9"/>'
            + T(x + 51 * s, y + 39 * s, 'GPS', 15 * s, 800, '#ffffff', 'middle')
            + f'<circle cx="{x + 130 * s:.0f}" cy="{y + 70 * s:.0f}" r="{7 * s:.0f}" fill="#22c55e"/>')

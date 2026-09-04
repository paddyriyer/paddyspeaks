#!/usr/bin/env python3
"""Plate generator for articles/the-interview-room.html.

Authors every illustration in the article as an SVG, then renders each one to a
2x PNG (kept in this directory as the archival source) and a WebP (what the page
actually loads). Nothing else in the repo is touched.

    pip install pillow cairosvg
    python images/articles/the-interview-room/source/make_plates.py
"""
from __future__ import annotations

import html
import pathlib

import cairosvg
from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE.parent

# ---------------------------------------------------------------- palette ----
PAPER   = "#F4F1EA"
PAPER2  = "#EAE5D9"
CARD    = "#FCFAF5"
INK     = "#14181F"
INK2    = "#48505C"
INK3    = "#8B929E"
RULE    = "#D6D0C2"
RULE2   = "#E7E2D6"
SCREEN  = "#10151C"
SCREEN2 = "#1B222C"
SCREEN3 = "#2A3340"
GREEN   = "#2E6B4E"
GREENL  = "#5FA37D"
AMBER   = "#B0821F"
AMBERL  = "#D9B45A"
RED     = "#A6322A"
REDL    = "#CF6A5E"
STEEL   = "#2C5570"
STEELL  = "#5B87A6"

SANS  = "Liberation Sans,DejaVu Sans,Helvetica,sans-serif"
MONO  = "DejaVu Sans Mono,Liberation Mono,monospace"
SERIF = "Charter,Bitstream Charter,Liberation Serif,Georgia,serif"


def esc(s: str) -> str:
    return html.escape(str(s), quote=False)


def t(x, y, s, size=15, fill=INK, family=SANS, weight="400", anchor="start",
      spacing=None, opacity=None, style=""):
    a = f' text-anchor="{anchor}"' if anchor != "start" else ""
    sp = f' letter-spacing="{spacing}"' if spacing else ""
    op = f' opacity="{opacity}"' if opacity else ""
    return (f'<text x="{x}" y="{y}" font-family="{family}" font-size="{size}" '
            f'font-weight="{weight}" fill="{fill}"{a}{sp}{op} style="{style}">{esc(s)}</text>')


def rect(x, y, w, h, fill="none", stroke=None, sw=1, rx=0, opacity=None, dash=None):
    st = f' stroke="{stroke}" stroke-width="{sw}"' if stroke else ""
    op = f' opacity="{opacity}"' if opacity is not None else ""
    da = f' stroke-dasharray="{dash}"' if dash else ""
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}"{st}{op}{da}/>'


def line(x1, y1, x2, y2, stroke=RULE, sw=1, dash=None, cap="butt", opacity=None):
    da = f' stroke-dasharray="{dash}"' if dash else ""
    op = f' opacity="{opacity}"' if opacity is not None else ""
    return (f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{stroke}" '
            f'stroke-width="{sw}" stroke-linecap="{cap}"{da}{op}/>')


def path(d, stroke=None, sw=1.5, fill="none", dash=None, cap="round", join="round", opacity=None):
    st = f' stroke="{stroke}" stroke-width="{sw}" stroke-linecap="{cap}" stroke-linejoin="{join}"' if stroke else ""
    da = f' stroke-dasharray="{dash}"' if dash else ""
    op = f' opacity="{opacity}"' if opacity is not None else ""
    return f'<path d="{d}" fill="{fill}"{st}{da}{op}/>'


def circ(cx, cy, r, fill="none", stroke=None, sw=1, opacity=None, dash=None):
    st = f' stroke="{stroke}" stroke-width="{sw}"' if stroke else ""
    op = f' opacity="{opacity}"' if opacity is not None else ""
    da = f' stroke-dasharray="{dash}"' if dash else ""
    return f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{fill}"{st}{op}{da}/>'


def arrow_down(x, y1, y2, stroke=INK3, sw=1.6):
    """Vertical arrow with a solid head."""
    head_y = y2 - 7
    return (line(x, y1, x, head_y, stroke, sw, cap="round")
            + f'<path d="M {x-4.5} {head_y} L {x+4.5} {head_y} L {x} {y2} Z" fill="{stroke}"/>')


def arrow_right(x1, y, x2, stroke=INK3, sw=1.6, dash=None):
    hx = x2 - 7
    return (line(x1, y, hx, y, stroke, sw, dash=dash, cap="round")
            + f'<path d="M {hx} {y-4.5} L {hx} {y+4.5} L {x2} {y} Z" fill="{stroke}"/>')


def frame(w, h, bg=PAPER):
    return rect(0, 0, w, h, fill=bg) + rect(0.75, 0.75, w - 1.5, h - 1.5, stroke=RULE, sw=1.5)


def header(w, eyebrow, title, sub=None, y=54, colour=AMBER):
    out = [t(46, y - 22, eyebrow.upper(), 13, colour, MONO, "500", spacing="2.6"),
           t(46, y + 14, title, 30, INK, SANS, "700")]
    if sub:
        out.append(t(46, y + 42, sub, 16.5, INK2, SERIF, "400"))
    out.append(line(46, y + (62 if sub else 36), w - 46, y + (62 if sub else 36), RULE, 1.2))
    return "".join(out)


def svg(w, h, body, bg=PAPER):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" '
            f'viewBox="0 0 {w} {h}">{frame(w, h, bg)}{body}</svg>')


PLATES: dict[str, tuple[int, int, str]] = {}


def plate(name, w, h, body, bg=PAPER):
    PLATES[name] = (w, h, svg(w, h, body, bg))

# =============================================================== 1. HERO ======
def _hero():
    W, H = 1040, 640
    b = []
    b.append(t(46, 44, "INT. VIDEO INTERVIEW — 09:02", 13, AMBER, MONO, "500", spacing="2.6"))
    b.append(t(46, 76, "Northstar Data Platforms · Backline & Escalation Engineering",
              25, INK, SANS, "700"))
    b.append(line(46, 92, W - 46, 92, RULE, 1.2))

    wx, wy, ww, wh = 46, 112, W - 92, 490
    b.append(rect(wx, wy, ww, wh, fill=SCREEN, rx=10))
    b.append(rect(wx, wy, ww, 34, fill=SCREEN3, rx=10))
    b.append(rect(wx, wy + 22, ww, 12, fill=SCREEN3))
    for i, c in enumerate(("#CF6A5E", "#D9B45A", "#5FA37D")):
        b.append(circ(wx + 20 + i * 17, wy + 17, 5, fill=c, opacity=.85))
    b.append(t(wx + ww / 2, wy + 22, "Interview · Staff Escalation Engineer · recording OFF",
               13, "#96A0AE", MONO, "400", anchor="middle"))

    sx, sy, sw_, sh = wx + 16, wy + 50, 646, 400
    b.append(rect(sx, sy, sw_, sh, fill=SCREEN2, rx=6))
    b.append(t(sx + 16, sy + 26, "SHARED SCREEN", 11, AMBERL, MONO, "500", spacing="2.2"))
    b.append(t(sx + 16, sy + 48, "Stage 17  ·  1,000 tasks  ·  duration by task id",
               15, "#DDE3EA", SANS, "600"))
    b.append(line(sx + 16, sy + 60, sx + sw_ - 16, sy + 60, "#39434F", 1))

    cx0, cy0, cw, ch = sx + 46, sy + 82, sw_ - 78, 200
    b.append(line(cx0, cy0 + ch, cx0 + cw, cy0 + ch, "#4A5666", 1.2))
    b.append(line(cx0, cy0, cx0, cy0 + ch, "#4A5666", 1.2))
    for lab, frac in (("30 min", 0.0), ("15 min", 0.5), ("0", 1.0)):
        yy = cy0 + ch * frac
        b.append(t(cx0 - 10, yy + 4, lab, 10.5, "#7C8697", MONO, "400", anchor="end"))
        if frac != 1.0:
            b.append(line(cx0, yy, cx0 + cw, yy, "#333D4A", 1, dash="3 5"))

    heights, seed = [], 20260904
    for _ in range(118):
        seed = (seed * 1103515245 + 12345) % 2147483648
        heights.append(11 + (seed % 1000) / 1000 * 10)
    spikes = {37: 178, 68: 194, 99: 164}
    bw = cw / 118
    for i, hgt in enumerate(heights):
        x = cx0 + i * bw
        if i in spikes:
            b.append(rect(x + 0.6, cy0 + ch - spikes[i], bw - 1.2, spikes[i], fill=REDL, rx=1))
        else:
            b.append(rect(x + 0.6, cy0 + ch - hgt, bw - 1.2, hgt, fill="#5B87A6", rx=1, opacity=.9))
    b.append(t(cx0, cy0 + ch + 19, "task 0", 10.5, "#7C8697", MONO))
    b.append(t(cx0 + cw, cy0 + ch + 19, "task 999", 10.5, "#7C8697", MONO, anchor="end"))

    ay = sy + 328
    b.append(rect(sx + 16, ay, sw_ - 32, 46, fill="#241F1D", rx=5))
    b.append(rect(sx + 16, ay, 3, 46, fill=REDL))
    b.append(t(sx + 32, ay + 20, "997 tasks:  25–40 sec   ·   ~600 MB in", 12.5, "#C9D2DC", MONO))
    b.append(t(sx + 32, ay + 38, "  3 tasks:  22–31 min   ·   28–43 GB in", 12.5, REDL, MONO, "500"))

    def tile(x, y, w, h, name, role, accent, initials):
        o = [rect(x, y, w, h, fill=SCREEN2, rx=6)]
        o.append(circ(x + w / 2, y + h / 2 - 14, 34, fill=accent, opacity=.16))
        o.append(circ(x + w / 2, y + h / 2 - 14, 34, stroke=accent, sw=1.4))
        o.append(t(x + w / 2, y + h / 2 - 6, initials, 24, accent, SANS, "700", anchor="middle"))
        o.append(t(x + w / 2, y + h - 34, name, 15, "#E4E9EF", SANS, "600", anchor="middle"))
        o.append(t(x + w / 2, y + h - 16, role, 11, "#8B95A3", MONO, "400", anchor="middle"))
        return "".join(o)

    tx = sx + sw_ + 16
    tw = wx + ww - 16 - tx
    b.append(tile(tx, sy, tw, 192, "Alex Morgan", "HIRING MANAGER", AMBERL, "AM"))
    b.append(tile(tx, sy + 208, tw, 192, "Jordan Lee", "CANDIDATE", STEELL, "JL"))
    for x, lab in ((tx + 14, "mic"), (tx + 74, "cam"), (tx + 134, "chat")):
        b.append(rect(x, sy + 412, 50, 26, fill=SCREEN3, rx=13))
        b.append(t(x + 25, sy + 429, lab, 10.5, "#9AA4B2", MONO, anchor="middle"))

    b.append(t(46, H - 22, "Fictional company. Fictional people. Real class of problem.",
               13.5, INK3, SERIF, "400"))
    return W, H, "".join(b)


plate("hero-interview-room", *_hero())


# ====================================================== 2. VERTICAL MOVE ======
def _vertical():
    W, H = 1000, 800
    b = [header(W, "the question behind “are you still hands-on?”",
                "Moving vertically — and coming back up",
                "Anyone can name the layers. The test is whether you can travel through them in both directions.")]
    top = 176
    down = ["Architecture", "Application", "Spark plan", "Stage", "Task", "Partition", "JVM", "Code"]
    up = ["Root cause", "Architecture improvement", "Automation", "Product improvement"]
    lx, rx, step, wd = 200, W - 200, 52, 262

    b.append(t(lx, top - 26, "DESCENT — narrowing to evidence", 12.5, STEEL, MONO, "500",
               spacing="1.4", anchor="middle"))
    for i, lab in enumerate(down):
        y = top + i * step
        b.append(rect(lx - wd / 2, y, wd, 34, fill=CARD, stroke=RULE, sw=1.1, rx=4))
        b.append(rect(lx - wd / 2, y, 3, 34, fill=STEEL))
        b.append(t(lx, y + 22, lab, 15.5, INK, SANS, "600", anchor="middle"))
        if i < len(down) - 1:
            b.append(arrow_down(lx, y + 36, y + step - 2, STEELL, 1.5))

    b.append(t(rx, top - 26, "ASCENT — widening to leverage", 12.5, GREEN, MONO, "500",
               spacing="1.4", anchor="middle"))
    ups = []
    for i, lab in enumerate(up):
        y = top + (len(up) - 1 - i) * 66 + 8
        ups.append(y)
        b.append(rect(rx - wd / 2, y, wd, 40, fill=CARD, stroke=RULE, sw=1.1, rx=4))
        b.append(rect(rx - wd / 2, y, 3, 40, fill=GREEN))
        b.append(t(rx, y + 26, lab, 15.5, INK, SANS, "600", anchor="middle"))
    for i in range(len(up) - 1):
        y_from, y_to = ups[i], ups[i + 1]          # travelling upward
        b.append(line(rx, y_from - 4, rx, y_to + 50, GREENL, 1.5, cap="round"))
        b.append(f'<path d="M {rx-4.5} {y_to+50} L {rx+4.5} {y_to+50} L {rx} {y_to+42} Z" fill="{GREENL}"/>')

    ty = top + (len(down) - 1) * step + 34
    root_bottom = ups[0] + 40
    b.append(path(f"M {lx} {ty + 8} L {lx} {ty + 60} Q {lx} {ty + 82} {lx + 40} {ty + 82} "
                  f"L {rx - 40} {ty + 82} Q {rx} {ty + 82} {rx} {ty + 60} "
                  f"L {rx} {root_bottom + 12}", stroke=AMBER, sw=2, dash="7 6"))
    b.append(f'<path d="M {rx-5} {root_bottom+12} L {rx+5} {root_bottom+12} L {rx} {root_bottom+2} Z" fill="{AMBER}"/>')
    b.append(rect(W / 2 - 168, ty + 68, 336, 28, fill=PAPER))
    b.append(t(W / 2, ty + 88, "the same person, walking back up", 15, AMBER, SERIF, "400",
               anchor="middle", style="font-style:italic"))
    b.append(line(46, H - 62, W - 46, H - 62, RULE2, 1))
    b.append(t(W / 2, H - 32,
               "“An architect who cannot read a task log is quoting other people’s work.”",
               17.5, INK2, SERIF, "400", anchor="middle", style="font-style:italic"))
    return W, H, "".join(b)


plate("vertical-move", *_vertical())


# ====================================================== 3. SKEW ANATOMY =======
def _skew():
    W, H = 1040, 720
    b = [header(W, "act iii — stage 17", "Skew is a symptom. Go find the cause.",
                "Three tasks out of a thousand did 4% of the work and 61% of the waiting.")]
    px, py, pw, ph = 46, 174, 496, 330
    b.append(rect(px, py, pw, ph, fill=CARD, stroke=RULE, sw=1.1, rx=6))
    b.append(t(px + 20, py + 30, "KEY FREQUENCY — join key customer_id", 11.5, STEEL, MONO,
               "500", spacing="1.4"))
    b.append(t(px + 20, py + 52, "3.1 billion rows on the fact side", 13, INK3, SERIF))
    bars = [("(null)", 0.41, RED), ("'UNKNOWN'", 0.18, RED), ("-1  (sentinel)", 0.11, AMBER),
            ("C_88213", 0.014, STEELL), ("C_10477", 0.011, STEELL),
            ("… 61 M other keys", 0.275, GREENL)]
    by = py + 78
    maxw = pw - 200
    for i, (lab, frac, col) in enumerate(bars):
        y = by + i * 36
        b.append(t(px + 20, y + 15, lab, 13, INK, MONO))
        b.append(rect(px + 168, y + 3, maxw, 15, fill=PAPER2, rx=2))
        b.append(rect(px + 168, y + 3, max(3, maxw * frac), 15, fill=col, rx=2))
        b.append(t(px + 168 + maxw + 8, y + 15, f"{frac*100:.1f}%", 12, INK2, MONO))
    b.append(line(px + 20, py + ph - 44, px + pw - 20, py + ph - 44, RULE2, 1))
    b.append(t(px + 20, py + ph - 22,
               "70% of the join key is three values that mean “we didn’t know”.",
               14.5, RED, SERIF, "400"))

    qx = px + pw + 26
    qw = W - 46 - qx
    b.append(rect(qx, py, qw, ph, fill=CARD, stroke=RULE, sw=1.1, rx=6))
    b.append(t(qx + 20, py + 30, "WHAT I ASK BEFORE I TOUCH A CONFIG", 11.5, AMBER, MONO,
               "500", spacing="1.4"))
    qs = ["Which column is the join / group key?",
          "What is the top-20 key frequency?",
          "Are nulls and sentinels being joined?",
          "Is the key low-cardinality by design?",
          "Is one side exploding the row count?",
          "Is the partition column also the skewed key?",
          "Did the distribution change, or did the code?"]
    for i, q in enumerate(qs):
        y = py + 62 + i * 33
        b.append(circ(qx + 28, y + 5, 3, fill=AMBER))
        b.append(t(qx + 44, y + 10, q, 14.5, INK, SERIF))
    b.append(line(qx + 20, py + ph - 44, qx + qw - 20, py + ph - 44, RULE2, 1))
    b.append(t(qx + 20, py + ph - 22, "None of these are settings. All of them are evidence.",
               14.5, GREEN, SERIF))

    ry = py + ph + 40
    b.append(t(46, ry, "REMEDIES — none of which is a first move", 11.5, INK3, MONO, "500",
               spacing="1.6"))
    chips = [("Filter the junk keys", "cheapest, if the rows are meaningless"),
             ("Pre-aggregate", "shrink before you shuffle"),
             ("Broadcast the small side", "if it really is small"),
             ("AQE skew join", "splits the big partition for you"),
             ("Salt the hot key", "when AQE can’t, and you know which key"),
             ("Fix the data model", "the only one that stops it recurring")]
    cw = (W - 92 - 5 * 12) / 6
    for i, (title, note) in enumerate(chips):
        x = 46 + i * (cw + 12)
        col = GREEN if i == 5 else (AMBER if i >= 3 else STEEL)
        b.append(rect(x, ry + 18, cw, 84, fill=CARD, stroke=RULE, sw=1.1, rx=5))
        b.append(rect(x, ry + 18, cw, 3, fill=col))
        for j, wline in enumerate(_wrap(title, 15)):
            b.append(t(x + 12, ry + 44 + j * 17, wline, 14, INK, SANS, "600"))
        for j, wline in enumerate(_wrap(note, 22)):
            b.append(t(x + 12, ry + 80 + j * 15, wline, 11.5, INK3, SERIF))
    b.append(t(W / 2, H - 26,
               "“Salting is an answer. It is not a diagnosis.”",
               17.5, INK2, SERIF, anchor="middle", style="font-style:italic"))
    return W, H, "".join(b)


def _wrap(s, n):
    words, out, cur = s.split(), [], ""
    for w in words:
        if len(cur) + len(w) + 1 <= n:
            cur = f"{cur} {w}".strip()
        else:
            out.append(cur); cur = w
    if cur:
        out.append(cur)
    return out


plate("skew-anatomy", *_skew())


# ==================================================== 4. CATALYST PIPELINE ====
def _catalyst():
    W, H = 1040, 856
    b = [header(W, "act iv — what actually happens", "One query, nine translations",
                "Every arrow is a place where something can silently go wrong.")]
    stages = [
        ("SQL / DataFrame", "what you wrote", "df.explain(True)"),
        ("Unresolved Logical Plan", "names, not objects yet", "UnresolvedRelation"),
        ("Analyzed Logical Plan", "catalog resolved, types fixed", "SQL tab → Details"),
        ("Catalyst optimisation", "rules: pushdown, pruning, folding", "optimizedPlan"),
        ("Optimized Logical Plan", "what Spark decided you meant", "compare across runs"),
        ("Physical Plan", "joins, exchanges, scans chosen", "the file you attach to a bug"),
        ("Stages", "cut at every shuffle boundary", "Spark UI → Stages"),
        ("Tasks", "one per partition", "task metrics, spill, GC"),
        ("Executors", "where the JVM actually suffers", "executor tab, GC logs"),
    ]
    cx = 430
    top = 168
    step = 68
    for i, (name, why, look) in enumerate(stages):
        y = top + i * step
        bw, bh = 258, 46
        accent = STEEL if i < 6 else AMBER
        b.append(rect(cx - bw / 2, y, bw, bh, fill=CARD, stroke=RULE, sw=1.1, rx=5))
        b.append(rect(cx - bw / 2, y, 3, bh, fill=accent))
        b.append(t(cx, y + 20, name, 15.5, INK, SANS, "600", anchor="middle"))
        b.append(t(cx, y + 37, why, 12, INK3, SERIF, anchor="middle"))
        b.append(t(cx - bw / 2 - 22, y + 29, "", 12))
        b.append(t(cx + bw / 2 + 22, y + 29, look, 12.5, INK2, MONO))
        if i < len(stages) - 1:
            b.append(arrow_down(cx, y + bh + 2, y + step - 2, INK3, 1.4))
    b.append(t(cx + 151, top - 18, "WHERE YOU CAN LOOK", 11, INK3, MONO, "500", spacing="1.6"))

    # shuffle boundary bracket
    y1 = top + 5 * step + 46
    y2 = top + 6 * step
    b.append(rect(60, y1 - 8, 218, 62, fill="#F6EEDC", stroke=AMBER, sw=1.1, rx=5))
    b.append(t(76, y1 + 14, "STAGE BOUNDARY", 11.5, AMBER, MONO, "500", spacing="1.4"))
    b.append(t(76, y1 + 36, "created by a wide dependency", 12.5, INK2, SERIF))
    b.append(arrow_right(280, y1 + 22, cx - 134, AMBER, 1.6, dash="5 4"))

    b.append(rect(60, top + 40, 218, 96, fill=CARD, stroke=RULE2, sw=1.1, rx=5))
    b.append(t(76, top + 64, "NARROW", 11.5, GREEN, MONO, "500", spacing="1.4"))
    b.append(t(76, top + 86, "map · filter · select", 12.5, INK2, MONO))
    b.append(t(76, top + 108, "one input partition →", 13, INK3, SERIF))
    b.append(t(76, top + 126, "one output partition", 13, INK3, SERIF))

    b.append(rect(60, top + 172, 218, 116, fill=CARD, stroke=RULE2, sw=1.1, rx=5))
    b.append(t(76, top + 196, "WIDE", 11.5, RED, MONO, "500", spacing="1.4"))
    b.append(t(76, top + 218, "join · groupBy · distinct", 12.5, INK2, MONO))
    b.append(t(76, top + 240, "repartition · window", 12.5, INK2, MONO))
    b.append(t(76, top + 262, "every output partition may", 13, INK3, SERIF))
    b.append(t(76, top + 280, "read from every input one", 13, INK3, SERIF))

    b.append(line(46, H - 66, W - 46, H - 66, RULE2, 1))
    b.append(t(W / 2, H - 34,
               "“Shuffle is expensive because it is the only step that has to agree with every other machine.”",
               17, INK2, SERIF, anchor="middle", style="font-style:italic"))
    return W, H, "".join(b)


plate("catalyst-pipeline", *_catalyst())


# ====================================================== 5. JOIN STRATEGIES ====
def _joins():
    W, H = 1040, 680
    b = [header(W, "act v — 8 TB meets 40 MB", "The join you expected vs. the join you got",
                "Spark does not read your mind. It reads statistics — and sometimes it reads stale ones.")]
    top = 180
    ph = 300
    pw = (W - 92 - 28) / 2

    # broadcast
    x = 46
    b.append(rect(x, top, pw, ph, fill=CARD, stroke=RULE, sw=1.1, rx=6))
    b.append(rect(x, top, pw, 3, fill=GREEN))
    b.append(t(x + 20, top + 32, "BROADCAST HASH JOIN", 12, GREEN, MONO, "500", spacing="1.6"))
    b.append(t(x + 20, top + 54, "the small side travels; the big side stays home",
               13.5, INK3, SERIF))
    b.append(rect(x + 20, top + 74, 128, 40, fill="#E7EFE8", stroke=GREEN, sw=1.1, rx=4))
    b.append(t(x + 84, top + 92, "dim  ·  40 MB", 12.5, GREEN, MONO, anchor="middle"))
    b.append(t(x + 84, top + 108, "collected to driver", 10.5, INK3, MONO, anchor="middle"))
    for i in range(3):
        ex = x + 216 + i * 92
        ey = top + 150
        b.append(rect(ex, ey, 80, 96, fill=PAPER2, stroke=RULE, sw=1, rx=4))
        b.append(t(ex + 40, ey + 20, f"executor {i+1}", 11, INK2, MONO, anchor="middle"))
        b.append(rect(ex + 10, ey + 30, 60, 20, fill="#E7EFE8", stroke=GREEN, sw=1, rx=3))
        b.append(t(ex + 40, ey + 44, "dim copy", 10, GREEN, MONO, anchor="middle"))
        b.append(rect(ex + 10, ey + 58, 60, 28, fill="#E3EAF1", stroke=STEELL, sw=1, rx=3))
        b.append(t(ex + 40, ey + 76, "fact part", 10, STEEL, MONO, anchor="middle"))
        b.append(path(f"M {x + 84} {top + 118} C {x + 84} {top + 132 + i * 8} "
                      f"{ex + 40} {ey - 54 - i * 6} {ex + 40} {ey - 12}",
                      stroke=GREEN, sw=1.3, dash="4 4"))
        b.append(f'<path d="M {ex+35.5} {ey-12} L {ex+44.5} {ey-12} L {ex+40} {ey-3} Z" fill="{GREEN}"/>')
    b.append(t(x + 20, top + ph - 24, "No shuffle of the 8 TB side. One network hop, N copies.",
               13.5, INK2, SERIF))

    # sort merge
    x2 = 46 + pw + 28
    b.append(rect(x2, top, pw, ph, fill=CARD, stroke=RULE, sw=1.1, rx=6))
    b.append(rect(x2, top, pw, 3, fill=AMBER))
    b.append(t(x2 + 20, top + 32, "SORT MERGE JOIN", 12, AMBER, MONO, "500", spacing="1.6"))
    b.append(t(x2 + 20, top + 54, "both sides shuffle, both sides sort", 13.5, INK3, SERIF))
    for k, (lab, yy) in enumerate((("fact  ·  8 TB", top + 96), ("dim  ·  40 MB", top + 180))):
        b.append(rect(x2 + 20, yy, 100, 40, fill=PAPER2, stroke=RULE, sw=1, rx=4))
        b.append(t(x2 + 70, yy + 25, lab, 11.5, INK2, MONO, anchor="middle"))
        b.append(arrow_right(x2 + 124, yy + 20, x2 + 168, AMBER, 1.4))
        b.append(rect(x2 + 172, yy, 70, 40, fill="#F6EEDC", stroke=AMBER, sw=1, rx=4))
        b.append(t(x2 + 207, yy + 25, "shuffle", 11.5, AMBER, MONO, anchor="middle"))
        b.append(arrow_right(x2 + 246, yy + 20, x2 + 288, AMBER, 1.4))
        b.append(rect(x2 + 292, yy, 58, 40, fill="#F6EEDC", stroke=AMBER, sw=1, rx=4))
        b.append(t(x2 + 321, yy + 25, "sort", 11.5, AMBER, MONO, anchor="middle"))
    b.append(path(f"M {x2 + 354} {top + 116} L {x2 + 376} {top + 116} L {x2 + 376} {top + 200} "
                  f"L {x2 + 354} {top + 200}", stroke=INK3, sw=1.3))
    b.append(rect(x2 + 376, top + 138, 56, 40, fill=PAPER2, stroke=INK3, sw=1, rx=4))
    b.append(t(x2 + 404, top + 163, "JOIN", 12, INK, MONO, "500", anchor="middle"))
    b.append(t(x2 + 20, top + ph - 24, "8 TB across the wire because 40 MB “looked” bigger.",
               13.5, INK2, SERIF))

    # why row
    ry = top + ph + 34
    b.append(t(46, ry, "SPARK CHOSE SORT MERGE ANYWAY. THE SHORT LIST OF WHY:",
               11.5, INK3, MONO, "500", spacing="1.5"))
    reasons = ["No statistics on the table",
               "Stale statistics after a big write",
               "Serialized size ≠ on-disk size",
               "Below-threshold filter applied after the join decision",
               "autoBroadcastJoinThreshold lowered by a platform default",
               "A hint that quietly disabled it"]
    for i, r in enumerate(reasons):
        col = i % 2
        row = i // 2
        b.append(circ(58 + col * 500, ry + 30 + row * 28, 3, fill=STEEL))
        b.append(t(74 + col * 500, ry + 35 + row * 28, r, 14, INK, SERIF))
    b.append(t(W / 2, H - 26, "Verify the physical plan. Never tune what you assume Spark did.",
               17.5, INK, SERIF, "600", anchor="middle"))
    return W, H, "".join(b)


plate("join-strategies", *_joins())



# ======================================================== 6. GC PATTERNS ======
def _gc():
    W, H = 1060, 730
    b = [header(W, "act vi — 410 seconds of a 900-second task",
                "Three heaps that all “have a GC problem”",
                "The sawtooth tells you how memory is suffering. Only Spark tells you why.")]
    top = 176
    pw = (W - 92 - 40) / 3
    panels = [
        ("PATTERN A", "High allocation churn", GREEN,
         "Before GC  12 GB → After GC  3 GB", "Heap returns to a low baseline.",
         "Cost is CPU, not capacity. Look at object creation on the hot path."),
        ("PATTERN B", "Retained live set", RED,
         "Before GC  15 GB → After GC  14 GB", "Heap never comes back down.",
         "Something is being held. Heap dump, not more heap."),
        ("PATTERN C", "Skew-induced pressure", AMBER,
         "One executor. One partition.", "Only the hot task sawtooths.",
         "The memory symptom has a data cause. Fix the partition."),
    ]
    for i, (tag, name, col, num, obs, note) in enumerate(panels):
        x = 46 + i * (pw + 20)
        b.append(rect(x, top, pw, 356, fill=CARD, stroke=RULE, sw=1.1, rx=6))
        b.append(rect(x, top, pw, 3, fill=col))
        b.append(t(x + 18, top + 30, tag, 11.5, col, MONO, "500", spacing="1.6"))
        b.append(t(x + 18, top + 54, name, 18, INK, SANS, "600"))

        gx, gy, gw, gh = x + 18, top + 76, pw - 36, 124
        b.append(rect(gx, gy, gw, gh, fill="#F1EDE3", stroke=RULE2, sw=1, rx=4))
        b.append(t(gx + 6, gy + 14, "16 GB", 9.5, INK3, MONO))
        b.append(line(gx, gy + 8, gx + gw, gy + 8, RULE, 1, dash="3 4"))
        pts = []
        n = 7
        for k in range(n):
            x0 = gx + 6 + k * (gw - 12) / n
            x1 = gx + 6 + (k + 1) * (gw - 12) / n
            if i == 0:
                lo, hi = gh - 22, 26
            elif i == 1:
                lo, hi = gh - 30 - k * 11, 22 + max(0, 18 - k * 4)
            else:
                lo, hi = (gh - 26, 30) if k % 2 else (gh - 34, gh - 44)
            pts.append(f"{x0:.1f},{gy + lo:.1f}")
            pts.append(f"{x1 - 3:.1f},{gy + hi:.1f}")
            pts.append(f"{x1:.1f},{gy + lo:.1f}")
        b.append(f'<polyline points="{" ".join(pts)}" fill="none" stroke="{col}" '
                 f'stroke-width="1.9" stroke-linejoin="round"/>')
        b.append(t(gx + 6, gy + gh - 6, "time →", 9.5, INK3, MONO))

        b.append(t(x + 18, top + 226, num, 12.5, INK2, MONO))
        b.append(line(x + 18, top + 238, x + pw - 18, top + 238, RULE2, 1))
        for j, ln in enumerate(_wrap(obs, 30)):
            b.append(t(x + 18, top + 260 + j * 19, ln, 14.5, INK, SERIF))
        for j, ln in enumerate(_wrap(note, 32)):
            b.append(t(x + 18, top + 302 + j * 18, ln, 13, col, SERIF))

    b.append(rect(46, top + 386, W - 92, 62, fill=SCREEN, rx=6))
    b.append(t(66, top + 412, "-Xlog:gc*:file=/tmp/gc.log:time,uptime,level,tags",
               15, "#9ED8B6", MONO))
    b.append(t(66, top + 434, "# ask for the timeline before you argue about the heap size",
               12.5, "#7E8896", MONO))
    b.append(t(W / 2, H - 26, "GC tells us how memory is suffering. Spark tells us why.",
               18, INK, SERIF, "600", anchor="middle"))
    return W, H, "".join(b)


plate("gc-patterns", *_gc())


# =================================================== 7. DIAGNOSTIC CHOICE =====
def _diagnostics():
    W, H = 1040, 700
    b = [header(W, "act vii — pick the right instrument",
                "Four tools. Four different questions.",
                "Collecting all of them is not thoroughness. It is indecision with a ticket number.")]
    cards = [
        ("GC LOG", "How is memory behaving over time?", GREEN,
         ["allocation rate", "pause duration", "post-GC live set", "trend across a whole stage"],
         "-Xlog:gc*"),
        ("HEAP DUMP", "What is the JVM holding?", RED,
         ["object counts", "retained heap", "reference chains", "GC roots, leak suspects"],
         "jcmd <PID> GC.heap_dump /tmp/heap.hprof"),
        ("THREAD DUMP", "What is the JVM doing right now?", STEEL,
         ["blocked threads", "deadlocks", "I/O waits", "the same stack, ten times running"],
         "jcmd <PID> Thread.print"),
        ("FLIGHT RECORDER", "How do all of those line up?", AMBER,
         ["allocation profile", "lock contention", "I/O and CPU together", "one correlated timeline"],
         "jcmd <PID> JFR.start duration=120s"),
    ]
    cw = (W - 92 - 24) / 2
    ch = 196
    for i, (name, q, col, items, cmd) in enumerate(cards):
        x = 46 + (i % 2) * (cw + 24)
        y = 178 + (i // 2) * (ch + 24)
        b.append(rect(x, y, cw, ch, fill=CARD, stroke=RULE, sw=1.1, rx=6))
        b.append(rect(x, y, 3, ch, fill=col))
        b.append(t(x + 20, y + 30, name, 12, col, MONO, "500", spacing="1.8"))
        b.append(t(x + 20, y + 56, q, 17.5, INK, SANS, "600"))
        for j, it in enumerate(items):
            b.append(circ(x + 26, y + 80 + j * 21, 2.5, fill=INK3))
            b.append(t(x + 38, y + 85 + j * 21, it, 13.5, INK2, SERIF))
        b.append(rect(x + 16, y + ch - 40, cw - 32, 26, fill="#12171F", rx=4))
        b.append(t(x + 28, y + ch - 22, cmd, 11.5, "#9ED8B6", MONO))
    b.append(line(46, H - 70, W - 46, H - 70, RULE2, 1))
    b.append(t(W / 2, H - 38,
               "“What would this artefact tell me that I don’t already know?” — if there is no answer, don’t collect it.",
               16, INK2, SERIF, anchor="middle", style="font-style:italic"))
    return W, H, "".join(b)


plate("diagnostic-choice", *_diagnostics())


# ================================================== 8. DRIVER VS EXECUTOR =====
def _oom():
    W, H = 1040, 656
    b = [header(W, "act viii — two different failures with the same word in them",
                "Driver OOM is a design smell. Executor OOM is a data smell.")]
    top = 156
    pw = (W - 92 - 26) / 2

    def col(x, title, sub, accent, causes, quote):
        o = [rect(x, top, pw, 300, fill=CARD, stroke=RULE, sw=1.1, rx=6)]
        o.append(rect(x, top, pw, 3, fill=accent))
        o.append(t(x + 20, top + 32, title, 12, accent, MONO, "500", spacing="1.8"))
        o.append(t(x + 20, top + 58, sub, 17.5, INK, SANS, "600"))
        for j, c in enumerate(causes):
            o.append(t(x + 20, top + 88 + j * 24, "—", 13, INK3, MONO))
            o.append(t(x + 42, top + 88 + j * 24, c, 14.5, INK2, SERIF))
        o.append(line(x + 20, top + 244, x + pw - 20, top + 244, RULE2, 1))
        for j, ln in enumerate(_wrap(quote, 46)):
            o.append(t(x + 20, top + 266 + j * 19, ln, 14, accent, SERIF,
                       style="font-style:italic"))
        return "".join(o)

    b.append(col(46, "DRIVER OOM", "Distributed data arriving at one machine", RED,
                 ["collect() / toPandas()", "a result set nobody bounded",
                  "an enormous query plan", "metadata explosion — millions of files",
                  "hundreds of thousands of tasks", "driver-side accumulators and objects"],
                 "“Another 16 GB may postpone the failure. It does not explain why the data came home.”"))
    b.append(col(46 + pw + 26, "EXECUTOR OOM", "One partition that no longer fits", AMBER,
                 ["skew — a single giant partition", "join state / hash table size",
                  "aggregation buffers", "cached data competing with execution",
                  "Python worker memory outside the heap", "container limit vs. heap limit"],
                 "“Heap normal, container killed? Then it was never a heap problem.”"))

    dy = top + 330
    b.append(rect(46, dy, W - 92, 120, fill="#F6EEDC", stroke=AMBER, sw=1.2, rx=6))
    b.append(t(70, dy + 34, "THE QUESTION THAT SPLITS THEM", 11.5, AMBER, MONO, "500", spacing="1.8"))
    b.append(t(70, dy + 68, "Does the failure follow the executor — or does it follow the partition?",
               22, INK, SANS, "700"))
    b.append(t(70, dy + 98,
               "If every executor that picks up task 847 dies, the executor is innocent. Go and look at task 847.",
               15, INK2, SERIF))
    b.append(t(W / 2, H - 26,
               "Same word. Opposite investigations.", 17, INK2, SERIF, anchor="middle",
               style="font-style:italic"))
    return W, H, "".join(b)


plate("driver-vs-executor", *_oom())


# ===================================================== 9. PYTHON BOUNDARY =====
def _pyboundary():
    W, H = 1040, 672
    b = [header(W, "act ix — the crossing nobody looks at",
                "Where a Python UDF actually spends its life",
                "The function is fine. The commute is the problem.")]
    top = 190
    lanes = [("JVM", "row batch in Tungsten format", STEEL),
             ("serialize", "pickle / Arrow, per batch", AMBER),
             ("Python worker", "your function, one row at a time", GREEN),
             ("serialize", "and back again", AMBER),
             ("JVM", "results reassembled", STEEL)]
    bw = (W - 92 - 4 * 26) / 5
    for i, (name, note, colr) in enumerate(lanes):
        x = 46 + i * (bw + 26)
        b.append(rect(x, top, bw, 108, fill=CARD, stroke=RULE, sw=1.1, rx=6))
        b.append(rect(x, top, bw, 3, fill=colr))
        b.append(t(x + bw / 2, top + 40, name, 17, INK, SANS, "600", anchor="middle"))
        for j, ln in enumerate(_wrap(note, 22)):
            b.append(t(x + bw / 2, top + 66 + j * 17, ln, 12.5, INK3, SERIF, anchor="middle"))
        if i < 4:
            b.append(arrow_right(x + bw + 4, top + 54, x + bw + 22, INK3, 1.5))

    # time bar
    ty = top + 148
    b.append(t(46, ty - 10, "WHERE THE WALL CLOCK GOES — one slow batch, measured",
               11.5, INK3, MONO, "500", spacing="1.5"))
    segs = [("JVM read", 0.14, STEELL), ("serialize out", 0.22, AMBERL),
            ("your Python code", 0.19, GREENL), ("serialize back", 0.27, AMBERL),
            ("JVM merge", 0.18, STEELL)]
    x = 46
    barw = W - 92
    for lab, frac, colr in segs:
        w = barw * frac
        b.append(rect(x, ty, w, 44, fill=colr))
        b.append(t(x + w / 2, ty + 28, f"{frac*100:.0f}%", 14, "#FFFFFF", SANS, "600",
                   anchor="middle"))
        b.append(t(x + w / 2, ty + 62, lab, 12.5, INK2, SERIF, anchor="middle"))
        x += w
    b.append(rect(46, ty, barw, 44, stroke=RULE, sw=1))
    b.append(t(46, ty + 92, "49% of the batch was moving data across a boundary. 19% was the function.",
               16.5, RED, SERIF))

    ry = ty + 118
    b.append(rect(46, ry, W - 92, 118, fill=CARD, stroke=RULE, sw=1.1, rx=6))
    b.append(t(70, ry + 30, "BEFORE REWRITING ANYTHING", 11.5, AMBER, MONO, "500", spacing="1.8"))
    checks = ["Is the UDF on the dominant path, or on 2% of the runtime?",
              "Can a built-in expression do it? Then the JVM never leaves home.",
              "Is it row-at-a-time, or can it be a vectorised / Arrow batch?",
              "Is Python worker memory counted against the container, not the heap?"]
    for i, c in enumerate(checks):
        b.append(circ(80, ry + 54 + i * 20, 2.5, fill=AMBER))
        b.append(t(94, ry + 59 + i * 20, c, 14, INK2, SERIF))
    b.append(t(W / 2, H - 22, "“First establish whether the UDF is actually on the dominant path.”",
               17, INK2, SERIF, anchor="middle", style="font-style:italic"))
    return W, H, "".join(b)


plate("python-boundary", *_pyboundary())


# ========================================================= 10. SMALL FILES ====
def _files():
    W, H = 1040, 716
    b = [header(W, "act x — the customer says the table got slow",
                "Five billion rows is not the problem",
                "2.2 million files is the problem. And the writer that makes more of them every hour.")]
    top = 176
    # left: the numbers
    b.append(rect(46, top, 420, 316, fill=CARD, stroke=RULE, sw=1.1, rx=6))
    b.append(t(66, top + 32, "TABLE PROFILE", 11.5, STEEL, MONO, "500", spacing="1.8"))
    rows = [("Rows", "5,010,442,118", INK),
            ("Files", "2,214,907", RED),
            ("Average file size", "95 KB", RED),
            ("Target file size", "128–512 MB", GREEN),
            ("Partitions on disk", "18,240 (event_hour)", AMBER),
            ("Files per partition", "~121", AMBER)]
    for i, (k, v, colr) in enumerate(rows):
        y = top + 62 + i * 36
        b.append(t(66, y + 14, k, 14.5, INK2, SERIF))
        b.append(t(446, y + 14, v, 14.5, colr, MONO, "500", anchor="end"))
        b.append(line(66, y + 26, 446, y + 26, RULE2, 1))
    b.append(t(66, top + 302, "The query engine is not slow. It is filing paperwork.",
               14.5, INK3, SERIF))

    # right: cost stack
    x2 = 494
    b.append(rect(x2, top, W - 46 - x2, 316, fill=CARD, stroke=RULE, sw=1.1, rx=6))
    b.append(t(x2 + 20, top + 32, "WHAT 2.2 M FILES ACTUALLY COST", 11.5, AMBER, MONO,
               "500", spacing="1.6"))
    costs = [("Metadata / transaction log", 0.30),
             ("Object-store LIST calls", 0.24),
             ("File open + footer read", 0.22),
             ("Task scheduling overhead", 0.16),
             ("Actual row scanning", 0.08)]
    for i, (lab, frac) in enumerate(costs):
        y = top + 62 + i * 44
        colr = GREEN if i == 4 else (AMBER if i < 3 else STEELL)
        b.append(t(x2 + 20, y + 14, lab, 13.5, INK2, SERIF))
        b.append(rect(x2 + 20, y + 22, (W - 66 - x2) * frac, 12, fill=colr, rx=2))
        b.append(t(x2 + 24 + (W - 66 - x2) * frac, y + 32, f"{frac*100:.0f}%", 11.5, INK3, MONO))
    b.append(t(x2 + 20, top + 302, "8% of the work was the work.", 14.5, GREEN, SERIF))

    # bottom: the two fixes
    fy = top + 348
    b.append(rect(46, fy, (W - 92 - 20) / 2, 118, fill="#F1EDE3", stroke=RULE, sw=1.1, rx=6))
    b.append(t(70, fy + 32, "THE FIX EVERYONE ASKS FOR", 11.5, AMBER, MONO, "500", spacing="1.6"))
    b.append(t(70, fy + 62, "Compact the table", 21, INK, SANS, "700"))
    b.append(t(70, fy + 90, "Real relief. Also a Tuesday ritual if nothing else changes.",
               14, INK2, SERIF))
    x3 = 46 + (W - 92 - 20) / 2 + 20
    b.append(rect(x3, fy, (W - 92 - 20) / 2, 118, fill="#E7EFE8", stroke=GREEN, sw=1.2, rx=6))
    b.append(t(x3 + 24, fy + 32, "THE FIX THAT ENDS IT", 11.5, GREEN, MONO, "500", spacing="1.6"))
    b.append(t(x3 + 24, fy + 62, "Fix the writer", 21, INK, SANS, "700"))
    b.append(t(x3 + 24, fy + 90, "Trigger interval, partition grain, and how many tasks write.",
               14, INK2, SERIF))
    b.append(t(W / 2, H - 24,
               "Fixing the layout is good. Fixing the write behaviour that created it is better.",
               17, INK, SERIF, "600", anchor="middle"))
    return W, H, "".join(b)


plate("small-files", *_files())


# ====================================================== 11. STREAMING LAG =====
def _stream():
    W, H = 1040, 660
    b = [header(W, "act xi — 100k in, 68k out",
                "A backlog is arithmetic, not an opinion",
                "32,000 records a second, every second, going somewhere you are not looking.")]
    top = 176
    cx0, cy0, cw, ch = 96, top + 18, W - 190, 154
    b.append(rect(46, top, W - 92, 204, fill=CARD, stroke=RULE, sw=1.1, rx=6))
    b.append(line(cx0, cy0 + ch, cx0 + cw, cy0 + ch, RULE, 1.2))
    b.append(line(cx0, cy0, cx0, cy0 + ch, RULE, 1.2))
    for frac, lab in ((0.0, "120k"), (0.5, "60k"), (1.0, "0")):
        y = cy0 + ch * frac
        b.append(t(cx0 - 10, y + 4, lab, 11, INK3, MONO, anchor="end"))
        if frac:
            b.append(line(cx0, y, cx0 + cw, y, RULE2, 1, dash="3 4"))
    inp = [(i, 100) for i in range(25)]
    proc = [68, 69, 67, 68, 70, 68, 66, 68, 69, 67, 68, 68, 67, 69, 68, 66, 68, 67, 69, 68, 67, 68, 69, 67, 68]
    def px(i): return cx0 + i * cw / 24
    def py(v): return cy0 + ch - (v / 120) * ch
    b.append(f'<polyline points="{" ".join(f"{px(i):.1f},{py(v):.1f}" for i, v in inp)}" '
             f'fill="none" stroke="{STEEL}" stroke-width="2.2"/>')
    b.append(f'<polyline points="{" ".join(f"{px(i):.1f},{py(v):.1f}" for i, v in enumerate(proc))}" '
             f'fill="none" stroke="{RED}" stroke-width="2.2"/>')
    band = " ".join(f"{px(i):.1f},{py(100):.1f}" for i in range(25)) + " " + \
           " ".join(f"{px(i):.1f},{py(proc[i]):.1f}" for i in range(24, -1, -1))
    b.append(f'<polygon points="{band}" fill="{REDL}" opacity="0.16"/>')
    b.append(t(cx0 + cw - 6, py(100) - 10, "incoming  100k/s", 13, STEEL, MONO, "500", anchor="end"))
    b.append(t(cx0 + cw - 6, py(68) + 20, "processed  68k/s", 13, RED, MONO, "500", anchor="end"))
    b.append(t(cx0 + cw / 2, py(84) + 4, "backlog  +32k every second", 14.5, RED, SANS, "600",
               anchor="middle"))
    b.append(t(cx0, cy0 + ch + 22, "micro-batch →", 11, INK3, MONO))

    sy = top + 236
    b.append(t(46, sy, "WHERE THE 32k IS BEING LOST — check in this order", 11.5, INK3, MONO,
               "500", spacing="1.5"))
    steps = [("Source", "partitions, fetch rate, rebalancing"),
             ("Processing", "batch duration vs trigger interval"),
             ("Shuffle / state", "state store size, number of keys"),
             ("Checkpoint", "commit latency to object storage"),
             ("Sink", "write amplification, small files, upserts")]
    bw = (W - 92 - 4 * 16) / 5
    for i, (name, note) in enumerate(steps):
        x = 46 + i * (bw + 16)
        b.append(rect(x, sy + 18, bw, 112, fill=CARD, stroke=RULE, sw=1.1, rx=6))
        b.append(rect(x, sy + 18, bw, 3, fill=STEEL if i < 4 else AMBER))
        b.append(t(x + bw / 2, sy + 48, name, 16, INK, SANS, "600", anchor="middle"))
        for j, ln in enumerate(_wrap(note, 24)):
            b.append(t(x + bw / 2, sy + 72 + j * 17, ln, 12.5, INK3, SERIF, anchor="middle"))
        if i < 4:
            b.append(arrow_right(x + bw + 1, sy + 74, x + bw + 14, INK3, 1.4))
    b.append(rect(46, H - 74, W - 92, 44, fill="#F7E7E4", stroke=RED, sw=1.1, rx=5))
    b.append(t(70, H - 46, "“Delete the checkpoint” is not a tuning step. It is a decision about correctness.",
               16, RED, SERIF, "500"))
    return W, H, "".join(b)


plate("streaming-backlog", *_stream())


# ======================================================== 12. REGRESSION ======
def _regression():
    W, H = 1040, 740
    b = [header(W, "act xii — “it worked before the upgrade”",
                "Nine things changed. Prove it was the one they mean.",
                "A controlled experiment is the cheapest thing you can build and the hardest thing to argue with.")]
    top = 176
    # controlled comparison
    b.append(rect(46, top, W - 92, 194, fill=CARD, stroke=RULE, sw=1.1, rx=6))
    b.append(t(70, top + 32, "HOLD EVERYTHING. MOVE ONE THING.", 11.5, AMBER, MONO, "500", spacing="1.6"))
    held = ["same workload", "same data snapshot", "same configuration",
            "same cluster shape", "same storage path"]
    for i, h in enumerate(held):
        x = 70 + i * 182
        b.append(rect(x, top + 52, 166, 40, fill="#F1EDE3", stroke=RULE2, sw=1, rx=4))
        b.append(t(x + 83, top + 77, h, 13, INK2, MONO, anchor="middle"))
    b.append(t(70, top + 122, "the one variable:", 13.5, INK3, SERIF))
    b.append(rect(206, top + 104, 260, 44, fill="#E7EFE8", stroke=GREEN, sw=1.2, rx=5))
    b.append(t(336, top + 132, "runtime 12.4  → PASS", 15, GREEN, MONO, "500", anchor="middle"))
    b.append(rect(486, top + 104, 260, 44, fill="#F7E7E4", stroke=RED, sw=1.2, rx=5))
    b.append(t(616, top + 132, "runtime 13.0  → FAIL", 15, RED, MONO, "500", anchor="middle"))
    b.append(t(70, top + 172,
               "Until this table exists, “the upgrade broke it” is a feeling with a timestamp.",
               14.5, INK2, SERIF))

    # narrowing ladder
    ly = top + 224
    b.append(t(46, ly, "THEN NARROW — each step throws away half the suspects",
               11.5, INK3, MONO, "500", spacing="1.5"))
    steps = ["Diff the physical plans",
             "Diff the effective configuration, not the file",
             "Diff the logs at the first divergence",
             "Identify the component that changed behaviour",
             "Read the code path, not the release notes",
             "Narrow to a commit or a rule",
             "Hand Engineering a reproduction that runs in five minutes"]
    for i, s_ in enumerate(steps):
        y = ly + 26 + i * 34
        colr = STEEL if i < 5 else GREEN
        b.append(rect(46, y, 26, 26, fill=colr, rx=13, opacity=.14))
        b.append(t(59, y + 18, str(i + 1), 13, colr, MONO, "500", anchor="middle"))
        b.append(t(86, y + 18, s_, 15.5, INK, SERIF))
        if i < len(steps) - 1:
            b.append(line(59, y + 27, 59, y + 33, RULE, 1.4))
    b.append(rect(600, ly + 26, W - 46 - 600, 200, fill=SCREEN, rx=6))
    b.append(t(624, ly + 54, "PLAN DIFF — the only line that mattered", 11, AMBERL, MONO, "500"))
    diff = [("- BroadcastHashJoin  BuildRight", REDL),
            ("+ SortMergeJoin", "#9ED8B6"),
            ("", INK3),
            ("- stats: sizeInBytes=39.4 MB", REDL),
            ("+ stats: sizeInBytes=8.0 EB", "#9ED8B6"),
            ("", INK3),
            ("# the default changed. the table", "#7E8896"),
            ("# never had statistics at all.", "#7E8896")]
    for i, (ln, colr) in enumerate(diff):
        b.append(t(624, ly + 80 + i * 18, ln, 12, colr, MONO))
    b.append(t(W / 2, H - 26, "Don’t send Engineering a complaint. Send Engineering evidence.",
               18, INK, SERIF, "600", anchor="middle"))
    return W, H, "".join(b)


plate("regression-bisect", *_regression())


# =================================================== 13. RADIUS OF IMPACT =====
def _radius():
    W, H = 1040, 700
    b = [header(W, "act xiv — the only definition that survives contact with a title ladder",
                "Staff is not seniority. It is radius.")]
    cx, cy = 330, 396
    rings = [(190, "#EFE9DA", GREEN, "STAFF", "changes the system so the class becomes unlikely"),
             (136, "#E7E1D2", AMBER, "SENIOR", "fixes the class of incidents"),
             (80, "#DDD6C6", STEEL, "ENGINEER", "fixes the incident")]
    for r, fillc, colr, lab, note in rings:
        b.append(circ(cx, cy, r, fill=fillc, stroke=colr, sw=1.4))
    b.append(t(cx, cy + 6, "ENGINEER", 15, STEEL, MONO, "500", anchor="middle"))
    b.append(t(cx, cy - 98, "SENIOR", 15, AMBER, MONO, "500", anchor="middle"))
    b.append(t(cx, cy - 152, "STAFF", 15, GREEN, MONO, "500", anchor="middle"))
    b.append(t(cx, cy + 30, "fixes the incident", 12.5, INK3, SERIF, anchor="middle"))
    b.append(t(cx, cy - 79, "fixes the class", 12.5, INK3, SERIF, anchor="middle"))
    b.append(t(cx, cy - 133, "removes the class", 12.5, INK3, SERIF, anchor="middle"))

    x2 = 600
    b.append(t(x2, 190, "THE SAME ESCALATION, THREE ENDINGS", 11.5, INK3, MONO, "500", spacing="1.6"))
    outs = [("Engineer", STEEL,
             "Restarts the job, clears the backlog, closes the ticket. The customer is unblocked tonight."),
            ("Senior engineer", AMBER,
             "Finds the null-key skew, fixes the pipeline, and writes the pattern down so the next five tickets close in an hour."),
            ("Staff engineer", GREEN,
             "Ships a skew detector into the platform’s diagnostics, files the product gap that made it invisible, and the ticket class thins out.")]
    for i, (name, colr, note) in enumerate(outs):
        y = 220 + i * 128
        b.append(rect(x2, y, W - 46 - x2, 110, fill=CARD, stroke=RULE, sw=1.1, rx=6))
        b.append(rect(x2, y, 3, 110, fill=colr))
        b.append(t(x2 + 20, y + 32, name, 17.5, INK, SANS, "600"))
        for j, ln in enumerate(_wrap(note, 46)):
            b.append(t(x2 + 20, y + 58 + j * 19, ln, 14, INK2, SERIF))
    b.append(t(46, H - 26,
               "Nobody gets promoted for the restart. Everybody depends on the detector.",
               17, INK2, SERIF, style="font-style:italic"))
    return W, H, "".join(b)


plate("radius-of-impact", *_radius())


# ======================================================= 14. EVIDENCE LOOP ====
def _loop():
    W, H = 1040, 470
    b = [header(W, "the whole interview, on one line",
                "The path they were watching you walk")]
    steps = ["Ambiguous problem", "Evidence", "Decompose", "Hypothesis",
             "Experiment", "Root cause", "Mitigation", "Architecture", "Automation"]
    top = 190
    bw = (W - 92 - 8 * 10) / 9
    for i, s_ in enumerate(steps):
        x = 46 + i * (bw + 10)
        if i <= 1:
            colr = RED
        elif i <= 4:
            colr = AMBER
        elif i <= 6:
            colr = STEEL
        else:
            colr = GREEN
        b.append(rect(x, top, bw, 92, fill=CARD, stroke=RULE, sw=1.1, rx=6))
        b.append(rect(x, top, bw, 3, fill=colr))
        b.append(t(x + bw / 2, top + 34, f"{i+1}", 11.5, colr, MONO, "500", anchor="middle"))
        for j, ln in enumerate(_wrap(s_, 13)):
            b.append(t(x + bw / 2, top + 58 + j * 16, ln, 13.5, INK, SANS, "600", anchor="middle"))
        if i < 8:
            b.append(arrow_right(x + bw + 1, top + 46, x + bw + 9, INK3, 1.3))
    b.append(t(46, top + 128, "most candidates start here →", 12.5, RED, MONO))
    b.append(rect(300, top + 112, 172, 24, fill="#F7E7E4", rx=4))
    b.append(t(386, top + 129, "“increase the memory”", 12.5, RED, MONO, anchor="middle"))
    b.append(t(W - 46, top + 128, "← strong candidates finish here", 12.5, GREEN, MONO, anchor="end"))
    b.append(line(46, H - 96, W - 46, H - 96, RULE2, 1))
    b.append(t(W / 2, H - 58,
               "“The strongest candidate is not the one with the fastest answer.",
               19, INK, SERIF, anchor="middle", style="font-style:italic"))
    b.append(t(W / 2, H - 30,
               "It is the one who knows which answer has not yet been proven.”",
               19, INK, SERIF, anchor="middle", style="font-style:italic"))
    return W, H, "".join(b)


plate("evidence-loop", *_loop())


# ========================================================== 15. SHARE CARD ====
def _share():
    W, H = 1200, 630
    b = [rect(0, 0, W, H, fill=SCREEN)]
    b.append(rect(0, 0, W, 6, fill=AMBER))
    b.append(t(72, 96, "PADDYSPEAKS  ·  A FICTIONAL SCREENPLAY", 15, AMBERL, MONO, "500",
               spacing="3.2"))
    b.append(t(72, 190, "The Interview Room", 74, "#F3EFE6", SANS, "700"))
    b.append(t(72, 250, "How a senior data engineer is really tested", 30, "#A8B2BF", SERIF))
    b.append(line(72, 292, W - 72, 292, "#333D4A", 1.2))
    lines = [("ALEX", "“So it’s GC?”", AMBERL),
             ("JORDAN", "“GC is definitely expensive.”", "#C9D2DC"),
             ("ALEX", "“That wasn’t my question.”", AMBERL),
             ("JORDAN", "“Right. No — I haven’t proven GC is the root cause.”", "#C9D2DC")]
    for i, (who, said, colr) in enumerate(lines):
        y = 344 + i * 52
        b.append(t(72, y, who, 15, "#78838F", MONO, "500", spacing="1.4"))
        b.append(t(196, y, said, 24, colr, SERIF))
    b.append(t(72, H - 46, "Spark · JVM · distributed systems · escalations · evidence",
               17, "#78838F", MONO))
    return W, H, "".join(b)


plate("share-card", *_share())


# ================================================================== RENDER ====
def render():
    for name, (w, h, doc) in PLATES.items():
        (HERE / f"{name}.svg").write_text(doc, encoding="utf-8")
        png = HERE / f"{name}.png"
        cairosvg.svg2png(bytestring=doc.encode("utf-8"), write_to=str(png),
                         output_width=w * 2, output_height=h * 2)
        im = Image.open(png).convert("RGB")
        if name == "share-card":
            im.resize((1200, 630), Image.LANCZOS).save(OUT / "share-card.png", "PNG",
                                                       optimize=True)
            im.resize((1200, 630), Image.LANCZOS).save(OUT / "poster.webp", "WEBP",
                                                       quality=90, method=6)
        else:
            im.save(OUT / f"plate-{name}.webp", "WEBP", quality=88, method=6)
        print(f"{name:26s} {w}x{h}")


if __name__ == "__main__":
    render()

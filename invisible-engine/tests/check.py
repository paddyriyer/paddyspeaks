"""The Invisible Engine — scene and page contract (no network, stdlib only).

    python3 invisible-engine/tests/check.py

Checks every scene SVG and every module page against the rules in
docs/INVISIBLE-ENGINE.md: valid XML, title + desc, frames numbered from 1,
no scripts, a legend for every arrow kind used, five reader levels per scene,
frame captions matching the SVG's frames, sources and an accuracy check, and
labelled field drawings. Also fails on banned phrasings that the lesson's
accuracy rules forbid.
"""
from __future__ import annotations

import pathlib
import re
import sys
from xml.dom import minidom

ROOT = pathlib.Path(__file__).resolve().parents[2]
IE = ROOT / "invisible-engine"
problems: list[str] = []


def fail(msg: str) -> None:
    problems.append(msg)


# ── scenes ──────────────────────────────────────────────────────────
scene_frames: dict[str, int] = {}
for svg in sorted((IE / "scenes").glob("s*.svg")):
    text = svg.read_text(encoding="utf-8")
    try:
        doc = minidom.parseString(text)
    except Exception as e:  # noqa: BLE001
        fail(f"{svg.name}: not well-formed XML: {e}")
        continue
    root = doc.documentElement
    if root.getAttribute("viewBox") != "0 0 1600 900":
        fail(f"{svg.name}: viewBox must be 0 0 1600 900")
    if not root.getElementsByTagName("title") or not root.getElementsByTagName("desc"):
        fail(f"{svg.name}: needs <title> and <desc>")
    if root.getElementsByTagName("script") or root.getElementsByTagName("foreignObject") or re.search(r"\son\w+=", text):
        fail(f"{svg.name}: scripts and event handlers are not allowed")
    frames = sorted({int(f) for f in re.findall(r'data-f="(\d+)"', text)})
    if frames and frames != list(range(1, len(frames) + 1)):
        fail(f"{svg.name}: frames must be numbered 1..n without gaps, got {frames}")
    scene_frames[svg.stem] = len(frames)
    # every arrow kind used appears in the legend
    body, _, legend = text.partition('<g class="legend">')
    for kind in ("energy", "signal", "plain", "crypto", "admin"):
        if f'class="a-{kind}"' in body and f'class="a-{kind}"' not in legend:
            fail(f"{svg.name}: arrow kind '{kind}' used but missing from the legend")
    for cls, name in (('class="hz"', "hazard"), ('class="bound"', "boundary")):
        if cls in body and cls not in legend:
            fail(f"{svg.name}: {name} used but missing from the legend")
    if 'class="field"' in text and not re.search(r"[Ii]llustrative", text):
        fail(f"{svg.name}: field drawing without an 'illustrative' label")
    png = IE / "scenes" / "png" / f"{svg.stem}.png"
    if not png.exists():
        fail(f"{svg.name}: missing still PNG scenes/png/{png.name} (run scripts/invisible_engine/render.mjs)")

# ── pages ───────────────────────────────────────────────────────────
BANNED = [
    (r"\bnot a (?:real )?transmitter\b.*\bbroadcasts\b", "card described as broadcasting"),
    (r"\bquantum computers? (?:can|already) (?:break|decrypt|read)", "quantum attack presented as current"),
    (r"\bcontactless (?:is|payments are) (?:anonymous|private)\b", "contactless presented as anonymous"),
    (r"\btries all (?:the )?answers at once\b", "quantum myth"),
    (r"\bghost job\b", "accusatory phrasing"),
]
seen_scenes: set[str] = set()
for page in sorted(IE.glob("m*.html")):
    html = page.read_text(encoding="utf-8")
    low = html.lower()
    for rx, why in BANNED:
        for m in re.finditer(rx, low):
            ctx = low[max(0, m.start() - 40): m.end() + 10]
            if "not " in ctx[:40] or "no " in ctx[:40] or "never" in ctx[:40]:
                continue
            fail(f"{page.name}: banned phrasing ({why}): …{ctx}…")
    for sec in re.findall(r'<section class="scene" id="(s\d\d)".*?</section>', html, re.S):
        seen_scenes.add(sec)
    for m in re.finditer(r'<section class="scene" id="(s\d\d)"(.*?)</section>', html, re.S):
        sid, body = m.group(1), m.group(2)
        for lv in "ABCDE":
            if f'data-lv="{lv}"' not in body:
                fail(f"{page.name} {sid}: missing reader level {lv}")
        story = re.search(r'<ol class="story">(.*?)</ol>', body, re.S)
        if not story or not 3 <= story.group(1).count("<li>") <= 6:
            fail(f"{page.name} {sid}: level A needs a 3–6 frame story")
        if '<p class="why">' not in body:
            fail(f"{page.name} {sid}: level A needs a one-sentence cause and effect")
        frames = re.search(r'<ol class="frames">(.*?)</ol>', body, re.S)
        n = frames.group(1).count("<li>") if frames else 0
        if sid in scene_frames and scene_frames[sid] and n != scene_frames[sid]:
            fail(f"{page.name} {sid}: {n} frame captions but the SVG has {scene_frames[sid]} frames")
        if f'src="/invisible-engine/scenes/{sid}.svg"' not in body:
            fail(f"{page.name} {sid}: image does not point at scenes/{sid}.svg")
        if "Accuracy check" not in body or "<h4>Sources</h4>" not in body:
            fail(f"{page.name} {sid}: needs an accuracy check and sources")
        alt = re.search(r'<img data-svg="[^"]+" [^>]*alt="([^"]*)"', body)
        if not alt or len(alt.group(1)) < 80:
            fail(f"{page.name} {sid}: diagram needs a full text alternative")

missing = sorted(set(scene_frames) - seen_scenes)
if missing:
    fail(f"scenes with no page: {', '.join(missing)}")

if problems:
    print("✗ invisible-engine contract:")
    for p in problems:
        print("  - " + p)
    sys.exit(1)
print(f"✓ invisible-engine: {len(scene_frames)} scenes, {len(seen_scenes)} on pages, contract holds")

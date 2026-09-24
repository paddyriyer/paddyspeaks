#!/usr/bin/env python3
"""
Maintain the navigation layer of the Data Engineering Interview handbook
(articles/data-engineering-interview-prep.html).

The article itself is the source of truth — it is edited by hand. This script
only rewrites the regions it owns, so it is safe to run any number of times:

  • the handbook CSS block            <style id="hb-style">…</style>
                                      (from scripts/handbook/handbook.css)
  • the sticky part chip-nav          <nav class="section-nav">…</nav>
  • the master hierarchical contents  <!-- HB:TOC START --> … <!-- HB:TOC END -->
  • the per-part time strip           <div class="hb-time">…</div>
  • the per-part footer nav           <nav class="hb-chapnav">…</nav>
  • the visible "N." numbering of each part's h2 headings (ids never change,
    so every existing deep link keeps working)

Reading time is derived from the page, not typed in: STUDY from prose and
code volume, QUICK from the part's interview card + notes + lede, PRACTICE
from the number of drills, pushback blocks and answer-depth exercises.

    python scripts/handbook_build.py           # rewrite in place
    python scripts/handbook_build.py --check   # exit 1 if a rewrite is needed

Never run scripts/combine_interview.py — it rebuilds from stale sources and
would delete Parts 10+ and every upgrade (it now refuses to run).
"""
from __future__ import annotations

import html
import math
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ARTICLE = ROOT / "articles" / "data-engineering-interview-prep.html"
CSS = ROOT / "scripts" / "handbook" / "handbook.css"

# Parts added in the 2026 upgrade get a small "new" tag in the contents.
NEW_PARTS = {"13", "14", "15", "16", "17", "18", "19", "20"}

SECTION_RE = re.compile(
    r'<section id="part-(\d\d)" class="part-section" data-part="\d\d">(.*?)</section>',
    re.DOTALL,
)
TITLE_RE = re.compile(r'<h1 class="part-title">(.*?)</h1>', re.DOTALL)
H2_RE = re.compile(r'<h2 id="([^"]+)">(.*?)</h2>', re.DOTALL)
TAG_RE = re.compile(r"<[^>]+>")


def text_of(fragment: str) -> str:
    return html.unescape(TAG_RE.sub(" ", fragment))


def words(fragment: str) -> int:
    return len(text_of(fragment).split())


def round5(minutes: float) -> int:
    return max(5, int(math.ceil(minutes / 5.0)) * 5)


# ── h2 numbering ─────────────────────────────────────────────────────────

NUM_PREFIX = re.compile(r"^(\s*)(\d+)\.\s+")


def renumber(body: str) -> str:
    """Make the visible 'N. ' prefixes of numbered h2s sequential (1, 2, 3…)."""
    counter = 0

    def fix(m: re.Match) -> str:
        nonlocal counter
        hid, inner = m.group(1), m.group(2)
        pm = NUM_PREFIX.match(inner)
        if not pm:
            return m.group(0)
        counter += 1
        inner = f"{pm.group(1)}{counter}. " + inner[pm.end():]
        return f'<h2 id="{hid}">{inner}</h2>'

    return H2_RE.sub(fix, body)


# ── time model ───────────────────────────────────────────────────────────

PRE_RE = re.compile(r"<pre\b.*?</pre>", re.DOTALL)
BLOCK_RES = {
    "drill": re.compile(r'class="hb-drill"'),
    "attack": re.compile(r'class="hb-attack"'),
    "depth": re.compile(r'class="hb-depth"'),
    "cheat": re.compile(r'class="hb-cheat"'),
}


def time_model(body: str) -> dict:
    code = PRE_RE.findall(body)
    code_words = sum(words(c) for c in code)
    prose = PRE_RE.sub(" ", body)
    prose_words = words(prose)
    study = prose_words / 200.0 + code_words / 90.0

    # The interview card is always the last block of a part.
    at = body.find('<div class="hb-card"')
    card = body[at:] if at >= 0 else ""
    quick_words = words(card)
    for cls in ("hb-lede", "hb-note-h"):
        quick_words += sum(
            words(m) for m in re.findall(rf'class="{cls}"[^>]*>(.*?)</', body, re.DOTALL)
        )
    h2s = len(H2_RE.findall(body))
    quick = quick_words / 180.0 + h2s * 0.4

    n = {k: len(r.findall(body)) for k, r in BLOCK_RES.items()}
    practice = n["drill"] * 12 + n["attack"] * 3 + n["depth"] * 4 + n["cheat"] * 5
    if card:
        practice += 30  # the card's code / draw / debug prompts, done for real
    return {
        "quick": round5(quick),
        "study": round5(study),
        "practice": round5(practice) if practice else 0,
        "counts": n,
        "card": bool(card),
    }


def time_strip(tm: dict) -> str:
    parts = [
        f'<span><b>Quick refresh</b>{tm["quick"]} min</span>',
        f'<span><b>Interview study</b>{tm["study"]} min</span>',
    ]
    if tm["practice"]:
        parts.append(f'<span><b>Deep practice</b>{tm["practice"]} min</span>')
    return '<div class="hb-time" aria-label="Estimated time for this part">' + "".join(parts) + "</div>"


# ── per-part rewrite ─────────────────────────────────────────────────────

HEADER_RE = re.compile(r'(<header class="part-header">.*?</header>)', re.DOTALL)
TIME_RE = re.compile(r'\s*<div class="hb-time"[^>]*>.*?</div>(?=\s)', re.DOTALL)
FOOT_RE = re.compile(
    r'\s*(?:<p class="back-to-top"><a href="#top">[^<]*</a></p>|<nav class="hb-chapnav".*?</nav>)\s*$',
    re.DOTALL,
)


def label(num: str) -> str:
    return "Overview" if num == "00" else f"Part {num}"


def chapnav(parts: list, i: int) -> str:
    def link(j: int, cls: str, arrow_l: str, arrow_r: str, kicker: str) -> str:
        num, title = parts[j][0], parts[j][1]
        return (
            f'<a class="{cls}" href="#part-{num}"><small>{kicker}</small>'
            f"{arrow_l}{label(num)} · {title}{arrow_r}</a>"
        )

    prev_html = link(i - 1, "hb-prev", "← ", "", "Previous") if i > 0 else "<span></span>"
    next_html = (
        link(i + 1, "hb-next", "", " →", "Next") if i + 1 < len(parts) else "<span></span>"
    )
    up = '<a class="hb-up" href="#p00-contents">Contents</a> · <a class="hb-up" href="#top">Top ↑</a>'
    return (
        '<nav class="hb-chapnav" aria-label="Chapter navigation">'
        f'{prev_html}<span class="hb-up">{up}</span>{next_html}</nav>'
    )


def build_toc(parts: list, times: dict) -> str:
    total = {"quick": 0, "study": 0, "practice": 0}
    rows = []
    for num, title, body in parts:
        tm = times[num]
        for k in total:
            total[k] += tm[k]
        items = []
        for hid, inner in H2_RE.findall(body):
            if hid.endswith("-contents") or hid == "p00-contents":
                continue
            items.append(f'<li><a href="#{hid}">{text_of(inner).strip()}</a></li>')
        if tm["card"]:
            items.append(f'<li><a href="#p{num}-l5-card">★ L5 Interview Card</a></li>')
        new = '<span class="hb-toc-new">new</span>' if num in NEW_PARTS else ""
        t = f'{tm["quick"]} · {tm["study"]}' + (f' · {tm["practice"]}' if tm["practice"] else "")
        rows.append(
            "<details>"
            f'<summary><span class="hb-toc-num">{label(num)}</span>'
            f'<span class="hb-toc-title"><a href="#part-{num}">{title}</a>{new}</span>'
            f'<span class="hb-toc-t" title="quick · study · practice (minutes)">{t} min</span></summary>'
            f'<ol>{"".join(items)}</ol>'
            "</details>"
        )
    head = (
        '<div class="hb-toc-head"><span>Contents — open a part to see its sections</span>'
        f'<span>quick · study · practice (min) — totals {total["quick"]} · {total["study"]} · {total["practice"]}</span></div>'
    )
    return (
        "<!-- HB:TOC START (generated by scripts/handbook_build.py — edit headings, not this) -->\n"
        f'<nav class="hb-toc" aria-label="Handbook contents">{head}{"".join(rows)}</nav>\n'
        "<!-- HB:TOC END -->"
    )


def build_chips(parts: list) -> str:
    chips = "".join(
        f'<a class="section-chip" href="#part-{num}" data-target="part-{num}">'
        f'<span class="chip-num">{label(num)}</span><span class="chip-title">{title}</span></a>'
        for num, title, _ in parts
    )
    return (
        '<nav class="section-nav" aria-label="Jump to section">'
        f'<div class="section-nav-inner">{chips}</div></nav>'
    )


def build(src: str) -> str:
    # 1. CSS block
    css = CSS.read_text(encoding="utf-8").strip()
    style = f'<style id="hb-style">\n{css}\n</style>'
    if '<style id="hb-style">' in src:
        src = re.sub(r'<style id="hb-style">.*?</style>', lambda _: style, src, flags=re.DOTALL)
    else:
        src = src.replace("</head>", style + "\n</head>", 1)

    # 2. renumber h2s per part, collect parts
    def renum_section(m: re.Match) -> str:
        return m.group(0).replace(m.group(2), renumber(m.group(2)), 1)

    src = SECTION_RE.sub(renum_section, src)
    parts = []
    for m in SECTION_RE.finditer(src):
        num, body = m.group(1), m.group(2)
        title = TITLE_RE.search(body).group(1).strip()
        parts.append((num, title, body))

    # 3. per-part time strip + footer nav (time is computed without the chrome)
    times = {}
    for num, _t, body in parts:
        clean = TIME_RE.sub("", body)
        times[num] = time_model(clean)

    def rewrite_section(m: re.Match) -> str:
        num, body = m.group(1), m.group(2)
        i = next(k for k, p in enumerate(parts) if p[0] == num)
        body = TIME_RE.sub("", body)
        body = HEADER_RE.sub(lambda h: h.group(1) + "\n" + time_strip(times[num]), body, count=1)
        body = FOOT_RE.sub("", body)
        body = body.rstrip() + "\n" + chapnav(parts, i) + "\n"
        return f'<section id="part-{num}" class="part-section" data-part="{num}">{body}</section>'

    src = SECTION_RE.sub(rewrite_section, src)

    # 4. chip-nav (all parts)
    src = re.sub(
        r'<nav class="section-nav" aria-label="Jump to section">.*?</nav>',
        lambda _: build_chips(parts),
        src,
        count=1,
        flags=re.DOTALL,
    )

    # 5. master TOC (lives in the Overview, under the "Contents" heading)
    toc = build_toc(parts, times)
    if "<!-- HB:TOC START" in src:
        src = re.sub(r"<!-- HB:TOC START.*?<!-- HB:TOC END -->", lambda _: toc, src, flags=re.DOTALL)
    else:
        raise SystemExit("HB:TOC markers missing — add them under the Overview's Contents heading")
    return src


def main(argv: list[str]) -> int:
    src = ARTICLE.read_text(encoding="utf-8")
    out = build(src)
    if "--check" in argv:
        if out != src:
            print("handbook_build: article is stale — run python scripts/handbook_build.py")
            return 1
        print("handbook_build: up to date")
        return 0
    if out != src:
        ARTICLE.write_text(out, encoding="utf-8")
        print(f"handbook_build: rewrote {ARTICLE.relative_to(ROOT)} ({len(out):,} bytes)")
    else:
        print("handbook_build: no changes")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

#!/usr/bin/env python3
"""
Guardrail for the Data Engineering Interview handbook
(articles/data-engineering-interview-prep.html). Read-only; exits 1 on failure.

Checks the structural promises the handbook makes to a reader:
  • every id is unique and every in-page href="#…" resolves
  • <section> tags balance and parts are numbered 00, 01, 02 … with no gaps
  • each part's numbered h2s run 1, 2, 3 … (no skipped or repeated numbers)
  • every h2 appears in the master contents, and the build script has no
    pending rewrite (navigation, numbering and time strips are current)
  • every part has a time strip and a prev/next footer
  • every technical part ends with an L5 Interview Card carrying all eleven
    sections in the documented order
  • every code block carries an Engine / Dialect / Executable label
  • no invented-question or company-attribution phrasing ("real interview
    questions", "asked at Google" …)

    python scripts/check_handbook.py
"""
from __future__ import annotations

import re
import sys
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import handbook_build as hb  # noqa: E402

ARTICLE = hb.ARTICLE

# Parts without an interview card: the overview, the scenario bank, the prep
# program and the self-assessment/cheat-sheet part (which *is* the cards).
NO_CARD = {"00", "08", "09", "20"}

CARD_SECTIONS = [
    "Must know",
    "Must be able to explain",
    "Must be able to draw",
    "Must be able to code",
    "Must be able to debug",
    "Numbers that matter",
    "Classic traps",
    "30-second answer",
    "2-minute answer",
    "Deep-dive follow-up",
    "Staff+ follow-up",
]

BANNED = [
    r"\breal interview (questions|scenarios)\b",
    r"\b40\+ real\b",
    r"\bactually asked\b",
    r"\basked (at|by) (Meta|Google|Netflix|Uber|Amazon|Apple|Microsoft|Airbnb|Stripe)\b",
    r"\b(Meta|Google|Netflix|Uber|Amazon) (always )?asks\b",
    r"In today's rapidly evolving",
]

VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta",
        "source", "track", "wbr"}


class Balance(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.stack: list[tuple[str, int]] = []
        self.errors: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag not in VOID:
            self.stack.append((tag, self.getpos()[0]))

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        # p and li may be implicitly closed; tolerate by popping to the match.
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                skipped = [t for t, _ in self.stack[i + 1:] if t not in ("p", "li")]
                if skipped:
                    self.errors.append(
                        f"line {self.getpos()[0]}: </{tag}> closes over unclosed {skipped}"
                    )
                del self.stack[i:]
                return
        self.errors.append(f"line {self.getpos()[0]}: stray </{tag}>")


def main() -> int:
    src = ARTICLE.read_text(encoding="utf-8")
    errors: list[str] = []

    ids = re.findall(r'\sid="([^"]+)"', src)
    for k, v in Counter(ids).items():
        if v > 1:
            errors.append(f"duplicate id: {k} ×{v}")
    idset = set(ids)
    for h in sorted(set(re.findall(r'href="#([^"]+)"', src))):
        if h not in idset:
            errors.append(f"broken in-page link: #{h}")

    if src.count("<section") != src.count("</section>"):
        errors.append(
            f"<section> imbalance: {src.count('<section')} open vs {src.count('</section>')} close"
        )
    body = src[src.find('<div class="article-content">'):src.find('<footer class="site-footer">')]
    bal = Balance()
    bal.feed(body)
    errors += [f"html: {e}" for e in bal.errors[:20]]

    parts = [(m.group(1), m.group(2)) for m in hb.SECTION_RE.finditer(src)]
    nums = [n for n, _ in parts]
    if nums != [f"{i:02d}" for i in range(len(nums))]:
        errors.append(f"part numbers not contiguous: {nums}")

    toc = re.search(r"<!-- HB:TOC START.*?<!-- HB:TOC END -->", src, re.DOTALL)
    toc_links = set(re.findall(r'href="#([^"]+)"', toc.group(0))) if toc else set()
    if not toc:
        errors.append("master contents (HB:TOC) missing")

    for num, part in parts:
        seq = []
        for hid, inner in hb.H2_RE.findall(part):
            m = hb.NUM_PREFIX.match(inner)
            if m:
                seq.append(int(m.group(2)))
            if not hid.endswith("-contents") and hid not in toc_links:
                errors.append(f"part {num}: h2 #{hid} not in master contents")
        if seq != list(range(1, len(seq) + 1)):
            errors.append(f"part {num}: h2 numbering is {seq}")
        if 'class="hb-time"' not in part:
            errors.append(f"part {num}: no time strip")
        if 'class="hb-chapnav"' not in part:
            errors.append(f"part {num}: no chapter navigation")
        if num not in NO_CARD:
            at = part.find('<div class="hb-card"')
            if at < 0:
                errors.append(f"part {num}: no L5 Interview Card")
            else:
                card = part[at:]
                if f'id="p{num}-l5-card"' not in card[:200]:
                    errors.append(f"part {num}: card id must be p{num}-l5-card")
                heads = re.findall(r"<h5>(.*?)</h5>", card)
                if heads != CARD_SECTIONS:
                    errors.append(f"part {num}: card sections {heads} != documented order")

    # every code block labelled
    for m in re.finditer(r'(<div class="sourceCode"[^>]*>\s*)?<pre\b', body):
        start = m.start()
        # a diagram is not code
        if body.rfind('<figure class="hb-diagram">', max(0, start - 80), start) >= 0:
            continue
        if body.rfind('class="hb-card-sec"', max(0, start - 600), start) >= 0 and \
                body.rfind("</div>", max(0, start - 600), start) < body.rfind('class="hb-card-sec"', max(0, start - 600), start):
            continue  # tiny sketch inside an interview card
        prev = body[max(0, start - 400):start]
        if 'class="hb-code-label"' not in prev or prev.rfind("</pre>") > prev.rfind('class="hb-code-label"'):
            line = src[:src.find(body) + start].count("\n") + 1
            errors.append(f"unlabelled code block near line {line}")

    text = re.sub(r"<[^>]+>", " ", body)
    for pat in BANNED:
        for m in re.finditer(pat, text, re.IGNORECASE):
            errors.append(f"banned phrasing: {m.group(0)!r}")

    if hb.build(src) != src:
        errors.append("navigation layer is stale — run python scripts/handbook_build.py")

    if errors:
        print(f"check_handbook: {len(errors)} problem(s)")
        for e in errors[:200]:
            print("  -", e)
        return 1
    print(f"check_handbook: OK — {len(parts)} parts, {len(idset):,} ids, all links resolve")
    return 0


if __name__ == "__main__":
    sys.exit(main())

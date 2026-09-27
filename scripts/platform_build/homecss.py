"""lib/ps-home-base.css — the slice of style.css the homepage actually needs.

Why: style.css is the stylesheet ~190 pages share (135 KB, 22 KB gzipped) and
it is render-blocking. The homepage uses about 5% of it — the design tokens on
`:root`, the reset, `body`, the paper texture, the page frame, and the few
legacy nav / footer / skip-link classes that lib/ps-chrome.css restyles on top
of. Shipping the whole file cost a phone ~1.2 s before first paint
(Lighthouse mobile, 2026-09-27). So the homepage links this generated slice
instead, and nothing else changes: the rules are copied verbatim, in their
original order, from style.css, so the cascade the homepage sees is the same.

Generated: never edit lib/ps-home-base.css by hand. Edit style.css and run
`python3 scripts/platform_build/build.py homecss` (part of `all`); `check`
fails when the slice is stale. To make the homepage use another style.css
rule, add its selector to KEEP below.

Stdlib only. A rule is kept when ANY selector in its selector list matches
KEEP. @media / @supports blocks are kept with only their matching rules;
@keyframes and @font-face are kept only when named in KEEP_AT (none today).
"""
from __future__ import annotations

import re

from .common import ROOT, write_if_changed

SOURCE = "style.css"
OUTPUT = "lib/ps-home-base.css"

# The element the selector starts with, alone (with any pseudo-classes or
# pseudo-elements) — `body::before` yes, `body .foo` no.
_BARE = r"(?:\*|:root|html|body|mark)(?:::?[\w-]+(?:\([^)]*\))?)*"
# Class families the homepage's shared header, footer and skip link rely on
# (lib/ps-chrome.css and lib/ps-nav.js build on these base rules). Anything
# that starts with one of them is kept, descendants and states included.
_FAMILIES = ("page-frame", "nav-bar", "nav-search-btn", "site-footer", "footer-copy",
             "ps-skip-link", "ps-nav-mobile-bar", "ps-nav-toggle", "ps-nav-collapsible")

KEEP = re.compile(r"^(?:%s|\.(?:%s)(?![\w-]))" % (_BARE + "$", "|".join(_FAMILIES)))
KEEP_AT: tuple[str, ...] = ()   # e.g. ("@keyframes psNavIn",) if a kept rule animates

HEADER = """/* GENERATED from style.css by scripts/platform_build/homecss.py — do not edit.
   The slice of the shared stylesheet the homepage needs (tokens, reset, body,
   paper texture, page frame, legacy nav/footer/skip-link base rules), copied
   verbatim and in order so the cascade is unchanged. Edit style.css, then run
   `python3 scripts/platform_build/build.py homecss`. */
"""


def _skip_comment_or_string(text: str, i: int) -> int:
    """If text[i] opens a comment or string, return the index just past it."""
    if text.startswith("/*", i):
        end = text.find("*/", i + 2)
        return len(text) if end < 0 else end + 2
    if text[i] in "\"'":
        q = text[i]
        j = i + 1
        while j < len(text):
            if text[j] == "\\":
                j += 2
                continue
            if text[j] == q:
                return j + 1
            j += 1
        return len(text)
    return i


def parse(text: str) -> list[tuple[str, str | list]]:
    """Parse CSS into [(prelude, body)] where body is the declaration text for a
    style rule or a nested list for a block at-rule. Comments between rules
    are dropped; comments inside declarations travel with their rule."""
    rules: list[tuple[str, str | list]] = []
    i, n = 0, len(text)
    while i < n:
        c = text[i]
        if c.isspace():
            i += 1
            continue
        if text.startswith("/*", i):
            i = _skip_comment_or_string(text, i)
            continue
        # prelude up to '{' or ';' (a statement at-rule such as @import)
        start = i
        while i < n and text[i] not in "{;":
            j = _skip_comment_or_string(text, i)
            i = j if j > i else i + 1
        if i >= n:
            break
        prelude = text[start:i].strip()
        if text[i] == ";":
            rules.append((prelude, ""))
            i += 1
            continue
        # find the matching '}'
        depth, j = 0, i
        while j < n:
            k = _skip_comment_or_string(text, j)
            if k > j:
                j = k
                continue
            if text[j] == "{":
                depth += 1
            elif text[j] == "}":
                depth -= 1
                if depth == 0:
                    break
            j += 1
        inner = text[i + 1:j]
        i = j + 1
        if prelude.startswith("@") and "{" in inner:
            rules.append((prelude, parse(inner)))
        else:
            rules.append((prelude, inner))
    return rules


def _keep_rule(prelude: str) -> bool:
    return any(KEEP.match(sel.strip()) for sel in prelude.split(","))


def _select(rules: list, depth: int = 0) -> list:
    out = []
    for prelude, body in rules:
        if prelude.startswith("@"):
            if prelude.split("{")[0].strip() in KEEP_AT:
                out.append((prelude, body))
            elif isinstance(body, list):
                kept = _select(body, depth + 1)
                if kept:
                    out.append((prelude, kept))
            continue
        if _keep_rule(prelude):
            out.append((prelude, body))
    return out


def _render(rules: list, indent: str = "") -> str:
    parts = []
    for prelude, body in rules:
        if isinstance(body, list):
            parts.append(f"{indent}{prelude} {{\n{_render(body, indent + '    ')}{indent}}}\n")
        elif body == "" and prelude.startswith("@"):
            parts.append(f"{indent}{prelude};\n")
        else:
            decl = "\n".join(indent + "    " + line.strip() for line in body.strip().splitlines() if line.strip())
            parts.append(f"{indent}{prelude} {{\n{decl}\n{indent}}}\n")
    return "".join(parts)


def build() -> str:
    src = (ROOT / SOURCE).read_text(encoding="utf-8")
    return HEADER + _render(_select(parse(src)))


def run(write: bool) -> list[str]:
    text = build()
    if write:
        if write_if_changed(OUTPUT, text):
            print(f"  wrote {OUTPUT}")
        return []
    cur = ROOT / OUTPUT
    if not cur.exists() or cur.read_text(encoding="utf-8") != text:
        return [f"{OUTPUT} is stale against {SOURCE} — run: python3 scripts/platform_build/build.py homecss"]
    return []

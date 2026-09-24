"""Keep the shared header and footer current on hand-crafted pages.

The homepage carries the header by hand; pages.py renders it into every page
under content/pages/. Hand-crafted pages that are not rendered — the resume
pages — mark where it goes:

    <!-- ps:header -->  …replaced…  <!-- /ps:header -->
    <!-- ps:footer -->  …replaced…  <!-- /ps:footer -->

and this step writes pages.header_html() / pages.footer_html() between the
markers, so there is still exactly ONE header definition (pages.py) and the
navigation cannot fork. Nothing outside the markers is touched. The page also
needs body.ps-chrome, lib/ps-chrome.css and lib/ps-nav.js (see CLAUDE.md).
"""
from __future__ import annotations

import re

from .common import ROOT, write_if_changed

# page → the nav item marked aria-current (None: no journey owns the page)
FILES = {
    "resume.html": None,
    "visual-resume.html": None,
}

BLOCK_RE = {
    name: re.compile(rf"(<!-- ps:{name} -->\n)(?:.*?\n)?(<!-- /ps:{name} -->)", re.S)
    for name in ("header", "footer")
}


def render(text: str, active: str | None) -> str:
    from .pages import footer_html, header_html
    parts = {"header": header_html(active), "footer": footer_html()}
    for name, rx in BLOCK_RE.items():
        text = rx.sub(lambda m: m.group(1) + parts[name] + "\n" + m.group(2), text)
    return text


def run(write: bool) -> list[str]:
    problems = []
    for f, active in FILES.items():
        p = ROOT / f
        text = p.read_text(encoding="utf-8")
        missing = [n for n, rx in BLOCK_RE.items() if not rx.search(text)]
        if missing:
            problems.append(f"{f}: missing <!-- ps:{missing[0]} --> markers")
            continue
        new = render(text, active)
        if new == text:
            continue
        if write:
            write_if_changed(f, new)
            print(f"  chrome {f}")
        else:
            problems.append(f"{f}: shared header/footer is stale — run: python3 scripts/platform_build/build.py chrome assets")
    return problems

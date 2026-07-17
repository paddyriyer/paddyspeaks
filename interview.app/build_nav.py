#!/usr/bin/env python3
"""
Propagate the canonical Interview Studio nav into every page.

Single source of truth:  interview.app/partials/nav.html
Run from anywhere:        python3 interview.app/build_nav.py

On first run it wraps each page's existing <nav class="ip-topnav">...</nav> in
<!--NAV:START-->/<!--NAV:END--> markers. On every subsequent run it replaces
whatever sits between those markers. Idempotent: re-running with no template
change rewrites identical bytes and reports "unchanged".

No build step is required to *serve* the site — this is a manual codegen step,
run only when the nav template changes.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent          # interview.app/
PARTIAL = ROOT / "partials" / "nav.html"

START = "<!--NAV:START (generated from partials/nav.html — run build_nav.py; do not hand-edit) -->"
END = "<!--NAV:END-->"

# Match an existing marker block (for re-runs) ...
MARKER_RE = re.compile(re.escape(START) + r".*?" + re.escape(END), re.DOTALL)
# ... or, on first run, the raw topnav element.
RAW_RE = re.compile(r'<nav class="ip-topnav".*?</nav>', re.DOTALL)


def partial_body() -> str:
    text = PARTIAL.read_text(encoding="utf-8")
    # Drop the leading instructional comment; inject from the skip link onward.
    idx = text.index('<a class="ip-skip"')
    return text[idx:].rstrip("\n")


def block() -> str:
    return f"{START}\n{partial_body()}\n{END}"


def targets():
    files = set()
    for pat in ("index.html", "*/index.html", "*/quiz.html", "sql.html", "python.html"):
        for p in ROOT.glob(pat):
            if '<nav class="ip-topnav"' in p.read_text(encoding="utf-8") or START in p.read_text(encoding="utf-8"):
                files.add(p)
    return sorted(files)


def main():
    if not PARTIAL.exists():
        sys.exit(f"missing template: {PARTIAL}")
    new_block = block()
    changed = unchanged = skipped = 0
    for f in targets():
        src = f.read_text(encoding="utf-8")
        if START in src:
            out = MARKER_RE.sub(lambda _m: new_block, src, count=1)
        elif RAW_RE.search(src):
            out = RAW_RE.sub(lambda _m: new_block, src, count=1)
        else:
            print(f"  skip (no nav found): {f.relative_to(ROOT)}")
            skipped += 1
            continue
        if out != src:
            f.write_text(out, encoding="utf-8")
            print(f"  updated: {f.relative_to(ROOT)}")
            changed += 1
        else:
            unchanged += 1
    print(f"\nnav: {changed} updated, {unchanged} unchanged, {skipped} skipped "
          f"({changed + unchanged + skipped} pages)")


if __name__ == "__main__":
    main()

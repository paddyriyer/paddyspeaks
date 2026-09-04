#!/usr/bin/env python3
"""Refresh <lastmod> in sitemap.xml from git history.

Why this exists
---------------
Sitemap entries on this site are added by hand, and their <lastmod> was set to
whatever the date happened to be that day. Nothing refreshed them afterwards, so
pages kept changing while the sitemap kept claiming they had not. Google treats
lastmod as a recrawl hint; a feed where the dates are reliably wrong is a feed
Google learns to ignore.

This script sets each entry's <lastmod> to the commit date of the last commit
that touched the corresponding file.

What it does NOT do
-------------------
It only rewrites <lastmod> values. URL order, <priority>, <changefreq>, comments
and whitespace are all preserved byte-for-byte, so the diff shows dates and
nothing else. It never adds, removes or reorders URLs, and it never touches
index.html or any other content file (see CLAUDE.md).

Usage:
  python .github/scripts/refresh_sitemap_lastmod.py            # check only, exit 1 if stale
  python .github/scripts/refresh_sitemap_lastmod.py --write    # apply
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SITEMAP = ROOT / "sitemap.xml"
BASE = "https://paddyspeaks.com/"

URL_BLOCK = re.compile(r"<url>.*?</url>", re.S)
LOC = re.compile(r"<loc>\s*(.*?)\s*</loc>", re.S)
LASTMOD = re.compile(r"(<lastmod>)\s*(.*?)\s*(</lastmod>)", re.S)


def url_to_path(loc: str) -> Path | None:
    """Map a public URL back to the file that serves it."""
    if not loc.startswith(BASE):
        return None
    rel = loc[len(BASE):]
    if rel == "":
        return ROOT / "index.html"
    if rel.endswith("/"):
        return ROOT / rel / "index.html"
    return ROOT / rel


def last_commit_date(path: Path) -> str | None:
    """Committer date (YYYY-MM-DD) of the last commit touching path."""
    try:
        out = subprocess.run(
            ["git", "log", "-1", "--format=%cs", "--", str(path.relative_to(ROOT))],
            cwd=ROOT, capture_output=True, text=True, timeout=30,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    date = out.stdout.strip()
    return date or None


def main() -> int:
    write = "--write" in sys.argv
    text = SITEMAP.read_text(encoding="utf-8")

    changed: list[tuple[str, str, str]] = []
    skipped_missing = 0

    def fix_block(m: re.Match[str]) -> str:
        nonlocal skipped_missing
        block = m.group(0)
        loc_m = LOC.search(block)
        if not loc_m:
            return block
        loc = loc_m.group(1)

        path = url_to_path(loc)
        if path is None or not path.exists():
            skipped_missing += 1
            return block

        git_date = last_commit_date(path)
        if not git_date:
            return block

        lm = LASTMOD.search(block)
        if not lm:
            return block
        current = lm.group(2)
        if current == git_date:
            return block

        changed.append((loc, current, git_date))
        return block[: lm.start()] + f"{lm.group(1)}{git_date}{lm.group(3)}" + block[lm.end():]

    new_text = URL_BLOCK.sub(fix_block, text)

    if skipped_missing:
        print(f"note: {skipped_missing} entry(ies) had no file on disk and were left alone")

    if not changed:
        print("sitemap lastmod is up to date")
        return 0

    print(f"{len(changed)} entry(ies) have a stale lastmod:")
    for loc, old, new in sorted(changed, key=lambda r: r[2], reverse=True)[:20]:
        print(f"  {old} -> {new}  {loc}")
    if len(changed) > 20:
        print(f"  ... and {len(changed) - 20} more")

    if not write:
        print("\nrun with --write to apply")
        return 1

    SITEMAP.write_text(new_text, encoding="utf-8")
    print(f"\nupdated {SITEMAP.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Content guardrail for the PaddySpeaks static site.

Runs in CI on pull requests (and can be run locally: `python .github/scripts/validate_content.py`).
It does NOT touch or regenerate any file — it only reads and reports. The goal is
to catch the small, high-cost regressions that would otherwise deploy straight to
production via Cloudflare:

  1. article_metadata.json is valid JSON, a list, with the required keys, no
     duplicate slugs, and every slug pointing at a file that actually exists.
  2. Every other tracked JSON file parses.
  3. Every inline <svg>…</svg> in an article is well-formed XML.
  4. Every article file has a <title> and a <!doctype html>.

Ratchet behaviour: checks 3 and 4 are HARD ERRORS only for files passed via
`--changed` (the files touched by the current PR) and WARNINGS for everything
else. That keeps the build green on legacy content while holding all new or
edited articles to the strict bar. Checks 1 and 2 are always hard errors.

Usage:
  python .github/scripts/validate_content.py                  # full repo, 3+4 as warnings
  python .github/scripts/validate_content.py --changed a.html b.html   # strict on those

Exit code 0 = clean, 1 = at least one error. Warnings never fail the build.
"""
from __future__ import annotations

import json
import re
import sys
import xml.dom.minidom as minidom
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ARTICLES = ROOT / "articles"
METADATA = ROOT / "article_metadata.json"

REQUIRED_KEYS = ("title", "date", "category", "slug")
KNOWN_CATEGORIES = {"philosophy", "technology", "ai"}

errors: list[str] = []
warnings: list[str] = []


def err(msg: str) -> None:
    errors.append(msg)


def warn(msg: str) -> None:
    warnings.append(msg)


def check_metadata() -> None:
    if not METADATA.exists():
        err(f"{METADATA.name} is missing")
        return
    try:
        data = json.loads(METADATA.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        err(f"{METADATA.name} is not valid JSON: {e}")
        return
    if not isinstance(data, list):
        err(f"{METADATA.name} must be a JSON array")
        return

    seen: dict[str, int] = {}
    for i, entry in enumerate(data):
        where = f"{METADATA.name}[{i}]"
        if not isinstance(entry, dict):
            err(f"{where} is not an object")
            continue
        for key in REQUIRED_KEYS:
            if not entry.get(key):
                err(f"{where} is missing required key '{key}'")
        slug = entry.get("slug")
        if slug:
            if slug in seen:
                err(f"duplicate slug '{slug}' at {where} (also at index {seen[slug]})")
            seen[slug] = i
            if not (ARTICLES / slug).exists():
                err(f"{where}: slug '{slug}' has no matching file in articles/")
        cat = entry.get("category")
        if cat and cat not in KNOWN_CATEGORIES:
            warn(f"{where}: unusual category '{cat}' (expected one of {sorted(KNOWN_CATEGORIES)})")
        rt = entry.get("read_time")
        if rt is not None and not isinstance(rt, int):
            warn(f"{where}: read_time should be an integer, got {rt!r}")


def check_other_json() -> None:
    for path in sorted(ROOT.glob("*.json")):
        if path.name == METADATA.name:
            continue
        try:
            json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            err(f"{path.name} is not valid JSON: {e}")


SVG_RE = re.compile(r"<svg\b.*?</svg>", re.DOTALL | re.IGNORECASE)


def check_article_html(strict_paths: set[str]) -> None:
    if not ARTICLES.is_dir():
        err("articles/ directory is missing")
        return
    for path in sorted(ARTICLES.glob("*.html")):
        rel = path.relative_to(ROOT)
        # A file is "strict" if it was changed in this PR. With no --changed
        # list at all (local full run), nothing is strict → everything warns.
        strict = str(rel) in strict_paths
        report = err if strict else warn
        text = path.read_text(encoding="utf-8", errors="replace")
        lower = text.lower()
        if "<title" not in lower:
            report(f"{rel}: no <title> tag found")
        if "<!doctype html" not in lower:
            report(f"{rel}: no <!doctype html> declaration")
        for n, svg in enumerate(SVG_RE.findall(text), start=1):
            try:
                minidom.parseString(svg)
            except Exception as e:  # noqa: BLE001 - report any parse failure
                report(f"{rel}: inline SVG #{n} is not well-formed XML: {e}")


def main(argv: list[str]) -> int:
    strict_paths: set[str] = set()
    if "--changed" in argv:
        strict_paths = {p for p in argv[argv.index("--changed") + 1:] if p.strip()}

    check_metadata()
    check_other_json()
    check_article_html(strict_paths)

    for w in warnings:
        print(f"::warning::{w}" if _in_ci() else f"WARN  {w}")
    for e in errors:
        print(f"::error::{e}" if _in_ci() else f"ERROR {e}")

    if errors:
        print(f"\n✗ {len(errors)} error(s), {len(warnings)} warning(s)")
        return 1
    print(f"✓ content valid ({len(warnings)} warning(s))")
    return 0


def _in_ci() -> bool:
    import os

    return os.environ.get("GITHUB_ACTIONS") == "true"


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

"""Stamp registry values into HTML.

A page opts a number in by wrapping it:

    <span data-ps-stat="interview.questions">1527</span>
    <span data-ps-stat="interview.questions" data-ps-format="comma">1,527</span>

Only the text BETWEEN the tags of such an element is ever rewritten, and only
when that text is a plain number. Nothing else in the file is touched, which
is what makes it safe to run over the hand-crafted index.html (CLAUDE.md
forbids regenerating it; this does not regenerate it).
"""
from __future__ import annotations

import re

from .common import ROOT, public_html_files, tracked_files

STAT_RE = re.compile(
    r'(<(?P<tag>[a-zA-Z][a-zA-Z0-9]*)\b(?P<attrs>[^>]*?\bdata-ps-stat="(?P<key>[^"]+)"[^>]*)>)'
    r'(?P<inner>[^<]*)'
    r'(?P<close></(?P=tag)>)'
)
FORMAT_RE = re.compile(r'\bdata-ps-format="([^"]+)"')


def fmt(value: int, style: str | None) -> str:
    if style == "comma":
        return f"{value:,}"
    return str(value)


def candidate_files() -> list[str]:
    files = set(public_html_files())
    # The Interview Studio nav partial is excluded from "public pages" but its
    # stamped count is copied into ~35 pages by build_nav.py, so stamp it too.
    files.update(f for f in tracked_files("interview.app/partials/*.html"))
    return sorted(files)


def stamp_text(text: str, stats: dict, path: str, errors: list) -> str:
    def repl(m):
        key = m.group("key")
        if key not in stats:
            errors.append(f"{path}: unknown data-ps-stat key '{key}'")
            return m.group(0)
        inner = m.group("inner")
        if inner.strip() and not re.fullmatch(r"\s*[\d,]+\s*", inner):
            errors.append(f"{path}: data-ps-stat '{key}' wraps non-numeric text {inner!r}")
            return m.group(0)
        style = FORMAT_RE.search(m.group("attrs"))
        new = fmt(stats[key], style.group(1) if style else None)
        return m.group(1) + new + m.group("close")

    return STAT_RE.sub(repl, text)


def run(stats: dict, write: bool) -> tuple[list[str], list[str]]:
    """Return (files that differ, errors). Writes only when write=True."""
    changed, errors = [], []
    for f in candidate_files():
        p = ROOT / f
        try:
            text = p.read_text(encoding="utf-8")
        except (UnicodeDecodeError, FileNotFoundError):
            continue
        if "data-ps-stat" not in text:
            continue
        new = stamp_text(text, stats, f, errors)
        if new != text:
            changed.append(f)
            if write:
                p.write_text(new, encoding="utf-8")
    return changed, errors

"""Fingerprint the shared stylesheets and scripts a page links to.

    <link rel="stylesheet" href="/lib/ps-home.css?v=3f2a9c1b0d">

Why: GitHub Pages (and the Cloudflare edge in front of it) lets browsers keep
CSS/JS for a while. When index.html changes together with ps-home.css, a
visitor can get the new HTML with the OLD stylesheet — which is exactly how
the homepage feature image once rendered at its natural 1600px across the
Latest column. A version derived from the file's own bytes changes the URL
whenever the file changes, so HTML and CSS can never be mismatched.

Scope: index.html (hand-crafted; this step rewrites only the ?v= values of
matching links, nothing else) and every page pages.py renders (which calls
fingerprint() on its output). Only first-party assets are touched:
style.css and lib/ps-*.css|js.
"""
from __future__ import annotations

import hashlib
import re

from .common import ROOT, write_if_changed

FILES = ["index.html"]

# href="style.css" · href="/style.css" · src="/lib/ps-nav.js" · …, with or without ?v=
REF_RE = re.compile(
    r'(?P<attr>\b(?:href|src)=")(?P<slash>/?)(?P<path>style\.css|lib/ps-[\w-]+\.(?:css|js))'
    r'(?:\?v=[0-9a-f]+)?"')

_cache: dict[str, str] = {}


def version(path: str) -> str | None:
    if path not in _cache:
        p = ROOT / path
        _cache[path] = hashlib.sha256(p.read_bytes()).hexdigest()[:10] if p.exists() else ""
    return _cache[path] or None


def fingerprint(text: str) -> str:
    def repl(m):
        v = version(m.group("path"))
        if not v:
            return m.group(0)
        return f'{m.group("attr")}{m.group("slash")}{m.group("path")}?v={v}"'
    return REF_RE.sub(repl, text)


def run(write: bool) -> list[str]:
    problems = []
    for f in FILES:
        p = ROOT / f
        text = p.read_text(encoding="utf-8")
        new = fingerprint(text)
        if new == text:
            continue
        if write:
            write_if_changed(f, new)
            print(f"  fingerprinted {f}")
        else:
            problems.append(f"{f}: asset versions are stale — run: python3 scripts/platform_build/build.py assets")
    return problems

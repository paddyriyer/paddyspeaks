"""Cross-cutting consistency checks run by `build.py check` (and CI).

Each check returns a list of human-readable problems. An empty list is a pass.
They are structural guarantees, not style rules: each one exists because the
audit (docs/PADDYSPEAKS-PLATFORM-AUDIT.md) found the corresponding drift.
"""
from __future__ import annotations

import re
import subprocess
import sys

from .common import ROOT, read_json
from .registry import CATALOG, homepage_deck


def check_catalog_paths() -> list[str]:
    """Every path the catalog names must exist — a catalog entry is a promise."""
    cat = read_json(CATALOG)
    problems = []
    for group, items in cat.items():
        if not isinstance(items, list):
            continue
        for it in items:
            if not isinstance(it, dict) or "path" not in it:
                continue
            p = ROOT / it["path"]
            if it["path"].endswith("/"):
                if not (p / "index.html").exists() and not p.is_dir():
                    problems.append(f"catalog.{group}: '{it['path']}' does not exist")
            elif not p.exists():
                problems.append(f"catalog.{group}: '{it['path']}' does not exist")
    ids = [it.get("id") for items in cat.values() if isinstance(items, list) for it in items if isinstance(it, dict)]
    dup = sorted({i for i in ids if i and ids.count(i) > 1})
    if dup:
        problems.append(f"catalog: duplicate ids {dup}")
    return problems


def check_articles_consistent() -> list[str]:
    """The homepage archive and article_metadata.json describe the same set."""
    meta = read_json("article_metadata.json")
    slugs = {m["slug"] for m in meta}
    problems = []
    seen = set()
    for m in meta:
        if m["slug"] in seen:
            problems.append(f"article_metadata.json: duplicate slug {m['slug']}")
        seen.add(m["slug"])
        if not (ROOT / "articles" / m["slug"]).exists():
            problems.append(f"article_metadata.json: {m['slug']} has no file in articles/")
    cats = {c["id"] for c in read_json(CATALOG)["article_categories"]}
    for m in meta:
        if m["category"] not in cats:
            problems.append(f"article_metadata.json: {m['slug']} has unknown category '{m['category']}'")
    deck_articles = {h[len("articles/"):] for h, _ in homepage_deck() if h.startswith("articles/")}
    for s in sorted(deck_articles - slugs):
        problems.append(f"index.html deck card articles/{s} has no entry in article_metadata.json")
    for s in sorted(slugs - deck_articles):
        problems.append(f"article_metadata.json: {s} has no deck card on the homepage")
    by_slug = {m["slug"]: m["category"] for m in meta}
    for h, c in homepage_deck():
        s = h[len("articles/"):]
        if s in by_slug and by_slug[s] != c:
            problems.append(f"index.html deck card {h} is '{c}' but metadata says '{by_slug[s]}'")
    return problems


def check_filter_counts_are_stamped() -> list[str]:
    """Homepage filter counts must be registry-stamped, never typed."""
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    problems = []
    for m in re.finditer(r'<button class="deck-filter-btn[^"]*" data-filter="([a-z]+)">.*?</button>', html, re.S):
        if "data-ps-stat=" not in m.group(0):
            problems.append(f"index.html: deck filter '{m.group(1)}' count is hand-typed (use data-ps-stat)")
    return problems


def check_interview_counts() -> list[str]:
    """interview/scripts/update_counts.py must have nothing left to rewrite."""
    r = subprocess.run(
        [sys.executable, "interview/scripts/update_counts.py", "--check"],
        cwd=ROOT, capture_output=True, text=True,
    )
    if r.returncode != 0:
        return [line for line in (r.stdout + r.stderr).splitlines() if line.strip()] or ["update_counts.py --check failed"]
    return []


def run_all() -> list[str]:
    problems: list[str] = []
    for fn in (check_catalog_paths, check_articles_consistent,
               check_filter_counts_are_stamped, check_interview_counts):
        problems += fn()
    return problems

#!/usr/bin/env python3
"""
Apply current question/company counts to every hardcoded reference in the
homepage and bank pages.

Counts are taken from the DATA, not from manifest.json: the manifest is a
cache that once drifted (it said 988 SQL questions while questions.json held
991). This script now recounts questions.json, refreshes the manifest's
totals, and then rewrites the pages.

Idempotent — safe to run as part of the pipeline whenever the question
list changes. Each substitution matches "<number> + keyword" pairs so
re-runs always replace the previous (different) number with the new one.

Numbers that sit in visible HTML are better expressed as
<span data-ps-stat="…"> and stamped by scripts/platform_build/build.py from
data/site-registry.json; this script remains for strings inside <title>,
meta descriptions and JSON-LD, where an element cannot go.

Usage:  python3 interview/scripts/update_counts.py          # rewrite
        python3 interview/scripts/update_counts.py --check  # CI: exit 1 if anything is stale
"""

from __future__ import annotations

import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "interview" / "data" / "manifest.json"
QUESTIONS = ROOT / "interview" / "data" / "questions.json"
COMPANIES = ROOT / "interview" / "data" / "companies.json"
CHECK = "--check" in sys.argv[1:]

_questions = json.loads(QUESTIONS.read_text())
_langs = Counter(q["language"] for q in _questions)
TOTAL = len(_questions)
COS = len(json.loads(COMPANIES.read_text()))
SQL_N = _langs.get("sql", 0)
PY_N = _langs.get("python", 0)

mf = json.loads(MANIFEST.read_text())
_mf_new = dict(mf)
_mf_new["total"] = TOTAL
_mf_new["companies"] = COS
_mf_new["languages"] = {k: _langs[k] for k in mf.get("languages", {}) if k in _langs}
for _k in sorted(_langs):
    _mf_new["languages"].setdefault(_k, _langs[_k])

# The Skill Check (interview.app/evaluate/) is a different dataset from the
# question bank above — its pools live as one JSON file per section. Its SEO
# copy is hardcoded too, so count the pools here and keep those strings honest.
EVAL_DATA = ROOT / "interview.app" / "evaluate" / "data"
EVAL_SECTIONS = {
    "sql": "sql",
    "python": "python",
    "design": "design",
    "topics2026": "hot-topics-2026",
    "ai": "ai",
    "communication": "communication",
    "dashboarding": "dashboarding",
}


def eval_counts() -> dict[str, int]:
    counts = {}
    for key, stem in EVAL_SECTIONS.items():
        path = EVAL_DATA / f"{stem}.json"
        if path.exists():
            counts[key] = len(json.loads(path.read_text()).get("questions", []))
    return counts


EVAL = eval_counts()
EVAL_TOTAL = sum(EVAL.values())
EVAL_SECTION_N = len(EVAL)

# Each tuple is (regex, replacement). The regex is anchored on a keyword
# adjacent to the number so plain "710" elsewhere in the codebase isn't
# touched by accident.
SUBS = [
    # "710 Questions · 107 Companies" (deck cards)
    (re.compile(r"\b\d+\s*Questions\s*·\s*\d+\s*Companies\b"),
     f"{TOTAL} Questions · {COS} Companies"),

    # "710 real interview questions"
    (re.compile(r"\b\d+\s+real\s+interview\s+questions\b"),
     f"{TOTAL} real interview questions"),

    # "710 hand-curated interview questions"
    (re.compile(r"\b\d+\s+hand-curated\s+interview\s+questions\b"),
     f"{TOTAL} hand-curated interview questions"),

    # "all 710 questions"
    (re.compile(r"\ball\s+\d+\s+questions\b"),
     f"all {TOTAL} questions"),

    # SEO titles like "710 Real SQL, Python & Snowflake Questions"
    (re.compile(r"\b\d+\s+Real\s+SQL,\s+Python\s+(?:&|&amp;)\s+Snowflake\s+Questions\b"),
     f"{TOTAL} Real SQL, Python &amp; Snowflake Questions"),

    # "710 real questions · 107 companies"
    (re.compile(r"\b\d+\s+real\s+questions\s*·\s*\d+\s+companies\b"),
     f"{TOTAL} real questions · {COS} companies"),

    # "from 107 companies"
    (re.compile(r"\bfrom\s+\d+\s+companies\b"),
     f"from {COS} companies"),

    # "107 companies including"
    (re.compile(r"\b\d+\s+companies\s+including\b"),
     f"{COS} companies including"),

    # "and 99 other companies" (prerender lede) — the sentence names 8
    # companies first, so "other" is COS minus those 8, not COS.
    (re.compile(r"\band\s+\d+\s+other\s+companies\b"),
     f"and {COS - 8} other companies"),

    # SQL playground titles
    (re.compile(r"\b\d+\s+Real\s+SQL\s+Interview\s+Questions\b"),
     f"{SQL_N} Real SQL Interview Questions"),
    (re.compile(r"\bIn-Browser\s+SQLite\s+for\s+\d+\s+Interview\s+Questions\b"),
     f"In-Browser SQLite for {SQL_N} Interview Questions"),

    # Python playground titles
    (re.compile(r"\b\d+\s+Real\s+Python\s+Interview\s+Questions\b"),
     f"{PY_N} Real Python Interview Questions"),
    (re.compile(r"\bIn-Browser\s+Pyodide\s+for\s+\d+\s+Interview\s+Questions\b"),
     f"In-Browser Pyodide for {PY_N} Interview Questions"),

    # README phrases
    (re.compile(r"ships\s+\*\*\d+\s+real\s+interview\s+questions\*\*"),
     f"ships **{TOTAL} real interview questions**"),
    (re.compile(r"questions\.json\s+(←|<-)\s+\d+\s+unified"),
     f"questions.json         ← {TOTAL} unified"),

    # Subhead "710 questions · 107 companies · …" (interview.app header)
    (re.compile(r"<span\s+id=\"qb-total\">\s*[—\d-]+\s*</span>"),
     f'<span id="qb-total">{TOTAL}</span>'),
    (re.compile(r"<span\s+id=\"qb-companies\">\s*[—\d-]+\s*</span>"),
     f'<span id="qb-companies">{COS}</span>'),

    # FAQ JSON-LD answer "Most of the 991 SQL solutions run as-is" (the
    # visible copy of this sentence is a data-ps-stat span instead).
    (re.compile(r"\bMost of the \d+ SQL solutions\b"),
     f"Most of the {SQL_N} SQL solutions"),

    # FAQ stat about SQL solutions ("X of the Y SQL solutions") —
    # rewrite to a percentage-based phrasing that ages gracefully.
    (re.compile(r"\b\d+\s+of\s+the\s+\d+\s+SQL\s+solutions\s+run\s+as-is\b"),
     "Most SQL solutions run as-is"),
    (re.compile(r"The\s+other\s+\d+\s+use\s+Snowflake"),
     "Solutions that don't are flagged with a banner — they use Snowflake"),
]

# Per-page strings where the same wording carries a different number on each
# page ("N Real Questions with In-Browser Playground" is SQL on one page and
# Python on the other), so they cannot live in the shared SUBS list.
PAGE_SUBS = {
    "interview.app/sql.html": [
        (re.compile(r"\b\d+ Real Questions with In-Browser"), f"{SQL_N} Real Questions with In-Browser"),
        (re.compile(r"\bPractice \d+ real SQL interview questions"), f"Practice {SQL_N} real SQL interview questions"),
    ],
    "interview.app/python.html": [
        (re.compile(r"\b\d+ Real Questions with In-Browser"), f"{PY_N} Real Questions with In-Browser"),
        (re.compile(r"\bPractice \d+ real Python interview questions"), f"Practice {PY_N} real Python interview questions"),
    ],
}

FILES = [
    "index.html",
    "interview.app/index.html",
    "interview.app/sql.html",
    "interview.app/python.html",
    "interview.app/README.md",
]

# Skill Check pages. Kept on their own list with their own substitutions —
# the bank totals above must never leak into these strings, and vice versa.
EVAL_SUBS = [
    (re.compile(r"\b\d+-Question Bank\b"), f"{EVAL_TOTAL}-Question Bank"),
    (re.compile(r"\b\d+(-section (?:auto-graded )?skill assessment)"),
     lambda m: f"{EVAL_SECTION_N}{m.group(1)}"),
    (re.compile(r"\b\d+ (questions across SQL)"),
     lambda m: f"{EVAL_TOTAL} {m.group(1)}"),
    (re.compile(r"\b\d+ (skill-assessment pools)"),
     lambda m: f"{EVAL_SECTION_N} {m.group(1)}"),
    (re.compile(r"\b(Dashboarding (?:&amp;|&) BI) \(\d+ questions\)"),
     lambda m: f"{m.group(1)} ({EVAL.get('dashboarding', 0)} questions)"),
    (re.compile(r"\bSQL \(\d+ questions\)"), f"SQL ({EVAL.get('sql', 0)} questions)"),
    (re.compile(r"\bPython \(\d+ questions\)"), f"Python ({EVAL.get('python', 0)} questions)"),
    (re.compile(r"\b(Data (?:&amp;|&) System Design) \(\d+ questions\)"),
     lambda m: f"{m.group(1)} ({EVAL.get('design', 0)} questions)"),
    (re.compile(r"\b(2026 Hot Topics) \(\d+ questions"),
     lambda m: f"{m.group(1)} ({EVAL.get('topics2026', 0)} questions"),
    (re.compile(r"\b(AI Engineering) \(\d+ questions\)"),
     lambda m: f"{m.group(1)} ({EVAL.get('ai', 0)} questions)"),
    (re.compile(r"\b(Communication) \(\d+ questions\)"),
     lambda m: f"{m.group(1)} ({EVAL.get('communication', 0)} questions)"),
]

EVAL_FILES = [
    "interview.app/evaluate/index.html",
    "interview.app/evaluate/quiz.html",
]


STALE: list[str] = []


def _apply(rel: str, src: str, new: str) -> None:
    if new == src:
        if not CHECK:
            print(f"clean  {rel}")
        return
    if CHECK:
        STALE.append(rel)
        print(f"stale  {rel}")
    else:
        (ROOT / rel).write_text(new)
        print(f"update {rel}")


def main():
    mf_text = json.dumps(_mf_new, indent=2) + "\n"
    _apply("interview/data/manifest.json", MANIFEST.read_text(), mf_text)

    for rel in FILES:
        path = ROOT / rel
        if not path.exists():
            print(f"skip   {rel} (missing)")
            continue
        src = path.read_text()
        new = src
        for rgx, repl in SUBS + PAGE_SUBS.get(rel, []):
            new = rgx.sub(repl, new)
        _apply(rel, src, new)

    for rel in EVAL_FILES:
        path = ROOT / rel
        if not path.exists():
            print(f"skip   {rel} (missing)")
            continue
        src = path.read_text()
        new = src
        for rgx, repl in EVAL_SUBS:
            new = rgx.sub(repl, new)
        _apply(rel, src, new)

    if CHECK:
        if STALE:
            print("update_counts --check: stale counts in " + ", ".join(STALE)
                  + " — run: python3 interview/scripts/update_counts.py")
            sys.exit(1)
        return

    print(f"\nCurrent counts → {TOTAL} questions · {COS} companies · sql {SQL_N} · python {PY_N}")
    print(f"Skill Check    → {EVAL_TOTAL} questions across {EVAL_SECTION_N} sections · "
          + " · ".join(f"{k} {v}" for k, v in EVAL.items()))


if __name__ == "__main__":
    main()

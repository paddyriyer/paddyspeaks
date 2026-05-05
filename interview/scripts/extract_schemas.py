#!/usr/bin/env python3
"""
Parse the `schema` field of each SQL question into a structured spec
the SQL playground can use to generate per-question sample tables.

Output: interview/data/question_schemas.json
  { "<qid>": [ { "table": "orders", "columns": ["order_id", ...] }, ... ] }

Run from repo root:
  python3 interview/scripts/extract_schemas.py
"""

from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
QUESTIONS = ROOT / "interview" / "data" / "questions.json"
OUT = ROOT / "interview" / "data" / "question_schemas.json"
COVERAGE = ROOT / "interview" / "data" / "table_coverage.json"

TABLE_RE = re.compile(r"([A-Za-z_][A-Za-z0-9_]*)\s*\(([^()]*)\)")

# Column tokens shorter than this and not containing an underscore are
# probably aliases (e.g., "o", "c", "p") not real column names.
def is_real_column(token: str) -> bool:
    t = token.strip()
    if not t:
        return False
    if not re.match(r"^[A-Za-z_][A-Za-z0-9_]*$", t):
        return False
    # Single-letter or two-letter all-alpha: probably an alias
    if len(t) <= 2 and "_" not in t:
        return False
    return True


def parse_schema(schema: str):
    """Return list of {table, columns} — preserves order, dedupes columns."""
    if not schema:
        return []
    out = []
    seen = set()
    for m in TABLE_RE.finditer(schema):
        table = m.group(1)
        raw_cols = [c.strip() for c in m.group(2).split(",")]
        cols = []
        for c in raw_cols:
            if is_real_column(c) and c not in cols:
                cols.append(c)
        if not cols:
            continue
        key = (table, tuple(cols))
        if key in seen:
            continue
        seen.add(key)
        out.append({"table": table, "columns": cols})
    return out


def main():
    questions = json.loads(QUESTIONS.read_text())
    out = {}
    table_freq = Counter()
    for q in questions:
        if q.get("language") != "sql":
            continue
        spec = parse_schema(q.get("schema") or "")
        if not spec:
            continue
        out[q["id"]] = spec
        for s in spec:
            table_freq[s["table"]] += 1

    # Coverage: how many questions reference each table, with the union of cols
    union_cols = {}
    for spec in out.values():
        for s in spec:
            union_cols.setdefault(s["table"], set()).update(s["columns"])
    coverage = sorted(
        [
            {"table": t, "questions": table_freq[t], "columns": sorted(union_cols[t])}
            for t in union_cols
        ],
        key=lambda r: -r["questions"],
    )

    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2))
    COVERAGE.write_text(json.dumps(coverage, ensure_ascii=False, indent=2))

    print(f"Wrote {len(out)} question→schema entries to {OUT.relative_to(ROOT)}")
    print(f"Wrote {len(coverage)} table coverage rows to {COVERAGE.relative_to(ROOT)}")
    print("\nTop 15 tables across questions:")
    for row in coverage[:15]:
        print(f"  {row['table']:24s} {row['questions']:4d} qs · cols: {row['columns'][:8]}")


if __name__ == "__main__":
    main()

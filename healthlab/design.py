#!/usr/bin/env python3
"""Generate /interview.app/design/the-health-intelligence-problem.html.

    python3 -m healthlab.design            # write the page
    python3 -m healthlab.design --check    # fail if the committed page is stale (CI)

The template is healthlab/design/page.html. The SQL is embedded from
healthlab/sql/schema.sql and exercises.sql; the query results come from
healthlab/sql/exercises.out, written by `bash healthlab/sql/verify.sh --write`
against a real PostgreSQL. Demo facts come from health-lab/data. Nothing on the
page that a run can produce is typed by hand.
"""
from __future__ import annotations

import html
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
TEMPLATE = ROOT / "healthlab" / "design" / "page.html"
OUT = ROOT / "interview.app" / "design" / "the-health-intelligence-problem.html"
SQL = ROOT / "healthlab" / "sql"
RULE = "-- ----------------------------------------------------------------"


def code(text: str) -> str:
    """Escape SQL for a <div class="codeblock">, comments in the comment color."""
    out = []
    for line in text.strip("\n").splitlines():
        if line.startswith("\\echo"):
            continue
        esc = html.escape(line, quote=False)
        i = esc.find("--")
        if i >= 0:
            esc = esc[:i] + '<span class="cl">' + esc[i:] + "</span>"
        out.append(esc)
    return "\n".join(out)


def sections():
    text = (SQL / "exercises.sql").read_text()
    parts = text.split(RULE)
    found = {}
    for p in parts[1:]:
        m = re.match(r" (E\d) ", p)
        if m:
            found[m.group(1)] = RULE + p
    return found


def outputs():
    text = (SQL / "exercises.out").read_text()
    res = {}
    for block in text.split("-- ")[1:]:
        head, _, body = block.partition("\n")
        res[head.split()[0]] = html.escape(body.strip("\n"), quote=False)
    return res


def facts():
    a = json.loads((ROOT / "health-lab" / "data" / "profile-a.json").read_text())
    src = next(s for s in a["sources"] if s["file"] == "apple_export.xml")
    rec = sum(r["count"] for r in src["log"] if r["outcome"] == "duplicate" and "record" in r["reason"])
    wk = sum(r["count"] for r in src["log"] if r["outcome"] == "duplicate" and "workout" in r["reason"])
    ss = a["same_speed"]
    neg = lambda v: f"{v}".replace("-", "−")
    return {"A_DUPES": str(rec), "A_WDUPES": str(wk),
            "A_SS": f"{neg(ss['per_180d'])} /min per 6 months (95% interval {neg(ss['ci95'][0])} to {neg(ss['ci95'][1])})"}


def render() -> str:
    page = TEMPLATE.read_text()
    sec, out = sections(), outputs()
    rep = {"SCHEMA": code((SQL / "schema.sql").read_text())}
    for k in ("E1", "E2", "E3"):
        rep[k] = code(sec[k])
        rep[k + "_OUT"] = out[k]
    rep.update(facts())
    for k, v in rep.items():
        page = page.replace("{{" + k + "}}", v)
    left = re.findall(r"\{\{[A-Z0-9_]+\}\}", page)
    if left:
        raise SystemExit(f"unfilled placeholders: {left}")
    return page


def main(argv):
    page = render()
    if "--check" in argv:
        if not OUT.exists() or OUT.read_text() != page:
            print(f"{OUT.relative_to(ROOT)} is stale. Run: python3 -m healthlab.design")
            return 1
        print("✓ design page up to date")
        return 0
    OUT.write_text(page)
    print(f"wrote {OUT.relative_to(ROOT)} ({len(page) // 1024} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

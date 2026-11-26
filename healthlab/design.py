#!/usr/bin/env python3
"""Generate the two Health Intelligence Lab design interviews:

    Nº 43 /interview.app/design/the-health-intelligence-problem.html   (healthlab/design/page.html)
    Nº 44 /interview.app/design/the-private-health-lab-problem.html    (healthlab/design/private-lab.html)

    python3 -m healthlab.design            # write the pages
    python3 -m healthlab.design --check    # fail if a committed page is stale (CI)

Nº 44 embeds real code: the ZIP reader and Apple tokenizer from health-lab/engine.js
and the medication reconciliation from healthlab/ingest.py, with their real output.

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
TEMPLATE44 = ROOT / "healthlab" / "design" / "private-lab.html"
OUT44 = ROOT / "interview.app" / "design" / "the-private-health-lab-problem.html"
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


def fill(page: str, rep: dict) -> str:
    for k, v in rep.items():
        page = page.replace("{{" + k + "}}", v)
    left = re.findall(r"\{\{[A-Z0-9_]+\}\}", page)
    if left:
        raise SystemExit(f"unfilled placeholders: {left}")
    return page


def excerpt(text: str, start: str, end: str) -> str:
    """The lines from the one starting with `start` up to (not including) the one starting with `end`."""
    i = text.index(start)
    j = text.index(end, i + len(start))
    block = text[i:j].rstrip("\n").splitlines()
    pad = min(len(l) - len(l.lstrip()) for l in block if l.strip())
    return "\n".join(l[pad:] for l in block)


def jscode(text: str) -> str:
    out = []
    for line in text.splitlines():
        esc = html.escape(line, quote=False)
        i = esc.find("//")
        if i >= 0 and (i == 0 or esc[i - 1] in " ;{(") and "://" not in esc[max(0, i - 1):i + 2]:
            esc = esc[:i] + '<span class="cl">' + esc[i:] + "</span>"
        out.append(esc)
    return "\n".join(out)


def pycode(text: str) -> str:
    out = []
    for line in text.splitlines():
        esc = html.escape(line, quote=False)
        i = esc.find("#")
        if i >= 0 and esc[:i].count('"') % 2 == 0 and esc[:i].count("'") % 2 == 0:
            esc = esc[:i] + '<span class="cl">' + esc[i:] + "</span>"
        out.append(esc)
    return "\n".join(out)


def rows(data) -> str:
    return "\n".join("<tr>" + "".join(f"<td>{html.escape(str(c), quote=False)}</td>" for c in r) + "</tr>" for r in data)


def render44() -> str:
    import inspect
    from healthlab import ingest
    eng = (ROOT / "health-lab" / "engine.js").read_text()
    meta = json.loads((ROOT / "health-lab" / "data" / "meta.json").read_text())
    b = json.loads((ROOT / "health-lab" / "data" / "profile-b.json").read_text())
    c = json.loads((ROOT / "health-lab" / "data" / "profile-c.json").read_text())
    parity = json.loads((ROOT / "health-lab" / "tests" / "parity.json").read_text())
    A = meta["anonymity"]
    med = next(m for m in b["medications"] if m["status"] == "needs review")
    rep = {
        "ZIP_JS": jscode(excerpt(eng, "  // Find export.xml inside", "  // Read a text stream")),
        "RECONCILE_PY": pycode(inspect.getsource(ingest.reconcile_medications).rstrip()),
        "MED_OUT": html.escape(json.dumps(med, indent=2, ensure_ascii=False), quote=False),
        "ANON_ROWS": rows([[l["label"], f"{l['unique_pct']}%", f"{l['k_lt5_pct']}%", l["median_k"]] for l in A["levels"]]),
        "ANON_N": f"{A['population']:,}",
        "ANON_NOTE": html.escape(A["note"], quote=False),
        "MIN_CELL": str(meta["min_cell"]),
        "SUPPRESSED": str(sum(1 for v in meta["cohorts"]["strata"].values() if v.get("suppressed"))),
        "STRATA": str(len(meta["cohorts"]["strata"])),
        "COV_C": rows([[x["label"], x["status"], x["evidence"]] for x in c["coverage"]]),
        "PARITY_FILES": str(len(parity)),
    }
    return fill(TEMPLATE44.read_text(), rep)


def render() -> str:
    page = TEMPLATE.read_text()
    sec, out = sections(), outputs()
    rep = {"SCHEMA": code((SQL / "schema.sql").read_text())}
    for k in ("E1", "E2", "E3"):
        rep[k] = code(sec[k])
        rep[k + "_OUT"] = out[k]
    rep.update(facts())
    return fill(page, rep)


def main(argv):
    bad = 0
    for out, page in ((OUT, render()), (OUT44, render44())):
        if "--check" in argv:
            if not out.exists() or out.read_text() != page:
                print(f"{out.relative_to(ROOT)} is stale. Run: python3 -m healthlab.design")
                bad = 1
            continue
        out.write_text(page)
        print(f"wrote {out.relative_to(ROOT)} ({len(page) // 1024} KB)")
    if "--check" in argv and not bad:
        print("✓ design pages up to date")
    return bad


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

#!/usr/bin/env python3
"""Run the reference solutions and record their results in ../expected.json.

    python3 interview/loop/verify/compute_expected.py            # Python + SQL (needs psql)
    python3 interview/loop/verify/compute_expected.py --python   # Python only (no database)
    ... --check                                                   # fail if expected.json differs

SQL runs against a real PostgreSQL through `psql`; point it at one with the
usual PGHOST / PGPORT / PGUSER variables. Each question gets a fresh `public`
schema. Every diagnostic (a known wrong answer) must differ from the expected
result, or the run fails.
"""
import csv
import io
import json
import os
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
LOOP = HERE.parent
sys.path.insert(0, str(LOOP))
sys.path.insert(0, str(HERE))

import algos  # noqa: E402  reference Python
import runners  # noqa: E402

OUT = LOOP / "expected.json"


def python_expectations(qid, spec):
    ns = {"__name__": "loop_reference"}
    for name in ("FareWindow", "shortest_burst", "first_player_wins", "plan_compaction"):
        ns[name] = getattr(algos, name)
    exec(runners.PY_PRELUDE, ns)
    if spec.get("prelude_extra"):
        exec(spec["prelude_extra"], ns)
    out = []
    for t in spec["tests"]:
        start = time.perf_counter()
        if t.get("raises"):
            try:
                eval(t["expr"], ns)
            except Exception as e:  # noqa: BLE001
                assert type(e).__name__ == t["raises"], (qid, t["name"], e)
                out.append({"raises": t["raises"]})
                continue
            raise AssertionError(f"{qid} {t['name']}: reference did not raise {t['raises']}")
        got = eval(t["expr"], ns)
        secs = time.perf_counter() - start
        if isinstance(got, tuple) and len(got) == 2 and isinstance(got[0], str):
            raise AssertionError(f"{qid} {t['name']}: reference failed its own check: {got}")
        if t.get("limit_s"):
            assert secs < t["limit_s"] / 3, f"{qid} {t['name']}: reference too slow ({secs:.2f}s)"
        out.append({"expect": repr(got)})
    return out


def psql(*args, stdin=None):
    r = subprocess.run(["psql", "-X", "-q", "-v", "ON_ERROR_STOP=1", *args], input=stdin,
                       capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit(f"psql failed: {r.stderr}")
    return r.stdout


def run_sql(setup, view, query):
    prep = "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; SET client_min_messages = warning;\n" + setup
    if view:
        prep += "\n" + view.replace("CREATE TEMP VIEW", "CREATE VIEW") + ";\n"
    psql(stdin=prep)
    text = psql("--csv", "-P", "null=\\N", "-c", "SET TIME ZONE 'UTC'", "-c", query)
    rows = list(csv.reader(io.StringIO(text)))
    cols = rows[0]
    body = [[None if v == "\\N" else v for v in r] for r in rows[1:]]
    return {"columns": cols, "rows": body}


def sql_expectations(qid, spec):
    expect = [run_sql(spec["setup"], spec.get("reference_view"), e["sql"]) for e in spec["expect"]]
    diags = []
    for d in spec.get("diagnostics", []):
        res = run_sql(spec["setup"], spec.get("reference_view"), d["sql"])
        for e in expect:
            if res["rows"] == e["rows"]:
                raise AssertionError(f"{qid}: a diagnostic equals the expected result: {d['message'][:60]}")
        diags.append(res)
    return {"expect": expect, "diagnostics": diags}


def main(argv):
    python_only = "--python" in argv
    check = "--check" in argv
    old = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {}
    new = {}
    for qid, spec in runners.RUNNERS.items():
        if spec["lang"] == "python":
            new[qid] = {"tests": python_expectations(qid, spec)}
        elif python_only:
            if qid not in old:
                raise SystemExit(f"{qid}: no recorded SQL results; run without --python against PostgreSQL")
            new[qid] = old[qid]
        else:
            new[qid] = sql_expectations(qid, spec)
    text = json.dumps(new, indent=1, ensure_ascii=False) + "\n"
    if check:
        if not OUT.exists() or OUT.read_text(encoding="utf-8") != text:
            print("interview/loop/expected.json is stale: re-run interview/loop/verify/compute_expected.py")
            return 1
        print("expected.json: the reference solutions still produce every recorded result")
        return 0
    OUT.write_text(text, encoding="utf-8")
    print(f"wrote {OUT.relative_to(LOOP.parent.parent)} ({len(new)} questions)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

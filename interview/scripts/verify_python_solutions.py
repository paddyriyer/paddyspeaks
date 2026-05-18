#!/usr/bin/env python3
"""
Verify every Python reference solution by executing it in a subprocess with
a per-question timeout — so one hanging solution can't stall the sweep (the
in-process audit in audit_solutions.py does).

Mirrors the playground (interview.app/js/python.js): the same prelude is
pre-run, and runtime:pyspark / third-party solutions are not executed (the
playground shows those read-only — Pyodide can't run them). They are still
syntax-checked. pandas solutions run only if pandas imports here.

Usage:  python3 interview/scripts/verify_python_solutions.py
Writes interview/data/python_audit.json.
"""
from __future__ import annotations

import ast
import json
import shutil
import subprocess
import sys
import tempfile
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from audit_solutions import FUNC_CANONICAL, PRELUDE_PY

ROOT = Path(__file__).resolve().parents[2]
QUESTIONS = ROOT / "interview" / "data" / "questions.json"
REPORT = ROOT / "interview" / "data" / "python_audit.json"
TIMEOUT = 12  # seconds per solution

try:
    import pandas  # noqa: F401

    PANDAS_OK = True
except Exception:
    PANDAS_OK = False

# The playground binds `pd` / `np` in globals once pandas finishes loading.
PANDAS_PRELUDE = (
    "import warnings\n"
    "warnings.filterwarnings('ignore')\n"
    "import numpy as np\n"
    "import pandas as pd\n"
)


def first_funcdef(src):
    """Name of the first top-level def (or None), and whether src fails to parse."""
    try:
        tree = ast.parse(src)
    except SyntaxError:
        return None, True
    for node in tree.body:
        if isinstance(node, ast.FunctionDef):
            return node.name, False
    return None, False


def _syntax_error(src, qid):
    try:
        compile(src, qid, "exec")
        return None
    except SyntaxError as e:
        return f"SyntaxError: {e.msg} (line {e.lineno})"


def verify(q):
    qid = q["id"]
    rec = {"id": qid, "batch": qid.rsplit("-", 1)[0], "runtime": q.get("runtime")}
    src = q.get("solution") or ""
    if not src.strip():
        rec["status"] = "empty"
        return rec

    rt = q.get("runtime")
    runnable = rt not in ("pyspark", "third-party") and not (
        rt == "pandas" and not PANDAS_OK
    )
    if not runnable:
        # Not executable here — still catch syntax errors in the reference.
        err = _syntax_error(src, qid)
        rec["status"] = "error" if err else "skipped"
        if err:
            rec["msg"] = err
        return rec

    fn, syntax_err = first_funcdef(src)
    if syntax_err:
        rec["status"] = "error"
        rec["msg"] = _syntax_error(src, qid) or "SyntaxError"
        return rec

    demo = ""
    if fn and FUNC_CANONICAL.get(fn):
        demo = f"\n__r = {fn}({FUNC_CANONICAL[fn]})\nprint(__r)\n"
        rec["demo"] = fn

    prelude = PRELUDE_PY + (PANDAS_PRELUDE if rt == "pandas" else "")
    code = prelude + "\n" + src + demo
    # A private working directory per solution — file-based solutions read and
    # write fixture files, and the sweep runs many in parallel.
    workdir = tempfile.mkdtemp(prefix="pyverify_")
    try:
        p = subprocess.run(
            [sys.executable, "-c", code],
            capture_output=True,
            text=True,
            timeout=TIMEOUT,
            cwd=workdir,
        )
    except subprocess.TimeoutExpired:
        rec["status"] = "timeout"
        return rec
    finally:
        shutil.rmtree(workdir, ignore_errors=True)

    if p.returncode != 0:
        rec["status"] = "error"
        lines = [ln for ln in (p.stderr or "").strip().splitlines() if ln.strip()]
        rec["msg"] = lines[-1] if lines else f"exit {p.returncode}"
        return rec

    rec["status"] = "ok"
    return rec


def main():
    questions = json.loads(QUESTIONS.read_text())
    py = [q for q in questions if q.get("language") == "python"]
    with ThreadPoolExecutor(max_workers=8) as ex:
        results = list(ex.map(verify, py))
    results.sort(key=lambda r: r["id"])
    REPORT.write_text(json.dumps(results, indent=1, ensure_ascii=False) + "\n")

    st = Counter(r["status"] for r in results)
    print(f"\n══ PYTHON SOLUTION VERIFICATION ══  ({len(results)} Python questions)\n")
    print(f"  ok        : {st['ok']}")
    print(f"  error     : {st['error']}")
    print(f"  timeout   : {st['timeout']}")
    print(f"  empty     : {st['empty']}")
    print(f"  skipped   : {st['skipped']}  (pyspark / third-party"
          + ("" if PANDAS_OK else " / pandas") + ")")
    print(f"\n  pandas available here: {PANDAS_OK}")
    fails = [r for r in results if r["status"] in ("error", "timeout")]
    if fails:
        print(f"\n  failures by batch: {dict(Counter(r['batch'] for r in fails))}")
    print(f"\n  full report → interview/data/python_audit.json")


if __name__ == "__main__":
    main()

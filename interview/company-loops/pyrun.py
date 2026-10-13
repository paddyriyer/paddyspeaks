#!/usr/bin/env python3
"""Run reference Python solutions against generated test cases (used by validate.mjs).

Reads a JSON job on stdin:
  [{"id": "...", "code": "...", "entry": "...", "prelude": "...",
    "cases": [{"name": "...", "args": "<python expr>", "expect": "<python literal>" | null, "limit_s": n | null}]}]
Prints one JSON object: {"problems": [...], "cases": n}.

A case with an expect must equal it (floats to 0.005). A case with a limit_s must
finish in under a third of it: the reference has to clear its own timing test
with room to spare in a slower browser runtime.
"""
import ast
import json
import sys
import time


def close(a, b):
    if isinstance(a, float) or isinstance(b, float):
        try:
            return abs(float(a) - float(b)) <= 0.005 + 1e-9
        except (TypeError, ValueError):
            return False
    if isinstance(a, (list, tuple)) and isinstance(b, (list, tuple)):
        return len(a) == len(b) and all(close(x, y) for x, y in zip(a, b))
    if isinstance(a, dict) and isinstance(b, dict):
        return a.keys() == b.keys() and all(close(a[k], b[k]) for k in a)
    return a == b


def main():
    jobs = json.load(sys.stdin)
    problems, n = [], 0
    for job in jobs:
        ns = {"__name__": "reference"}
        try:
            exec(compile(job["code"], job["id"] + " reference", "exec"), ns)
            exec(job.get("prelude") or "", ns)
        except Exception as e:  # noqa: BLE001
            problems.append(f"{job['id']}: reference does not run: {e}")
            continue
        fn = ns.get(job["entry"])
        if not callable(fn):
            problems.append(f"{job['id']}: reference defines no {job['entry']}()")
            continue
        for c in job["cases"]:
            n += 1
            try:
                args = eval(c["args"], ns)
                start = time.perf_counter()
                got = fn(*args)
                secs = time.perf_counter() - start
            except Exception as e:  # noqa: BLE001
                problems.append(f"{job['id']} [{c['name']}]: reference raised {type(e).__name__}: {e}")
                continue
            if c.get("expect") is not None:
                want = ast.literal_eval(c["expect"])
                if not close(got, want):
                    problems.append(f"{job['id']} [{c['name']}]: reference {repr(got)[:160]} != oracle {c['expect'][:160]}")
            if c.get("limit_s") and secs > c["limit_s"] / 3:
                problems.append(f"{job['id']} [{c['name']}]: reference took {secs:.2f}s (limit {c['limit_s']}s / 3)")
    print(json.dumps({"problems": problems, "cases": n}))


if __name__ == "__main__":
    main()

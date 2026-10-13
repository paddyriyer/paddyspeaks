/* Company Interview Loops — Python checks in a Web Worker (Pyodide).
   Runs the candidate's code and, for tests without a fixed expect, the evaluator's
   reference, each in its own namespace. The page terminates this worker on timeout,
   so a slow or endless answer never freezes the tab.
   In:  { id, code, ref, entry, prelude, tests: [{name, args, expect?, limit_s?}] }
   Out: { id, type: "booted" }, then { id, ok, results?, error? } */
/* global importScripts, loadPyodide */
"use strict";

const INDEX = "/interview.app/vendor/pyodide/";
let ready = null;

const HARNESS = `
import ast, json, time, traceback, copy

def _close(a, b):
    if isinstance(a, float) or isinstance(b, float):
        try:
            return abs(float(a) - float(b)) <= 0.005 + 1e-9
        except (TypeError, ValueError):
            return False
    if isinstance(a, (list, tuple)) and isinstance(b, (list, tuple)):
        return len(a) == len(b) and all(_close(x, y) for x, y in zip(a, b))
    if isinstance(a, dict) and isinstance(b, dict):
        return a.keys() == b.keys() and all(_close(a[k], b[k]) for k in a)
    return a == b

def _ns(code, prelude, label):
    ns = {"__name__": label}
    exec(compile(code, "<" + label + ">", "exec"), ns)
    exec(prelude, ns)
    return ns

def _cl_run(code, ref, entry, prelude, tests_json):
    try:
        cand = _ns(code, prelude, "your code")
    except Exception:
        return json.dumps({"error": traceback.format_exc(limit=2)})
    if not callable(cand.get(entry)):
        return json.dumps({"error": "Define a function named " + entry + "()."})
    refns = None
    out = []
    for t in json.loads(tests_json):
        r = {"name": t["name"]}
        try:
            if t.get("expect") is not None:
                want = ast.literal_eval(t["expect"])
            else:
                if refns is None:
                    refns = _ns(ref, prelude, "reference")
                want = refns[entry](*eval(t["args"], refns))
            args = eval(t["args"], cand)
            start = time.perf_counter()
            got = cand[entry](*args)
            r["secs"] = time.perf_counter() - start
            r["ok"] = _close(got, want)
            if not r["ok"]:
                r["got"] = repr(got)[:300]
                r["want"] = repr(want)[:300]
        except Exception as e:
            r["ok"] = False
            r["got"] = (type(e).__name__ + ": " + str(e))[:300]
            r.setdefault("secs", 0)
        lim = t.get("limit_s")
        if lim and r.get("ok") and r["secs"] > lim:
            r["ok"] = False
            r["got"] = "correct, but took %.1f s (limit %d s): check your complexity" % (r["secs"], lim)
        out.append(r)
    return json.dumps({"results": out})
`;

async function boot() {
  importScripts(INDEX + "pyodide.js");
  const py = await loadPyodide({ indexURL: INDEX });
  py.runPython(HARNESS);
  return py;
}

self.onmessage = async (ev) => {
  const { id, code, ref, entry, prelude, tests } = ev.data;
  try {
    if (!ready) ready = boot();
    const py = await ready;
    self.postMessage({ id, type: "booted" });
    const run = py.globals.get("_cl_run");
    const raw = run(code, ref || "", entry, prelude || "", JSON.stringify(tests));
    run.destroy();
    const parsed = JSON.parse(raw);
    if (parsed.error) self.postMessage({ id, ok: false, error: parsed.error });
    else self.postMessage({ id, ok: true, results: parsed.results });
  } catch (e) {
    self.postMessage({ id, ok: false, error: String((e && e.message) || e) });
  }
};

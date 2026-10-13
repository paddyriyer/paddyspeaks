/* Five-Round Loop — Python checks in a Web Worker.
   Pyodide runs here, not on the page, so a slow or endless answer can be
   stopped (the page terminates this worker on timeout) without freezing the tab.
   Message in:  { id, code, prelude, tests: [{name, expr, expect?, raises?, limit_s?}] }
   Message out: { id, type: "booted" } once Python is loaded, then { id, ok, results?, error? } */
/* global importScripts, loadPyodide */
"use strict";

const INDEX = "/interview.app/vendor/pyodide/";
let ready = null;

const HARNESS = `
import ast, json, time, traceback

def _close(a, b):
    if isinstance(a, float) or isinstance(b, float):
        try:
            return abs(float(a) - float(b)) <= 0.005 + 1e-9
        except (TypeError, ValueError):
            return False
    if isinstance(a, (list, tuple)) and isinstance(b, (list, tuple)):
        return len(a) == len(b) and all(_close(x, y) for x, y in zip(a, b))
    return a == b

def _loop_run(code, prelude, tests_json):
    ns = {"__name__": "__candidate__"}
    try:
        exec(compile(code, "<your code>", "exec"), ns)
    except Exception:
        return json.dumps({"error": traceback.format_exc(limit=2)})
    exec(prelude, ns)
    out = []
    for t in json.loads(tests_json):
        start = time.perf_counter()
        r = {"name": t["name"]}
        try:
            got = eval(t["expr"], ns)
            r["secs"] = time.perf_counter() - start
            if t.get("raises"):
                r["ok"] = False
                r["got"] = "returned " + repr(got)[:300] + " instead of raising " + t["raises"]
            else:
                want = ast.literal_eval(t["expect"])
                r["ok"] = _close(got, want)
                if not r["ok"]:
                    r["got"] = repr(got)[:300]
                    r["want"] = t["expect"][:300]
        except Exception as e:
            r["secs"] = time.perf_counter() - start
            if t.get("raises") and type(e).__name__ == t["raises"]:
                r["ok"] = True
            else:
                r["ok"] = False
                r["got"] = (type(e).__name__ + ": " + str(e))[:300]
        lim = t.get("limit_s")
        if lim and r["secs"] > lim and r.get("ok"):
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
  const { id, code, prelude, tests } = ev.data;
  try {
    if (!ready) ready = boot();
    const py = await ready;
    self.postMessage({ id, type: "booted" });   // the page starts the test clock now
    const run = py.globals.get("_loop_run");
    const raw = run(code, prelude, JSON.stringify(tests));
    run.destroy();
    const parsed = JSON.parse(raw);
    if (parsed.error) self.postMessage({ id, ok: false, error: parsed.error });
    else self.postMessage({ id, ok: true, results: parsed.results });
  } catch (e) {
    self.postMessage({ id, ok: false, error: String(e && e.message || e) });
  }
};

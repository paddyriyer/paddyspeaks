#!/usr/bin/env python3
"""Build and validate the Career Prep content.

Sources (hand-written, reviewed):
    interview/careers/roles.json        families, seniority, roles, title patterns
    interview/careers/categories.json   interview categories + preparation guides
    interview/careers/rubric.json       rubric dimensions and anchors
    interview/careers/tracks/*.json     one interview curriculum per track

Output (GENERATED — never edit):
    interview.app/careers/data/careers.json         taxonomy, guides, tracks, counts
    interview.app/careers/data/tracks/<track>.json  that track's questions

Numbers inside practice scenarios are computed here, not typed: a question's
`vars` are substituted into {{…}} expressions, and a `table` with
"compute": "rice" or "critical_path" gets its results calculated.

    python3 interview/careers/build.py           # write
    python3 interview/careers/build.py --check   # fail if output is stale or content invalid
"""
from __future__ import annotations

import argparse
import ast
import json
import math
import operator
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OUT = ROOT / "interview.app" / "careers" / "data"

REQUIRED_Q = ("id", "category", "levels", "minutes", "title", "prompt", "hints",
              "followups", "criteria", "outline", "reference", "pitfalls", "dimensions")
MIN_LEN = {"hints": 2, "followups": 3, "criteria": 4, "outline": 4, "pitfalls": 1, "dimensions": 2}

# Never attribute a question to an employer or call it real. A question may set
# its premise in a familiar product only when it says so in `premise`.
EMPLOYERS = ["google", "meta", "facebook", "instagram", "whatsapp", "amazon", "aws", "microsoft",
             "apple", "netflix", "openai", "anthropic", "uber", "airbnb", "stripe", "linkedin",
             "salesforce", "nvidia", "tiktok", "spotify", "databricks", "snowflake"]
ATTRIBUTION = re.compile(
    r"\b(asked (at|by|in)|real interview question|actual interview question|verbatim|"
    r"reported by (a |an )?candidates?|leaked|from (a|an|the) (google|meta|amazon|microsoft|openai|apple) interview|"
    r"(google|meta|amazon|microsoft|openai|apple)['’]s interview)\b", re.I)
PREDICTION = re.compile(r"\b(you will (get|receive) (an|the) offer|guarantee[sd]? (an|the) offer|"
                        r"hiring (probability|likelihood)|chance of (being hired|an offer))\b", re.I)

errors: list[str] = []


def err(msg: str) -> None:
    errors.append(msg)


def load(p: Path):
    return json.loads(p.read_text(encoding="utf-8"))


# ── safe expression evaluation for {{…}} ─────────────────────────────────────
_OPS = {ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul,
        ast.Div: operator.truediv, ast.USub: operator.neg, ast.Pow: operator.pow}


def _money(x: float) -> str:
    return f"${x:,.2f}" if abs(x - round(x)) > 1e-9 else f"${x:,.0f}"


def _num(x: float, nd: int = 0) -> str:
    return f"{x:,.{int(nd)}f}"


def _pct(x: float, nd: int = 0) -> str:
    return f"{x * 100:.{int(nd)}f}%"


def _list(xs) -> str:
    xs = [str(v) for v in xs]
    return ", ".join(xs[:-1]) + " and " + xs[-1] if len(xs) > 1 else "".join(xs)


FUNCS = {"mean": lambda xs: sum(xs) / len(xs), "min": min, "max": max, "sum": sum,
         "ceil": math.ceil, "round": round,
         "fmt.money": _money, "fmt.num": _num, "fmt.pct": _pct, "fmt.list": _list}


def _eval(node, env):
    if isinstance(node, ast.Expression):
        return _eval(node.body, env)
    if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
        return node.value
    if isinstance(node, ast.Name):
        if node.id not in env:
            raise KeyError(node.id)
        return env[node.id]
    if isinstance(node, ast.Attribute) and isinstance(node.value, ast.Name):
        key = f"{node.value.id}.{node.attr}"
        if key in env:
            return env[key]
        raise KeyError(key)
    if isinstance(node, ast.BinOp) and type(node.op) in _OPS:
        return _OPS[type(node.op)](_eval(node.left, env), _eval(node.right, env))
    if isinstance(node, ast.UnaryOp) and type(node.op) in _OPS:
        return _OPS[type(node.op)](_eval(node.operand, env))
    if isinstance(node, ast.Call):
        f = node.func
        name = f.id if isinstance(f, ast.Name) else (
            f"{f.value.id}.{f.attr}" if isinstance(f, ast.Attribute) and isinstance(f.value, ast.Name) else None)
        if name not in FUNCS:
            raise KeyError(f"function {name}")
        return FUNCS[name](*[_eval(a, env) for a in node.args])
    raise ValueError(f"unsupported expression: {ast.dump(node)}")


def render(text: str, env: dict, where: str) -> str:
    def sub(m):
        expr = m.group(1).strip()
        try:
            if expr in env and isinstance(env[expr], str):
                return env[expr]
            v = _eval(ast.parse(expr, mode="eval"), env)
        except Exception as e:  # noqa: BLE001 — report and keep going
            err(f"{where}: cannot evaluate {{{{{expr}}}}}: {e}")
            return m.group(0)
        if isinstance(v, float) and v.is_integer():
            v = int(v)
        return str(v)
    return re.sub(r"\{\{(.+?)\}\}", sub, text)


# ── table computations ───────────────────────────────────────────────────────
def compute_rice(table: dict, env: dict) -> None:
    for r in table["rows"]:
        r["score"] = round(r["reach"] * r["impact"] * r["confidence"] / r["effort"], 1)
        s = r["score"]
        env[f"rice.{r['key']}"] = f"{s:,.0f}" if float(s).is_integer() else f"{s:,.1f}"
    table["columns"] = [["item", "Request"], ["reach", "Reach"], ["impact", "Impact"],
                        ["confidence", "Confidence"], ["effort", "Effort"], ["score", "RICE (computed)"]]
    table["rank"] = [r["key"] for r in sorted(table["rows"], key=lambda r: -r["score"])]


def compute_critical_path(table: dict, env: dict, where: str) -> None:
    rows = {r["key"]: r for r in table["rows"]}
    order, seen = [], set()

    def visit(k, stack=()):
        if k in stack:
            err(f"{where}: dependency cycle at {k}")
            return
        if k in seen:
            return
        for p in rows[k]["after"]:
            if p not in rows:
                err(f"{where}: unknown predecessor {p}")
                continue
            visit(p, stack + (k,))
        seen.add(k)
        order.append(k)

    for k in rows:
        visit(k)
    ef = {}
    for k in order:
        es = max((ef[p] for p in rows[k]["after"]), default=0)
        rows[k]["start"] = es
        ef[k] = es + rows[k]["duration"]
        rows[k]["finish"] = ef[k]
    total = max(ef.values())
    succ = {k: [s for s in rows if k in rows[s]["after"]] for k in rows}
    lf = {}
    for k in reversed(order):
        lf[k] = min((lf[s] - rows[s]["duration"] for s in succ[k]), default=total)
    for k in rows:
        rows[k]["slack"] = lf[k] - ef[k]

    paths = []

    def walk(k, path):
        nxt = [s for s in succ[k] if rows[s]["slack"] == 0 and rows[s]["start"] == ef[k]]
        if not nxt:
            paths.append(path)
        for s in nxt:
            walk(s, path + [s])

    for k in order:
        if rows[k]["slack"] == 0 and not rows[k]["after"]:
            walk(k, [k])
    table["total"] = total
    table["paths"] = paths
    table["columns"] = [["item", "Task"], ["duration", "Weeks"], ["after", "After"],
                        ["start", "Earliest start (computed)"], ["finish", "Earliest finish (computed)"],
                        ["slack", "Slack (computed)"]]
    env["cp.total"] = str(total)
    env["cp.paths"] = _list(["–".join(p) for p in paths])
    slack = [f"{k} ({rows[k]['slack']} week{'s' if rows[k]['slack'] != 1 else ''})"
             for k in rows if rows[k]["slack"] > 0]
    env["cp.slack_text"] = _list(slack) if slack else "none"


# ── validation + build ───────────────────────────────────────────────────────
def build() -> dict[str, object]:
    roles_doc = load(HERE / "roles.json")
    cats_doc = load(HERE / "categories.json")
    rub_doc = load(HERE / "rubric.json")
    track_files = sorted((HERE / "tracks").glob("*.json"))
    tracks = [load(p) for p in track_files]

    fam_ids = [f["id"] for f in roles_doc["families"]]
    sen_ids = [s["id"] for s in roles_doc["seniority"]]
    cat_by = {c["id"]: c for c in cats_doc["categories"]}
    dim_ids = {d["id"] for d in rub_doc["dimensions"]}
    track_by = {t["id"]: t for t in tracks}

    for name, ids in [("family", fam_ids), ("seniority", sen_ids), ("category", [c["id"] for c in cats_doc["categories"]]),
                      ("rubric dimension", [d["id"] for d in rub_doc["dimensions"]]), ("track", [t["id"] for t in tracks]),
                      ("role", [r["id"] for r in roles_doc["roles"]])]:
        dup = {i for i in ids if ids.count(i) > 1}
        if dup:
            err(f"duplicate {name} id(s): {sorted(dup)}")
    for p, t in zip(track_files, tracks):
        if p.stem != t["id"]:
            err(f"{p.name}: id {t['id']!r} must match the file name")
    for d in rub_doc["dimensions"]:
        if len(d["anchors"]) != len(rub_doc["scale"]):
            err(f"rubric {d['id']}: needs one anchor per scale point")

    # roles
    for r in roles_doc["roles"]:
        w = f"role {r['id']}"
        if r["family"] not in fam_ids:
            err(f"{w}: unknown family {r['family']}")
        if r["level"] not in sen_ids:
            err(f"{w}: unknown level {r['level']}")
        for pat in r["title_patterns"] + r.get("exclude_patterns", []):
            try:
                re.compile(pat)
            except re.error as e:
                err(f"{w}: bad pattern {pat!r}: {e}")
        if r["prep"] == "careers":
            if r.get("track") not in track_by:
                err(f"{w}: unknown track {r.get('track')}")
            else:
                tc = set(track_by[r["track"]]["categories"])
                for c in r.get("focus", []):
                    if c not in tc:
                        err(f"{w}: focus {c} is not a category of track {r['track']}")
        elif r["prep"] == "studio":
            if not r.get("studio_links"):
                err(f"{w}: a studio role needs studio_links")
        else:
            err(f"{w}: prep must be 'careers' or 'studio'")
    for f in fam_ids:
        if not any(r["family"] == f for r in roles_doc["roles"]):
            err(f"family {f} has no roles")

    # tracks + questions
    all_q_ids: list[str] = []
    prompts: dict[str, str] = {}
    out_tracks, track_questions = [], {}
    for t in tracks:
        w = f"track {t['id']}"
        for c in t["categories"]:
            if c not in cat_by:
                err(f"{w}: unknown category {c}")
        for d in t["rubric"]:
            if d not in dim_ids:
                err(f"{w}: unknown rubric dimension {d}")
        qids = [q["id"] for q in t["questions"]]
        all_q_ids += qids
        ns = [r["n"] for r in t["rounds"]]
        if ns != [1, 2, 3, 4, 5]:
            err(f"{w}: needs exactly five rounds numbered 1–5 (got {ns})")
        pooled = set()
        for r in t["rounds"]:
            if not r["pool"]:
                err(f"{w} round {r['n']}: empty pool")
            for q in r["pool"]:
                if q not in qids:
                    err(f"{w} round {r['n']}: unknown question {q}")
                pooled.add(q)
        for q in qids:
            if q not in pooled:
                err(f"{w}: question {q} is in no round")
        for c in t["categories"]:
            if not any(q["category"] == c for q in t["questions"]):
                err(f"{w}: category {c} has no question")

        rendered = []
        for q in t["questions"]:
            qw = f"{w} question {q.get('id')}"
            for k in REQUIRED_Q:
                if not q.get(k):
                    err(f"{qw}: missing {k}")
            for k, n in MIN_LEN.items():
                if len(q.get(k, [])) < n:
                    err(f"{qw}: needs at least {n} {k}")
            if len(q.get("reference", "")) < 300:
                err(f"{qw}: reference answer is too short")
            if q.get("category") not in t["categories"]:
                err(f"{qw}: category {q.get('category')} is not in the track")
            for lv in q.get("levels", []):
                if lv not in sen_ids:
                    err(f"{qw}: unknown level {lv}")
            for d in q.get("dimensions", []):
                if d not in dim_ids:
                    err(f"{qw}: unknown dimension {d}")
            q = json.loads(json.dumps(q))      # deep copy; sources stay untouched
            env: dict = dict(q.get("vars", {}))
            if "table" in q:
                kind = q["table"].get("compute")
                if kind == "rice":
                    compute_rice(q["table"], env)
                elif kind == "critical_path":
                    compute_critical_path(q["table"], env, qw)
                else:
                    err(f"{qw}: unknown table compute {kind!r}")
            for k in ("title", "prompt", "premise", "reference"):
                if k in q:
                    q[k] = render(q[k], env, f"{qw}.{k}")
            for k in ("hints", "followups", "criteria", "outline", "pitfalls"):
                q[k] = [render(s, env, f"{qw}.{k}") for s in q[k]]
            q.pop("vars", None)
            text = " ".join([q["title"], q["prompt"], q.get("premise", ""), q["reference"],
                             *q["hints"], *q["followups"], *q["criteria"], *q["outline"]])
            if "{{" in text:
                err(f"{qw}: unresolved token")
            if ATTRIBUTION.search(text):
                err(f"{qw}: attributes a question to an employer or calls it real: "
                    f"{ATTRIBUTION.search(text).group(0)!r}")
            if PREDICTION.search(text):
                err(f"{qw}: presents practice as a hiring prediction")
            named = [e for e in EMPLOYERS if re.search(rf"\b{e}\b", q["prompt"] + " " + q["reference"], re.I)]
            if named and "not a reported interview question" not in q.get("premise", ""):
                err(f"{qw}: names {named} — say in `premise` that it is a hypothetical, not a reported interview question")
            key = re.sub(r"\W+", " ", q["prompt"].lower()).strip()
            if key in prompts:
                err(f"{qw}: same prompt as {prompts[key]}")
            prompts[key] = q["id"]
            q["kind"] = "practice"
            q["track"] = t["id"]
            rendered.append(q)
        track_questions[t["id"]] = rendered
        dims_used = sorted({d for q in rendered for d in q["dimensions"]})
        out_tracks.append({
            "id": t["id"], "title": t["title"], "summary": t["summary"], "tests": t["tests"],
            "distinct_from": t.get("distinct_from"), "categories": t["categories"],
            "rubric": t["rubric"], "rubric_all": sorted(set(t["rubric"]) | set(dims_used)),
            "rounds": t["rounds"], "studio_links": t.get("studio_links", []),
            "question_count": len(rendered),
            "by_category": {c: sum(1 for q in rendered if q["category"] == c) for c in t["categories"]},
        })

    dup = {i for i in all_q_ids if all_q_ids.count(i) > 1}
    if dup:
        err(f"duplicate question ids: {sorted(dup)}")

    # Product management and technical program management are different jobs.
    # Their curricula must not converge (the owner's requirement).
    def jaccard(a, b):
        a, b = set(a) - {"behavioral"}, set(b) - {"behavioral"}
        return len(a & b) / max(1, len(a | b))
    for a, b in [("pm_core", "tpm"), ("tech_pm", "tpm"), ("pm_core", "tech_pm"), ("ai_pm", "tpm")]:
        if a in track_by and b in track_by:
            j = jaccard(track_by[a]["categories"], track_by[b]["categories"])
            if j > 0.2:
                err(f"tracks {a} and {b} share too many categories ({j:.0%}); they must stay distinct")
    role_track = {r["id"]: r.get("track") for r in roles_doc["roles"]}
    if role_track.get("technical_pm") == role_track.get("tpm"):
        err("technical_pm and tpm must use different tracks")

    roles_out = []
    for r in roles_doc["roles"]:
        o = {k: r[k] for k in ("id", "family", "title", "level", "prep", "summary", "aliases") if k in r}
        if r["prep"] == "careers":
            o["track"] = r["track"]
            o["focus"] = r.get("focus") or track_by[r["track"]]["categories"]
            o["question_count"] = len(track_questions[r["track"]])
        else:
            o["studio_links"] = r["studio_links"]
        roles_out.append(o)

    total_q = sum(len(v) for v in track_questions.values())
    careers = {
        "$comment": "GENERATED by interview/careers/build.py from interview/careers/*.json — do not edit.",
        "families": [{**f, "role_count": sum(1 for r in roles_doc["roles"] if r["family"] == f["id"])}
                     for f in roles_doc["families"]],
        "seniority": roles_doc["seniority"],
        "roles": roles_out,
        "categories": cats_doc["categories"],
        "rubric": {"scale": rub_doc["scale"], "dimensions": rub_doc["dimensions"]},
        "tracks": out_tracks,
        "counts": {"roles": len(roles_out), "families": len(fam_ids), "tracks": len(out_tracks),
                   "questions": total_q, "categories": len({c for t in tracks for c in t["categories"]})},
    }
    files: dict[str, object] = {"careers.json": careers}
    for tid, qs in track_questions.items():
        files[f"tracks/{tid}.json"] = {"$comment": careers["$comment"], "track": tid, "questions": qs}
    return files


def dump(obj) -> str:
    return json.dumps(obj, ensure_ascii=False, indent=1) + "\n"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()
    files = build()
    if errors:
        print("Career Prep content is invalid:", file=sys.stderr)
        for e in errors:
            print("  ✗ " + e, file=sys.stderr)
        return 1
    stale = []
    for rel, obj in files.items():
        p = OUT / rel
        text = dump(obj)
        if args.check:
            if not p.exists() or p.read_text(encoding="utf-8") != text:
                stale.append(rel)
        else:
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(text, encoding="utf-8")
    existing = {str(p.relative_to(OUT)) for p in OUT.rglob("*.json")} if OUT.exists() else set()
    extra = sorted(existing - set(files))
    if args.check:
        if stale or extra:
            print("Career Prep data is stale; run python3 interview/careers/build.py", file=sys.stderr)
            for s in stale + extra:
                print("  ✗ " + s, file=sys.stderr)
            return 1
        print(f"Career Prep data OK — {files['careers.json']['counts']}")
        return 0
    for rel in extra:
        (OUT / rel).unlink()
    print(f"wrote {OUT.relative_to(ROOT)} — {files['careers.json']['counts']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

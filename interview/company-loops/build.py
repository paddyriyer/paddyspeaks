#!/usr/bin/env python3
"""Build the Company Interview Loops data from its sources.

    python3 interview/company-loops/build.py           # write interview.app/company-loops/data/*.json
    python3 interview/company-loops/build.py --check   # fail if stale or if a rule is broken
    python3 interview/company-loops/build.py --draft   # while authoring: report problems, write anyway

Sources (edit these, never the JSON):
    companies.json                    the company registry (all companies, available or planned)
    config.json                       roles, seniority, difficulty, modes, languages, dialects, rubrics
    templates/<company>/loopN.md      candidate-facing templates (five per loop)
    templates/<company>/loopN.eval.md evaluator notes and reference solutions
    interview.app/company-loops/gen/<company>/<ID>.mjs   generators for executable templates

Outputs:
    interview.app/company-loops/data/index.json        registry + config + per-company counts
    interview.app/company-loops/data/<company>.json    candidate-facing templates
    interview.app/company-loops/data/<company>.eval.json   evaluator notes + references (lazy)

Format: docs/COMPANY-INTERVIEW-LOOPS.md. Generators and references are proven
against each other by validate.mjs (Node, PGlite) and pyrun.py.
"""
import importlib.util
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
OUT = ROOT / "interview.app" / "company-loops" / "data"
GEN = ROOT / "interview.app" / "company-loops" / "gen"

# One Markdown renderer for the Interview Studio's generated pages.
_spec = importlib.util.spec_from_file_location("loop_build", ROOT / "interview" / "loop" / "build.py")
_loop = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_loop)
md, _inline, split_outside_fences = _loop.md, _loop._inline, _loop.split_outside_fences

KINDS = {"sql", "python", "debug", "design", "leadership"}
EXECUTABLE = {"sql", "python", "debug"}
LEVELS = {"Medium": 1, "Hard": 2, "Very Hard": 3}
SECTIONS = {
    "business scenario": "scenario",
    "problem statement": "problem",
    "constraints": "constraints",
    "assumptions": "assumptions",
    "clarifications": "clarifications",
    "hints": "hints",
    "follow-ups": "followups",
    "follow-up rules": "rules",
    "production reality check": "incidents",
    "evaluation criteria": "criteria",
}
REQUIRED = {"scenario", "problem", "constraints", "assumptions", "clarifications", "hints", "followups", "rules", "criteria"}
STOP = set("""a an the and or of to in on at by for with from is are was were be been being do does did what which who whom
how when where why if then than that this these those it its as into out over under can could should would will may might
must not no yes any all each per vs versus about our your their there here does""".split())

# Claims this module must never make about a question (it is simulated practice).
BANNED = [
    (re.compile(r"\b(?:asked at|asked by|actual interview question|real interview question|leaked|verbatim from)\b", re.I),
     "never present a simulated question as one a company asked"),
    (re.compile(r"\b(?:confidential|internal (?:document|system|tool) of)\b", re.I),
     "never claim knowledge of a company's confidential or internal systems"),
]


def keywords(text):
    words = re.findall(r"[a-z][a-z0-9_]+", text.lower())
    return sorted({w for w in words if len(w) >= 4 and w not in STOP})


def parse_template(company, tid, title, body, loop_no):
    lines = body.splitlines()
    k = 0
    while k < len(lines) and not lines[k].strip():
        k += 1
    meta = {}
    while k < len(lines) and lines[k].startswith("|"):
        m = re.match(r"^\|\s*\*\*(.+?)\*\*\s*\|\s*(.*?)\s*\|\s*$", lines[k])
        if m:
            meta[m.group(1)] = m.group(2)
        k += 1
    params = None
    sections, current, buf, fence = {}, None, [], False

    def flush():
        if current:
            sections[current] = "\n".join(buf).strip()

    rest = lines[k:]
    i = 0
    while i < len(rest):
        ln = rest[i]
        if ln.startswith("```params"):
            j = i + 1
            while j < len(rest) and not rest[j].startswith("```"):
                j += 1
            params = json.loads("\n".join(rest[i + 1:j]))
            i = j + 1
            continue
        if ln.startswith("```"):
            fence = not fence
        m = None if fence else re.match(r"^\*\*([^*]+?)\.?\*\*\s*(.*)$", ln)
        key = SECTIONS.get(m.group(1).strip().rstrip(".").lower()) if m else None
        if key:
            flush()
            current, buf = key, []
            if m.group(2).strip():
                buf.append(m.group(2).strip())
        elif ln.strip() != "---":
            buf.append(ln)
        i += 1
    flush()

    where = f"{company}/{tid}"
    problems = []
    need = {"Template ID", "Loop", "Kind", "Topic", "Difficulty", "Minutes", "Roles"}
    if need - set(meta):
        problems.append(f"{where}: metadata lacks {sorted(need - set(meta))}")
        return None, problems
    if meta["Template ID"] != tid:
        problems.append(f"{where}: metadata says {meta['Template ID']}")
    kind = meta["Kind"]
    if kind not in KINDS:
        problems.append(f"{where}: unknown kind {kind!r}")
    if int(meta["Loop"]) != loop_no:
        problems.append(f"{where}: in loop{loop_no}.md but says loop {meta['Loop']}")
    missing = REQUIRED - set(sections)
    if loop_no in (3, 4):
        missing |= {"incidents"} - set(sections)
    if missing:
        problems.append(f"{where}: missing sections {sorted(missing)}")
    levels = sorted({LEVELS[x.strip()] for x in meta["Difficulty"].split(",") if x.strip() in LEVELS})
    if not levels:
        problems.append(f"{where}: difficulty must list Medium, Hard and/or Very Hard")
    gen = meta.get("Generator", "").strip()
    if kind in EXECUTABLE and not gen:
        problems.append(f"{where}: an executable template ({kind}) needs a Generator")
    if gen and not (GEN / company / gen).exists():
        problems.append(f"{where}: generator {gen} not found under interview.app/company-loops/gen/{company}/")

    def items(text, numbered):
        pat = r"^\d+\.\s+(.*)$" if numbered else r"^[-*]\s+(.*)$"
        out = []
        for ln in (text or "").splitlines():
            mm = re.match(pat, ln.strip())
            if mm:
                out.append(mm.group(1).strip())
            elif out and ln.strip():
                out[-1] += " " + ln.strip()
        return out

    clar = []
    for it in items(sections.get("clarifications"), False):
        mm = re.match(r"^Q:\s*(.+?)\s*\|\s*A:\s*(.+)$", it)
        if not mm:
            problems.append(f"{where}: clarification must be 'Q: … | A: …': {it[:60]}")
            continue
        clar.append({"q": _inline(mm.group(1)), "a": _inline(mm.group(2)), "keywords": keywords(mm.group(1))})
    rules = []
    for it in items(sections.get("rules"), False):
        mm = re.match(r"^when:\s*(.+?)\s*→\s*ask:\s*(.+)$", it)
        if not mm:
            problems.append(f"{where}: follow-up rule must be 'when: a, b → ask: …': {it[:60]}")
            continue
        rules.append({"when": [w.strip().lower() for w in mm.group(1).split(",") if w.strip()], "ask": _inline(mm.group(2))})
    followups = [_inline(x) for x in items(sections.get("followups"), True)]
    hints = [_inline(x) for x in items(sections.get("hints"), True)]
    incidents = [_inline(x) for x in items(sections.get("incidents"), False)]
    if not 2 <= len(followups) <= 5:
        problems.append(f"{where}: needs 2–5 numbered follow-ups (has {len(followups)})")
    if len(hints) < 2:
        problems.append(f"{where}: needs at least 2 numbered hints")
    if len(clar) < 3:
        problems.append(f"{where}: needs at least 3 clarifications")
    if len(rules) < 2:
        problems.append(f"{where}: needs at least 2 follow-up rules")
    if loop_no in (3, 4) and len(incidents) < 2:
        problems.append(f"{where}: loop {loop_no} needs at least 2 Production Reality Check incidents")

    # Every {{placeholder}} must be supplied, by params or by the generator.
    text = "\n".join(sections.values())
    names = set(re.findall(r"\{\{(\w+)\}\}", text))
    if params is not None:
        for name, vals in params.items():
            vs = vals.values() if isinstance(vals, dict) else [vals]
            if not all(isinstance(v, list) and v for v in vs):
                problems.append(f"{where}: params.{name} must be a non-empty list (or a per-level object of lists)")
        if names - set(params) and not gen:
            problems.append(f"{where}: placeholders without params: {sorted(names - set(params))}")
    elif names and not gen:
        problems.append(f"{where}: placeholders {sorted(names)} but no ```params block or generator")
    if kind in ("design", "leadership") and params is None:
        problems.append(f"{where}: a {kind} template needs a ```params block so instances vary")

    topic, _, sub = meta["Topic"].partition(" / ")
    tpl = {
        "id": tid,
        "company": company,
        "loop": loop_no,
        "kind": kind,
        "title": title,
        "topic": topic.strip(),
        "subtopic": sub.strip(),
        "levels": levels,
        "minutes": int(re.match(r"(\d+)", meta["Minutes"]).group(1)),
        "roles": [x.strip() for x in meta["Roles"].split(",") if x.strip()],
        "generator": f"gen/{company}/{gen}" if gen else None,
        "params": params,
        "placeholders": sorted(names),
        "sections": {k2: md(sections[k2]) for k2 in ("scenario", "problem", "constraints", "assumptions", "criteria") if sections.get(k2)},
        "clarifications": clar,
        "hints": hints,
        "followups": followups,
        "rules": rules,
        "incidents": incidents,
        "source_type": "simulated",
    }
    return tpl, problems


def parse_eval(company, text):
    out, problems = {}, []
    for m, body in split_outside_fences(text, r"^## ([A-Z]+-L\d-\d\d)\s*$"):
        tid = m.group(1)
        ref_sql = re.search(r"```sql reference\n(.*?)```", body, re.S)
        ref_py = re.search(r"```python reference\n(.*?)```", body, re.S)
        clean = body.replace("```sql reference", "```sql").replace("```python reference", "```python")
        out[tid] = {"html": md(clean), "reference_sql": ref_sql.group(1).strip() if ref_sql else None,
                    "reference_python": ref_py.group(1).strip() + "\n" if ref_py else None}
    return out, problems


def build():
    reg = json.loads((HERE / "companies.json").read_text(encoding="utf-8"))
    cfg = json.loads((HERE / "config.json").read_text(encoding="utf-8"))
    role_ids = {r["id"] for r in cfg["roles"]}
    problems, outputs, counts = [], {}, {}
    seen_ids = set()
    for c in reg["companies"]:
        cdir = HERE / "templates" / c["id"]
        if c["status"] != "available":
            if cdir.exists() and any(cdir.iterdir()):
                problems.append(f"{c['id']}: has templates but is not marked available")
            continue
        templates, evals = [], {}
        for n in range(1, 6):
            src = cdir / f"loop{n}.md"
            ev = cdir / f"loop{n}.eval.md"
            if not src.exists() or not ev.exists():
                problems.append(f"{c['id']}: missing loop{n}.md or loop{n}.eval.md")
                continue
            got = []
            for m, body in split_outside_fences(src.read_text(encoding="utf-8"), r"^## ([A-Z]+-L\d-\d\d): (.+)$"):
                tpl, p = parse_template(c["id"], m.group(1), m.group(2).strip(), body, n)
                problems += p
                if tpl:
                    got.append(tpl)
            if len(got) < 5:
                problems.append(f"{c['id']}: loop {n} has {len(got)} templates; at least 5 are required")
            e, p = parse_eval(c["id"], ev.read_text(encoding="utf-8"))
            problems += p
            evals.update(e)
            templates += got
        for t in templates:
            if t["id"] in seen_ids:
                problems.append(f"duplicate template id {t['id']}")
            seen_ids.add(t["id"])
            if t["id"] not in evals:
                problems.append(f"{c['id']}/{t['id']}: no evaluator notes")
            elif t["kind"] == "sql" and not evals[t["id"]]["reference_sql"]:
                problems.append(f"{c['id']}/{t['id']}: an sql template needs a ```sql reference block")
            elif t["kind"] in ("python", "debug") and not evals[t["id"]]["reference_python"]:
                problems.append(f"{c['id']}/{t['id']}: a {t['kind']} template needs a ```python reference block")
            for r in t["roles"]:
                if r not in role_ids:
                    problems.append(f"{c['id']}/{t['id']}: unknown role {r!r}")
        counts[c["id"]] = {str(n): sum(1 for t in templates if t["loop"] == n) for n in range(1, 6)}
        cand = {"$comment": "GENERATED by interview/company-loops/build.py — do not edit. Simulated practice scenarios.",
                "company": c["id"], "templates": templates}
        evaluator = {"$comment": "GENERATED by interview/company-loops/build.py — do not edit. Loaded only on reveal or after a mock or assessment.",
                     "company": c["id"], "templates": {k: v for k, v in evals.items() if k in {t["id"] for t in templates}}}
        outputs[OUT / f"{c['id']}.json"] = json.dumps(cand, ensure_ascii=False, indent=1) + "\n"
        outputs[OUT / f"{c['id']}.eval.json"] = json.dumps(evaluator, ensure_ascii=False, indent=1) + "\n"
        blob = outputs[OUT / f"{c['id']}.json"]
        for rx, why in BANNED:
            for mm in rx.finditer(blob):
                problems.append(f"{c['id']}.json: '{mm.group(0)}' — {why}")
        for marker in ("Rubric anchors", "Reference solution", "Red flags", "reference_sql"):
            if marker in blob:
                problems.append(f"{c['id']}.json contains evaluator text ('{marker}')")
    companies = []
    for c in reg["companies"]:
        cc = dict(c)
        cc["loop_counts"] = counts.get(c["id"])
        companies.append(cc)
    index = {"$comment": "GENERATED by interview/company-loops/build.py — do not edit.",
             "companies": companies, "config": cfg}
    outputs[OUT / "index.json"] = json.dumps(index, ensure_ascii=False, indent=1) + "\n"
    return outputs, problems


def main(argv):
    outputs, problems = build()
    if problems:
        print("\n".join(problems))
        if "--draft" not in argv:      # --draft: report problems but still write, while authoring
            return 1
    if "--check" in argv:
        stale = [p for p, t in outputs.items() if not p.exists() or p.read_text(encoding="utf-8") != t]
        extra = [p for p in OUT.glob("*.json") if p not in outputs]
        if stale or extra:
            print("stale: " + ", ".join(str(p.relative_to(ROOT)) for p in stale + extra) + " — run python3 interview/company-loops/build.py")
            return 1
        print(f"company-loops: data is current; rules hold ({len(outputs) - 1} company files)")
        return 0
    OUT.mkdir(parents=True, exist_ok=True)
    for p, t in outputs.items():
        p.write_text(t, encoding="utf-8")
        print(f"wrote {p.relative_to(ROOT)} ({len(t) // 1024} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

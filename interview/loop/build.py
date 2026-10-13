#!/usr/bin/env python3
"""Build the Five-Round Loop's data from its sources.

    python3 interview/loop/build.py           # write interview.app/loop/data/*.json
    python3 interview/loop/build.py --check   # fail if the data is stale or a rule is broken

Sources (edit these, never the JSON):
    interview/loop/questions.md   candidate-facing questions
    interview/loop/evaluator.md   reference solutions and evaluator notes
    interview/loop/runners.py     what the page runs for the executable questions
    interview/loop/expected.json  the reference solutions' results (verify/compute_expected.py)

Outputs:
    interview.app/loop/data/questions.json   everything a candidate may see
    interview.app/loop/data/solutions.json   loaded only on reveal or after an assessment

The Markdown subset (headings, paragraphs, lists, tables, code fences, bold,
italic, inline code, links, rules, block quotes) is rendered to HTML here, once.
"""
import html
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
OUT = ROOT / "interview.app" / "loop" / "data"
sys.path.insert(0, str(HERE))
import runners  # noqa: E402

# ---------------------------------------------------------------- markdown

def _inline(text: str) -> str:
    """Escape, then apply inline code, bold, italic and links (code spans are protected)."""
    codes = []

    def stash(m):
        codes.append("<code>" + html.escape(m.group(1), quote=False) + "</code>")
        return f"\x00{len(codes) - 1}\x00"

    s = re.sub(r"`([^`]+)`", stash, text)          # protect code spans; bold may wrap them
    s = html.escape(s, quote=False)
    s = re.sub(r"\[([^\]]+)\]\(([^)\s]+)\)", lambda m: f'<a href="{html.escape(m.group(2))}">{m.group(1)}</a>', s)
    s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])", r"<em>\1</em>", s)
    return re.sub(r"\x00(\d+)\x00", lambda m: codes[int(m.group(1))], s)


def _table(lines):
    rows = [[c.strip() for c in ln.strip().strip("|").split("|")] for ln in lines]
    head, body = rows[0], [r for r in rows[2:]]
    h = "".join(f"<th>{_inline(c)}</th>" for c in head)
    b = "".join("<tr>" + "".join(f"<td>{_inline(c)}</td>" for c in r) + "</tr>" for r in body)
    return f'<div class="lp-table"><table><thead><tr>{h}</tr></thead><tbody>{b}</tbody></table></div>'


LIST_RE = re.compile(r"^(\s*)([-*]|\d+\.)\s+(.*)$")


def _list(lines):
    """Nested lists by indentation. Continuation lines join the previous item."""
    items = []  # (indent, ordered, text)
    for ln in lines:
        m = LIST_RE.match(ln)
        if m:
            items.append([len(m.group(1)), m.group(2)[0].isdigit(), m.group(3)])
        elif items:
            items[-1][2] += " " + ln.strip()
    out, stack = [], []  # stack of (indent, tag)
    for indent, ordered, text in items:
        tag = "ol" if ordered else "ul"
        while stack and indent < stack[-1][0]:
            out.append(f"</li></{stack.pop()[1]}>")
        if not stack or indent > stack[-1][0]:
            out.append(f"<{tag}><li>")
            stack.append((indent, tag))
        else:
            out.append("</li><li>")
        out.append(_inline(text))
    while stack:
        out.append(f"</li></{stack.pop()[1]}>")
    return "".join(out)


def md(text: str) -> str:
    lines = text.strip("\n").splitlines()
    out, i = [], 0
    while i < len(lines):
        ln = lines[i]
        if not ln.strip() or ln.strip() == "---":
            if ln.strip() == "---":
                out.append("<hr>")
            i += 1
            continue
        if ln.startswith("```"):
            lang = ln[3:].strip()
            j = i + 1
            while j < len(lines) and not lines[j].startswith("```"):
                j += 1
            code = html.escape("\n".join(lines[i + 1:j]), quote=False)
            cls = f' class="lang-{lang}"' if lang else ""
            out.append(f"<pre><code{cls}>{code}</code></pre>")
            i = j + 1
            continue
        m = re.match(r"^(#{1,6})\s+(.*)$", ln)
        if m:
            lvl = min(len(m.group(1)) + 1, 6)
            out.append(f"<h{lvl}>{_inline(m.group(2))}</h{lvl}>")
            i += 1
            continue
        if ln.lstrip().startswith("|"):
            j = i
            while j < len(lines) and lines[j].lstrip().startswith("|"):
                j += 1
            out.append(_table(lines[i:j]))
            i = j
            continue
        if ln.startswith(">"):
            j = i
            while j < len(lines) and lines[j].startswith(">"):
                j += 1
            out.append("<blockquote>" + md("\n".join(l[1:].lstrip() for l in lines[i:j])) + "</blockquote>")
            i = j
            continue
        if LIST_RE.match(ln):
            j = i
            while j < len(lines) and lines[j].strip() and (LIST_RE.match(lines[j]) or lines[j].startswith((" ", "\t"))):
                j += 1
            out.append(_list(lines[i:j]))
            i = j
            continue
        j = i
        para = []
        while j < len(lines) and lines[j].strip() and not lines[j].startswith(("```", "#", "|", ">")) \
                and not LIST_RE.match(lines[j]) and lines[j].strip() != "---":
            para.append(lines[j].strip())
            j += 1
        out.append("<p>" + _inline(" ".join(para)) + "</p>")
        i = j
    return "".join(out)


# ---------------------------------------------------------------- parsing

def split_outside_fences(text: str, pattern: str):
    """Yield (heading_match, body) for headings matching `pattern`, ignoring fenced code."""
    lines = text.splitlines()
    in_fence = False
    marks = []
    for n, ln in enumerate(lines):
        if ln.startswith("```"):
            in_fence = not in_fence
            continue
        if not in_fence:
            m = re.match(pattern, ln)
            if m:
                marks.append((n, m))
    for k, (n, m) in enumerate(marks):
        end = marks[k + 1][0] if k + 1 < len(marks) else len(lines)
        yield m, "\n".join(lines[n + 1:end])


SECTION_KEYS = [
    ("business scenario", "scenario"),
    ("problem statement", "problem"),
    ("sample input / schema and expected output", "sample_and_expected"),
    ("sample input / schema", "sample"),
    ("expected output", "expected"),
    ("constraints", "constraints"),
    ("clarification questions to consider", "clarifications"),
    ("live challenges", "challenges"),
    ("interviewer follow-up questions", "followups"),
    ("evaluation criteria", "criteria"),
]
LABEL_RE = re.compile(r"^\*\*([^*]+?)\*\*(.*)$")

# The rubric's competencies, in report order. A question names the ones it tests;
# every other competency is N/A for it, never 0.
COMPETENCIES = {
    "correctness": "Correctness",
    "code_quality": "Code quality",
    "efficiency": "Algorithmic efficiency",
    "sql": "SQL proficiency",
    "modeling": "Data modeling quality",
    "distributed": "Distributed-system reasoning",
    "reliability": "Reliability and scalability",
    "tradeoffs": "Trade-off analysis",
    "communication": "Communication",
    "leadership": "Technical leadership",
}
COMPETENCY_BY_LABEL = {v: k for k, v in COMPETENCIES.items()}


def section_key(label: str):
    norm = re.sub(r"\(.*?\)", "", label).strip().rstrip(".").strip().lower()
    for name, key in SECTION_KEYS:
        if norm == name:
            return key
    return None


def parse_question(qid: str, title: str, body: str, round_no: int):
    # The metadata table is the first contiguous block of table lines.
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
    rest = lines[k:]
    sections, order, current = {}, [], None
    buf: list[str] = []
    in_fence = False

    def flush():
        if current:
            sections[current] = "\n".join(buf).strip()

    for ln in rest:
        if ln.startswith("```"):
            in_fence = not in_fence
        m = LABEL_RE.match(ln) if not in_fence else None
        key = section_key(m.group(1)) if m else None
        if key:
            flush()
            current, buf = key, []
            order.append(key)
            tail = m.group(2).strip()   # e.g. "*(scenario assumptions)*. Trending ≤ 30 s …"
            if tail:
                buf.append(tail)
            continue
        if ln.strip() == "---":
            continue
        buf.append(ln)
    flush()
    required = {"problem", "followups", "criteria"}
    missing = required - set(sections)
    if missing:
        raise SystemExit(f"{qid}: missing sections {sorted(missing)}")
    need_meta = {"Question ID", "Difficulty", "Estimated Time", "Topic / Subtopic", "Skills evaluated", "Technologies",
                 "Competencies"}
    if need_meta - set(meta):
        raise SystemExit(f"{qid}: metadata table lacks {sorted(need_meta - set(meta))}")
    if meta["Question ID"] != qid:
        raise SystemExit(f"{qid}: metadata says {meta['Question ID']}")
    minutes = int(re.match(r"(\d+)", meta["Estimated Time"]).group(1))
    comps = []
    for label in (c.strip() for c in meta["Competencies"].split(",")):
        if label not in COMPETENCY_BY_LABEL:
            raise SystemExit(f"{qid}: unknown competency {label!r}")
        comps.append(COMPETENCY_BY_LABEL[label])
    topic, _, subtopic = meta["Topic / Subtopic"].partition(" / ")
    return {
        "id": qid,
        "round": round_no,
        "title": title,
        "difficulty": meta["Difficulty"],
        "level": re.match(r"(Medium|Hard|Very Hard)", meta["Difficulty"]).group(1),
        "minutes": minutes,
        "topic": topic.strip(),
        "subtopic": subtopic.strip(),
        "skills": meta["Skills evaluated"],
        "technologies": meta["Technologies"],
        "competencies": comps,
        "order": order,
        "sections": {k: md(v) for k, v in sections.items() if v},
        "_text": {k: v for k, v in sections.items() if v},   # for the rule checks; not shipped
    }


def parse_questions(text: str):
    rounds, questions, scoring = [], [], ""
    for m, body in split_outside_fences(text, r"^# (ROUND (\d): (.+)|SCORING)$"):
        if m.group(1) == "SCORING":
            scoring = md(body)
            continue
        rno, rtitle = int(m.group(2)), m.group(3).strip()
        first_q = re.search(r"^## R\d-\d\d:", body, re.M)
        note = body[: first_q.start()] if first_q else body
        note = "\n".join(l for l in note.splitlines() if l.strip() != "---")
        rounds.append({"round": rno, "title": rtitle, "note": md(note) if note.strip() else ""})
        for qm, qbody in split_outside_fences(body, r"^## (R\d-\d\d): (.+)$"):
            questions.append(parse_question(qm.group(1), qm.group(2).strip(), qbody, rno))
    return rounds, questions, scoring


def parse_evaluator(text: str, ids):
    sols, general = {}, []
    head, _, _ = text.partition("\n## ")
    intro = head.split("\n", 1)[1] if "\n" in head else ""
    intro = "\n".join(l for l in intro.splitlines() if not l.startswith("The reference solutions and evaluator") and
                      not l.startswith("only when a candidate") and not l.startswith("`interview/loop/build.py`"))
    general.append(md(intro))
    round_notes = {}
    for m, body in split_outside_fences(text, r"^## (.+)$"):
        title = m.group(1)
        qm = re.match(r"^(R\d-\d\d): (.+)$", title)
        if qm:
            sols[qm.group(1)] = md(body)
            continue
        rm = re.match(r"^Round (\d): (.+)$", title)
        if rm:
            rno = int(rm.group(1))
            first = re.search(r"^### R\d-\d\d", body, re.M)
            pre = body[: first.start()] if first else body
            subs = list(split_outside_fences(body, r"^### (R\d-\d\d): (.+)$"))
            if rno == 5:
                rows = [ln for ln in body.splitlines() if ln.startswith("| **R5-")]
                pre_lines = [ln for ln in body.splitlines() if not ln.startswith("|")]
                round_notes[rno] = md("\n".join(pre_lines))
                for ln in rows:
                    cells = [c.strip() for c in ln.strip().strip("|").split("|")]
                    qid = re.match(r"\*\*(R5-\d\d)\*\*", cells[0]).group(1)
                    sols[qid] = md(f"**Strong-hire signals.** {cells[1]}\n\n**Red flags.** {cells[2]}")
            else:
                round_notes[rno] = md(pre)
                for sm, sbody in subs:
                    sols[sm.group(1)] = md(sbody)
            continue
        if title.startswith("End-of-session report"):
            general.append(md("### " + title + "\n" + body))
    missing = set(ids) - set(sols)
    if missing:
        raise SystemExit(f"evaluator.md lacks {sorted(missing)}")
    return {"general": "".join(general), "round_notes": round_notes, "solutions": sols}


def runner_payload(expected):
    out = {}
    for qid, spec in runners.RUNNERS.items():
        exp = expected.get(qid)
        if exp is None:
            raise SystemExit(f"{qid}: no recorded results; run interview/loop/verify/compute_expected.py")
        if spec["lang"] == "python":
            if len(exp["tests"]) != len(spec["tests"]):
                raise SystemExit(f"{qid}: expected.json is stale (test count); re-run compute_expected.py")
            out[qid] = {
                "lang": "python",
                "starter": spec["starter"],
                "prelude": runners.PY_PRELUDE + spec.get("prelude_extra", ""),
                "tests": [dict(name=t["name"], expr=t["expr"], limit_s=t.get("limit_s"), **e)
                          for t, e in zip(spec["tests"], exp["tests"])],
            }
        else:
            if len(exp["expect"]) != len(spec["expect"]) or len(exp["diagnostics"]) != len(spec.get("diagnostics", [])):
                raise SystemExit(f"{qid}: expected.json is stale; re-run compute_expected.py")
            out[qid] = {
                "lang": "sql",
                "starter": spec["starter"],
                "setup": spec["setup"],
                "expect": [dict(label=e["label"], **r) for e, r in zip(spec["expect"], exp["expect"])],
                "diagnostics": [dict(message=d["message"], rows=r["rows"])
                                for d, r in zip(spec.get("diagnostics", []), exp["diagnostics"])],
            }
    return out


# ------------------------------------------------------------------ rules

BANNED = [
    (re.compile(r"\b(?:Uber|Netflix|Airbnb|Meta|Amazon|Google|LinkedIn)[- ]style\b", re.I),
     "never name a company as a question's style"),
    (re.compile(r"\b(?:asked at|asked by|real interview question|verbatim)\b", re.I),
     "never present a question as real or attributed"),
]


def check_rules(questions, payload_text):
    problems = []
    for rx, why in BANNED:
        for m in rx.finditer(payload_text):
            problems.append(f"questions.json: '{m.group(0)}' — {why}")
    per_round = {}
    for q in questions:
        per_round.setdefault(q["round"], []).append(q["id"])
    for r in range(1, 6):
        if len(per_round.get(r, [])) != 5:
            problems.append(f"round {r} has {len(per_round.get(r, []))} questions, not 5")
    ids = [q["id"] for q in questions]
    if len(set(ids)) != len(ids):
        problems.append("duplicate question ids")
    for q in questions:
        if q["level"] not in ("Medium", "Hard", "Very Hard"):
            problems.append(f"{q['id']}: difficulty {q['difficulty']!r}")
        fu = q["_text"].get("followups", "")
        if len(re.findall(r"^\d+\.", fu, re.M)) < 2:
            problems.append(f"{q['id']}: needs at least two numbered follow-ups")
    return problems


def build():
    rounds, questions, scoring = parse_questions((HERE / "questions.md").read_text(encoding="utf-8"))
    ev = parse_evaluator((HERE / "evaluator.md").read_text(encoding="utf-8"), [q["id"] for q in questions])
    expected = json.loads((HERE / "expected.json").read_text(encoding="utf-8"))
    runs = runner_payload(expected)
    for q in questions:
        if q["id"] in runs:
            q["runner"] = runs[q["id"]]
    unknown = set(runs) - {q["id"] for q in questions}
    if unknown:
        raise SystemExit(f"runners.py names unknown questions {sorted(unknown)}")
    questions_doc = {
        "$comment": "GENERATED by interview/loop/build.py from interview/loop/*.md — do not edit.",
        "rounds": rounds,
        "competencies": COMPETENCIES,
        "scoring": scoring,
        "questions": questions,
    }
    solutions_doc = {
        "$comment": "GENERATED by interview/loop/build.py from interview/loop/evaluator.md — do not edit. "
                    "The page loads this file only when a solution is revealed or an assessment is submitted.",
        **ev,
    }
    texts = {q["id"]: q.pop("_text") for q in questions}
    q_text = json.dumps(questions_doc, ensure_ascii=False, indent=1) + "\n"
    s_text = json.dumps(solutions_doc, ensure_ascii=False, indent=1) + "\n"
    for q in questions:
        q["_text"] = texts[q["id"]]
    problems = check_rules(questions, q_text)
    # The candidate file must never carry evaluator material.
    for marker in ("Rubric anchors", "Strong-hire signals", "Reference solution", "Red flags."):
        if marker in q_text:
            problems.append(f"questions.json contains evaluator text ('{marker}')")
    return q_text, s_text, problems


def main(argv):
    q_text, s_text, problems = build()
    if problems:
        print("\n".join(problems))
        return 1
    targets = {OUT / "questions.json": q_text, OUT / "solutions.json": s_text}
    if "--check" in argv:
        stale = [p for p, t in targets.items() if not p.exists() or p.read_text(encoding="utf-8") != t]
        if stale:
            print("stale: " + ", ".join(str(p.relative_to(ROOT)) for p in stale) + " — run python3 interview/loop/build.py")
            return 1
        print("loop: data is current; rules hold")
        return 0
    OUT.mkdir(parents=True, exist_ok=True)
    for p, t in targets.items():
        p.write_text(t, encoding="utf-8")
        print(f"wrote {p.relative_to(ROOT)} ({len(t) // 1024} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

#!/usr/bin/env python3
"""Build the company-tagged question pools for the Skill Check 'company mode'.

Source: interview/data/questions.json (the Practice Q&A bank) — only the
batches that carry verified company tags. Output: two pool files the Skill
Check quiz engine loads when the user picks one or more companies. Re-run
this whenever the Practice Q&A bank changes.

    python3 interview.app/evaluate/build_company_pools.py
"""
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
SRC = os.path.join(ROOT, "interview", "data", "questions.json")
OUT_DIR = os.path.join(HERE, "data")

# Only these batches carry real, verified company tags. The other batches are
# either Community-tagged or untagged (e.g. the skillcheck_* ports). Verified
# by auditing per-batch company coverage against interview/data/questions.json.
TAGGED_BATCHES = {"co_sql_305", "python_175", "snowflake_51", "customer_growth"}

META = {
    "sql": {
        "section": "sql",
        "mode": "company",
        "title": "SQL Skill Check",
        "tagline": "Real company-tagged SQL questions — self-rated against the model answer",
        "duration_minutes": 35,
        "passing_score": 70,
        "quiz_length": 20,
    },
    "python": {
        "section": "python",
        "mode": "company",
        "title": "Python Skill Check",
        "tagline": "Real company-tagged Python questions — self-rated against the model answer",
        "duration_minutes": 35,
        "passing_score": 70,
        "quiz_length": 20,
    },
}


def norm_topic(t):
    t = (t or "").strip()
    if not t:
        return "General"
    if t.lower().startswith("snowflake"):
        return "Snowflake"
    if "/" in t:
        t = t.split("/")[-1].strip()
    t = re.sub(r"Python\s*\+\s*\d+", "Python", t).strip()
    return t or "General"


def norm_difficulty(d):
    d = (d or "").strip().lower()
    return d if d in ("easy", "medium", "hard") else "medium"


def build_prompt(q):
    """Company-tagged source rows are terse — title + schema signature +
    solution. Compose the most informative prompt the data allows."""
    parts = []
    title = (q.get("title") or "").strip()
    question = (q.get("question") or "").strip()
    schema = (q.get("schema") or "").strip()
    if title:
        parts.append(title)
    if question and question.lower() != title.lower():
        parts.append(question)
    if schema:
        label = "Schema" if q.get("language") == "sql" else "Setup"
        parts.append(f"{label}:\n```\n{schema}\n```")
    if not question:
        verb = "SQL query" if q.get("language") == "sql" else "Python solution"
        parts.append(f"Write the {verb} for the task above, then self-rate against the model answer.")
    return "\n\n".join(parts) if parts else "(no prompt)"


def adapt(q):
    """Map a Practice Q&A row onto the quiz engine's code-question schema.
    runnable=False: these rows have no test harness / expected output and
    some are non-Postgres dialects, so they are self-rated, not executed."""
    return {
        "id": q["id"],
        "type": "code",
        "topic": norm_topic(q.get("type")),
        "difficulty": norm_difficulty(q.get("difficulty")),
        "company": q["company"].strip(),
        "language": q.get("language"),
        "runnable": False,
        "prompt": build_prompt(q),
        "model_answer": (q.get("solution") or "").strip(),
    }


def main():
    with open(SRC, encoding="utf-8") as f:
        pq = json.load(f)

    pools = {"sql": [], "python": []}
    for q in pq:
        if q.get("batch") not in TAGGED_BATCHES:
            continue
        company = (q.get("company") or "").strip()
        if not company or company == "Community":
            continue
        lang = q.get("language")
        if lang not in pools:
            continue
        if not (q.get("solution") or "").strip():
            continue
        pools[lang].append(adapt(q))

    for lang, items in pools.items():
        items.sort(key=lambda x: x["id"])
        out = dict(META[lang])
        out["questions"] = items
        path = os.path.join(OUT_DIR, f"{lang}-companies.json")
        with open(path, "w", encoding="utf-8") as f:
            f.write(json.dumps(out, indent=2, ensure_ascii=True))
        companies = sorted(set(x["company"] for x in items))
        print(f"{lang}-companies.json: {len(items)} questions, {len(companies)} companies")
    print("done")


if __name__ == "__main__":
    main()

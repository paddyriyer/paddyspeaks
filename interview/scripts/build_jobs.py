#!/usr/bin/env python3
"""
build_jobs.py — generate the Jobs board data for interview.app/jobs/.

Idempotent, mirrors interview/scripts/xlsx_to_json.py: reads the existing
question data, computes a real per-company question breakdown, and writes a
single static file the page renders client-side:

    interview.app/jobs/data/jobs.json

Two modes:

  --source FILE   "live" mode. FILE is a JSON array of role records pulled from
                  a jobs feed (e.g. the Indeed connector export). Each record:
                      {"company": "...", "role": "...", "location": "...",
                       "apply_url": "https://...", "posted": "2026-07-20"}
                  Companies are normalised to the slug/name already used in
                  interview/data/companies.json; roles for companies that have
                  no tagged questions are dropped (nothing to practise → no
                  value). Each surviving role is enriched with its company's
                  live question counts + a deep link into the bank.

  (no --source)   "sample" mode. Emits a clearly-labelled illustrative board so
                  the page has something to render before the feed is wired,
                  exactly like the leaderboard's sample preview. Question counts
                  and practice links are REAL; the openings are illustrative and
                  the page labels them as such.

Run from the repo root:
    python3 interview/scripts/build_jobs.py                # sample board
    python3 interview/scripts/build_jobs.py --source feed.json   # live board
"""
from __future__ import annotations

import argparse
import datetime as _dt
import json
import sys
from collections import defaultdict
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "interview" / "data"
OUT = ROOT / "interview.app" / "jobs" / "data" / "jobs.json"

# Illustrative role titles + locations for the sample board. Generic titles
# only — never a fabricated specific posting. Assigned deterministically by
# company rank so re-runs are byte-stable.
SAMPLE_ROLES = [
    "Senior Data Engineer",
    "Analytics Engineer",
    "Data Platform Engineer",
    "ML Platform Engineer",
    "Staff Data Engineer",
    "Data Engineer, Growth",
    "Senior Analytics Engineer",
    "Data Infrastructure Engineer",
]
SAMPLE_LOCATIONS = [
    "Remote · US",
    "San Francisco, CA",
    "Seattle, WA",
    "New York, NY",
    "Remote",
    "Austin, TX",
]
# How many top companies to feature on the sample board.
SAMPLE_COMPANY_LIMIT = 18


def load_json(path: Path):
    with path.open(encoding="utf-8") as fh:
        return json.load(fh)


def company_counts(questions: list[dict]) -> dict[str, dict]:
    """Per-company {total, sql, python} from the live question set."""
    counts: dict[str, dict] = defaultdict(lambda: {"total": 0, "sql": 0, "python": 0})
    for q in questions:
        co = q.get("company")
        if not co:
            continue
        rec = counts[co]
        rec["total"] += 1
        lang = (q.get("language") or "").lower()
        if lang == "sql":
            rec["sql"] += 1
        elif lang in ("python", "py"):
            rec["python"] += 1
    return counts


def practice_url(company: str) -> str:
    # The bank reads ?company=<Name> on load and applies the facet (app.js).
    return "../?company=" + quote(company)


def careers_search(company: str) -> str:
    # Honest, non-fabricated "apply" target for the sample board: a real search
    # for that company's data-engineering roles. Live mode uses the feed's URL.
    return "https://www.google.com/search?q=" + quote(f"{company} data engineer jobs")


def build_sample(counts: dict[str, dict], companies: list[dict]) -> list[dict]:
    ranked = [c["name"] for c in companies if counts.get(c["name"], {}).get("total")]
    jobs = []
    for i, name in enumerate(ranked[:SAMPLE_COMPANY_LIMIT]):
        jobs.append(
            {
                "company": name,
                "role": SAMPLE_ROLES[i % len(SAMPLE_ROLES)],
                "location": SAMPLE_LOCATIONS[i % len(SAMPLE_LOCATIONS)],
                "apply_url": careers_search(name),
                "practice_url": practice_url(name),
                "counts": counts[name],
                "sample": True,
            }
        )
    return jobs


def build_live(source: Path, counts: dict[str, dict], names: set[str]) -> list[dict]:
    feed = load_json(source)
    jobs = []
    dropped = 0
    for rec in feed:
        co = (rec.get("company") or "").strip()
        if co not in names or not counts.get(co, {}).get("total"):
            dropped += 1
            continue
        jobs.append(
            {
                "company": co,
                "role": (rec.get("role") or "Data Engineer").strip(),
                "location": (rec.get("location") or "").strip(),
                "apply_url": rec.get("apply_url") or careers_search(co),
                "practice_url": practice_url(co),
                "counts": counts[co],
                "posted": rec.get("posted"),
                "sample": False,
            }
        )
    if dropped:
        print(f"  dropped {dropped} role(s) with no tagged questions / unknown company")
    # Newest first when a posted date is present.
    jobs.sort(key=lambda j: j.get("posted") or "", reverse=True)
    return jobs


def main() -> None:
    ap = argparse.ArgumentParser(description="Generate interview.app/jobs data.")
    ap.add_argument("--source", type=Path, help="JSON feed of live roles (Indeed export).")
    args = ap.parse_args()

    companies = load_json(DATA / "companies.json")
    questions = load_json(DATA / "questions.json")
    counts = company_counts(questions)
    names = {c["name"] for c in companies}

    if args.source:
        if not args.source.exists():
            sys.exit(f"source feed not found: {args.source}")
        jobs = build_live(args.source, counts, names)
        mode = "live"
    else:
        jobs = build_sample(counts, companies)
        mode = "sample"

    payload = {
        "generated_at": _dt.datetime.now(_dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "mode": mode,
        "job_count": len(jobs),
        "company_count": len({j["company"] for j in jobs}),
        "jobs": jobs,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"  wrote {OUT.relative_to(ROOT)} — {mode} mode, {len(jobs)} role(s)")


if __name__ == "__main__":
    main()

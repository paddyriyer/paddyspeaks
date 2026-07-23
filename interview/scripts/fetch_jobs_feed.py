#!/usr/bin/env python3
"""
fetch_jobs_feed.py — pull real Data/AI-Engineer roles from companies' public ATS
job boards (Greenhouse / Lever / Ashby) and write a feed.json that
build_jobs.py consumes via --source.

Keyless and free: each provider exposes a public JSON board endpoint. Driven by
interview/scripts/ats_boards.json (company -> provider + slug). Fails gracefully
per company and prints a coverage report, so a wrong/dead slug just drops that
company instead of breaking the run.

Usage (from repo root):
    python3 interview/scripts/fetch_jobs_feed.py            # -> feed.json
    python3 interview/scripts/fetch_jobs_feed.py --out feed.json --per-company 4

Then:
    python3 interview/scripts/build_jobs.py --source feed.json
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MAP = Path(__file__).resolve().parent / "ats_boards.json"

# A role counts as data/AI engineering if its title contains one of these.
TITLE_INCLUDE = [
    "data engineer", "analytics engineer", "data platform", "data infrastructure",
    "machine learning engineer", "ml engineer", "ai engineer", "mlops",
    "data warehouse", "analytics platform", "data reliability",
]
# ...but never these (avoid recruiters/managers/sales dressed up with keywords).
TITLE_EXCLUDE = ["recruiter", "sourcer", "sales", "account executive", "intern"]

UA = "PaddySpeaks-JobsBot/1.0 (+https://paddyspeaks.com/interview.app/jobs/)"
TIMEOUT = 20


def title_ok(title: str) -> bool:
    t = (title or "").lower()
    if any(x in t for x in TITLE_EXCLUDE):
        return False
    return any(x in t for x in TITLE_INCLUDE)


def get_json(url: str):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        return json.loads(r.read().decode("utf-8"))


# ── per-provider parsers → list[{role, location, apply_url, posted}] ──
def from_greenhouse(slug: str):
    data = get_json(f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs")
    out = []
    for j in data.get("jobs", []):
        out.append({
            "role": j.get("title", ""),
            "location": (j.get("location") or {}).get("name", ""),
            "apply_url": j.get("absolute_url", ""),
            "posted": (j.get("updated_at") or "")[:10],
        })
    return out


def from_lever(slug: str):
    data = get_json(f"https://api.lever.co/v0/postings/{slug}?mode=json")
    out = []
    for j in data if isinstance(data, list) else []:
        cats = j.get("categories") or {}
        out.append({
            "role": j.get("text", ""),
            "location": cats.get("location", ""),
            "apply_url": j.get("hostedUrl", ""),
            "posted": "",  # createdAt is epoch ms; leave blank rather than mislabel
        })
    return out


def from_ashby(slug: str):
    data = get_json(f"https://api.ashbyhq.com/posting-api/job-board/{slug}")
    out = []
    for j in data.get("jobs", []):
        out.append({
            "role": j.get("title", ""),
            "location": j.get("location", ""),
            "apply_url": j.get("jobUrl") or j.get("applyUrl", ""),
            "posted": (j.get("publishedAt") or "")[:10],
        })
    return out


PARSERS = {"greenhouse": from_greenhouse, "lever": from_lever, "ashby": from_ashby}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, default=ROOT / "feed.json")
    ap.add_argument("--per-company", type=int, default=4, help="cap roles kept per company")
    args = ap.parse_args()

    cfg = json.loads(MAP.read_text(encoding="utf-8"))
    boards = cfg.get("boards", [])

    feed = []
    ok = 0
    report = []
    for b in boards:
        company, provider, slug = b.get("company"), b.get("provider"), b.get("slug")
        parser = PARSERS.get(provider)
        if not parser:
            report.append(f"  ?  {company}: unknown provider '{provider}'")
            continue
        try:
            roles = parser(slug)
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, ValueError) as e:
            report.append(f"  ✗  {company} ({provider}/{slug}): {type(e).__name__}")
            continue
        matched = [r for r in roles if title_ok(r["role"]) and r["apply_url"]]
        matched = matched[: args.per_company]
        for r in matched:
            r["company"] = company
            feed.append(r)
        ok += 1 if matched else 0
        report.append(f"  {'✓' if matched else '·'}  {company}: {len(matched)} role(s) of {len(roles)} posted")

    args.out.write_text(json.dumps(feed, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print("\n".join(report))
    print(f"\nfeed: {len(feed)} role(s) across {ok} companies with matches -> {args.out}")
    if not feed:
        # Non-zero so the workflow can choose to keep the last good jobs.json.
        sys.exit(3)


if __name__ == "__main__":
    main()

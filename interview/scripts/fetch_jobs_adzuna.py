#!/usr/bin/env python3
"""
fetch_jobs_adzuna.py — pull real Data/AI-Engineer roles from the Adzuna jobs API
and write a feed the Jobs board consumes via build_jobs.py --source.

Credentials come from the environment (set as GitHub Actions secrets), NEVER from
the code:
    ADZUNA_APP_ID    — 8-char application id
    ADZUNA_APP_KEY   — 32-char application key
If either is missing the script no-ops (writes nothing, exits 0) so the workflow
just skips Adzuna and relies on the keyless ATS feed.

Adzuna returns listings from across the whole market, so we keep only the ones
whose company matches one of interview/data/companies.json (normalised), and let
build_jobs.py attach question counts + the practice deep-link.

Usage (from repo root):
    ADZUNA_APP_ID=... ADZUNA_APP_KEY=... python3 interview/scripts/fetch_jobs_adzuna.py --out feed_adzuna.json
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

# Reuse the exact title filter used by the ATS fetcher (single source of truth).
sys.path.insert(0, str(Path(__file__).resolve().parent))
from fetch_jobs_feed import title_ok  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
COMPANIES = ROOT / "interview" / "data" / "companies.json"

COUNTRIES = ["us", "gb"]                    # widen if you want more markets
WHATS = ["data engineer", "analytics engineer", "machine learning engineer", "data platform engineer"]
RESULTS_PER_PAGE = 50
PER_COMPANY_CAP = 4
UA = "PaddySpeaks-JobsBot/1.0 (+https://paddyspeaks.com/interview.app/jobs/)"
TIMEOUT = 25

# Strip common company-name noise so "Google LLC" matches the tag "Google".
_SUFFIX = re.compile(
    r"\b(inc|inc\.|llc|l\.l\.c|ltd|limited|corp|corporation|co|company|technologies|technology|"
    r"labs|group|holdings|international|global|the|plc|gmbh)\b",
    re.I,
)


def norm(name: str) -> str:
    s = (name or "").lower()
    s = s.replace("&", " and ")
    s = _SUFFIX.sub(" ", s)
    s = re.sub(r"[^a-z0-9]+", "", s)   # drop spaces, punctuation, ".com"
    return s


def build_lookup() -> dict:
    companies = json.loads(COMPANIES.read_text(encoding="utf-8"))
    return {norm(c["name"]): c["name"] for c in companies}


def adzuna_url(country: str, what: str, app_id: str, app_key: str) -> str:
    q = urllib.parse.urlencode({
        "app_id": app_id,
        "app_key": app_key,
        "results_per_page": RESULTS_PER_PAGE,
        "what": what,
        "content-type": "application/json",
    })
    return f"https://api.adzuna.com/v1/api/jobs/{country}/search/1?{q}"


def get_json(url: str):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        return json.loads(r.read().decode("utf-8"))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, default=ROOT / "feed_adzuna.json")
    args = ap.parse_args()

    app_id = os.environ.get("ADZUNA_APP_ID", "").strip()
    app_key = os.environ.get("ADZUNA_APP_KEY", "").strip()
    if not app_id or not app_key:
        print("Adzuna secrets not set (ADZUNA_APP_ID / ADZUNA_APP_KEY) — skipping Adzuna.")
        return  # exit 0, no file

    lookup = build_lookup()
    seen = set()
    per_company = {}
    feed = []
    calls = 0

    for country in COUNTRIES:
        for what in WHATS:
            try:
                data = get_json(adzuna_url(country, what, app_id, app_key))
                calls += 1
            except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, ValueError) as e:
                print(f"  ✗ {country}/{what!r}: {type(e).__name__}")
                continue
            for j in data.get("results", []):
                title = j.get("title", "")
                if not title_ok(title):
                    continue
                raw_co = (j.get("company") or {}).get("display_name", "")
                canon = lookup.get(norm(raw_co))
                if not canon:
                    continue
                url = j.get("redirect_url", "")
                key = (canon, title.strip().lower())
                if not url or key in seen:
                    continue
                if per_company.get(canon, 0) >= PER_COMPANY_CAP:
                    continue
                seen.add(key)
                per_company[canon] = per_company.get(canon, 0) + 1
                feed.append({
                    "company": canon,
                    "role": title.strip(),
                    "location": (j.get("location") or {}).get("display_name", ""),
                    "apply_url": url,
                    "posted": (j.get("created") or "")[:10],
                })

    args.out.write_text(json.dumps(feed, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    matched_cos = sorted(per_company)
    print(f"Adzuna: {calls} call(s) → {len(feed)} role(s) across {len(matched_cos)} tagged companies")
    if matched_cos:
        print("  matched:", ", ".join(matched_cos))
    args_out_rel = args.out.relative_to(ROOT) if args.out.is_relative_to(ROOT) else args.out
    print(f"  wrote {args_out_rel}")


if __name__ == "__main__":
    main()

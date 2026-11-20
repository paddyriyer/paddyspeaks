#!/usr/bin/env python3
"""
build_jobs.py — generate the Jobs board data for interview.app/jobs/.

Writes one static file the page renders client-side:

    interview.app/jobs/data/jobs.json

Every judgement about a posting — which career role it is, its family, its
seniority, workplace, employment type, a short summary, and whether it is
still listed — is made HERE, in Python, from the shared taxonomy in
interview/careers/roles.json (interview/careers/classify.py). The page only
formats and filters. No posting is ever invented.

Sources (provider integration is kept separate from interview content):

  JobSignal index  jobs/data/index.json — PaddySpeaks' own verified board of
                   public ATS postings (refreshed every four hours by
                   .github/workflows/jobsignal-ingest.yml). Default on;
                   --no-jobsignal turns it off. Summaries come from the
                   posting text in jobs/data/detail/.
  --source FILE…   ATS / Adzuna feeds (fetch_jobs_feed.py, fetch_jobs_adzuna.py):
                   [{"company","role","location","apply_url","posted"}].
                   Missing files are skipped.

  --sample         The labelled illustrative preview, used only when no real
                   source is connected: generic titles, real question counts,
                   apply links that are searches, every card marked sample.

Listing lifecycle:
  * first_seen — when the listing first reached this board; carried forward
    from the previous file and never re-stamped.
  * A listing that disappears from a source that DID deliver this run is kept
    for EXPIRED_DAYS as status "expired" (the page shows it as no longer
    listed, with no apply button), then dropped. A listing whose source did
    not deliver this run is carried forward unchanged — a failed fetch never
    expires real jobs.

Run from the repo root:
    python3 interview/scripts/build_jobs.py                      # JobSignal (+ carry-forward)
    python3 interview/scripts/build_jobs.py --source feed.json   # + ATS feed
    python3 interview/scripts/build_jobs.py --sample             # illustrative preview
"""
from __future__ import annotations

import argparse
import datetime as _dt
import hashlib
import json
import re
import sys
from collections import defaultdict
from pathlib import Path
from urllib.parse import quote, urlparse

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from interview.careers.classify import Taxonomy, employment, summarise, workplace  # noqa: E402

DATA = ROOT / "interview" / "data"
OUT = ROOT / "interview.app" / "jobs" / "data" / "jobs.json"
JOBSIGNAL = ROOT / "jobs" / "data" / "index.json"
EXPIRED_DAYS = 21

SOURCE_LABEL = {
    "jobsignal": "JobSignal (verified ATS posting)",
    "ats": "Company careers board",
    "adzuna": "Adzuna",
    "sample": "Illustrative sample",
}
ATS_LABEL = {"greenhouse": "Greenhouse", "lever": "Lever", "ashby": "Ashby",
             "smartrecruiters": "SmartRecruiters", "workday": "Workday"}

# Illustrative role titles + locations for the sample board. Generic titles
# only — never a fabricated specific posting.
SAMPLE_ROLES = [
    "Senior Data Engineer", "Analytics Engineer", "Data Platform Engineer", "Product Manager",
    "Technical Program Manager", "AI Product Manager", "Senior Analytics Engineer", "Product Analyst",
]
SAMPLE_LOCATIONS = ["Remote · US", "San Francisco, CA", "Seattle, WA", "New York, NY", "Remote", "Austin, TX"]
SAMPLE_COMPANY_LIMIT = 18

US_STATES = set("AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM "
                "NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC".split())
COUNTRY_WORDS = [
    ("US", r"\b(united states|usa|u\.s\.|san francisco|new york|seattle|austin|boston|chicago|los angeles|denver|atlanta|washington,? d\.?c)\b"),
    ("CA", r"\b(canada|toronto|vancouver|montreal|ontario)\b"),
    ("GB", r"\b(united kingdom|uk|london|england|scotland|manchester|edinburgh)\b"),
    ("IN", r"\b(india|bangalore|bengaluru|hyderabad|pune|mumbai|delhi|gurgaon|gurugram|chennai)\b"),
    ("DE", r"\b(germany|berlin|munich|hamburg)\b"), ("FR", r"\b(france|paris)\b"),
    ("IE", r"\b(ireland|dublin)\b"), ("NL", r"\b(netherlands|amsterdam)\b"),
    ("ES", r"\b(spain|madrid|barcelona)\b"), ("JP", r"\b(japan|tokyo)\b"),
    ("SG", r"\bsingapore\b"), ("AU", r"\b(australia|sydney|melbourne)\b"),
    ("BR", r"\b(brazil|são paulo|sao paulo)\b"), ("CN", r"\b(china|beijing|shanghai|shenzhen)\b"),
    ("IL", r"\b(israel|tel aviv)\b"), ("PL", r"\b(poland|warsaw|krak[oó]w)\b"),
]


def load_json(path: Path):
    with path.open(encoding="utf-8") as fh:
        return json.load(fh)


def country_for(location: str) -> str:
    loc = (location or "").strip()
    if not loc:
        return ""
    m = re.search(r",\s*([A-Z]{2})\b", loc)
    if m and m.group(1) in US_STATES:
        return "US"
    low = loc.lower()
    for code, pat in COUNTRY_WORDS:
        if re.search(pat, low):
            return code
    return ""


def norm_url(u: str) -> str:
    p = urlparse(u or "")
    return (p.netloc.lower().removeprefix("www.") + p.path.rstrip("/") + ("?" + p.query if p.query else "")).lower()


def dup_key(company: str, role: str, location: str) -> tuple:
    return ((company or "").strip().lower(), re.sub(r"\s+", " ", (role or "").lower()).strip(),
            (location or "").strip().lower())


def stable_id(*parts: str) -> str:
    return "s" + hashlib.sha1("|".join(parts).encode("utf-8")).hexdigest()[:12]


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


def bank_url(company: str) -> str:
    # The question bank reads ?company=<Name> on load and applies the facet (app.js).
    return "../?company=" + quote(company)


def careers_search(company: str, role: str = "data engineer") -> str:
    return "https://www.google.com/search?q=" + quote(f"{company} {role} jobs")


class Enricher:
    """Adds the taxonomy fields every card needs. Pure function of the record."""

    def __init__(self, counts: dict, names: set[str]):
        self.tax = Taxonomy.load()
        self.counts = counts
        self.names_lower = {n.lower(): n for n in names}

    def bank_company(self, company: str) -> str | None:
        name = self.names_lower.get((company or "").lower())
        return name if name and self.counts.get(name, {}).get("total") else None

    def enrich(self, job: dict, experience: str | None = None) -> dict | None:
        cls = self.tax.classify(job["role"], experience)
        if cls is None:
            return None
        job.update(role_id=cls["role"], family=cls["family"], families=cls["families"],
                   seniority=cls["seniority"])
        job.pop("counts", None)          # older boards repeated these per job;
        job.pop("practice_url", None)    # they now live once, in payload["bank"]
        bank = self.bank_company(job["company"])
        if bank:
            job["bank"] = bank
        return job


def from_jobsignal(path: Path, enr: Enricher) -> list[dict]:
    idx = load_json(path)
    shards: dict[str, dict] = {}

    def detail(jid: str) -> dict:
        shard = jid[1:3]
        if shard not in shards:
            p = path.parent / "detail" / f"{shard}.json"
            shards[shard] = {d["id"]: d for d in load_json(p)["jobs"]} if p.exists() else {}
        return shards[shard].get(jid, {})

    out = []
    for j in idx["jobs"]:
        if j.get("status") != "live" or j.get("is_staffing_firm") or j.get("confidence_level") == "caution":
            continue
        rec = {"company": j["company_name"], "role": j["job_title"], "location": j.get("location") or ""}
        if enr.enrich(rec, j.get("experience_level")) is None:
            continue
        d = detail(j["id"])
        extra = [x for x in (d.get("locations_extra") or []) if x]
        salary = None
        if j.get("salary_min") and j.get("salary_max") and j.get("currency"):
            salary = {"min": j["salary_min"], "max": j["salary_max"], "currency": j["currency"]}
        rec.update(
            id="js-" + j["id"],
            locations_extra=extra,
            country=j.get("location_country") or country_for(rec["location"]),
            workplace=workplace(j.get("remote_status"), rec["location"]),
            employment=employment(j.get("employment_type"), rec["role"]),
            salary=salary,
            posted=j.get("posted_at_original") or None,
            source="jobsignal",
            source_detail=ATS_LABEL.get(j.get("ats_provider"), j.get("ats_provider") or ""),
            verified_at=(j.get("last_verified_at") or "")[:10] or None,
            first_seen_hint=(j.get("first_seen_at") or "")[:10] or None,
            apply_url=j["apply_url"],
            details_url="/jobs/job/?id=" + quote(j["id"]),
            summary=summarise(d.get("description"), rec["role"]),
        )
        out.append(rec)
    return out


def from_feed(records: list[dict], enr: Enricher, source: str, today: str) -> list[dict]:
    out = []
    for r in records:
        co = (r.get("company") or "").strip()
        url = r.get("apply_url")
        if not co or not url:
            continue
        rec = {"company": co, "role": (r.get("role") or "").strip(), "location": (r.get("location") or "").strip()}
        if enr.enrich(rec) is None:
            continue
        rec.update(
            id=stable_id(source, co, rec["role"], url),
            locations_extra=[],
            country=country_for(rec["location"]),
            workplace=workplace(None, rec["location"]),
            employment=employment(None, rec["role"]),
            salary=None,
            posted=r.get("posted") or None,
            source=source,
            source_detail="",
            verified_at=today,
            apply_url=url,
            summary="",
        )
        out.append(rec)
    return out


def previous_board() -> dict:
    if not OUT.exists():
        return {}
    try:
        return load_json(OUT)
    except (json.JSONDecodeError, OSError):
        return {}          # unreadable previous board: degrade to all-new, never crash


def old_key(j: dict) -> tuple:
    """Identity across rebuilds — the same key the board has always used."""
    return (j.get("company"), (j.get("role") or "").lower(), j.get("apply_url"))


def merge(fresh: list[dict], delivered: set[str], prev: dict, enr: Enricher, today: str) -> list[dict]:
    prev_jobs = [j for j in prev.get("jobs", []) if not j.get("sample")]
    prev_by_key = {old_key(j): j for j in prev_jobs}
    prev_generated = (prev.get("generated_at") or today)[:10]

    # De-duplicate across sources: the first source wins (JobSignal is listed
    # first because it carries salary, workplace and a verified date).
    seen_url, seen_key, jobs = set(), set(), []
    for j in fresh:
        u, k = norm_url(j["apply_url"]), dup_key(j["company"], j["role"], j["location"])
        if u in seen_url or k in seen_key:
            continue
        seen_url.add(u)
        seen_key.add(k)
        jobs.append(j)

    added = 0
    for j in jobs:
        before = prev_by_key.get(old_key(j))
        hint = j.pop("first_seen_hint", None)
        if before and before.get("first_seen"):
            j["first_seen"] = before["first_seen"]
        else:
            j["first_seen"] = min(hint, today) if hint else today
            added += 1
        j["status"] = "live"
        j["sample"] = False

    live_keys = {old_key(j) for j in jobs}
    carried = expired = dropped = 0
    for p in prev_jobs:
        if old_key(p) in live_keys:
            continue
        u, k = norm_url(p.get("apply_url", "")), dup_key(p.get("company"), p.get("role"), p.get("location"))
        if u in seen_url or k in seen_key:
            continue
        src = p.get("source") or "ats"            # boards before 2026-11 were ATS-only
        p = dict(p)
        p.setdefault("source", src)
        p.setdefault("verified_at", prev_generated)
        p.setdefault("locations_extra", [])
        p.setdefault("country", country_for(p.get("location", "")))
        p.setdefault("workplace", workplace(None, p.get("location")))
        p.setdefault("employment", employment(None, p.get("role", "")))
        p.setdefault("salary", None)
        p.setdefault("summary", "")
        p.setdefault("id", stable_id(src, p.get("company", ""), p.get("role", ""), p.get("apply_url", "")))
        if enr.enrich(p) is None:
            dropped += 1
            continue
        if src in delivered:
            # The source answered this run and no longer lists it.
            p["status"] = "expired"
            p.setdefault("expired_on", today)
            age = (_dt.date.fromisoformat(today) - _dt.date.fromisoformat(p["expired_on"])).days
            if age > EXPIRED_DAYS:
                dropped += 1
                continue
            expired += 1
        else:
            p.setdefault("status", "live")
            carried += 1
        jobs.append(p)
        seen_url.add(u)
        seen_key.add(k)
    print(f"  {added} new to the board, {len(live_keys) - added} still listed, "
          f"{carried} carried from sources not fetched this run, {expired} marked expired, {dropped} dropped")
    return jobs


def build_sample(counts: dict[str, dict], companies: list[dict], enr: Enricher, today: str) -> list[dict]:
    ranked = [c["name"] for c in companies if counts.get(c["name"], {}).get("total")]
    jobs = []
    for i, name in enumerate(ranked[:SAMPLE_COMPANY_LIMIT]):
        role = SAMPLE_ROLES[i % len(SAMPLE_ROLES)]
        rec = {"company": name, "role": role, "location": SAMPLE_LOCATIONS[i % len(SAMPLE_LOCATIONS)]}
        enr.enrich(rec)
        rec.update(id=stable_id("sample", name, role), locations_extra=[], country="",
                   workplace=workplace(None, rec["location"]), employment="unknown", salary=None,
                   posted=None, source="sample", source_detail="", verified_at=None,
                   apply_url=careers_search(name, role), summary="", first_seen=today,
                   status="sample", sample=True)
        jobs.append(rec)
    return jobs


FIELD_ORDER = ["id", "company", "role", "role_id", "family", "families", "seniority", "location",
               "locations_extra", "country", "workplace", "employment", "salary", "summary", "posted",
               "first_seen", "verified_at", "status", "expired_on", "source", "source_detail",
               "apply_url", "details_url", "bank", "sample"]


def tidy(j: dict) -> dict:
    return {k: j[k] for k in FIELD_ORDER if k in j and j[k] not in (None, "", [])
            or k in ("sample",)}


def main() -> None:
    ap = argparse.ArgumentParser(description="Generate interview.app/jobs data.")
    ap.add_argument("--source", type=Path, nargs="+", default=[],
                    help="ATS / Adzuna feed JSON files. Missing files are skipped.")
    ap.add_argument("--jobsignal", type=Path, default=JOBSIGNAL, help="JobSignal index.json")
    ap.add_argument("--no-jobsignal", action="store_true")
    ap.add_argument("--sample", action="store_true", help="Write the labelled illustrative preview instead.")
    args = ap.parse_args()

    now = _dt.datetime.now(_dt.timezone.utc)
    today = now.strftime("%Y-%m-%d")
    companies = load_json(DATA / "companies.json")
    counts = company_counts(load_json(DATA / "questions.json"))
    enr = Enricher(counts, {c["name"] for c in companies})

    sources = []
    if args.sample:
        jobs, mode = build_sample(counts, companies, enr, today), "sample"
    else:
        fresh, delivered = [], set()
        if not args.no_jobsignal and args.jobsignal.exists():
            js = from_jobsignal(args.jobsignal, enr)
            if js:
                fresh += js
                delivered.add("jobsignal")
                sources.append({"id": "jobsignal", "label": SOURCE_LABEL["jobsignal"], "jobs": len(js),
                                "refreshed_at": load_json(args.jobsignal).get("generated_at")})
        for src in args.source:
            if not src.exists():
                print(f"  (skipping absent feed: {src})")
                continue
            kind = "adzuna" if "adzuna" in src.name.lower() else "ats"
            recs = from_feed(load_json(src), enr, kind, today)
            if recs:
                fresh += recs
                delivered.add(kind)
                sources.append({"id": kind, "label": SOURCE_LABEL[kind], "jobs": len(recs),
                                "refreshed_at": now.strftime("%Y-%m-%dT%H:%M:%SZ")})
        if not fresh:
            sys.exit("no roles found in any source — leaving the previous board untouched")
        jobs, mode = merge(fresh, delivered, previous_board(), enr, today), "live"
        # Newest first; expired last.
        jobs.sort(key=lambda j: (j["status"] == "expired", j.get("posted") or j["first_seen"]), reverse=False)
        jobs.sort(key=lambda j: j["status"] == "expired")
        live = [j for j in jobs if j["status"] != "expired"]
        live.sort(key=lambda j: (j.get("posted") or j["first_seen"], j["company"]), reverse=True)
        jobs = live + [j for j in jobs if j["status"] == "expired"]

    jobs = [tidy(j) for j in jobs]
    payload = {
        "generated_at": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "mode": mode,
        "taxonomy": "interview/careers/roles.json",
        "sources": sources,
        "job_count": sum(1 for j in jobs if j.get("status") != "expired"),
        "expired_count": sum(1 for j in jobs if j.get("status") == "expired"),
        "company_count": len({j["company"] for j in jobs if j.get("status") != "expired"}),
        # Question-bank coverage per company, for the "Practise SQL / Python
        # for <company>" link. Only companies with tagged questions appear.
        "bank": {b: {**counts[b], "url": bank_url(b)} for b in sorted({j["bank"] for j in jobs if j.get("bank")})},
        "jobs": jobs,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    # One job per line: compact for the browser, readable in a diff.
    head = {k: v for k, v in payload.items() if k != "jobs"}
    body = ",\n".join(json.dumps(j, ensure_ascii=False, separators=(",", ":")) for j in jobs)
    text = json.dumps(head, ensure_ascii=False, indent=1)[:-2] + ',\n "jobs": [\n' + body + "\n ]\n}\n"
    json.loads(text)
    OUT.write_text(text, encoding="utf-8")
    print(f"  wrote {OUT.relative_to(ROOT)} — {mode} mode, {payload['job_count']} live role(s), "
          f"{payload['expired_count']} expired, {payload['company_count']} companies")


if __name__ == "__main__":
    main()

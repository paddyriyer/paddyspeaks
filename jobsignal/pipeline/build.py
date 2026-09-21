#!/usr/bin/env python3
"""JobSignal ingestion run.

    python3 -m jobsignal.pipeline.build                 # full run
    python3 -m jobsignal.pipeline.build --dry-run       # fetch, compute, write nothing
    python3 -m jobsignal.pipeline.build --only stripe   # one employer
    python3 -m jobsignal.pipeline.build --offline FILE  # replay a saved raw capture

Writes jobs/data/{index,stats,companies,health,history}.json plus detail shards
and the year archives. Never writes a job it did not read from a live employer
source this run or carry forward from the store - there is no sample mode and
no placeholder record, by design (brief §20, and CLAUDE.md's standing rule that
this site does not seed content it cannot evidence).

Exit codes: 0 success, 1 nothing ingested and the previous board was kept.
"""
from __future__ import annotations

import argparse
import datetime as _dt
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

from . import confidence, identity, normalize, store, taxonomy
from .adapters import ADAPTERS
from .http import BudgetExhausted, Fetcher

ROOT = Path(__file__).resolve().parents[2]
SOURCES = ROOT / "jobsignal" / "sources.json"
DATA = ROOT / "jobs" / "data"

# Fields carried in the compact index the browser downloads. Descriptions and
# requirements live in the detail shards, so the index stays small enough to
# search in the browser (see docs/JOBSIGNAL.md §2).
# Fields carried in the compact index the browser downloads. Everything the
# ranker and the card need, and nothing else — descriptions, requirements and
# posting history live in the detail shards. The old index carried 38 fields
# including derived arrays and ran to 8.25 MB for 6k roles, parsed on a phone.
INDEX_FIELDS = (
    "id", "company_slug", "company_name", "company_domain",
    "job_title", "role_family", "role_head", "role_family_confidence",
    "department", "location", "location_city", "location_region",
    "location_country", "location_count", "locations_extra",
    "remote_status", "employment_type",
    "experience_level", "education_requirement",
    "salary_min", "salary_max", "currency",
    "visa_sponsorship", "security_clearance",
    "ats_provider", "apply_url", "apply_url_host", "apply_hops",
    "posted_at_original", "first_seen_at", "last_verified_at",
    "repost_count", "status", "confidence_level", "freshness", "age_days",
    "skills", "industry", "company_size", "is_staffing_firm",
)


def now_utc() -> _dt.datetime:
    return _dt.datetime.now(_dt.UTC).replace(microsecond=0)


def load_sources() -> dict:
    return json.loads(SOURCES.read_text(encoding="utf-8"))


def build_record(src: dict, raw: dict, run_iso: str) -> dict | None:
    """Raw ATS posting -> canonical record. Returns None if it must not ship."""
    title = (raw.get("title") or "").strip()
    apply_url = (raw.get("apply_url") or "").strip()
    if not title or not apply_url:
        return None
    # The candidate must land at the employer or its ATS. A posting whose apply
    # link points somewhere else is dropped rather than published with a
    # warning - "where the Apply button goes" is a promise, not a disclosure.
    if not normalize.apply_url_ok(apply_url, src["company_domain"]):
        return None

    desc = raw.get("description_text") or ""
    loc_raw = raw.get("location") or ""
    all_locs = normalize.parse_locations(loc_raw)
    parts = all_locs[0] if all_locs else {"city": "", "region": "", "country": ""}

    req = list(raw.get("requirements") or [])
    pref = list(raw.get("preferred") or [])
    req_source = "employer_field" if (req or pref) else ""
    if not req and not pref:
        req, pref = normalize.split_requirements(desc)
        # Parsed back out of the description rather than published as their own
        # fields. The job page uses this to avoid showing the same bullets twice.
        req_source = "description" if (req or pref) else ""

    sal_lo, sal_hi, cur = raw.get("salary_min"), raw.get("salary_max"), raw.get("currency") or ""
    sal_source = "employer_field" if sal_lo and sal_hi else ""
    if not (sal_lo and sal_hi):
        sal_lo, sal_hi, cur = normalize.parse_salary(desc, cur)
        sal_source = "description" if sal_lo and sal_hi else ""

    department = normalize.clean_department(raw.get("department", ""), src["company_name"])
    family, provenance = taxonomy.classify(title, department, desc)

    canonical = identity.canonical_key(
        src["company_domain"], raw.get("requisition_id", ""), title, loc_raw)

    rec = {
        "id": identity.job_id(canonical),
        "canonical_key": canonical,
        "lineage_key": identity.lineage_key(
            src["company_domain"], title, loc_raw, raw.get("department", "")),

        "company_slug": src["company_slug"],
        "company_name": src["company_name"],
        "company_domain": src["company_domain"],
        "industry": src.get("industry", ""),
        "company_size": src.get("company_size", ""),
        "is_staffing_firm": bool(src.get("is_staffing_firm")),

        "job_title": title,
        "title_normalized": normalize.normalize_title(title),
        "role_family": family,
        "role_head": taxonomy.role_head(title),
        "role_family_confidence": provenance,
        "department": department,
        "location": loc_raw,
        "location_city": parts["city"],
        "location_region": parts["region"],
        "location_country": parts["country"],
        "location_count": len(all_locs),
        # Every place after the first, so a role open in San Francisco AND New
        # York is findable by either. The card still leads with the first.
        "locations_extra": [
            [l["city"], l["region"], l["country"]] for l in all_locs[1:]
        ],
        "remote_status": normalize.remote_status(loc_raw, desc),
        "employment_type": normalize.employment_type(
            raw.get("employment_type", ""), title, desc),

        "salary_min": sal_lo, "salary_max": sal_hi, "currency": cur,
        "salary_source": sal_source,
        "experience_level": normalize.experience_level(title, desc),
        "education_requirement": normalize.education_requirement(desc),

        "description": desc,
        "requirements": req,
        "preferred_requirements": pref,
        "requirements_source": req_source,
        "skills": normalize.extract_skills(title, desc),
        "visa_sponsorship": normalize.mentions(normalize._VISA, desc, " ".join(req)),
        "security_clearance": normalize.mentions(normalize._CLEARANCE, desc, " ".join(req)),

        "requisition_id": str(raw.get("requisition_id") or ""),
        "source_type": "ats_api",
        "source_url": apply_url,
        "apply_url": apply_url,
        "apply_url_host": normalize.apply_host(apply_url),
        "apply_hops": 0,
        "ats_provider": src["ats_provider"],

        "posted_at_original": raw.get("posted_at") or "",
        "last_verified_at": run_iso,
        "description_hash": normalize.description_hash(desc),
        "_tokens": normalize.description_tokens(desc),
    }
    return rec


def harvest(sources: list[dict], fetcher: Fetcher, run_iso: str, health: list[dict]):
    """Fetch every enabled source. One failure never stops the run."""
    records = []
    for src in sources:
        adapter = ADAPTERS.get(src["ats_provider"])
        entry = {"company_slug": src["company_slug"], "company_name": src["company_name"],
                 "ats_provider": src["ats_provider"], "ok": False,
                 "postings_seen": 0, "kept": 0, "error": ""}
        if adapter is None:
            entry["error"] = f"no adapter for '{src['ats_provider']}'"
            health.append(entry)
            continue
        try:
            raws = adapter(src, fetcher)
        except BudgetExhausted:
            entry["error"] = "request budget exhausted"
            health.append(entry)
            break
        except Exception as e:  # noqa: BLE001 - a dead slug must drop one employer, not the run
            entry["error"] = f"{type(e).__name__}: {e}"
            health.append(entry)
            continue

        entry["ok"] = True
        entry["postings_seen"] = len(raws)
        for raw in raws:
            rec = build_record(src, raw, run_iso)
            if rec:
                records.append(rec)
                entry["kept"] += 1
        health.append(entry)
    return records


def probe_apply_urls(records: list[dict], fetcher: Fetcher, sample: int, run_iso: str) -> int:
    """Check a bounded sample of application pages, oldest-checked first.

    Listing presence proves the requisition exists; it does not prove the
    application page loads. Sampling keeps that second check honest without
    sending tens of thousands of requests a day at employers who did nothing to
    deserve them.
    """
    ordered = sorted(records, key=lambda r: r.get("apply_probe_at") or "")
    done = 0
    for rec in ordered[:sample]:
        try:
            outcome, detail = fetcher.probe(rec["apply_url"])
        except BudgetExhausted:
            break
        rec["apply_probe"] = outcome
        rec["apply_probe_at"] = run_iso
        rec["apply_probe_detail"] = detail
        done += 1
    return done


def compute_stats(live: list[dict], now: _dt.datetime, run_iso: str) -> dict:
    """The homepage numbers. Counted from the board, never written by hand."""
    verified_today = sum(
        1 for j in live
        if (j.get("last_verified_at") or "")[:10] == run_iso[:10])
    def _within(ts, hours):
        # `or` would be wrong here: a job first seen this very second gives 0.0,
        # which is falsy, and would be counted as "no timestamp".
        h = confidence.hours_since(ts, now)
        return h is not None and h <= hours

    added_24h = sum(1 for j in live if _within(j.get("first_seen_at"), 24))
    with_salary = sum(1 for j in live if j.get("salary_min") and j.get("salary_max"))
    return {
        "generated_at": run_iso,
        "live_jobs": len(live),
        "verified_today": verified_today,
        "added_last_24h": added_24h,
        "employers": len({j["company_slug"] for j in live}),
        "salary_disclosed": with_salary,
        "direct_employer_applications": sum(1 for j in live if j.get("apply_hops", 0) == 0),
        "by_status": dict(Counter(j["status"] for j in live)),
        "by_confidence": dict(Counter(j["confidence_level"] for j in live)),
        "by_remote": dict(Counter(j["remote_status"] for j in live)),
    }


def write_outputs(live: list[dict], history: dict, stats: dict, health: list[dict],
                  run_iso: str, closed_now: list[dict]) -> None:
    DATA.mkdir(parents=True, exist_ok=True)

    index = [{k: j.get(k) for k in INDEX_FIELDS} for j in live]
    for row in index:
        if not row.get("locations_extra"):
            row.pop("locations_extra", None)
    index.sort(key=lambda r: (r.get("last_verified_at") or "", r.get("first_seen_at") or ""), reverse=True)
    store.write_json(DATA / "index.json", {"generated_at": run_iso, "count": len(index), "jobs": index})

    shards: dict[str, list[dict]] = defaultdict(list)
    for job in live:
        detail = {k: v for k, v in job.items() if not k.startswith("_")}
        detail.pop("canonical_key", None)
        shards[job["id"][1:3]].append(detail)
    shard_dir = DATA / "detail"
    shard_dir.mkdir(parents=True, exist_ok=True)
    for existing in shard_dir.glob("*.json"):
        if existing.stem not in shards:
            existing.unlink()
    for name, items in shards.items():
        store.write_json(shard_dir / f"{name}.json",
                         {"generated_at": run_iso, "jobs": sorted(items, key=lambda r: r["id"])})

    by_company: dict[str, dict] = {}
    for job in live:
        c = by_company.setdefault(job["company_slug"], {
            "company_slug": job["company_slug"], "company_name": job["company_name"],
            "company_domain": job["company_domain"], "industry": job.get("industry", ""),
            "company_size": job.get("company_size", ""), "ats_provider": job.get("ats_provider", ""),
            "live_jobs": 0, "verified_live": 0, "first_seen_at": job["first_seen_at"],
            "reposted_roles": 0,
        })
        c["live_jobs"] += 1
        c["verified_live"] += 1 if job["status"] == "live" else 0
        c["reposted_roles"] += 1 if job.get("repost_count") else 0
        c["first_seen_at"] = min(c["first_seen_at"], job["first_seen_at"])
    store.write_json(DATA / "companies.json", {
        "generated_at": run_iso,
        "companies": sorted(by_company.values(), key=lambda c: (-c["live_jobs"], c["company_name"])),
    })

    store.write_json(DATA / "stats.json", stats)
    store.write_json(DATA / "health.json", {
        "generated_at": run_iso,
        "sources_total": len(health),
        "sources_ok": sum(1 for h in health if h["ok"]),
        "sources_failed": sum(1 for h in health if not h["ok"]),
        "postings_seen": sum(h["postings_seen"] for h in health),
        "jobs_published": len(live),
        "jobs_filtered_out_of_scope": stats.get("filtered_out_of_scope", 0),
        "by_family": stats.get("by_family", {}),
        "jobs_closed_this_run": len(closed_now),
        "sources": sorted(health, key=lambda h: (h["ok"], h["company_name"])),
    })
    store.save_history(history)


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description="Run one JobSignal ingestion pass.")
    ap.add_argument("--dry-run", action="store_true", help="compute everything, write nothing")
    ap.add_argument("--only", action="append", default=[], help="limit to these company slugs")
    ap.add_argument("--offline", type=Path, help="replay a saved raw capture instead of fetching")
    ap.add_argument("--no-probe", action="store_true", help="skip apply-URL probes")
    args = ap.parse_args(argv)

    cfg = load_sources()
    now = now_utc()
    run_iso = now.isoformat().replace("+00:00", "Z")

    sources = [s for s in cfg["sources"] if s.get("enabled")]
    if args.only:
        wanted = set(args.only)
        sources = [s for s in sources if s["company_slug"] in wanted]

    fetcher = Fetcher(budget=int(cfg.get("request_budget_per_run", 1200)))
    health: list[dict] = []

    if args.offline:
        captured = json.loads(args.offline.read_text(encoding="utf-8"))
        by_slug = {s["company_slug"]: s for s in sources}
        fresh = []
        for slug, raws in captured.items():
            src = by_slug.get(slug)
            if not src:
                continue
            kept = [r for r in (build_record(src, raw, run_iso) for raw in raws) if r]
            fresh.extend(kept)
            health.append({"company_slug": slug, "company_name": src["company_name"],
                           "ats_provider": src["ats_provider"], "ok": True,
                           "postings_seen": len(raws), "kept": len(kept), "error": ""})
    else:
        fresh = harvest(sources, fetcher, run_iso, health)

    if not fresh:
        print("✗ no postings ingested — previous board left untouched", file=sys.stderr)
        return 1

    fresh, absorbed = identity.dedupe(fresh)

    history = store.load_history()
    years = tuple(str(now.year - n) for n in range(2))
    closed_pool = store.recent_closed(history, years)
    for cand in closed_pool:
        cand["_tokens"] = normalize.description_tokens(cand.get("description", ""))

    seen_ids = set()
    for rec in fresh:
        if rec["lineage_key"] not in history["lineages"]:
            adopted = identity.match_closed_lineage(rec, closed_pool)
            if adopted:
                rec["lineage_key"] = adopted
        store.carry_forward(rec, history, run_iso)
        store.attach_lineage(rec, history, run_iso)
        confidence.annotate(rec, now)
        seen_ids.add(rec["id"])

    if not args.no_probe and not args.offline:
        for rec in fresh:
            prior = history["jobs"].get(rec["id"]) or {}
            rec.setdefault("apply_probe_at", prior.get("apply_probe_at", ""))
        probe_apply_urls(fresh, fetcher, int(cfg.get("apply_probe_sample", 150)), run_iso)
        for rec in fresh:
            confidence.annotate(rec, now)

    # Absence handling. Only employers we actually reached this run may have
    # their jobs closed — otherwise a single ATS outage would archive a whole
    # board and reset those roles' ages when they came back.
    reached = {h["company_slug"] for h in health if h["ok"]}
    closed_now: list[dict] = []
    for job_id, entry in list(history["jobs"].items()):
        if job_id in seen_ids or entry.get("closed_at"):
            continue
        prior_slug = entry.get("company_slug")
        if prior_slug and prior_slug not in reached:
            continue
        if store.record_miss(history, job_id) >= store.MISS_LIMIT:
            entry["closed_at"] = run_iso
            closed_now.append({
                "id": job_id, "closed_at": run_iso,
                "first_seen_at": entry.get("first_seen_at", ""),
                "last_seen_at": entry.get("last_seen_at", ""),
                "last_verified_at": entry.get("last_verified_at", ""),
                "posted_at_original": entry.get("posted_at_original", ""),
                "lineage_key": entry.get("lineage_key", ""),
                "company_domain": entry.get("company_domain", ""),
                "company_slug": prior_slug or "",
                "job_title": entry.get("job_title", ""),
                "description": entry.get("description", ""),
            })
            store.close_spell(history, {"lineage_key": entry.get("lineage_key"), "id": job_id}, run_iso)

    for rec in fresh:
        store.remember(history, rec)
        # Fields the closure path above needs later, when the job is gone.
        history["jobs"][rec["id"]].update({
            "company_slug": rec["company_slug"],
            "company_domain": rec["company_domain"],
            "job_title": rec["job_title"],
        })

    # Curation (brief §20: quality over quantity). A role outside the target
    # families is kept in the history ledger — so its age survives if it ever
    # becomes in-scope — but it is not published to the board.
    reachable = [r for r in fresh if r["status"] in ("live", "recent")]
    live = [r for r in reachable if taxonomy.is_published(r["role_family"])]
    filtered_out = len(reachable) - len(live)
    by_family = Counter(r["role_family"] for r in reachable)
    stats = compute_stats(live, now, run_iso)
    stats["by_family"] = {k: v for k, v in by_family.items() if k in taxonomy.TARGET_FAMILIES}
    stats["filtered_out_of_scope"] = filtered_out

    print(f"  sources ok      : {sum(1 for h in health if h['ok'])}/{len(health)}")
    print(f"  postings seen   : {sum(h['postings_seen'] for h in health)}")
    print(f"  deduped away    : {len(absorbed)}")
    print(f"  in scope        : {len(live)}")
    print(f"  filtered (scope): {filtered_out}")
    print(f"  closed this run : {len(closed_now)}")
    print(f"  requests spent  : {fetcher.spent}")
    for h in health:
        if not h["ok"]:
            print(f"  ✗ {h['company_name']}: {h['error']}")

    if args.dry_run:
        print("— dry run: nothing written —")
        return 0

    if closed_now:
        store.archive_jobs(closed_now)
    write_outputs(live, history, stats, health, run_iso, closed_now)
    print(f"✓ wrote jobs/data ({len(live)} live roles)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

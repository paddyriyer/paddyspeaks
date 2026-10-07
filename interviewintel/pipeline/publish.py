"""Publisher (brief §10–13, §15): the ledger → what the browser reads.

Only APPROVED reports of APPROVED questions reach a public file. Every
derived value — frequency, freshness, trends, company topic shares — is
computed here, once, and shipped as data; the pages only format and filter
(the JobSignal rule, which avoids two implementations drifting apart).

Public provenance per source: URL, a neutral title, source type, the
source's date and our retrieval date. Never the evidence quote, never an
author, never anything about a person.

Files:
  interview.app/reported/data/questions.json   the practice questions
  interview.app/reported/data/trending.json    7 / 30 / 90-day topic trends
  interview.app/reported/data/intel.json       company and company×role intelligence
  admin/interview-discovery/queue.json         the review queue (pending reports)
"""
from __future__ import annotations

import datetime as _dt
from collections import Counter, defaultdict

from . import authored, config, enrich, sources, store

LABEL_TREND = "Questions appearing in recently discovered public interview reports."
LABEL_INTEL = ("Based on publicly discovered interview reports. This is not official company interview "
               "information, and it is not a representative sample of anyone's interviews.")


def _d(s: str | None) -> _dt.date | None:
    try:
        return _dt.date.fromisoformat((s or "")[:10])
    except ValueError:
        return None


def report_date(r: dict) -> str:
    """When a report happened, as best we know: the source's date, else when we found it."""
    return r.get("source_date") or r["discovered"]


def freshness(dates: list[str], today: _dt.date) -> str:
    ds = sorted(d for d in (_d(x) for x in dates) if d)
    if not ds:
        return "HISTORICAL"
    latest_age = (today - ds[-1]).days
    if (len(ds) >= config.RECURRING_MIN_REPORTS
            and (ds[-1] - ds[0]).days >= config.RECURRING_MIN_SPAN_DAYS
            and latest_age <= config.RECURRING_MAX_AGE_DAYS):
        return "RECURRING"
    if latest_age <= config.RECENT_DAYS:
        return "RECENT"
    return "HISTORICAL"


def topic_of(q: dict) -> str:
    return q.get("subcategory") or q["category"]


def public_question(q: dict, reps: list[dict], today: _dt.date) -> dict:
    dates = [report_date(r) for r in reps]
    window_start = today - _dt.timedelta(days=config.RECENT_DAYS)
    companies = sorted({(r["company"], r["company_name"]) for r in reps if r["company"]})
    roles = sorted({(r["role"], r["role_name"]) for r in reps if r["role"]})
    stages = sorted({r["interview_stage"] for r in reps if r["interview_stage"]})
    years = sorted({r["interview_year"] or (_d(report_date(r)) or today).year for r in reps})
    prep = q.get("prep") if q.get("prep_for") == enrich.text_hash(q) else None
    return {
        "id": q["id"], "title": q["title"], "question": q["question"],
        "category": q["category"], "subcategory": q.get("subcategory"), "topic": topic_of(q),
        "difficulty": q.get("difficulty"), "technology": q.get("technology") or [],
        "question_type": "reported" if any(r["asked_in_interview"] for r in reps) else "listed",
        "companies_reported": [{"slug": s, "name": n} for s, n in companies],
        "roles_reported": [{"slug": s, "name": n} for s, n in roles],
        "interview_stages": stages, "years": years,
        "source_count": len({r["url"] for r in reps}),
        "reported_frequency": sum(1 for d in dates if (_d(d) or today) >= window_start),
        "first_seen": min(r["discovered"] for r in reps),
        "last_seen": max(r.get("last_seen") or r["discovered"] for r in reps),
        "latest_source_date": max((r["source_date"] for r in reps if r.get("source_date")), default=None),
        "freshness": freshness(dates, today),
        "sources": sorted(({
            "url": r["url"], "title": r["source_title"],
            "type": r["source_type"], "type_label": sources.SOURCE_TYPES.get(r["source_type"], "Public web page"),
            "source_date": r.get("source_date"), "retrieved": r["discovered"],
            "company": r["company_name"], "role": r["role_name"], "stage": r["interview_stage"],
            "asked_in_interview": r["asked_in_interview"],
        } for r in reps), key=lambda s: (s["source_date"] or s["retrieved"]), reverse=True),
        "bank_matches": sorted({(m["id"], m["title"]) for r in reps for m in r.get("bank_matches") or []})[:3],
        "prep": prep,
    }


def approved(ledger: dict) -> list[tuple[dict, list[dict]]]:
    docs = authored.load()
    by_q = defaultdict(list)
    for r in ledger["reports"].values():
        if r["status"] == "approved":
            by_q[r["question_id"]].append(r)
    out = []
    for qid, reps in by_q.items():
        q = ledger["questions"].get(qid)
        if q and q["status"] == "approved":
            mine = authored.for_question(q, docs)
            if mine:                       # authored material wins over generated
                q = dict(q, prep=mine, prep_for=enrich.text_hash(q))
            out.append((q, reps))
    return out


def trends(pairs, today: _dt.date) -> dict:
    out = {}
    for days in config.TREND_WINDOWS:
        cur_from = today - _dt.timedelta(days=days)
        prev_from = today - _dt.timedelta(days=2 * days)
        cur, prev = Counter(), Counter()
        examples = defaultdict(list)
        for q, reps in pairs:
            for r in reps:
                d = _d(report_date(r))
                if not d:
                    continue
                if cur_from < d <= today:
                    cur[topic_of(q)] += 1
                    if q["id"] not in examples[topic_of(q)]:
                        examples[topic_of(q)].append(q["id"])
                elif prev_from < d <= cur_from:
                    prev[topic_of(q)] += 1
        rows = []
        for topic, n in cur.items():
            if n < config.TREND_MIN_COUNT:
                continue
            p = prev.get(topic, 0)
            rows.append({"topic": topic, "reports": n, "previous": p,
                         "direction": "up" if n > p else ("down" if n < p else "flat"),
                         "questions": examples[topic][:5]})
        rows.sort(key=lambda x: (-x["reports"], -(x["reports"] - x["previous"]), x["topic"]))
        out[str(days)] = rows
    return {"label": LABEL_TREND, "windows": out, "min_reports": config.TREND_MIN_COUNT}


def _breakdown(values: list[str]) -> dict:
    c = Counter(v for v in values if v)
    total = sum(c.values())
    rows = [{"name": k, "count": v} for k, v in sorted(c.items(), key=lambda kv: (-kv[1], kv[0]))]
    if total >= config.MIN_REPORTS_FOR_PERCENT:
        for row in rows:
            row["percent"] = round(100 * row["count"] / total)
    return {"total": total, "rows": rows, "percent_shown": total >= config.MIN_REPORTS_FOR_PERCENT}


def _intel_for(items: list[tuple[dict, dict]], today: _dt.date) -> dict:
    """items: (question, report) pairs already filtered to one company (and role)."""
    recent_from = today - _dt.timedelta(days=30)
    topics_recent = {topic_of(q) for q, r in items if (_d(report_date(r)) or today) > recent_from}
    topics_before = {topic_of(q) for q, r in items if (_d(report_date(r)) or today) <= recent_from}
    latest = sorted(items, key=lambda qr: report_date(qr[1]), reverse=True)
    recent_ids = []
    for q, _ in latest:
        if q["id"] not in recent_ids:
            recent_ids.append(q["id"])
    skills = []
    for q, _ in items:
        skills += q.get("technology") or []
        if q.get("prep"):
            skills += q["prep"].get("skills_tested") or []
    return {
        "reports": len(items),
        "questions": len({q["id"] for q, _ in items}),
        "topics": _breakdown([topic_of(q) for q, _ in items]),
        "categories": _breakdown([q["category"] for q, _ in items]),
        "difficulty": _breakdown([q.get("difficulty") for q, _ in items]),
        "stages": _breakdown([r["interview_stage"] for _, r in items]),
        "skills": _breakdown(skills),
        "recent_questions": recent_ids[:10],
        "new_topics_last_30_days": sorted(topics_recent - topics_before),
        "latest_report": report_date(latest[0][1]) if latest else None,
    }


def intel(pairs, today: _dt.date) -> dict:
    per_company = defaultdict(list)
    names = {}
    for q, reps in pairs:
        for r in reps:
            if r["company"]:
                per_company[r["company"]].append((q, r))
                names[r["company"]] = r["company_name"]
    companies = {}
    for slug in sorted(set(config.FEATURED_COMPANIES) | set(per_company)):
        items = per_company.get(slug, [])
        display = config.COMPANIES[slug][0] if slug in config.COMPANIES else names.get(slug, slug)
        roles = defaultdict(list)
        role_names = {}
        for q, r in items:
            if r["role"]:
                roles[r["role"]].append((q, r))
                role_names[r["role"]] = r["role_name"]
        companies[slug] = {
            "name": display, "featured": slug in config.COMPANIES,
            "summary": _intel_for(items, today),
            "roles": {rs: {"name": role_names[rs], **_intel_for(rows, today)} for rs, rows in sorted(roles.items())},
        }
    return {"label": LABEL_INTEL, "min_reports_for_percent": config.MIN_REPORTS_FOR_PERCENT, "companies": companies}


def queue(ledger: dict) -> dict:
    pending = [r for r in ledger["reports"].values() if r["status"] == "pending"]
    pending.sort(key=lambda r: (-r["confidence"], r["discovered"], r["id"]))
    items = []
    for r in pending:
        q = ledger["questions"].get(r["question_id"]) or {}
        others = [x for x in ledger["reports"].values()
                  if x["question_id"] == r["question_id"] and x["id"] != r["id"] and x["status"] == "approved"]
        items.append({**r, "canonical": {k: q.get(k) for k in ("id", "title", "question", "status", "category",
                                                                "subcategory", "difficulty", "technology")},
                      "canonical_approved_reports": len(others)})
    decided = sorted((r for r in ledger["reports"].values() if r["status"] != "pending" and r.get("decided_at")),
                     key=lambda r: (r["decided_at"] or "", r["id"]), reverse=True)[:40]
    live_q = [q for q in ledger["questions"].values() if q["status"] in ("approved", "pending")]
    auto = sorted((r for r in ledger["reports"].values()
                   if r["status"] == "approved" and str(r.get("decided_by") or "").startswith("auto")),
                  key=lambda r: (r.get("decided_at") or "", r["id"]), reverse=True)[:60]
    auto_items = []
    for r in auto:
        q = ledger["questions"].get(r["question_id"]) or {}
        auto_items.append({k: r.get(k) for k in ("id", "question_id", "confidence", "band", "company_name",
                                                  "role_name", "source_type", "source_title", "url",
                                                  "decided_at", "decided_by")}
                          | {"title": q.get("title"), "question": q.get("question")})
    return {
        "pending": items,
        "auto_approved": auto_items,
        "auto_threshold": config.AUTO_PUBLISH_MIN_CONFIDENCE,
        "recently_decided": [{k: r.get(k) for k in ("id", "question_id", "status", "decided_by", "decided_at",
                                                     "decision_note", "url")} for r in decided],
        "merge_targets": sorted(({"id": q["id"], "title": q["title"], "status": q["status"],
                                  "category": q["category"]} for q in live_q), key=lambda x: x["title"]),
        "categories": config.CATEGORIES, "difficulties": config.DIFFICULTIES, "stages": config.STAGES,
        "companies": {s: c[0] for s, c in config.COMPANIES.items()},
    }


def build(ledger: dict, today: _dt.date, health: dict | None = None) -> dict:
    pairs = approved(ledger)
    questions = [public_question(q, reps, today) for q, reps in pairs]
    questions.sort(key=lambda x: (x["last_seen"], x["source_count"], x["id"]), reverse=True)
    stamp = today.isoformat()
    store.write_json(config.PUBLIC_DIR / "questions.json",
                     {"generated": stamp, "label": "Reported interview questions, rewritten as PaddySpeaks practice questions.",
                      "questions": questions}, indent=None)
    store.write_json(config.PUBLIC_DIR / "trending.json", {"generated": stamp, **trends(pairs, today)}, indent=None)
    store.write_json(config.PUBLIC_DIR / "intel.json", {"generated": stamp, **intel(pairs, today)}, indent=None)
    store.write_json(config.ADMIN_QUEUE, {"generated": stamp, "health": health or {}, **queue(ledger)})
    return {"published_questions": len(questions),
            "pending_reports": sum(1 for r in ledger["reports"].values() if r["status"] == "pending")}

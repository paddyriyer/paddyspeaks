"""One discovery pass (brief §16), from SEARCH API down to ADMIN REVIEW.

    queries.plan → provider.search → sources filter → classify → extract
    → extract.check → normalise → dedupe → confidence → ledger (pending)

Every source passes through `seen`, so it is paid for once. Every outcome —
including "skipped" and "rejected by the classifier" — is recorded there,
because the reason a URL is not on the site is as auditable as the reason
one is.
"""
from __future__ import annotations

import datetime as _dt

from . import classify_rules, config, confidence, dedupe, extract, normalize, queries, sources, store
from .providers import SearchResult


class Stats(dict):
    def bump(self, key: str, n: int = 1) -> None:
        self[key] = self.get(key, 0) + n


def search_all(provider, plan: list[queries.Query], stats: Stats, errors: list[str]) -> list[SearchResult]:
    found: dict[str, SearchResult] = {}
    for q in plan:
        try:
            rows = provider.search(q, config.RESULTS_PER_QUERY)
        except Exception as e:  # noqa: BLE001 - one failed query never sinks a run
            errors.append(f"search {q.as_operator_string()!r}: {type(e).__name__}: {e}"[:300])
            continue
        stats.bump("queries")
        for r in rows:
            stats.bump("results")
            url = sources.canonical_url(r.url)
            if url and url not in found:
                r.url = url
                found[url] = r
    return list(found.values())


def run(provider, model, ledger: dict, seen: dict, bank: list[dict], today: _dt.date,
        plan: list[queries.Query] | None = None) -> dict:
    iso = today.isoformat()
    stats, errors = Stats(), []
    results = search_all(provider, plan if plan is not None else queries.plan(today), stats, errors)
    adj = dedupe.Adjudicator(model)
    classified = extracted = 0

    for r in results:
        url = r.url
        prior = seen["urls"].get(url)
        if prior:
            prior["last_seen"] = iso
            for rep in ledger["reports"].values():
                if rep["url"] == url:
                    rep["last_seen"] = iso
            stats.bump("already_seen")
            continue
        entry = {"first_seen": iso, "last_seen": iso, "outcome": None, "class": None}
        seen["urls"][url] = entry

        why = sources.blocked_reason(url)
        if why:
            entry["outcome"] = "blocked: " + why
            stats.bump("blocked")
            continue
        text = sources.scrub(normalize.clean(r.text))
        if len(text) < 80:
            entry["outcome"] = "skipped: the provider returned too little text to judge"
            stats.bump("too_short")
            continue
        fp = sources.fingerprint(text)
        if fp in seen["fingerprints"] and seen["fingerprints"][fp] != url:
            entry.update(outcome="duplicate of " + seen["fingerprints"][fp], **{"class": "E"})
            stats.bump("class_E")
            continue
        seen["fingerprints"][fp] = url
        pre = classify_rules.prefilter(r.title, text)
        if pre:
            entry.update(outcome="rejected: " + pre, **{"class": "F"})
            stats.bump("prefilter_rejected")
            continue
        if model is None:
            entry["outcome"] = "deferred: no model configured"
            del seen["urls"][url]           # try again on a run that has a model
            stats.bump("deferred")
            continue
        if classified >= config.MAX_CLASSIFY:
            del seen["urls"][url]
            stats.bump("over_budget")
            continue

        doc = {"url": url, "title": sources.scrub(r.title), "published": r.published, "text": text}
        try:
            classified += 1
            cls = model.classify(doc)
        except Exception as e:  # noqa: BLE001
            errors.append(f"classify {url}: {type(e).__name__}: {e}"[:300])
            del seen["urls"][url]
            continue
        if classify_rules.looks_like_sales(text):
            cls["selling_course"] = True
        entry["class"] = cls["class"]
        stats.bump("class_" + cls["class"])
        decision = classify_rules.should_extract(cls)
        if decision:
            entry["outcome"] = "not extracted: " + decision
            continue
        if extracted >= config.MAX_EXTRACT:
            del seen["urls"][url]
            stats.bump("over_budget")
            continue
        try:
            extracted += 1
            proposed = model.extract(doc)
        except Exception as e:  # noqa: BLE001
            errors.append(f"extract {url}: {type(e).__name__}: {e}"[:300])
            del seen["urls"][url]
            continue

        kept = dropped = 0
        reasons = []
        for p in proposed:
            rec, why_not = extract.check(p, text)
            if not rec:
                dropped += 1
                reasons.append(why_not)
                continue
            if rec["category"] not in config.CATEGORIES:
                dropped += 1
                continue
            conf, parts = confidence.score(cls, rec, r.published)
            if conf < config.DROP_BELOW:
                dropped += 1
                reasons.append(f"confidence {conf} below {config.DROP_BELOW}")
                continue
            rid = store.report_id(url, rec["concept_key"], rec["question"])
            if rid in ledger["reports"]:
                continue
            qid, possible = dedupe.assign(rec, ledger, adj)
            if qid is None:
                qid = dedupe.attach_new(rec, ledger, iso)
            ledger["reports"][rid] = {
                "id": rid, "question_id": qid, "status": "pending",
                "url": url, "source_type": sources.source_type(url),
                "source_title": sources.public_title(url, r.title),
                "source_date": r.published, "discovered": iso, "last_seen": iso,
                "provider": r.provider, "query": r.query,
                "classification": {k: cls.get(k) for k in ("class", "reason", "seo_list", "selling_course",
                                                             "recruiting_ad", "states_specific_questions")},
                "proposed": {k: rec[k] for k in ("question", "title", "concept_key", "category", "subcategory",
                                                  "difficulty", "technology")},
                "asked_in_interview": rec["asked_in_interview"], "evidence": rec["evidence"],
                "company": rec["company"], "company_name": rec["company_name"],
                "company_evidence": rec["company_evidence"],
                "role": rec["role"], "role_name": rec["role_name"], "role_evidence": rec["role_evidence"],
                "interview_stage": rec["interview_stage"], "stage_evidence": rec["stage_evidence"],
                "interview_year": rec["interview_year"],
                "confidence": conf, "confidence_parts": parts, "band": confidence.band(conf),
                "flags": rec["flags"], "notes": rec["notes"],
                "possible_duplicates": possible,
                "bank_matches": dedupe.bank_matches(rec, bank),
                "decided_at": None, "decided_by": None, "decision_note": None,
            }
            kept += 1
            stats.bump("reports_queued")
        entry["outcome"] = f"extracted {kept} question(s)" + (f"; dropped {dropped}: " + "; ".join(sorted(set(reasons)))[:300] if dropped else "")
        stats.bump("questions_dropped", dropped)

    stats["classify_calls"] = classified
    stats["extract_calls"] = extracted
    stats["adjudications"] = adj.used
    return {"stats": dict(stats), "errors": errors}

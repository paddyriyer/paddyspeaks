"""Admin review (brief §9): decisions are files, applied by the pipeline.

The review page (/admin/interview-discovery/) cannot change anything: it is
a static page. It produces a decision file, which reaches the repo as a
commit — so the authority to publish is exactly the authority to write to
the repository, and every decision is in `git log` with its author.

    interviewintel/decisions/<timestamp>.json
    {
      "decided_by": "Paddy",
      "decided_at": "2026-10-07T09:30:00Z",
      "decisions": [
        {"report": "r-…", "action": "approve", "edits": {"title": "…"}, "note": "…"},
        {"report": "r-…", "action": "reject", "note": "a course advert"},
        {"report": "r-…", "action": "merge", "into": "q-…"},
        {"question": "q-…", "action": "merge", "into": "q-…"},
        {"question": "q-…", "action": "reject"}
      ]
    }

Applying is idempotent: the ledger remembers which files it has applied.
"""
from __future__ import annotations

from pathlib import Path

from . import config, normalize, store

QUESTION_FIELDS = ("question", "title", "category", "subcategory", "difficulty", "technology")
REPORT_FIELDS = ("company", "role", "interview_stage", "interview_year")
ACTIONS = ("approve", "reject", "merge")


def _resolve(ledger: dict, qid: str) -> dict | None:
    seen = set()
    q = ledger["questions"].get(qid)
    while q and q["status"] == "merged" and q.get("merged_into") and q["id"] not in seen:
        seen.add(q["id"])
        q = ledger["questions"].get(q["merged_into"])
    return q


def _edit_question(q: dict, edits: dict, errors: list[str]) -> None:
    for k in QUESTION_FIELDS:
        if k not in edits:
            continue
        v = edits[k]
        if k == "category":
            v = normalize.pick(v, config.CATEGORIES)
            if not v:
                errors.append(f"{q['id']}: category {edits[k]!r} is not in the vocabulary")
                continue
        elif k == "difficulty":
            v = normalize.pick(v, config.DIFFICULTIES)
        elif k == "technology":
            v = normalize.technologies(v if isinstance(v, list) else str(v).split(","))
        else:
            v = normalize.clean(v) or None
        if k in ("question", "title") and not v:
            errors.append(f"{q['id']}: {k} cannot be empty")
            continue
        q[k] = v
        q["edited"] = True


def _edit_report(r: dict, edits: dict) -> None:
    if "company" in edits:
        c = normalize.company(edits["company"])
        r["company"], r["company_name"] = (c if c else (None, None))
        r["company_evidence"] = "set by reviewer" if c else None
    if "role" in edits:
        ro = normalize.role(edits["role"])
        r["role"], r["role_name"] = (ro if ro else (None, None))
        r["role_evidence"] = "set by reviewer" if ro else None
    if "interview_stage" in edits:
        r["interview_stage"] = normalize.pick(edits["interview_stage"], config.STAGES)
        r["stage_evidence"] = "set by reviewer" if r["interview_stage"] else None
    if "interview_year" in edits:
        y = edits["interview_year"]
        r["interview_year"] = y if isinstance(y, int) and 2000 <= y <= 2100 else None


def _stamp(r: dict, who: str, when: str, note) -> None:
    r["decided_by"], r["decided_at"] = who, when
    r["decision_note"] = normalize.clean(note)[:300] if note else None


def _settle(ledger: dict, qid: str) -> None:
    """A question with no live report left is rejected (or stays merged)."""
    q = ledger["questions"].get(qid)
    if not q or q["status"] == "merged":
        return
    reports = [r for r in ledger["reports"].values() if r["question_id"] == qid]
    if any(r["status"] == "approved" for r in reports):
        q["status"] = "approved"
    elif any(r["status"] == "pending" for r in reports):
        q["status"] = "pending"
    else:
        q["status"] = "rejected"


def apply(ledger: dict, doc: dict) -> list[str]:
    errors: list[str] = []
    who = normalize.clean(doc.get("decided_by")) or "reviewer"
    when = normalize.clean(doc.get("decided_at")) or None
    for d in doc.get("decisions") or []:
        action = d.get("action")
        if action not in ACTIONS:
            errors.append(f"unknown action {action!r}")
            continue
        edits = d.get("edits") or {}
        if d.get("question"):
            q = ledger["questions"].get(d["question"])
            if not q:
                errors.append(f"unknown question {d['question']}")
                continue
            if edits:
                _edit_question(q, edits, errors)
            targets = [r for r in ledger["reports"].values() if r["question_id"] == q["id"]]
            if action == "merge":
                into = _resolve(ledger, d.get("into") or "")
                if not into or into["id"] == q["id"] or into["status"] == "rejected":
                    errors.append(f"{q['id']}: cannot merge into {d.get('into')!r}")
                    continue
                for r in targets:
                    r["question_id"] = into["id"]
                    if r["status"] == "pending":
                        r["status"] = "approved"
                        _stamp(r, who, when, d.get("note"))
                q["status"], q["merged_into"] = "merged", into["id"]
                _settle(ledger, into["id"])
            else:
                for r in targets:
                    if r["status"] == "pending":
                        r["status"] = "approved" if action == "approve" else "rejected"
                        _stamp(r, who, when, d.get("note"))
                _settle(ledger, q["id"])
            continue

        r = ledger["reports"].get(d.get("report") or "")
        if not r:
            errors.append(f"unknown report {d.get('report')!r}")
            continue
        _edit_report(r, edits)
        q = _resolve(ledger, r["question_id"])
        if q and any(k in edits for k in QUESTION_FIELDS):
            _edit_question(q, edits, errors)
        old = r["question_id"]
        if action == "merge":
            into = _resolve(ledger, d.get("into") or "")
            if not into or into["status"] == "rejected":
                errors.append(f"{r['id']}: cannot merge into {d.get('into')!r}")
                continue
            r["question_id"], r["status"] = into["id"], "approved"
            _stamp(r, who, when, d.get("note"))
            _settle(ledger, into["id"])
            if old != into["id"]:
                oq = ledger["questions"].get(old)
                if oq and not [x for x in ledger["reports"].values()
                               if x["question_id"] == old and x["status"] != "rejected"]:
                    oq["status"], oq["merged_into"] = "merged", into["id"]
            continue
        if q and q["id"] != old:
            r["question_id"] = q["id"]
        r["status"] = "approved" if action == "approve" else "rejected"
        _stamp(r, who, when, d.get("note"))
        _settle(ledger, r["question_id"])
    return errors


def apply_pending_files(ledger: dict, directory: Path | None = None) -> tuple[list[str], list[str]]:
    directory = directory or config.DECISIONS_DIR
    applied = ledger.setdefault("applied_decisions", [])
    done, errors = [], []
    for f in sorted(directory.glob("*.json")):
        if f.name in applied:
            continue
        doc = store.read_json(f, None)
        if not isinstance(doc, dict):
            errors.append(f"{f.name}: not a JSON object")
            continue
        errors += [f"{f.name}: {e}" for e in apply(ledger, doc)]
        applied.append(f.name)
        done.append(f.name)
    return done, errors


def auto_publish(ledger: dict, threshold: int | None = -1, when: str | None = None) -> int:
    """Brief §9: approve unflagged, non-duplicate pending reports at or above
    the threshold (config.AUTO_PUBLISH_MIN_CONFIDENCE; never below 50)."""
    if threshold == -1:
        threshold = config.AUTO_PUBLISH_MIN_CONFIDENCE
    if threshold is None:
        return 0
    n = 0
    for r in ledger["reports"].values():
        if (r["status"] == "pending" and r["confidence"] >= max(threshold, config.BAND_REVIEW)
                and not r["flags"] and not r["possible_duplicates"]):
            r["status"] = "approved"
            _stamp(r, f"auto (confidence ≥ {threshold})", when, None)
            _settle(ledger, r["question_id"])
            n += 1
    return n

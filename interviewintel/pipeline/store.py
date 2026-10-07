"""The interview database (brief §15, §16): interviewintel/data/ledger.json.

Two tables, kept as JSON so `git log` is the audit trail:

  questions  one canonical practice question per problem (brief §7)
  reports    one per (source URL, question): where it was reported, what the
             source supports, and its own review status

Nothing is ever deleted (brief §13). A rejected report stays, marked
rejected, so the same URL is never re-queued; a merged question stays,
pointing at the question it was merged into.

`seen.json` records every URL the pipeline has processed, with its outcome,
so a result returned by tomorrow's search is not classified (and paid for)
twice.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

from . import config


def read_json(path: Path, fallback):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return fallback


def write_json(path: Path, obj, indent: int | None = 1) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=indent, sort_keys=True, ensure_ascii=False) + "\n", encoding="utf-8")


def empty_ledger() -> dict:
    return {"version": 1, "questions": {}, "reports": {}}


def load_ledger(path: Path = config.LEDGER) -> dict:
    led = read_json(path, empty_ledger())
    led.setdefault("questions", {})
    led.setdefault("reports", {})
    return led


def load_seen(path: Path = config.SEEN) -> dict:
    s = read_json(path, {"urls": {}, "fingerprints": {}})
    s.setdefault("urls", {})
    s.setdefault("fingerprints", {})
    return s


def _h(*parts: str, n: int = 10) -> str:
    return hashlib.sha1("\x1f".join(parts).encode("utf-8")).hexdigest()[:n]


def question_id(concept_key: str, question: str) -> str:
    return "q-" + _h(concept_key or question.lower())


def report_id(url: str, concept_key: str, question: str) -> str:
    return "r-" + _h(url, concept_key or question.lower(), n=12)


def new_question(rec: dict, today: str) -> dict:
    return {
        "id": question_id(rec["concept_key"], rec["question"]),
        "title": rec["title"], "question": rec["question"], "concept_key": rec["concept_key"],
        "category": rec["category"], "subcategory": rec["subcategory"],
        "difficulty": rec["difficulty"], "technology": rec["technology"],
        "status": "pending", "merged_into": None, "created": today,
        "edited": False, "prep": None, "prep_for": None,
    }


def live_reports(ledger: dict, qid: str, statuses=("approved",)) -> list[dict]:
    return [r for r in ledger["reports"].values() if r["question_id"] == qid and r["status"] in statuses]

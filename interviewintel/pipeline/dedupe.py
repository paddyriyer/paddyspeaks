"""Semantic deduplication (brief §7).

The same question appears hundreds of times in different words. Each new
report is matched against every live canonical question:

  similarity ≥ SIM_SAME and same category  → attach to that question
  SIM_MAYBE ≤ similarity < SIM_SAME        → ask the model (`same`); if it says
                                              yes, attach; otherwise, or with no
                                              model, list it as a possible
                                              duplicate for the reviewer to merge
  below                                     → a new canonical question

Similarity is the better of the two questions' wording and their concept
keys (normalize.similarity). It is lexical and explainable; the model only
breaks ties, so a run without a model still deduplicates the obvious cases.
"""
from __future__ import annotations

from . import config, normalize, store


def _score(rec: dict, q: dict) -> float:
    s = normalize.similarity(rec["question"], q["question"])
    if rec.get("concept_key") and q.get("concept_key"):
        s = max(s, normalize.similarity(rec["concept_key"], q["concept_key"]))
    return s


def candidates(rec: dict, ledger: dict, limit: int = 5) -> list[tuple[float, dict]]:
    scored = []
    for q in ledger["questions"].values():
        if q["status"] in ("rejected", "merged"):
            continue
        s = _score(rec, q)
        if s >= config.SIM_MAYBE:
            scored.append((s, q))
    scored.sort(key=lambda t: (-t[0], t[1]["id"]))
    return scored[:limit]


class Adjudicator:
    """Wraps the model's `same` with a per-run budget and a memo."""

    def __init__(self, model, budget: int = config.MAX_ADJUDICATE):
        self.model, self.budget, self.used, self.memo = model, budget, 0, {}

    def same(self, a: str, b: str) -> bool | None:
        key = (a, b)
        if key in self.memo:
            return self.memo[key]
        if self.model is None or self.used >= self.budget:
            return None
        self.used += 1
        try:
            ans = bool(self.model.same(a, b))
        except Exception:  # noqa: BLE001 - a failed tie-break leaves it to the reviewer
            ans = None
        self.memo[key] = ans
        return ans


def assign(rec: dict, ledger: dict, adj: Adjudicator) -> tuple[str | None, list[dict]]:
    """(question id to attach to, or None for a new question; possible duplicates)."""
    possible = []
    for s, q in candidates(rec, ledger):
        if s >= config.SIM_SAME and q["category"] == rec["category"]:
            return q["id"], []
        verdict = adj.same(rec["question"], q["question"])
        if verdict:
            return q["id"], []
        possible.append({"id": q["id"], "similarity": s, "title": q["title"],
                         "question": q["question"],
                         "how": "model said different" if verdict is False else "lexical match, unadjudicated"})
    return None, possible


def bank_matches(rec: dict, bank: list[dict], limit: int = 3) -> list[dict]:
    """Questions already in the PaddySpeaks bank on the same concept (information only)."""
    key = rec.get("concept_key") or rec["question"]
    hits = []
    for b in bank:
        title = b.get("title") or ""
        s = normalize.similarity(key, title)
        if s >= 0.8:
            hits.append({"id": b.get("id"), "title": title, "similarity": s})
    hits.sort(key=lambda h: (-h["similarity"], h["id"] or ""))
    return hits[:limit]


def attach_new(rec: dict, ledger: dict, today: str) -> str:
    q = store.new_question(rec, today)
    # Two different concepts hashing to an existing id is astronomically
    # unlikely; a re-proposal of the same concept simply reuses its question.
    ledger["questions"].setdefault(q["id"], q)
    return q["id"]

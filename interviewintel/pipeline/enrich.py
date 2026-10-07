"""AI enrichment (brief §5): preparation material for APPROVED questions only.

The material is PaddySpeaks', written by a model, and is labelled so
everywhere. It must never claim to come from the interview or the candidate;
`validate` rejects material that does (the phrases below), and a rejected
piece of material is simply not published — the question still is, with an
honest "preparation material not written yet".

Material is tied to the exact question text it was written for (`prep_for`):
editing a question in review invalidates its material, which is rewritten
on the next run.
"""
from __future__ import annotations

import hashlib
import re

from . import config, normalize

# Phrases that would present AI material as source-derived.
CLAIMS = re.compile(
    r"\b(the (?:original )?candidate (?:said|answered|wrote|used|was told)|the interviewer (?:said|wanted|told|expected)|"
    r"in the (?:original|actual|real) interview|as reported by|according to the (?:post|candidate|author)|"
    r"the author (?:said|answered|was asked)|this is (?:the|their) (?:actual|exact) answer)\b", re.I)


def text_hash(q: dict) -> str:
    return hashlib.sha1((q["question"] + "\x1f" + q["category"]).encode("utf-8")).hexdigest()[:12]


def _strs(v, n: int, limit: int = 600) -> list[str]:
    return [normalize.clean(x)[:limit] for x in (v or []) if normalize.clean(x)][:n]


def validate(raw: dict) -> tuple[dict | None, str]:
    blob = " ".join(str(v) for v in raw.values())
    m = CLAIMS.search(blob)
    if m:
        return None, f"claims to come from the source: {m.group(0)!r}"
    sol = raw.get("sample_solution") or {}
    prep = {
        "topic": normalize.clean(raw.get("topic"))[:80],
        "skills_tested": _strs(raw.get("skills_tested"), 8, 80),
        "why_asked": normalize.clean(raw.get("why_asked"))[:1200],
        "hints": _strs(raw.get("hints"), 5),
        "approach": (raw.get("approach") or "").strip()[:5000],
        "sample_solution": {
            "language": normalize.clean(sol.get("language"))[:40],
            "code": (sol.get("code") or "").rstrip()[:14000],
            "explanation": (sol.get("explanation") or "").strip()[:5000],
        },
        "common_mistakes": _strs(raw.get("common_mistakes"), 6),
        "follow_ups": _strs(raw.get("follow_ups"), 6),
        "related_concepts": _strs(raw.get("related_concepts"), 8, 80),
        "estimated_minutes": raw.get("estimated_minutes") if isinstance(raw.get("estimated_minutes"), int)
        and 1 <= raw["estimated_minutes"] <= 180 else None,
        "similar_questions": [
            {"question": normalize.clean(s.get("question"))[:600], "what_changes": normalize.clean(s.get("what_changes"))[:300]}
            for s in (raw.get("similar_questions") or [])[:3] if normalize.clean(s.get("question"))
        ],
    }
    if len(prep["hints"]) < 1 or not prep["approach"]:
        return None, "incomplete: no hints or no approach"
    return prep, ""


def run(model, ledger: dict, today: str, budget: int = config.MAX_ENRICH) -> dict:
    from . import authored   # local import: authored imports this module

    stats = {"enriched": 0, "rejected": 0, "errors": []}
    if model is None:
        return stats
    docs = authored.load()
    todo = [q for q in ledger["questions"].values()
            if q["status"] == "approved" and q.get("prep_for") != text_hash(q)
            and not authored.for_question(q, docs)]       # an authored answer needs no model call
    todo.sort(key=lambda q: q["id"])
    for q in todo[:budget]:
        try:
            raw = model.enrich(q)
        except Exception as e:  # noqa: BLE001
            stats["errors"].append(f"enrich {q['id']}: {type(e).__name__}: {e}"[:300])
            continue
        prep, why = validate(raw)
        if not prep:
            stats["rejected"] += 1
            stats["errors"].append(f"enrich {q['id']}: rejected, {why}")
            q["prep"], q["prep_for"] = None, None
            continue
        prep["generated_by"] = "PaddySpeaks AI"
        prep["model"] = getattr(model, "model", "unknown")
        prep["generated_at"] = today
        q["prep"], q["prep_for"] = prep, text_hash(q)
        stats["enriched"] += 1
    return stats

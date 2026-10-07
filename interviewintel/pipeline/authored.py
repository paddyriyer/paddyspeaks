"""Authored preparation material (interviewintel/prep/<question id>.json).

Answers written deliberately — in a review session rather than by the weekly
run — take precedence over generated ones, are never overwritten by a run,
and cost nothing per run. Each file is tied to the exact question text it
answers: if the question is edited later, the file stops applying and the
question falls back to generated material until the file is updated.

    {"question": "<exact question text>", "written": "YYYY-MM-DD",
     "prep": {<the same fields enrich.py produces>}}

The material is still PaddySpeaks AI material and is labelled as such; it
passes the same validation (enrich.validate) as generated material.
"""
from __future__ import annotations

from pathlib import Path

from . import config, enrich, normalize, store

DIR = config.ROOT / "interviewintel" / "prep"


def load(directory: Path | None = None) -> dict:
    out = {}
    for f in sorted((directory or DIR).glob("q-*.json")):
        doc = store.read_json(f, None)
        if isinstance(doc, dict) and isinstance(doc.get("prep"), dict):
            out[f.stem] = doc
    return out


def for_question(q: dict, docs: dict) -> dict | None:
    doc = docs.get(q["id"])
    if not doc or normalize.clean(doc.get("question")) != normalize.clean(q.get("question")):
        return None
    prep, _ = enrich.validate(doc["prep"])
    if not prep:
        return None
    prep.update(generated_by="PaddySpeaks AI", model="authored", generated_at=doc.get("written"))
    return prep

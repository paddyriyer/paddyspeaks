"""Confidence (brief §8), computed — never asked of the model.

The score is a sum of observable facts about one report, and the breakdown
ships with it so the admin sees exactly why a report scored what it did.

  90–100  a first-person interview account, an explicit question, attribution
  70–89   strong evidence, some metadata missing
  50–69   possible interview question, needs review
  < 50    never published automatically
"""
from __future__ import annotations

from . import config

BASE = {"A": 60, "B": 50, "D": 35}


def score(classification: dict, rec: dict, source_date: str | None) -> tuple[int, list[str]]:
    cls = classification["class"]
    parts: list[tuple[str, int]] = [(f"class {cls} ({config.CLASSES.get(cls, '?')})", BASE.get(cls, 0))]
    if rec["asked_in_interview"]:
        parts.append(("source says it was asked in an interview", 15))
    if rec["company"]:
        parts.append(("company attributed with evidence", 8))
    if rec["role"]:
        parts.append(("role attributed with evidence", 6))
    if rec["interview_stage"]:
        parts.append(("stage attributed with evidence", 4))
    if source_date:
        parts.append(("source date known", 4))
    if rec["interview_year"]:
        parts.append(("interview year stated", 3))
    if classification.get("seo_list"):
        parts.append(("mass-produced list", -10))
    if classification.get("selling_course"):
        parts.append(("sells a course", -10))
    if "too_close_to_source" in rec["flags"]:
        parts.append(("too close to the source wording", -10))
    total = max(0, min(100, sum(v for _, v in parts)))
    return total, [f"{'+' if v >= 0 else ''}{v} {why}" for why, v in parts]


def band(value: int) -> str:
    if value >= config.BAND_PUBLISHABLE:
        return "clear"
    if value >= config.BAND_STRONG:
        return "strong"
    if value >= config.BAND_REVIEW:
        return "review"
    return "low"

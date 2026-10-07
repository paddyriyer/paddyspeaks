"""Question extractor, checked (brief §3, §4, §14).

The model proposes; this module disposes. A proposed question survives only
when its evidence is really in the source. Each attribution — company, role,
stage — survives only when its own evidence is in the source, names the
thing it attributes, and reads as an interview (not a passing mention).

Every decision made here is written into the report's `notes`, so a reviewer
can see why a company became UNKNOWN or a question was dropped.
"""
from __future__ import annotations

import re

from . import config, normalize, sources

INTERVIEW_CUES = re.compile(
    r"interview|interviewed|onsite|on-site|loop|round|screen|screening|asked|assessment|"
    r"oa\b|take[- ]home|hiring manager|panel|recruiter|offer|rejected|got the job|virtual onsite",
    re.I)


def evidence_in(span: str | None, source_text: str) -> bool:
    if not span:
        return False
    s = normalize.norm_for_match(span).strip(" .\"'")
    if len(s) < 8:
        return False
    return s in normalize.norm_for_match(source_text)


def longest_shared_run(a: str, b: str) -> int:
    """Longest run of consecutive words two texts share (case-insensitive)."""
    wa = re.findall(r"[a-z0-9']+", a.lower())
    wb = re.findall(r"[a-z0-9']+", b.lower())
    if not wa or not wb:
        return 0
    best, prev = 0, [0] * (len(wb) + 1)
    for x in wa:
        cur = [0] * (len(wb) + 1)
        for j, y in enumerate(wb, 1):
            if x == y:
                cur[j] = prev[j - 1] + 1
                best = max(best, cur[j])
        prev = cur
    return best


def _attribute(kind, raw_value, span, source_text, resolver, words_for, notes):
    """Return (slug, display, evidence) or (None, None, None) with a note."""
    if not raw_value:
        return None, None, None
    resolved = resolver(raw_value)
    if not resolved:
        return None, None, None
    slug, display = resolved
    if not evidence_in(span, source_text):
        notes.append(f"{kind} '{display}' dropped: its evidence is not in the source")
        return None, None, None
    sp = normalize.norm_for_match(span)
    if not any(normalize._word_in(w, sp) for w in words_for(slug, display)):
        notes.append(f"{kind} '{display}' dropped: its evidence does not name it")
        return None, None, None
    if kind == "company" and not INTERVIEW_CUES.search(sp):
        notes.append(f"company '{display}' dropped: mentioned, but not as the interviewing company")
        return None, None, None
    return slug, display, sources.scrub(span)[: config.EVIDENCE_LIMIT]


def check(proposed: dict, source_text: str) -> tuple[dict | None, str]:
    """Validate one proposed question. Returns (clean record, '') or (None, reason)."""
    notes: list[str] = []
    q = normalize.clean(proposed.get("practice_question"))
    if len(q) < 20:
        return None, "practice question too short"
    if sources.has_personal_data(q):
        return None, "practice question contains personal data"
    if not evidence_in(proposed.get("evidence"), source_text):
        return None, "question evidence not found in the source (unsupported)"
    category = normalize.pick(proposed.get("category"), config.CATEGORIES)
    if not category:
        return None, "category outside the vocabulary"

    co_slug, co_name, co_ev = _attribute("company", proposed.get("company"), proposed.get("company_evidence"),
                                         source_text, normalize.company, normalize.company_aliases, notes)
    ro_slug, ro_name, ro_ev = _attribute("role", proposed.get("role"), proposed.get("role_evidence"),
                                         source_text, normalize.role, normalize.role_words, notes)
    stage = normalize.pick(proposed.get("interview_stage"), config.STAGES)
    stage_ev = None
    if stage:
        if evidence_in(proposed.get("stage_evidence"), source_text):
            stage_ev = sources.scrub(proposed["stage_evidence"])[: config.EVIDENCE_LIMIT]
        else:
            notes.append(f"stage '{stage}' dropped: its evidence is not in the source")
            stage = None

    year = proposed.get("interview_year")
    if isinstance(year, int) and not (2000 <= year <= 2100 and str(year) in source_text):
        notes.append(f"interview year {year} dropped: not stated in the source")
        year = None
    elif not isinstance(year, int):
        year = None

    copied = longest_shared_run(q, source_text)
    flags = []
    if copied > config.COPY_RUN_LIMIT:
        flags.append("too_close_to_source")
        notes.append(f"practice question shares {copied} consecutive words with the source; rewrite before approving")

    if proposed.get("notes"):
        notes.append("extractor: " + sources.scrub(normalize.clean(proposed["notes"]))[:240])

    return {
        "question": q,
        "title": normalize.clean(proposed.get("title"))[:90] or f"{category} — question",
        "concept_key": normalize.clean(proposed.get("concept_key")).lower()[:60],
        "category": category,
        "subcategory": normalize.clean(proposed.get("subcategory"))[:60] or None,
        "difficulty": normalize.pick(proposed.get("difficulty"), config.DIFFICULTIES),
        "technology": normalize.technologies(proposed.get("technology")),
        "asked_in_interview": bool(proposed.get("asked_in_interview")),
        "evidence": sources.scrub(normalize.clean(proposed["evidence"]))[: config.EVIDENCE_LIMIT],
        "company": co_slug, "company_name": co_name, "company_evidence": co_ev,
        "role": ro_slug, "role_name": ro_name, "role_evidence": ro_ev,
        "interview_stage": stage, "stage_evidence": stage_ev,
        "interview_year": year,
        "flags": flags,
        "notes": notes,
    }, ""

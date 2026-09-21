"""Identity, deduplication and repost lineage.

Two different questions, and conflating them is what lets other boards show the
same opening five times and call a six-month-old role "posted today".

  canonical_key  "is this the same POSTING?"  - collapses one opening seen in
                 several places during a single run.
  lineage_key    "is this the same ROLE?"     - survives the employer deleting a
                 requisition and creating a fresh one, which is what makes
                 "reposted 3 times since May" possible.

The lineage is deliberately coarser than the posting. That asymmetry is the
whole feature.
"""
from __future__ import annotations

import hashlib

from .normalize import normalize_location, normalize_title

# Tier order for choosing a winner when one opening arrives from several places.
TIER_RANK = {"ats_api": 0, "employer_feed": 1, "trusted_api": 2, "discovery": 3}


def _sha(*parts: str) -> str:
    return hashlib.sha1("|".join(p or "" for p in parts).encode("utf-8")).hexdigest()


def canonical_key(company_domain: str, requisition_id: str, title: str, location: str) -> str:
    """Identity of a single posting.

    A requisition id is the employer's own primary key, so it wins outright when
    present. Without one, title+location is the best available stand-in - coarse
    enough to collapse "Remote - US" duplicates, specific enough not to merge two
    genuinely different openings on the same team.
    """
    if requisition_id:
        return _sha(company_domain, "req", str(requisition_id))
    return _sha(company_domain, "tl", normalize_title(title), normalize_location(location))


def lineage_key(company_domain: str, title: str, location: str, department: str) -> str:
    """Identity of a role across reposts. Never includes the requisition id."""
    return _sha(company_domain, normalize_title(title), normalize_location(location),
                (department or "").strip().lower())


def job_id(canonical: str) -> str:
    return "j" + canonical[:15]


def dedupe(records: list[dict]) -> tuple[list[dict], list[dict]]:
    """Collapse one opening seen several times into a single record.

    Returns (kept, absorbed). The winner is the most authoritative source, then
    the shortest apply-URL redirect chain, then the longest description - i.e.
    the copy closest to the employer, tie-broken toward the more complete one.
    Absorbed copies are kept as `also_seen_at` for diagnostics and are never
    rendered as extra results.
    """
    buckets: dict[str, list[dict]] = {}
    for rec in records:
        buckets.setdefault(rec["canonical_key"], []).append(rec)

    kept, absorbed = [], []
    for _, group in buckets.items():
        group.sort(key=lambda r: (
            TIER_RANK.get(r.get("source_type", "discovery"), 9),
            r.get("apply_hops", 0),
            -len(r.get("description", "")),
        ))
        winner, losers = group[0], group[1:]
        if losers:
            winner = dict(winner)
            winner["also_seen_at"] = sorted({l.get("source_url", "") for l in losers if l.get("source_url")})
            absorbed.extend(losers)
        kept.append(winner)
    return kept, absorbed


def jaccard(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


SIMILARITY_THRESHOLD = 0.82


def match_closed_lineage(rec: dict, closed_candidates: list[dict]) -> str | None:
    """Find a lineage for a posting whose lineage_key matched nothing.

    A job whose title or location was lightly reworded gets a new lineage_key,
    which would silently reset its age - exactly the behaviour this product
    exists to prevent. So an unmatched posting is compared against the same
    employer's recently closed roles on description similarity, with the title
    required to agree. Both conditions, because description overlap alone merges
    two roles that share a long boilerplate "about us" block.
    """
    best, best_score = None, 0.0
    my_tokens = rec.get("_tokens") or set()
    my_title = normalize_title(rec.get("job_title", ""))
    for cand in closed_candidates:
        if cand.get("company_domain") != rec.get("company_domain"):
            continue
        if normalize_title(cand.get("job_title", "")) != my_title:
            continue
        score = jaccard(my_tokens, cand.get("_tokens") or set())
        if score > best_score:
            best, best_score = cand, score
    if best and best_score >= SIMILARITY_THRESHOLD:
        return best.get("lineage_key")
    return None

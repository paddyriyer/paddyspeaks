"""The age ledger.

This module owns the one invariant the product is named for:

    first_seen_at is written exactly once per job id and is never updated.

Everything else here exists to serve that. `history.json` carries dates forward
across runs so a rebuild cannot stamp today on a role we have watched for
months; `archive/<YYYY>.json` keeps closed roles permanently, so a repost can be
recognised years later (brief §14 - nothing is ever physically deleted).

The same carry-forward already runs in production in
interview/scripts/build_jobs.py; this is that idea, generalised and given a
lineage.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "jobs" / "data"
HISTORY = DATA / "history.json"
ARCHIVE_DIR = DATA / "archive"

# A job missing from its employer's ATS for this many consecutive runs is
# closed. Two, not one: a single timeout would otherwise close an entire board.
MISS_LIMIT = 2


def _read_json(path: Path, fallback):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return fallback


def write_json(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    # Stable key order and a trailing newline so an unchanged run produces a
    # byte-identical file and the cron commit is genuinely a no-op.
    path.write_text(json.dumps(obj, indent=1, sort_keys=True, ensure_ascii=False) + "\n",
                    encoding="utf-8")


def empty_history() -> dict:
    return {"version": 1, "jobs": {}, "lineages": {}}


def load_history() -> dict:
    h = _read_json(HISTORY, empty_history())
    h.setdefault("jobs", {})
    h.setdefault("lineages", {})
    return h


def save_history(history: dict) -> None:
    write_json(HISTORY, history)


def load_archive(year: str) -> list[dict]:
    return _read_json(ARCHIVE_DIR / f"{year}.json", [])


def archive_jobs(records: list[dict]) -> None:
    """Append closed roles to their year file, replacing an earlier copy.

    Keyed by job id so a role closed, archived, reopened and closed again lands
    once per archive year rather than accumulating near-duplicates.
    """
    by_year: dict[str, list[dict]] = {}
    for rec in records:
        year = (rec.get("closed_at") or rec.get("last_seen_at") or "0000")[:4]
        by_year.setdefault(year, []).append(rec)
    for year, items in by_year.items():
        existing = {r.get("id"): r for r in load_archive(year)}
        for rec in items:
            existing[rec["id"]] = rec
        write_json(ARCHIVE_DIR / f"{year}.json",
                   sorted(existing.values(), key=lambda r: (r.get("closed_at") or "", r.get("id") or "")))


def recent_closed(history: dict, years: tuple[str, ...]) -> list[dict]:
    """Closed roles available for similarity matching (repost detection)."""
    out: list[dict] = []
    for year in years:
        out.extend(load_archive(year))
    return out


def carry_forward(record: dict, history: dict, now_iso: str) -> dict:
    """Apply everything already known about this job id.

    `first_seen_at` comes from the ledger when we have seen this id before and
    is otherwise set now - and then never touched again. `posted_at_original` is
    likewise sticky: an employer that silently blanks its own date later must not
    be allowed to make a role look newer than it is.
    """
    prior = history["jobs"].get(record["id"])
    if prior:
        record["first_seen_at"] = prior["first_seen_at"]
        record["posted_at_original"] = (
            record.get("posted_at_original") or prior.get("posted_at_original") or "")
        if prior.get("posted_at_original"):
            # Keep the earliest date the employer ever published for this role.
            record["posted_at_original"] = min(
                d for d in (record["posted_at_original"], prior["posted_at_original"]) if d)
        record["apply_probe"] = record.get("apply_probe") or prior.get("apply_probe", "")
        record["apply_probe_at"] = record.get("apply_probe_at") or prior.get("apply_probe_at", "")
    else:
        record["first_seen_at"] = now_iso
    record["last_seen_at"] = now_iso
    record["closed_at"] = ""
    return record


def attach_lineage(record: dict, history: dict, now_iso: str) -> dict:
    """Open or continue this role's spell, and count previous runs of it.

    A repost is a NEW spell on an EXISTING lineage. It never rewrites the
    lineage's own first_seen, which is what lets the detail page say
    "reposted 3 times since May" instead of "posted today".
    """
    key = record["lineage_key"]
    lin = history["lineages"].setdefault(key, {"first_seen": now_iso, "spells": []})
    spells = lin["spells"]

    open_spell = next((s for s in spells if not s.get("closed_at") and s["job_id"] == record["id"]), None)
    if open_spell is None:
        spells.append({
            "job_id": record["id"],
            "opened_at": record["first_seen_at"],
            "closed_at": "",
            "requisition_id": record.get("requisition_id", ""),
            "description_hash": record.get("description_hash", ""),
        })

    closed_before = sum(1 for s in spells if s.get("closed_at"))
    record["repost_count"] = closed_before
    record["lineage_first_seen"] = lin["first_seen"]
    record["lineage_spells"] = [
        {"opened_at": s["opened_at"], "closed_at": s.get("closed_at", "")}
        for s in sorted(spells, key=lambda s: s["opened_at"])
    ]
    return record


def close_spell(history: dict, record: dict, now_iso: str) -> None:
    lin = history["lineages"].get(record.get("lineage_key"))
    if not lin:
        return
    for spell in lin["spells"]:
        if spell["job_id"] == record["id"] and not spell.get("closed_at"):
            spell["closed_at"] = now_iso


def remember(history: dict, record: dict) -> None:
    """Persist the sticky fields for this job id."""
    history["jobs"][record["id"]] = {
        "first_seen_at": record["first_seen_at"],
        "last_seen_at": record["last_seen_at"],
        "last_verified_at": record.get("last_verified_at", ""),
        "posted_at_original": record.get("posted_at_original", ""),
        "lineage_key": record["lineage_key"],
        "misses": 0,
        "closed_at": record.get("closed_at", ""),
        "apply_probe": record.get("apply_probe", ""),
        "apply_probe_at": record.get("apply_probe_at", ""),
    }


def record_miss(history: dict, job_id: str) -> int:
    """Count one consecutive absence. Returns the new miss count."""
    entry = history["jobs"].get(job_id)
    if entry is None:
        return 0
    entry["misses"] = int(entry.get("misses") or 0) + 1
    return entry["misses"]

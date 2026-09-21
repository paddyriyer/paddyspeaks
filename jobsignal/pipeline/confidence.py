"""Live-confidence signals and freshness.

The product rule this file exists to enforce: JobSignal never says a job is
fake, never says an employer is dishonest, and never implies intent. It reports
what it observed, with the date it observed it, and lets the candidate decide.

Every signal below is a statement of fact that can be traced to a stored field.
A phrase like "probably a ghost job" has no field behind it and therefore cannot
be produced here.

There is also no parameter on any function in this module that a payment could
influence. That absence is structural, not a policy footnote (brief §21).
"""
from __future__ import annotations

import datetime as _dt

VERIFY_FRESH_HOURS = 6      # the 🟢 window
LONG_RUNNING_DAYS = 60
AGING_DAYS = 30

FRESHNESS_BANDS = (
    (1, "JUST POSTED"),
    (3, "FRESH"),
    (7, "RECENT"),
    (30, "ESTABLISHED"),
    (60, "AGING"),
)


def _parse(ts: str | None):
    if not ts:
        return None
    try:
        return _dt.datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
    except ValueError:
        try:
            return _dt.datetime.combine(_dt.date.fromisoformat(str(ts)[:10]), _dt.time(), _dt.UTC)
        except ValueError:
            return None


def hours_since(ts: str | None, now: _dt.datetime) -> float | None:
    t = _parse(ts)
    if t is None:
        return None
    if t.tzinfo is None:
        t = t.replace(tzinfo=_dt.UTC)
    return (now - t).total_seconds() / 3600.0


def days_since(ts: str | None, now: _dt.datetime) -> int | None:
    h = hours_since(ts, now)
    return None if h is None else int(h // 24)


def freshness_label(job: dict, now: _dt.datetime) -> str:
    """Age band, measured from the oldest date we can actually evidence.

    `posted_at_original` when the employer supplied one, otherwise the day we
    first saw it. Never the day of the most recent crawl - that is the mistake
    the whole product is a reaction to.

    A role that has run before is labelled REPOSTED rather than given a
    freshness band at all. This is the single rule brief §4 is most insistent
    about: when an employer deletes a requisition and republishes the same role,
    the new requisition really is hours old, so every honest age calculation on
    it still produces "JUST POSTED" - and that is precisely the headline the
    candidate must not be given. The banner therefore names what actually
    happened, and `lineage_age_days` carries how long the ROLE has been running.
    """
    if int(job.get("repost_count") or 0) >= 1:
        return "REPOSTED"
    anchor = job.get("posted_at_original") or job.get("first_seen_at")
    d = days_since(anchor, now)
    if d is None:
        return "AGE UNKNOWN"
    for limit, label in FRESHNESS_BANDS:
        if d < limit:
            return label
    return "LONG RUNNING"


def age_days(job: dict, now: _dt.datetime) -> int | None:
    """Age of THIS posting."""
    return days_since(job.get("posted_at_original") or job.get("first_seen_at"), now)


def lineage_age_days(job: dict, now: _dt.datetime) -> int | None:
    """Age of the ROLE, across every posting of it we have ever seen."""
    return days_since(job.get("lineage_first_seen") or job.get("first_seen_at"), now)


def status_for(job: dict, now: _dt.datetime) -> str:
    """🟢 live / 🟡 recent / ⚪ unverified / 🔴 closed."""
    if job.get("closed_at"):
        return "closed"
    h = hours_since(job.get("last_verified_at"), now)
    if h is None:
        return "unverified"
    return "live" if h <= VERIFY_FRESH_HOURS else "recent"


def _plural(n: int, noun: str) -> str:
    return f"{n} {noun}" if n == 1 else f"{n} {noun}s"


def _plus(text: str) -> dict:
    return {"kind": "plus", "text": text}


def _warn(text: str) -> dict:
    return {"kind": "warn", "text": text}


def signals(job: dict, now: _dt.datetime) -> list[dict]:
    """The observation list rendered under LIVE CONFIDENCE on a card and page."""
    out: list[dict] = []
    ats = job.get("ats_provider") or ""

    if job.get("source_type") == "ats_api":
        label = ats.replace("smartrecruiters", "SmartRecruiters").title() if ats else "the employer"
        out.append(_plus(f"Listed on the employer's own hiring system ({label})"))

    h = hours_since(job.get("last_verified_at"), now)
    if h is not None:
        if h < 1:
            out.append(_plus(f"Verified {_plural(max(1, int(h * 60)), 'minute')} ago"))
        elif h <= VERIFY_FRESH_HOURS:
            out.append(_plus(f"Verified {_plural(int(h), 'hour')} ago"))
        else:
            out.append(_warn(f"Last verified {_plural(int(h), 'hour')} ago"))

    probe = job.get("apply_probe") or ""
    if probe == "http_ok":
        out.append(_plus("Application page responded when we checked it"))
    elif probe == "http_error":
        out.append(_warn("Application page did not respond when we last checked it"))

    if job.get("requisition_id"):
        out.append(_plus(f"Requisition {job['requisition_id']}"))
    else:
        out.append(_warn("No requisition number published"))

    if job.get("apply_hops", 0) == 0:
        out.append(_plus(f"Apply goes directly to {job.get('apply_url_host', 'the employer')}"))
    else:
        out.append(_warn(f"Application link passes through {job['apply_hops']} redirect(s)"))

    if job.get("posted_at_original"):
        d = days_since(job["posted_at_original"], now)
        out.append(_plus(f"Employer's own posting date available ({job['posted_at_original']})"))
        if d is not None and d >= LONG_RUNNING_DAYS:
            out.append(_warn(f"Open for {_plural(d, 'day')}"))
    else:
        out.append(_warn("Employer did not publish an original posting date"))
        d = days_since(job.get("first_seen_at"), now)
        if d is not None and d >= LONG_RUNNING_DAYS:
            out.append(_warn(f"First seen {_plural(d, 'day')} ago"))

    reposts = int(job.get("repost_count") or 0)
    if reposts == 0:
        out.append(_plus("No previous run of this role detected"))
    else:
        since = job.get("lineage_first_seen") or ""
        tail = f" since {since[:7]}" if since else ""
        out.append(_warn(f"Similar posting has appeared {reposts + 1} times{tail}"))

    if job.get("salary_min") and job.get("salary_max"):
        out.append(_plus("Salary range published"))

    return out


def confidence_level(signal_list: list[dict], job: dict, now: _dt.datetime) -> str:
    """HIGH / MEDIUM / CAUTION, from the signal list alone.

    Two rules sit above the count, because they are the two cases where a
    cheerful score would be actively misleading: a job we cannot currently
    verify is never HIGH, and a role that has been reposted repeatedly is always
    at least flagged, however many positives it also carries.
    """
    warns = sum(1 for s in signal_list if s["kind"] == "warn")
    pluses = sum(1 for s in signal_list if s["kind"] == "plus")

    reposts = int(job.get("repost_count") or 0)
    if status_for(job, now) == "unverified":
        return "caution"
    if reposts >= 2:
        return "caution"
    if reposts == 1:
        # One previous run is not evidence of anything improper, and must not be
        # reported as though it were. But it is a fact the candidate should weigh
        # before spending an application, so it caps the headline at MEDIUM
        # rather than letting the positives carry the job to HIGH.
        return "medium"
    if warns == 0 and pluses >= 4:
        return "high"
    if warns >= 3:
        return "caution"
    if warns <= 1 and pluses >= 4:
        return "high"
    return "medium"


def annotate(job: dict, now: _dt.datetime) -> dict:
    """Attach every derived display value. The browser computes none of this."""
    job["status"] = status_for(job, now)
    sig = signals(job, now)
    job["confidence_signals"] = sig
    job["confidence_level"] = confidence_level(sig, job, now)
    job["freshness"] = freshness_label(job, now)
    job["age_days"] = age_days(job, now)
    job["lineage_age_days"] = lineage_age_days(job, now)
    return job

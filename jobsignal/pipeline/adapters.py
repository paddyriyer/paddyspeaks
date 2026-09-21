"""Tier-1 ATS adapters.

Each adapter takes a source registry entry and returns a list of RAW postings:
plain dicts in one shared shape, with values copied from the employer's feed and
nothing invented. Normalisation happens later (normalize.py) so that an adapter
stays a thin, readable mapping from one vendor's JSON to ours — which is what
makes a wrong field obvious in review.

Raw shape
    title, location, department, employment_type, apply_url, requisition_id,
    posted_at (ISO date or ''), description_html/description_text,
    requirements[], preferred[], salary_min, salary_max, currency

Absent data stays absent. An adapter never fills a blank with a guess: a missing
posted_at becomes '' and the UI says the employer did not supply one, which is
the honest statement and the one §5 of the brief asks for.
"""
from __future__ import annotations

import datetime as _dt
import html
import re

from .http import Fetcher

# Hosts an apply_url is allowed to point at, beyond the employer's own domain.
# Anything else is an aggregator and is rejected in normalize.py.
ATS_HOSTS = (
    "greenhouse.io", "lever.co", "ashbyhq.com", "smartrecruiters.com",
    "workable.com", "recruitee.com", "myworkdayjobs.com", "jobvite.com",
    "icims.com", "bamboohr.com", "applytojob.com",
)

_TAG = re.compile(r"<[^>]+>")
_WS = re.compile(r"[ \t\r\f\v\u00a0\u2007\u202f]+")
_BLANKS = re.compile(r"\n{3,}")


def strip_html(raw: str) -> str:
    """HTML -> plain text, at ingest time.

    Descriptions are third-party text. Reducing them to plain text here, rather
    than sanitising markup in the browser, means no source-derived string is
    ever handed to innerHTML anywhere in the product.
    """
    if not raw:
        return ""
    s = str(raw)
    # Some feeds return HTML that is itself HTML-escaped: Greenhouse's `content`
    # arrives as &lt;div&gt;… rather than <div>…. Stripping tags first finds
    # nothing to strip, and the unescape at the end of this function then turns
    # that escaped markup into *visible* markup on the job page. So unescape up
    # front while the body is still mostly entities, and only when it really is
    # escaped markup — a description that merely quotes a "<" in prose must not
    # have that turned into a tag and deleted.
    for _ in range(2):
        if s.count("&lt;") <= s.count("<"):
            break
        s = html.unescape(s)
    s = re.sub(r"(?is)<(script|style)\b.*?</\1>", " ", s)
    s = re.sub(r"(?i)<br\s*/?>", "\n", s)
    s = re.sub(r"(?i)</(p|div|li|h[1-6]|tr)>", "\n", s)
    s = re.sub(r"(?i)<li\b[^>]*>", "• ", s)
    s = _TAG.sub(" ", s)
    s = html.unescape(s)
    s = _WS.sub(" ", s)
    s = "\n".join(line.strip() for line in s.split("\n"))
    return _BLANKS.sub("\n\n", s).strip()


def _iso_day(value) -> str:
    """Best-effort ISO date from the several shapes ATS vendors use."""
    if not value:
        return ""
    if isinstance(value, (int, float)):
        secs = value / 1000.0 if value > 1e11 else float(value)
        try:
            return _dt.datetime.fromtimestamp(secs, _dt.UTC).date().isoformat()
        except (OverflowError, OSError, ValueError):
            return ""
    text = str(value)[:10]
    try:
        _dt.date.fromisoformat(text)
    except ValueError:
        return ""
    return text


def _raw(**kw) -> dict:
    base = {
        "title": "", "location": "", "department": "", "employment_type": "",
        "apply_url": "", "requisition_id": "", "posted_at": "",
        "description_text": "", "requirements": [], "preferred": [],
        "salary_min": None, "salary_max": None, "currency": "",
    }
    base.update(kw)
    return base


# ───────────────────────── Greenhouse ─────────────────────────
def fetch_greenhouse(src: dict, f: Fetcher) -> list[dict]:
    url = f"https://boards-api.greenhouse.io/v1/boards/{src['ats_slug']}/jobs?content=true"
    data = f.get_json(url)
    out = []
    for j in data.get("jobs", []):
        meta = {str(m.get("name", "")).lower(): m.get("value") for m in (j.get("metadata") or [])}
        dept = ""
        depts = j.get("departments") or []
        if depts:
            dept = depts[0].get("name", "")
        out.append(_raw(
            title=j.get("title", ""),
            location=(j.get("location") or {}).get("name", ""),
            department=dept,
            apply_url=j.get("absolute_url", ""),
            # Greenhouse exposes an internal numeric id plus, on some boards, a
            # human requisition number. Prefer the employer's own number.
            requisition_id=str(meta.get("requisition id") or j.get("requisition_id") or j.get("id") or ""),
            posted_at=_iso_day(j.get("first_published") or j.get("updated_at")),
            description_text=strip_html(j.get("content", "")),
        ))
    return out


# ─────────────────────────── Lever ────────────────────────────
def fetch_lever(src: dict, f: Fetcher) -> list[dict]:
    data = f.get_json(f"https://api.lever.co/v0/postings/{src['ats_slug']}?mode=json")
    out = []
    for j in data if isinstance(data, list) else []:
        cats = j.get("categories") or {}
        # Lever's `lists` are the posting's own bullet blocks; the headings are
        # the employer's words, so requirement vs. nice-to-have is read from
        # them rather than guessed from the prose.
        req, pref = [], []
        for block in j.get("lists") or []:
            head = str(block.get("text", "")).lower()
            items = [strip_html(x) for x in re.findall(r"(?is)<li\b[^>]*>(.*?)</li>", block.get("content", ""))]
            if any(w in head for w in ("preferred", "nice to have", "bonus", "plus")):
                pref.extend(items)
            elif any(w in head for w in ("requirement", "qualification", "you have", "looking for", "skills")):
                req.extend(items)
        out.append(_raw(
            title=j.get("text", ""),
            location=cats.get("location", ""),
            department=cats.get("department", "") or cats.get("team", ""),
            employment_type=cats.get("commitment", ""),
            apply_url=j.get("hostedUrl", ""),
            requisition_id=str(j.get("id") or ""),
            posted_at=_iso_day(j.get("createdAt")),
            description_text=strip_html(j.get("descriptionPlain") or j.get("description", "")),
            requirements=req, preferred=pref,
        ))
    return out


# ─────────────────────────── Ashby ────────────────────────────
def fetch_ashby(src: dict, f: Fetcher) -> list[dict]:
    url = (f"https://api.ashbyhq.com/posting-api/job-board/{src['ats_slug']}"
           "?includeCompensation=true")
    data = f.get_json(url)
    out = []
    for j in data.get("jobs", []):
        lo = hi = None
        cur = ""
        comp = j.get("compensation") or {}
        for tier in comp.get("summaryComponents") or []:
            if str(tier.get("compensationType", "")).lower() != "salary":
                continue
            cur = tier.get("currencyCode") or cur
            for key, target in (("minValue", "lo"), ("maxValue", "hi")):
                v = tier.get(key)
                if isinstance(v, (int, float)):
                    if target == "lo":
                        lo = int(v) if lo is None else min(lo, int(v))
                    else:
                        hi = int(v) if hi is None else max(hi, int(v))
        out.append(_raw(
            title=j.get("title", ""),
            location=j.get("location", ""),
            department=j.get("department", "") or j.get("team", ""),
            employment_type=j.get("employmentType", ""),
            apply_url=j.get("jobUrl") or j.get("applyUrl", ""),
            requisition_id=str(j.get("id") or ""),
            posted_at=_iso_day(j.get("publishedAt")),
            description_text=strip_html(j.get("descriptionHtml") or j.get("descriptionPlain", "")),
            salary_min=lo, salary_max=hi, currency=cur,
        ))
    return out


# ────────────────────── SmartRecruiters ───────────────────────
def fetch_smartrecruiters(src: dict, f: Fetcher, detail_cap: int = 25) -> list[dict]:
    """Listing is one call; full text needs one call per posting.

    Those detail calls are capped, because a 5,000-opening enterprise board
    would otherwise spend an entire run's budget on one employer. Postings past
    the cap are still published — with the listing's own summary rather than
    the full description, which is stated on the job page rather than papered
    over.
    """
    slug = src["ats_slug"]
    out = []
    offset, page = 0, 100
    while True:
        data = f.get_json(
            f"https://api.smartrecruiters.com/v1/companies/{slug}/postings?limit={page}&offset={offset}")
        items = data.get("content") or []
        for j in items:
            loc = j.get("location") or {}
            parts = [loc.get("city"), loc.get("region"), loc.get("country")]
            out.append(_raw(
                title=j.get("name", ""),
                location=", ".join(p for p in parts if p),
                department=(j.get("department") or {}).get("label", ""),
                employment_type=(j.get("typeOfEmployment") or {}).get("label", ""),
                apply_url=(j.get("applyUrl") or j.get("ref") or ""),
                requisition_id=str(j.get("refNumber") or j.get("id") or ""),
                posted_at=_iso_day(j.get("releasedDate")),
            ))
        offset += len(items)
        if len(items) < page or offset >= int(data.get("totalFound") or 0) or offset >= 500:
            break

    for rec in out[:detail_cap]:
        try:
            d = f.get_json(f"https://api.smartrecruiters.com/v1/companies/{slug}/postings/{rec['requisition_id']}")
        except Exception:  # noqa: BLE001 - a missing detail must not drop the posting
            continue
        jd = d.get("jobAd", {}).get("sections", {})
        body = "\n\n".join(
            strip_html((jd.get(k) or {}).get("text", ""))
            for k in ("companyDescription", "jobDescription")
        ).strip()
        rec["description_text"] = body
        quals = strip_html((jd.get("qualifications") or {}).get("text", ""))
        if quals:
            rec["requirements"] = [s for s in (x.strip(" •") for x in quals.split("\n")) if s]
    return out


# ────────────────────────── Workable ──────────────────────────
def fetch_workable(src: dict, f: Fetcher) -> list[dict]:
    data = f.get_json(f"https://apply.workable.com/api/v1/widget/accounts/{src['ats_slug']}")
    out = []
    for j in data.get("jobs", []):
        parts = [j.get("city"), j.get("state"), j.get("country")]
        out.append(_raw(
            title=j.get("title", ""),
            location=", ".join(p for p in parts if p),
            department=j.get("department", ""),
            employment_type=j.get("employment_type", ""),
            apply_url=j.get("application_url") or j.get("url", ""),
            requisition_id=str(j.get("shortcode") or ""),
            posted_at=_iso_day(j.get("published_on") or j.get("created_at")),
            description_text=strip_html(j.get("description", "")),
            requirements=[s for s in strip_html(j.get("requirements", "")).split("\n") if s],
            # `benefits` is deliberately not mapped to `preferred`: benefits are
            # what the employer offers, not what it asks for, and merging them
            # would put "free lunch" under preferred qualifications.
        ))
    return out


# ────────────────────────── Recruitee ─────────────────────────
def fetch_recruitee(src: dict, f: Fetcher) -> list[dict]:
    data = f.get_json(f"https://{src['ats_slug']}.recruitee.com/api/offers/")
    out = []
    for j in data.get("offers", []):
        parts = [j.get("city"), j.get("state_name"), j.get("country")]
        out.append(_raw(
            title=j.get("title", ""),
            location=", ".join(p for p in parts if p),
            department=j.get("department", ""),
            employment_type=j.get("employment_type_code", ""),
            apply_url=j.get("careers_apply_url") or j.get("careers_url", ""),
            requisition_id=str(j.get("id") or ""),
            posted_at=_iso_day(j.get("published_at")),
            description_text=strip_html(j.get("description", "")),
            requirements=[s for s in strip_html(j.get("requirements", "")).split("\n") if s],
        ))
    return out


ADAPTERS = {
    "greenhouse": fetch_greenhouse,
    "lever": fetch_lever,
    "ashby": fetch_ashby,
    "smartrecruiters": fetch_smartrecruiters,
    "workable": fetch_workable,
    "recruitee": fetch_recruitee,
}

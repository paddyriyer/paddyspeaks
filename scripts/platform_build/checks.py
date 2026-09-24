"""Cross-cutting consistency checks run by `build.py check` (and CI).

Each check returns a list of human-readable problems. An empty list is a pass.
They are structural guarantees, not style rules: each one exists because the
audit (docs/PADDYSPEAKS-PLATFORM-AUDIT.md) found the corresponding drift.
"""
from __future__ import annotations

import re
import subprocess
import sys

from .common import ROOT, read_json
from .registry import CATALOG, homepage_deck


def check_catalog_paths() -> list[str]:
    """Every path the catalog names must exist — a catalog entry is a promise."""
    cat = read_json(CATALOG)
    problems = []
    for group, items in cat.items():
        if not isinstance(items, list):
            continue
        for it in items:
            if not isinstance(it, dict) or "path" not in it:
                continue
            p = ROOT / it["path"]
            if it["path"].endswith("/"):
                if not (p / "index.html").exists() and not p.is_dir():
                    problems.append(f"catalog.{group}: '{it['path']}' does not exist")
            elif not p.exists():
                problems.append(f"catalog.{group}: '{it['path']}' does not exist")
    ids = [it.get("id") for items in cat.values() if isinstance(items, list) for it in items if isinstance(it, dict)]
    dup = sorted({i for i in ids if i and ids.count(i) > 1})
    if dup:
        problems.append(f"catalog: duplicate ids {dup}")
    return problems


def check_articles_consistent() -> list[str]:
    """The homepage archive and article_metadata.json describe the same set."""
    meta = read_json("article_metadata.json")
    slugs = {m["slug"] for m in meta}
    problems = []
    seen = set()
    for m in meta:
        if m["slug"] in seen:
            problems.append(f"article_metadata.json: duplicate slug {m['slug']}")
        seen.add(m["slug"])
        if not (ROOT / "articles" / m["slug"]).exists():
            problems.append(f"article_metadata.json: {m['slug']} has no file in articles/")
    cats = {c["id"] for c in read_json(CATALOG)["article_categories"]}
    for m in meta:
        if m["category"] not in cats:
            problems.append(f"article_metadata.json: {m['slug']} has unknown category '{m['category']}'")
    deck_articles = {h[len("articles/"):] for h, _ in homepage_deck() if h.startswith("articles/")}
    for s in sorted(deck_articles - slugs):
        problems.append(f"index.html deck card articles/{s} has no entry in article_metadata.json")
    for s in sorted(slugs - deck_articles):
        problems.append(f"article_metadata.json: {s} has no deck card on the homepage")
    by_slug = {m["slug"]: m["category"] for m in meta}
    for h, c in homepage_deck():
        s = h[len("articles/"):]
        if s in by_slug and by_slug[s] != c:
            problems.append(f"index.html deck card {h} is '{c}' but metadata says '{by_slug[s]}'")
    return problems


def check_filter_counts_are_stamped() -> list[str]:
    """Homepage filter counts must be registry-stamped, never typed."""
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    problems = []
    for m in re.finditer(r'<button class="deck-filter-btn[^"]*" data-filter="([a-z]+)">.*?</button>', html, re.S):
        if "data-ps-stat=" not in m.group(0):
            problems.append(f"index.html: deck filter '{m.group(1)}' count is hand-typed (use data-ps-stat)")
    return problems


def check_interview_counts() -> list[str]:
    """interview/scripts/update_counts.py must have nothing left to rewrite."""
    r = subprocess.run(
        [sys.executable, "interview/scripts/update_counts.py", "--check"],
        cwd=ROOT, capture_output=True, text=True,
    )
    if r.returncode != 0:
        return [line for line in (r.stdout + r.stderr).splitlines() if line.strip()] or ["update_counts.py --check failed"]
    return []


STATUSES = {"verified", "source-noted", "source-not-recorded", "under-review"}
SOURCE_ROLES = {"text", "transliteration", "translation", "commentary", "reference", "data"}
SOURCE_KINDS = {"primary", "secondary", "reference"}
CORRECTION_KINDS = {"factual", "translation", "technical", "data", "statistics", "attribution", "citation"}
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _path_exists(url: str) -> bool:
    path = url.split("#")[0].split("?")[0].lstrip("/")
    if not path:
        return (ROOT / "index.html").exists()
    p = ROOT / path
    return (p / "index.html").exists() if path.endswith("/") else p.exists()


def check_provenance() -> list[str]:
    """Provenance records are honest and complete (docs/PROVENANCE.md)."""
    import datetime
    today = datetime.date.today().isoformat()
    problems = []
    cat = read_json(CATALOG)
    for t in cat["sacred_texts"]:
        f = ROOT / "data" / "provenance" / f"{t['id']}.json"
        if not f.exists():
            problems.append(f"sacred text '{t['id']}' has no data/provenance/{t['id']}.json")
            continue
        rec = read_json(f.relative_to(ROOT))
        where = f"data/provenance/{t['id']}.json"
        if rec.get("id") != t["id"] or rec.get("url") != "/" + t["path"]:
            problems.append(f"{where}: id/url must match the catalog ({t['id']}, /{t['path']})")
        st = rec.get("status")
        if st not in STATUSES:
            problems.append(f"{where}: status '{st}' not in {sorted(STATUSES)}")
        # The honesty rule: 'verified' must name a check of the TEXT against its SOURCE.
        if st == "verified":
            ok = any(v.get("scope") == "text-against-source" and DATE_RE.match(v.get("verifiedOn", ""))
                     for v in rec.get("verification", []))
            if not ok:
                problems.append(f"{where}: status 'verified' needs a verification entry with scope 'text-against-source' and a verifiedOn date")
        if st == "source-not-recorded" and not rec.get("statusNote"):
            problems.append(f"{where}: 'source-not-recorded' must explain itself in statusNote")
        if st == "source-noted" and not rec.get("sources"):
            problems.append(f"{where}: 'source-noted' with no sources")
        for s_ in rec.get("sources", []):
            if s_.get("role") not in SOURCE_ROLES or s_.get("kind") not in SOURCE_KINDS or not s_.get("label"):
                problems.append(f"{where}: source {s_.get('label')!r} needs role in {sorted(SOURCE_ROLES)}, kind in {sorted(SOURCE_KINDS)} and a label")
            u = s_.get("url")
            if u and not (u.startswith("https://") or u.startswith("http://") or (u.startswith("/") and _path_exists(u))):
                problems.append(f"{where}: source url {u!r} is neither http(s) nor an existing site path")
        lr = rec.get("lastReviewed")
        if lr and (not DATE_RE.match(lr) or lr > today):
            problems.append(f"{where}: lastReviewed {lr!r} must be a past YYYY-MM-DD date")
    return problems


def check_corrections() -> list[str]:
    problems = []
    data = read_json("data/corrections.json")
    items = data.get("corrections", [])
    dates = [c.get("date", "") for c in items]
    if dates != sorted(dates, reverse=True):
        problems.append("data/corrections.json: entries must be newest first")
    ids = [c.get("id") for c in items]
    if len(ids) != len(set(ids)):
        problems.append("data/corrections.json: duplicate ids")
    for c in items:
        where = f"data/corrections.json[{c.get('id')}]"
        for k in ("id", "date", "url", "title", "kind", "summary"):
            if not c.get(k):
                problems.append(f"{where}: missing '{k}'")
        if c.get("date") and not DATE_RE.match(c["date"]):
            problems.append(f"{where}: date must be YYYY-MM-DD")
        if c.get("kind") and c["kind"] not in CORRECTION_KINDS:
            problems.append(f"{where}: kind '{c['kind']}' not in {sorted(CORRECTION_KINDS)}")
        for u in [c.get("url", "")] + c.get("also", []):
            if u and not _path_exists(u):
                problems.append(f"{where}: url {u!r} does not exist")
    return problems


BANNED_PRIVACY = re.compile(
    r"\bno (?:tracking|telemetry|analytics)\b|\bnothing (?:is )?uploaded\b|"
    r"\bno server\b(?!-)|runs entirely in your browser\s*[—-]\s*nothing", re.I)
# Places where a banned phrase is accurate or is not a claim about this site:
# an essay about someone else's analytics, a code sample, a local-only tool.
PRIVACY_CLAIM_ALLOW = {
    "articles/part1.html",                       # code comment inside a sample
    "articles/comprehensive-guide-consent-management-multi-level-cohorts.html",
    "articles/build-your-own-analytics-and-debug-it.html",
    "ic-flightdeck/index.html",                  # true: no pixel, no ps.js
    "jobs/js/pages/job.js", "jobs/saved/index.html",  # the pipeline itself is never uploaded
    "jobs/js/data.js", "jobs/js/tracker.js",           # same: describe the pipeline's data, accurately
    "privacy/app.js",                                  # "the paste flow needs no server" — true
    "interview.app/design/the-career-problem.html",    # "no telemetry inside a building" — editorial
}
TRACKER_RE = re.compile(r"/lib/ps\.js|api/px\.gif")


def check_privacy_claims() -> list[str]:
    """No page may promise more privacy than the code keeps (P0.4).

    A page that loads the analytics script or pixel cannot say "no tracking";
    no product page may say "nothing is uploaded" or "no telemetry" unless it
    is on the reviewed allowlist above. The Privacy Console must stay free of
    analytics and must keep its data-flow disclosure.
    """
    from .common import public_html_files, tracked_files
    problems = []
    files = public_html_files() + [f for f in tracked_files("*.js")
                                   if f.startswith(("lib/", "interview.app/js/", "jobs/js/", "careeros/", "privacy/"))]
    for f in files:
        if f in PRIVACY_CLAIM_ALLOW or f.startswith("privacy-agent/"):
            continue
        try:
            text = (ROOT / f).read_text(encoding="utf-8")
        except (UnicodeDecodeError, FileNotFoundError):
            continue
        for m in BANNED_PRIVACY.finditer(text):
            line = text.count("\n", 0, m.start()) + 1
            problems.append(f"{f}:{line}: privacy claim '{m.group(0)}' — see docs/PADDYSPEAKS-PLATFORM-AUDIT.md §12; say what the code actually does")
    pc = (ROOT / "privacy/index.html").read_text(encoding="utf-8")
    if TRACKER_RE.search(pc):
        problems.append("privacy/index.html must not load analytics — the page says it loads none")
    for needle in ('id="data-flow"', "Brave", "Google"):
        if needle not in pc:
            problems.append(f"privacy/index.html: data-flow disclosure is missing '{needle}'")
    return problems


def run_all() -> list[str]:
    problems: list[str] = []
    for fn in (check_catalog_paths, check_articles_consistent,
               check_filter_counts_are_stamped, check_interview_counts,
               check_provenance, check_corrections, check_privacy_claims):
        problems += fn()
    return problems

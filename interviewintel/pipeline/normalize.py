"""Normaliser (brief §16): free text from the model → the site's vocabularies.

Anything that does not map stays as the model said it (companies, roles) or
is dropped (categories, stages, difficulties outside the lists). Nothing is
ever guessed into a value: an unknown stays None.
"""
from __future__ import annotations

import re

from . import config

_WS = re.compile(r"\s+")


def clean(text: str | None) -> str:
    return _WS.sub(" ", (text or "").replace(" ", " ")).strip()


def norm_for_match(text: str) -> str:
    """Lowercase, straight quotes, single spaces: used to look a span up in its source."""
    t = (text or "").lower()
    t = t.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    t = t.replace("–", "-").replace("—", "-").replace("…", "...")
    return _WS.sub(" ", t).strip()


def _word_in(alias: str, text: str) -> bool:
    return re.search(r"(?<![a-z0-9])" + re.escape(alias) + r"(?![a-z0-9])", text) is not None


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", (text or "").lower()).strip("-")[:48]


def company(name: str | None) -> tuple[str, str] | None:
    """(slug, display) for a company name, or None."""
    n = norm_for_match(clean(name))
    if not n or n in ("unknown", "null", "n/a", "none"):
        return None
    for slug, (display, aliases) in config.COMPANIES.items():
        if n == slug or any(n == a for a in aliases):
            return slug, display
    return slugify(n), clean(name)


def company_aliases(slug: str, display: str) -> list[str]:
    if slug in config.COMPANIES:
        return config.COMPANIES[slug][1] + [slug]
    return [norm_for_match(display)]


def role(name: str | None) -> tuple[str, str] | None:
    n = norm_for_match(clean(name))
    if not n or n in ("unknown", "null", "n/a", "none"):
        return None
    n2 = re.sub(r"^(senior|sr\.?|staff|principal|lead|junior|jr\.?|entry[- ]level|new grad)\s+", "", n)
    n2 = re.sub(r"\s+(i{1,3}|iv|l\d|\d)$", "", n2)
    for slug, (display, aliases) in config.ROLES.items():
        if n2 == display.lower() or n2 in aliases:
            return slug, display
    return slugify(n2), clean(name)


def role_words(slug: str, display: str) -> list[str]:
    if slug in config.ROLES:
        return config.ROLES[slug][1] + [config.ROLES[slug][0].lower()]
    return [norm_for_match(display)]


def pick(value: str | None, allowed: list[str]) -> str | None:
    if not value:
        return None
    for a in allowed:
        if a.lower() == str(value).strip().lower():
            return a
    return None


_TECH = {t.lower(): t for t in config.TECHNOLOGIES}


def technologies(values) -> list[str]:
    out = []
    for v in values or []:
        k = clean(str(v)).lower()
        t = _TECH.get(k) or _TECH.get(k.replace(" ", "")) or (clean(str(v)) if 1 < len(k) <= 24 else None)
        if t and t not in out:
            out.append(t)
    return out[:8]


# --- similarity (brief §7) -----------------------------------------------------
# Lexical, deterministic and explainable. Words that every question shares
# ("write a query to find…") are removed; synonyms collapse; a light stemmer
# folds plurals. Borderline pairs go to the model (dedupe.py).
STOP = set("""a an the of to in on for with and or by from at as is are be was were this that these
those it its into using use given write writing query queries sql code function program return returns
returning find finding get getting show list output select each every all any which who whom what how
design implement explain describe you your we our can could would should will please table tables
dataset data one two""".split())
SYNONYMS = {
    "2nd": "second", "3rd": "third", "nth": "nth", "1st": "first",
    "highest": "max", "largest": "max", "maximum": "max", "biggest": "max", "top": "max",
    "lowest": "min", "smallest": "min", "minimum": "min",
    "salaries": "salary", "pay": "salary", "wage": "salary", "wages": "salary", "compensation": "salary",
    "employees": "employee", "staff": "employee", "workers": "employee",
    "customers": "customer", "users": "customer", "user": "customer", "clients": "customer",
    "purchases": "purchase", "orders": "purchase", "order": "purchase", "transactions": "purchase",
    "transaction": "purchase", "bought": "purchase", "purchased": "purchase",
    "consecutive": "consecutive", "straight": "consecutive", "streak": "consecutive", "row": "consecutive",
    "duplicates": "duplicate", "dupes": "duplicate", "deduplicate": "duplicate", "dedupe": "duplicate",
    "remove": "delete", "drop": "delete",
    "days": "day", "daily": "day", "dates": "day", "date": "day",
}


def _stem(w: str) -> str:
    for suf in ("ing", "ed", "es", "s"):
        if len(w) > 4 and w.endswith(suf):
            return w[: -len(suf)]
    return w


def tokens(text: str) -> set[str]:
    t = norm_for_match(text).replace("second-highest", "second highest").replace("-", " ")
    out = set()
    for w in re.findall(r"[a-z0-9]+", t):
        w = SYNONYMS.get(w, w)
        if w in STOP or len(w) < 2:
            continue
        out.add(_stem(w))
    return out


def similarity(a: str, b: str) -> float:
    ta, tb = tokens(a), tokens(b)
    if not ta or not tb:
        return 0.0
    inter = len(ta & tb)
    jacc = inter / len(ta | tb)
    contain = inter / min(len(ta), len(tb))
    # Containment alone over-merges a short question into a long one; require
    # the short side to carry at least two content words before it counts.
    if min(len(ta), len(tb)) < 2:
        contain = jacc
    return round(0.5 * jacc + 0.5 * contain, 3)

"""Normalisation: raw ATS posting -> canonical JobSignal record.

Everything here is extraction, never invention. If a fact is not in the source
it stays empty and the UI says so. In particular:

  * salary is read from a structured field or from an explicit range in the
    employer's own text; it is never estimated from a title or a market average
  * visa sponsorship and security clearance are reported as *mentioned* or
    *not mentioned* - never as "sponsors" or "does not sponsor", because the
    absence of a sentence is not a policy
  * seniority is classified from the title's own words, and falls back to
    'unknown' rather than to a plausible-looking guess
"""
from __future__ import annotations

import hashlib
import re
from urllib.parse import urlsplit

from .adapters import ATS_HOSTS

# ── titles ──────────────────────────────────────────────────────────────
_TITLE_NOISE = re.compile(
    r"\s*[\(\[][^)\]]*[\)\]]|\s*[-–—,|]\s*(remote|hybrid|onsite|on-site|contract|full[- ]time|part[- ]time)\b.*$",
    re.I)
_ROMAN = {" i": " 1", " ii": " 2", " iii": " 3", " iv": " 4", " v": " 5"}
_NON_WORD = re.compile(r"[^a-z0-9+#./ ]+")
_SPACES = re.compile(r"\s+")


def normalize_title(title: str) -> str:
    t = _TITLE_NOISE.sub("", title or "").lower().strip()
    t = _NON_WORD.sub(" ", t)
    t = _SPACES.sub(" ", t).strip()
    for roman, digit in _ROMAN.items():
        if t.endswith(roman):
            t = t[: -len(roman)] + digit
    return t


# ── locations ───────────────────────────────────────────────────────────
_REMOTE_WORDS = ("remote", "work from home", "wfh", "distributed", "anywhere", "virtual")
_HYBRID_WORDS = ("hybrid", "flexible - ", "partially remote")
_US_STATES = {
    "alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR", "california": "CA",
    "colorado": "CO", "connecticut": "CT", "delaware": "DE", "florida": "FL", "georgia": "GA",
    "hawaii": "HI", "idaho": "ID", "illinois": "IL", "indiana": "IN", "iowa": "IA",
    "kansas": "KS", "kentucky": "KY", "louisiana": "LA", "maine": "ME", "maryland": "MD",
    "massachusetts": "MA", "michigan": "MI", "minnesota": "MN", "mississippi": "MS",
    "missouri": "MO", "montana": "MT", "nebraska": "NE", "nevada": "NV",
    "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
    "north carolina": "NC", "north dakota": "ND", "ohio": "OH", "oklahoma": "OK",
    "oregon": "OR", "pennsylvania": "PA", "rhode island": "RI", "south carolina": "SC",
    "south dakota": "SD", "tennessee": "TN", "texas": "TX", "utah": "UT", "vermont": "VT",
    "virginia": "VA", "washington": "WA", "west virginia": "WV", "wisconsin": "WI",
    "wyoming": "WY", "district of columbia": "DC",
}
_COUNTRY_HINTS = {
    "united states": "US", "usa": "US", "u.s.": "US", "us": "US", "canada": "CA",
    "united kingdom": "GB", "uk": "GB", "ireland": "IE", "germany": "DE", "france": "FR",
    "spain": "ES", "netherlands": "NL", "poland": "PL", "india": "IN", "singapore": "SG",
    "australia": "AU", "japan": "JP", "brazil": "BR", "mexico": "MX", "israel": "IL",
}


def remote_status(location: str, description: str = "") -> str:
    blob = f"{location} {description[:1500]}".lower()
    loc = (location or "").lower()
    if any(w in loc for w in _HYBRID_WORDS):
        return "hybrid"
    if any(w in loc for w in _REMOTE_WORDS):
        return "remote"
    if any(w in blob for w in _HYBRID_WORDS):
        return "hybrid"
    if re.search(r"\b(fully|100%)\s+remote\b", blob) or "remote-first" in blob:
        return "remote"
    if loc.strip():
        return "onsite"
    return "unknown"


def parse_location(location: str) -> dict:
    """Split an employer's location string into city / region / country.

    Deliberately conservative: a piece is only promoted to a region or country
    when it matches a known name. An unrecognised string stays in `city`, where
    it is still searchable, rather than being filed somewhere wrong.
    """
    raw = (location or "").strip()
    out = {"city": "", "region": "", "country": ""}
    if not raw:
        return out
    cleaned = re.sub(r"(?i)\b(remote|hybrid|onsite|on-site)\b[\s,\-–—]*", "", raw).strip(" ,-–—")
    parts = [p.strip() for p in re.split(r"\s*[,/|]\s*|\s+-\s+", cleaned) if p.strip()]
    if not parts:
        return out

    # Read from the RIGHT. Locations are written "City, Region, Country", and
    # several US states share a name with their best-known city — "New York, NY"
    # must give city New York, not state New York. Taking the first match would
    # get that backwards, and the lineage key built from it would then treat two
    # spellings of one role as two different roles.
    rest = list(parts)
    if rest and rest[-1].lower() in _COUNTRY_HINTS:
        out["country"] = _COUNTRY_HINTS[rest.pop().lower()]
    if rest:
        tail = rest[-1]
        if re.fullmatch(r"[A-Z]{2}", tail):
            out["region"] = rest.pop()
            out["country"] = out["country"] or "US"
        elif tail.lower() in _US_STATES and len(rest) > 1:
            out["region"] = _US_STATES[rest.pop().lower()]
            out["country"] = out["country"] or "US"
    # A single remaining part stays the city even when it is also a state name.
    # "New York" and "Washington" on their own mean the city far more often than
    # the state in an ATS feed, and promoting them to a region would leave the
    # role with no city at all - unsearchable by the word the employer used.
    out["city"] = rest[0] if rest else ""
    return out


def normalize_location(location: str) -> str:
    p = parse_location(location)
    joined = " ".join(x for x in (p["city"], p["region"], p["country"]) if x).lower()
    return _SPACES.sub(" ", _NON_WORD.sub(" ", joined)).strip()


# ── employment type / seniority / education ─────────────────────────────
def employment_type(raw: str, title: str, description: str) -> str:
    blob = f"{raw} {title}".lower()
    if "intern" in blob and "internal" not in blob:
        return "internship"
    if "part" in blob and "time" in blob:
        return "part_time"
    if any(w in blob for w in ("contract", "contractor", "temporary", "fixed term", "fixed-term")):
        return "contract"
    if any(w in blob for w in ("full time", "full-time", "fulltime", "permanent", "regular")):
        return "full_time"
    low = (description or "").lower()
    if re.search(r"\b(full[- ]time|fulltime|permanent (?:position|role|employment)|"
                 r"salaried (?:position|role)|unbefristet|festanstellung)\b", low):
        return "full_time"
    if re.search(r"\b(part[- ]time|teilzeit)\b", low):
        return "part_time"
    if re.search(r"\b(fixed[- ]term|temporary (?:position|contract)|contractor role)\b", low):
        return "contract"
    return "unknown"


# "Engineer II" / "Engineer 2" carried no level at all before, which is why
# 26% of the board was `unknown`. Roman and arabic suffixes are read; a
# company-specific ladder ("L5", "IC4") deliberately is NOT — those mean
# different things at different employers and guessing would be inventing.
_NUMBERED = re.compile(r"\b(?:[a-z]+)\s+(i{1,3}|iv|v|[1-5])\s*$", re.I)
_NUM_LEVEL = {"i": "entry", "1": "entry", "ii": "mid", "2": "mid",
              "iii": "senior", "3": "senior", "iv": "senior", "4": "senior",
              "v": "senior", "5": "senior"}

_LEVEL_RULES = (
    ("internship", (r"\bintern\b", r"\binternship\b", r"\bco-?op\b",
                    r"\bpraktikum\b", r"\bworking student\b")),
    ("director_plus", (r"\b(vp|vice president|head of|director|chief|cto|cio|cdo)\b",)),
    ("manager", (r"\b(manager|mgr|lead|team lead|supervisor)\b",)),
    ("senior", (r"\b(senior|sr\.?|staff|principal|lead engineer|architect|distinguished)\b",)),
    ("entry", (r"\b(junior|jr\.?|entry[- ]level|associate|graduate|new grad|"
               r"university graduate|early career|apprentice|trainee)\b",)),
)


def experience_level(title: str, description: str = "") -> str:
    """Seniority from the title's own words.

    Title first, because it is the employer's own label and is far less noisy
    than prose. 'Product Manager' is intentionally NOT a people-manager: the
    manager rule runs after the director rule and before senior, and 'product
    manager' / 'program manager' / 'engineering manager' are disambiguated by
    the explicit exception below.
    """
    t = (title or "").lower()
    numbered = _NUMBERED.search(t.split(",")[0].split(" - ")[0])
    for level, patterns in _LEVEL_RULES:
        for pat in patterns:
            if re.search(pat, t):
                if level == "manager" and re.search(r"\b(product|program|project|product marketing)\s+manager\b", t):
                    break  # an IC role whose title happens to contain "manager"
                return level
    if numbered:
        mapped = _NUM_LEVEL.get(numbered.group(1).lower())
        if mapped:
            return mapped
    m = re.search(r"(\d+)\s*\+?\s*(?:-|to)?\s*(\d+)?\s*years?", (description or "")[:4000].lower())
    if m:
        years = int(m.group(1))
        if years >= 8:
            return "senior"
        if years >= 3:
            return "mid"
        if years >= 1:
            return "entry"
    return "unknown"


_EDU = (
    ("phd", r"\b(ph\.?d|doctorate)\b"),
    ("masters", r"\b(master'?s|m\.?s\.?c?\b|mba)\b"),
    ("bachelors", r"\b(bachelor'?s|b\.?s\.?c?\b|b\.?a\.?\b|undergraduate degree)\b"),
)


def education_requirement(description: str) -> str:
    low = (description or "").lower()
    for label, pat in _EDU:
        if re.search(pat, low):
            return label
    return "unspecified"


# ── salary ──────────────────────────────────────────────────────────────
_CUR_SYM = {"$": "USD", "£": "GBP", "€": "EUR", "₹": "INR", "C$": "CAD", "A$": "AUD"}
_RANGE = re.compile(
    r"(?P<sym>[$£€₹]|C\$|A\$)?\s*(?P<lo>\d{2,3}(?:,\d{3})+|\d{2,3}(?:\.\d)?\s*[kK]\b|\d{5,7})"
    r"\s*(?:-|–|—|\bto\b|\band\b)\s*"
    r"(?P<sym2>[$£€₹]|C\$|A\$)?\s*(?P<hi>\d{2,3}(?:,\d{3})+|\d{2,3}(?:\.\d)?\s*[kK]\b|\d{5,7})")
_PAY_CONTEXT = re.compile(
    r"(?i)(salary|compensation|pay range|base pay|base salary|annual|per year|/yr|OTE|cash comp)")


def _to_int(tok: str) -> int | None:
    t = tok.replace(",", "").strip()
    if t.lower().endswith("k"):
        try:
            return int(float(t[:-1]) * 1000)
        except ValueError:
            return None
    try:
        return int(float(t))
    except ValueError:
        return None


def parse_salary(description: str, currency_hint: str = "") -> tuple[int | None, int | None, str]:
    """Pull an explicit annual range out of the employer's own text.

    Only a range that sits near pay wording is accepted, and only if it lands in
    a plausible annual band. This deliberately misses some real salaries rather
    than inventing a wrong one - an absent salary is shown as absent, and 'salary
    disclosed' stays a meaningful filter.
    """
    text = description or ""
    for m in _RANGE.finditer(text):
        window = text[max(0, m.start() - 140): m.end() + 140]
        if not _PAY_CONTEXT.search(window):
            continue
        lo, hi = _to_int(m.group("lo")), _to_int(m.group("hi"))
        if lo is None or hi is None or lo > hi:
            continue
        if not (10_000 <= lo <= 2_000_000 and 10_000 <= hi <= 2_000_000):
            continue
        sym = m.group("sym") or m.group("sym2") or ""
        cur = _CUR_SYM.get(sym, "") or currency_hint or ("USD" if sym == "" and "$" in window else "")
        return lo, hi, cur
    return None, None, ""


# ── flags read from the employer's words ────────────────────────────────
_VISA = re.compile(
    r"(?i)\b(visa sponsorship|sponsor(?:ship)? (?:is )?(?:available|provided|offered)|"
    r"h-?1b|will sponsor|immigration support|work permit support|relocation and visa)\b")
_CLEARANCE = re.compile(
    r"(?i)\b(security clearance|ts/sci|top secret|public trust|secret clearance|"
    r"polygraph|dod clearance)\b")


def mentions(pattern: re.Pattern, *texts: str) -> str:
    return "mentioned" if any(pattern.search(t or "") for t in texts) else "not_mentioned"


# ── skills ──────────────────────────────────────────────────────────────
SKILL_VOCAB = (
    "python", "sql", "java", "scala", "go", "rust", "typescript", "javascript", "c++", "c#",
    "ruby", "kotlin", "swift", "r", "spark", "airflow", "dbt", "kafka", "flink", "snowflake",
    "databricks", "redshift", "bigquery", "postgres", "mysql", "mongodb", "dynamodb",
    "kubernetes", "docker", "terraform", "aws", "gcp", "azure", "pytorch", "tensorflow",
    "langchain", "llm", "nlp", "computer vision", "machine learning", "deep learning",
    "tableau", "looker", "power bi", "figma", "react", "node.js", "graphql", "rest api",
    "ci/cd", "etl", "elt", "data modeling", "experimentation", "a/b testing", "roadmap",
    "stakeholder management", "product strategy", "user research", "accessibility",
    "incident response", "threat modeling", "penetration testing", "siem", "zero trust",
)


def extract_skills(*texts: str, limit: int = 12) -> list[str]:
    blob = " ".join(t or "" for t in texts).lower()
    found = []
    for skill in SKILL_VOCAB:
        pat = r"(?<![a-z0-9])" + re.escape(skill) + r"(?![a-z0-9])"
        if re.search(pat, blob):
            found.append(skill)
        if len(found) >= limit:
            break
    return found


# ── requirements from prose, when the ATS gave us no structure ──────────
_REQ_HEAD = re.compile(
    r"(?im)^\s*(what you.{0,20}(bring|have|ll need)|requirements?|qualifications?|"
    r"minimum qualifications?|basic qualifications?|who you are|about you|you have)\b.*$")
_PREF_HEAD = re.compile(
    r"(?im)^\s*(preferred|nice to have|bonus points?|preferred qualifications?|"
    r"it.?s a plus|plus(?:es)?|additionally helpful)\b.*$")
_BULLET = re.compile(r"^\s*(?:•|[-*–—])\s*")


def split_requirements(description: str) -> tuple[list[str], list[str]]:
    """Section a plain-text description into required vs preferred bullets.

    Only bullet lines under an explicit heading are taken. Prose is left alone,
    so a description without headings yields two empty lists and the job page
    shows the description rather than a bogus checklist.
    """
    lines = (description or "").split("\n")
    req, pref, mode = [], [], None
    for line in lines:
        if _PREF_HEAD.match(line):
            mode = "pref"
            continue
        if _REQ_HEAD.match(line):
            mode = "req"
            continue
        if not line.strip():
            continue
        if mode and _BULLET.match(line):
            item = _BULLET.sub("", line).strip()
            if 3 <= len(item) <= 400:
                (req if mode == "req" else pref).append(item)
        elif mode and not _BULLET.match(line) and len(line.strip()) > 120:
            mode = None  # back into prose; stop collecting
    return req[:25], pref[:25]


# ── apply URL policing ──────────────────────────────────────────────────
def apply_url_ok(apply_url: str, company_domain: str) -> bool:
    """The candidate must land at the employer or its ATS - never an aggregator."""
    host = urlsplit(apply_url or "").netloc.lower().split(":")[0]
    if not host:
        return False
    root = (company_domain or "").lower()
    if root and (host == root or host.endswith("." + root)):
        return True
    return any(host == h or host.endswith("." + h) for h in ATS_HOSTS)


def apply_host(apply_url: str) -> str:
    host = urlsplit(apply_url or "").netloc.lower().split(":")[0]
    return host[4:] if host.startswith("www.") else host


# ── description hash ────────────────────────────────────────────────────
def clean_department(department: str, company_name: str) -> str:
    """Drop a department that is really the company name.

    SmartRecruiters returns the employer as the department, which put 179
    roles in a department called "Ubisoft" — useless as a facet and actively
    misleading beside a real department like "Data Platform".
    """
    d = (department or "").strip()
    if not d:
        return ""
    c = (company_name or "").strip().lower()
    dl = d.lower()
    if c and (dl == c or dl == c + " group" or dl.replace(" ", "") == c.replace(" ", "")):
        return ""
    if dl in {"other", "n/a", "none", "general", "-"}:
        return ""
    return d


def description_hash(description: str) -> str:
    norm = _SPACES.sub(" ", _NON_WORD.sub(" ", (description or "").lower())).strip()
    return hashlib.sha1(norm.encode("utf-8")).hexdigest()[:16]


def description_tokens(description: str) -> set[str]:
    norm = _NON_WORD.sub(" ", (description or "").lower())
    return {w for w in norm.split() if len(w) > 3}

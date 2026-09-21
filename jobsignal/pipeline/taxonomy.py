"""Role families — what kind of job is this, really?

The old search matched shared tokens, so "Sales Engineer" and "Data Engineer"
looked alike. This module gives every posting a `role_family` at ingest, and
the ranker gates on it: a job outside the query's family is not a candidate at
all. That is the whole fix.

Two rules make the classification trustworthy:

1. **Match the role HEAD, not the whole string.** Validating an earlier draft
   against real titles caught "Senior Product Manager - Observability Data
   Platform" being filed under data engineering, because "data platform"
   appeared *somewhere*. The head ("Product Manager") is what the job actually
   is; everything after a comma, dash or bracket is which team it sits in.

2. **Excluded families are named, not just absent.** `sales_engineering` is a
   real family here. Naming it is what stops "Sales Engineer" drifting into
   software_engineering on the word "engineer".

Nothing is invented: a title that matches nothing is `other`, and `other` is
not published. It is never guessed into a family to pad the board.
"""
from __future__ import annotations

import re

# Families JobSignal publishes.
TARGET_FAMILIES = (
    "data_engineering", "data_science", "ml_engineering", "analytics",
    "software_engineering", "infrastructure", "security",
    "product_management", "design_ux",
)

# Families recognised in order to EXCLUDE them.
EXCLUDED_FAMILIES = (
    "sales_engineering", "go_to_market", "marketing_comms",
    "people_ops", "support_ops", "finance_legal_ops", "other",
)

ALL_FAMILIES = TARGET_FAMILIES + EXCLUDED_FAMILIES

FAMILY_LABEL = {
    "data_engineering": "Data Engineering",
    "data_science": "Data Science",
    "ml_engineering": "ML Engineering",
    "analytics": "Analytics",
    "software_engineering": "Software Engineering",
    "infrastructure": "Infrastructure & SRE",
    "security": "Security",
    "product_management": "Product Management",
    "design_ux": "Design & UX",
}

# ── head extraction ──────────────────────────────────────────────────────
# Seniority and scope words that sit in FRONT of the real role noun.
_PREFIX = re.compile(
    r"^(?:(?:senior|sr\.?|staff|principal|distinguished|lead|junior|jr\.?|"
    r"associate|assistant|deputy|global|regional|group|chief|head\s+of|"
    r"director\s+of|vice\s+president\s+of|vp\s+of|apprentice|intern(?:ship)?)\s+)+",
    re.I)
# Everything from the first of these onward describes the TEAM, not the role.
_TAIL = re.compile(r"\s+[-–—|/:]\s+|\s*[,(\[]|\s+\bfor\b\s+|\s+\bat\b\s+", re.I)
# Trailing level markers: "Engineer II", "Engineer 2", "Engineer (L5)".
_LEVEL_SUFFIX = re.compile(r"\s+(?:[ivx]{1,4}|\d{1,2}|l\d{1,2})\s*$", re.I)

# Heads too generic to classify on their own — fall back to the full title.
_GENERIC_HEAD = {
    "engineer", "manager", "analyst", "architect", "specialist", "consultant",
    "developer", "scientist", "designer", "researcher", "lead", "director",
    "associate", "intern", "expert", "technician", "coordinator", "advisor",
    "", "staff", "senior", "principal",
}


def role_head(title: str) -> str:
    """The role noun, stripped of seniority and team qualifiers."""
    t = (title or "").strip()
    if not t:
        return ""
    t = _PREFIX.sub("", t)
    t = _TAIL.split(t)[0]
    t = _LEVEL_SUFFIX.sub("", t)
    return re.sub(r"\s+", " ", t).strip().lower()


# ── the families ─────────────────────────────────────────────────────────
# (family, include, veto). Order matters: specific before general, so that
# "ML Engineer" lands in ml_engineering rather than software_engineering.
_RULES: tuple[tuple[str, str, str], ...] = (
    ("sales_engineering",
     r"\b(sales engineer|solutions? engineer|solutions? architect|sales architect|"
     r"pre[- ]?sales|field engineer(?:ing)?|field cto|forward[- ]deployed|deployment strateg|"
     r"customer engineer|technical account|partner engineer|developer advocate|"
     r"evangelist|implementation consultant|professional services)\b", r"(?!)"),

    ("go_to_market",
     r"\b(account executive|account manager|account director|sales|seller|quota|"
     r"business development|\bbdr\b|\bsdr\b|partner manager|partnerships|channel|"
     r"revenue operations|\brevops\b|customer success|renewals|procurement)\b", r"(?!)"),

    ("marketing_comms",
     r"\b(marketing|brand|communications|public relations|copywriter|content strateg|"
     r"content marketing|social media|community manager|events?|demand generation|"
     r"growth marketing|seo)\b", r"(?!)"),

    ("people_ops",
     r"\b(recruit|talent acquisition|talent partner|sourcer|people partner|people operations|"
     r"human resources|\bhr\b|payroll|benefits|compensation|workplace|facilities|"
     r"office manager|executive assistant)\b", r"(?!)"),

    ("support_ops",
     r"\b(customer support|technical support|support specialist|support engineer|"
     r"service desk|help desk|escalation)\b", r"(?!)"),

    ("finance_legal_ops",
     r"\b(counsel|attorney|paralegal|legal|accountant|accounting|accounts payable|"
     r"bookkeep|treasury|tax\b|audit|controller|financial planning|\bfp&a\b|"
     r"procure|supply chain|logistics|warehouse)\b", r"(?!)"),

    ("data_engineering",
     r"\b(data engineer|analytics engineer|data platform|data infrastructure|"
     r"data warehouse|data pipeline|data architect|etl engineer|elt engineer|"
     r"database engineer|data reliability|data quality engineer|streaming engineer)\b",
     r"\b(sales engineer|solutions? (?:engineer|architect)|account executive)\b"),

    ("ml_engineering",
     r"\b(machine learning engineer|ml engineer|ml platform|ml infrastructure|mlops|"
     r"ai engineer|ai infrastructure|inference engineer|model engineer|"
     r"deep learning engineer|llm engineer)\b",
     r"\b(sales engineer|solutions? (?:engineer|architect)|account executive|"
     r"forward[- ]deployed|deployment strateg)\b"),

    ("data_science",
     r"\b(data scientist|applied scientist|research scientist|machine learning scientist|"
     r"research engineer|quantitative researcher|decision scientist)\b",
     r"\b(sales engineer|account executive|forward[- ]deployed)\b"),

    ("analytics",
     r"\b(data analyst|business analyst|business intelligence|\bbi\b|analytics manager|"
     r"analytics lead|insights analyst|reporting analyst|quantitative analyst|"
     r"statistician|econometric)\b",
     r"\b(sales engineer|solutions? (?:engineer|architect)|account executive)\b"),

    ("security",
     r"\b(security|cyber|appsec|infosec|threat|vulnerabilit|penetration test|red team|"
     r"blue team|detection engineer|incident response|cryptograph|trust (?:and|&) safety|"
     r"fraud|abuse|privacy engineer|compliance engineer|\bgrc\b)\b",
     r"\b(sales engineer|solutions? (?:engineer|architect)|account executive|"
     r"security guard|security officer)\b"),

    ("infrastructure",
     r"\b(infrastructure|platform engineer|site reliability|\bsre\b|devops|"
     r"cloud engineer|cloud architect|kubernetes|network engineer|systems engineer|"
     r"observability|capacity|datacenter|data cent(?:er|re)|release engineer|"
     r"build engineer|developer productivity|developer experience)\b",
     r"\b(sales engineer|solutions? (?:engineer|architect)|account executive|"
     r"mechanical|electrical|facilities|hvac)\b"),

    ("product_management",
     r"\b(product manager|product owner|product lead|product director|"
     r"technical program manager|program manager|product operations|product strateg)\b",
     r"\b(sales engineer|account executive|marketing manager|partner manager)\b"),

    ("design_ux",
     r"\b(product designer|ux designer|ui designer|user experience|user researcher|"
     r"ux research|interaction designer|visual designer|design system|content designer|"
     r"design lead|design manager|\bux\b)\b",
     r"\b(sales engineer|account executive|marketing manager)\b"),

    ("software_engineering",
     r"\b(software engineer|software development engineer|software developer|"
     r"back[- ]?end|front[- ]?end|full[- ]?stack|mobile engineer|ios engineer|"
     r"android engineer|web engineer|api engineer|systems programmer|compiler|"
     r"firmware|embedded engineer|game(?:play)? (?:engineer|programmer)|"
     r"\bsdet\b|qa engineer|test engineer|quality engineer|automation engineer|"
     r"software architect|engineering manager|technical lead)\b",
     r"\b(sales engineer|solutions? engineer|solutions? architect|pre[- ]?sales|"
     r"account|forward[- ]deployed|customer engineer|field engineer|"
     r"deployment strateg|recruit|marketing)\b"),
)

_COMPILED = tuple((fam, re.compile(inc, re.I), re.compile(veto, re.I))
                  for fam, inc, veto in _RULES)

# Out of scope however worded. Checked against the FULL title only — a
# description mentioning "sales" in passing must not disqualify an engineer.
_HARD_EXCLUDE = re.compile(
    r"\b(account executive|account manager|sales|seller|quota carrying|"
    r"business development representative|\bbdr\b|\bsdr\b|"
    r"recruiter|recruiting|talent acquisition|sourcer|"
    r"copywriter|social media|public relations|"
    r"executive assistant|office manager|receptionist|"
    r"general counsel|attorney|paralegal|"
    r"accounts payable|payroll|bookkeep|"
    r"janitor|custodian|barista|chef|driver|warehouse associate|"
    r"electrician|plumber|hvac|mechanic\b|car repair|"
    r"nurse|physician|therapist)\b", re.I)

# Skills that evidence real data-engineering work, for adjacency tests.
ADJACENCY_EVIDENCE = {
    "data_engineering": {"spark", "kafka", "airflow", "dbt", "snowflake", "bigquery",
                         "redshift", "etl", "elt", "data modeling", "flink", "databricks"},
    "ml_engineering": {"pytorch", "tensorflow", "llm", "nlp", "machine learning",
                       "deep learning", "computer vision"},
    "analytics": {"sql", "tableau", "looker", "power bi", "experimentation", "a/b testing"},
}

# query family -> {adjacent family: (penalty, evidence_family, min_hits)}
ADJACENCY = {
    "data_engineering": {
        "software_engineering": (0.55, "data_engineering", 2),
        "analytics": (0.65, "data_engineering", 1),
        "ml_engineering": (0.65, "data_engineering", 1),
    },
    "ml_engineering": {
        "data_science": (0.70, "ml_engineering", 1),
        "software_engineering": (0.55, "ml_engineering", 2),
    },
    "data_science": {"ml_engineering": (0.70, "ml_engineering", 1)},
    "analytics": {"data_engineering": (0.65, "analytics", 1)},
    "infrastructure": {"software_engineering": (0.55, None, 0)},
    "software_engineering": {"infrastructure": (0.60, None, 0)},
    # design_ux, security and product_management have NO adjacency on purpose:
    # the brief is explicit that a UX query must not surface engineering.
}


def classify(title: str, department: str = "", description: str = "") -> tuple[str, str]:
    """Return (family, provenance) where provenance is head | title | context | none."""
    full = (title or "").strip()
    if not full:
        return "other", "none"
    if _HARD_EXCLUDE.search(full):
        return "other", "head"

    head = role_head(full)
    if head and head not in _GENERIC_HEAD:
        for fam, inc, veto in _COMPILED:
            if inc.search(head) and not veto.search(full):
                return fam, "head"

    for fam, inc, veto in _COMPILED:
        if inc.search(full) and not veto.search(full):
            return fam, "title"

    context = f"{department or ''} {(description or '')[:400]}"
    if context.strip():
        for fam, inc, veto in _COMPILED:
            if inc.search(context) and not veto.search(full):
                return fam, "context"
    return "other", "none"


def is_published(family: str) -> bool:
    return family in TARGET_FAMILIES

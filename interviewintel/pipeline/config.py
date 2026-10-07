"""Vocabularies, thresholds and paths. One place, so every stage agrees.

Nothing in here is a number shown to a visitor: thresholds decide what the
pipeline does, and the pages compute every count from the published data.
"""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

# --- where things live -------------------------------------------------------
# The ledger is the interview database: every canonical question and every
# report of it, whatever its review status. It is committed, so `git log`
# is the audit trail, but it is not a page and robots.txt disallows it.
DATA_DIR = ROOT / "interviewintel" / "data"
LEDGER = DATA_DIR / "ledger.json"
SEEN = DATA_DIR / "seen.json"          # every URL ever processed, and its outcome
HEALTH = DATA_DIR / "health.json"      # what the last run did (provider, budgets, errors)
DECISIONS_DIR = ROOT / "interviewintel" / "decisions"

# What the browser reads. PUBLIC holds approved material only.
PUBLIC_DIR = ROOT / "interview.app" / "reported" / "data"
ADMIN_QUEUE = ROOT / "admin" / "interview-discovery" / "queue.json"

# The existing 1,500-question bank: used only to say "this is already in the
# bank", never merged into or edited.
BANK = ROOT / "interview" / "data" / "questions.json"

# --- classification (brief §2) ----------------------------------------------
CLASSES = {
    "A": "first_person_experience",
    "B": "question_list",
    "C": "generic_advice",
    "D": "promotional",
    "E": "duplicate",
    "F": "irrelevant",
}
EXTRACT_CLASSES = {"A", "B"}          # D only when it states specific questions

# --- categories (brief §3) ----------------------------------------------------
CATEGORIES = [
    "Coding", "Algorithms", "Data Structures", "SQL", "Python", "Java",
    "JavaScript", "System Design", "Data Engineering", "Machine Learning",
    "AI / GenAI", "Statistics", "Analytics", "Cybersecurity", "Cloud",
    "Databases", "Product Management", "Product Analytics", "Behavioral",
    "Case Study", "Architecture",
]
DIFFICULTIES = ["Easy", "Medium", "Hard"]
STAGES = [
    "Recruiter Screen", "Online Assessment", "Technical Screen", "Onsite",
    "Hiring Manager", "Take-home", "Final Round",
]
QUESTION_TYPES = {
    "reported": "Reported in an interview",
    "listed": "From a public question list",
}

# --- companies (brief §6). Aliases are matched case-insensitively, as words.
COMPANIES = {
    "google": ("Google", ["google", "alphabet", "google deepmind", "deepmind"]),
    "amazon": ("Amazon", ["amazon", "aws", "amazon web services"]),
    "meta": ("Meta", ["meta", "facebook", "instagram", "whatsapp"]),
    "microsoft": ("Microsoft", ["microsoft", "msft", "linkedin corporation"]),
    "apple": ("Apple", ["apple"]),
    "netflix": ("Netflix", ["netflix"]),
    "openai": ("OpenAI", ["openai", "open ai"]),
    "anthropic": ("Anthropic", ["anthropic"]),
    "nvidia": ("NVIDIA", ["nvidia"]),
    "salesforce": ("Salesforce", ["salesforce"]),
    "uber": ("Uber", ["uber"]),
    "airbnb": ("Airbnb", ["airbnb"]),
    "stripe": ("Stripe", ["stripe"]),
    "databricks": ("Databricks", ["databricks"]),
    "snowflake": ("Snowflake", ["snowflake"]),
}
# The fifteen above always get a page, even an empty one. A company outside
# the list is still recorded when a report names it; it gets a page once it
# has an approved report.
FEATURED_COMPANIES = list(COMPANIES)

ROLES = {
    "software-engineer": ("Software Engineer", ["software engineer", "swe", "software developer", "sde", "backend engineer", "frontend engineer", "full stack engineer", "full-stack engineer"]),
    "data-engineer": ("Data Engineer", ["data engineer", "analytics engineer", "big data engineer", "etl developer"]),
    "data-scientist": ("Data Scientist", ["data scientist", "applied scientist", "research scientist"]),
    "data-analyst": ("Data Analyst", ["data analyst", "business analyst", "product analyst", "bi analyst", "business intelligence engineer", "bie"]),
    "ml-engineer": ("ML Engineer", ["machine learning engineer", "ml engineer", "mle", "ai engineer", "applied ai engineer"]),
    "product-manager": ("Product Manager", ["product manager", "pm", "technical program manager", "tpm", "program manager"]),
    "security-engineer": ("Security Engineer", ["security engineer", "cybersecurity", "security analyst", "appsec engineer"]),
    "sre": ("SRE / DevOps", ["site reliability engineer", "sre", "devops engineer", "platform engineer", "cloud engineer"]),
    "engineering-manager": ("Engineering Manager", ["engineering manager", "em"]),
}

TECHNOLOGIES = [
    "SQL", "Python", "Java", "JavaScript", "TypeScript", "Go", "Scala", "C++",
    "Spark", "Kafka", "Airflow", "dbt", "Snowflake", "Databricks", "BigQuery",
    "Redshift", "PostgreSQL", "MySQL", "MongoDB", "Cassandra", "Redis",
    "AWS", "GCP", "Azure", "Kubernetes", "Docker", "Terraform",
    "pandas", "NumPy", "PyTorch", "TensorFlow", "scikit-learn",
    "LLM", "RAG", "Tableau", "Power BI", "Excel", "Git", "Linux",
]

# --- confidence (brief §8) ---------------------------------------------------
BAND_PUBLISHABLE = 90       # 90–100: clear experience and explicit question
BAND_STRONG = 70            # 70–89: strong evidence, some metadata missing
BAND_REVIEW = 50            # 50–69: possible, needs review
                            # < 50: never published automatically
# Optional, later (brief §9): auto-approve reports at or above this score that
# have no flags and no possible duplicates. None = everything waits for a person.
AUTO_PUBLISH_MIN_CONFIDENCE: int | None = None
DROP_BELOW = 30             # below this a report is not even queued

# --- deduplication (brief §7) ------------------------------------------------
SIM_SAME = 0.86             # at or above (same category): one canonical question
SIM_MAYBE = 0.55            # between: ask the model, else show as a possible duplicate

# --- freshness (brief §13) ---------------------------------------------------
RECENT_DAYS = 90
RECURRING_MIN_REPORTS = 3
RECURRING_MIN_SPAN_DAYS = 90
RECURRING_MAX_AGE_DAYS = 365

# --- intelligence (brief §12) ------------------------------------------------
MIN_REPORTS_FOR_PERCENT = 20   # below this a company page shows counts, never %
TREND_WINDOWS = (7, 30, 90)
TREND_MIN_COUNT = 2            # a topic needs this many reports in the window to trend

# --- per-run budgets (cost control) -------------------------------------------
# Sources are free. The only cost is the Claude calls on the existing key, so
# each run is capped and each URL is read by the model once, ever (seen.json).
# At these caps a weekly run on Haiku costs cents; see docs/INTERVIEW-INTEL.md.
MAX_CLASSIFY = 30
MAX_EXTRACT = 15
MAX_ADJUDICATE = 10
MAX_ENRICH = 10
MAX_HTTP = 60                  # requests to free APIs and feeds per run
MAX_QUERIES = 24               # only if an optional paid search API is switched on
RESULTS_PER_QUERY = 10
SOURCE_TEXT_LIMIT = 4000       # characters of source text sent to the model
EVIDENCE_LIMIT = 200           # characters of a source we keep as evidence, at most
COPY_RUN_LIMIT = 10            # a practice question may not share a run of more words than this with its source

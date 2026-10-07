"""The query planner (brief §1).

Builds the full, deterministic list of searches and hands each run a rotating
window of it, so every combination is visited over successive runs without
any one run spending more than MAX_QUERIES.

A query is data, not a string: `site` is kept apart from the words so that a
provider with a domain filter (Exa, Tavily) uses the filter, and one without
(Brave, Google) gets a `site:` operator. LinkedIn is one source among several.
"""
from __future__ import annotations

import datetime as _dt
import random
from dataclasses import dataclass, field

from . import config


@dataclass(frozen=True)
class Query:
    text: str                       # the words, without any site: operator
    site: str | None = None         # e.g. "linkedin.com/posts"
    recency_days: int = 90
    facets: tuple = field(default_factory=tuple)   # (kind, value) pairs, for the run log

    def as_operator_string(self) -> str:
        return f"site:{self.site} {self.text}" if self.site else self.text


LI = "linkedin.com/posts"

# The searches the brief names, verbatim apart from the site: operator.
LINKEDIN = [
    '"technical interview" "questions"',
    '"interview experience" software engineer',
    '"interview questions" data engineer',
    '"interview questions" data scientist',
    '"interview questions" product manager',
    '"interview experience" Amazon',
    '"interview experience" Google',
    '"interview experience" Meta',
    '"interview experience" Microsoft',
    "SQL interview questions",
    "Python interview questions",
    "system design interview",
    "machine learning interview",
    "cybersecurity interview",
    "data engineering interview",
    "product analytics interview",
]

# The broader public web: first-person experiences.
WEB_FIRST_PERSON = [
    '"my interview" "data engineer" questions asked',
    '"I was asked" interview SQL',
    '"I was asked" "system design" interview',
    '"interview experience" "data scientist" onsite',
    '"interview experience" "machine learning engineer"',
    '"interview experience" "product manager" case',
]

ROLE_WORDS = {
    "software-engineer": "software engineer",
    "data-engineer": "data engineer",
    "data-scientist": "data scientist",
    "data-analyst": "data analyst",
    "ml-engineer": "machine learning engineer",
    "product-manager": "product manager",
}
# The topic a role is most often probed on, for the COMPANY × ROLE × TECH rotation.
ROLE_TOPICS = {
    "software-engineer": ["system design", "coding", "algorithms"],
    "data-engineer": ["SQL", "data modeling", "Spark", "pipeline design"],
    "data-scientist": ["statistics", "experimentation", "machine learning", "SQL"],
    "data-analyst": ["SQL", "product analytics", "metrics"],
    "ml-engineer": ["machine learning system design", "LLM", "RAG"],
    "product-manager": ["product sense", "product analytics", "case study"],
}
INTERVIEW_TYPES = ["interview experience", "technical screen", "onsite interview"]


def all_queries(today: _dt.date) -> list[Query]:
    """Every planned search, in a stable order."""
    year = today.year
    out: list[Query] = [Query(t, LI, 30, (("source", "linkedin"),)) for t in LINKEDIN]
    out += [Query(t, None, 90, (("source", "web"),)) for t in WEB_FIRST_PERSON]
    for slug in config.FEATURED_COMPANIES:
        company = config.COMPANIES[slug][0]
        for role, words in ROLE_WORDS.items():
            out.append(Query(f'"{company}" {words} "interview experience" {year}', None, 120,
                             (("company", slug), ("role", role), ("type", "experience"), ("date", str(year)))))
            for topic in ROLE_TOPICS[role]:
                out.append(Query(f'{company} {words} interview {topic}', None, 120,
                                 (("company", slug), ("role", role), ("technology", topic))))
            for kind in INTERVIEW_TYPES[1:]:
                out.append(Query(f'{company} {words} {kind} questions', None, 120,
                                 (("company", slug), ("role", role), ("type", kind))))
    return out


def plan(today: _dt.date, budget: int = config.MAX_QUERIES) -> list[Query]:
    """This run's window: the LinkedIn and first-person searches every run
    (they are few and the freshest), the combinations in rotation."""
    every = all_queries(today)
    fixed = [q for q in every if not any(k == "company" for k, _ in q.facets)]
    rotating = [q for q in every if q not in fixed]
    # A fixed shuffle, so one run spans several companies and roles rather
    # than twelve searches about one company, and the cycle still visits all.
    random.Random(1527).shuffle(rotating)
    fixed_share = fixed[: max(0, budget // 2)]
    room = budget - len(fixed_share)
    if room <= 0 or not rotating:
        return fixed_share[:budget]
    start = (today.toordinal() * room) % len(rotating)
    window = [rotating[(start + i) % len(rotating)] for i in range(min(room, len(rotating)))]
    # The fixed list is longer than half the budget, so it rotates too.
    if len(fixed) > len(fixed_share):
        offset = today.toordinal() % len(fixed)
        fixed_share = [fixed[(offset + i) % len(fixed)] for i in range(len(fixed_share))]
    return fixed_share + window

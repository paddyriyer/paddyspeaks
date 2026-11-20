"""Classify a job posting into the career taxonomy in roles.json.

All judgement about what a posting IS lives here, in Python, and ships as data:
the jobs page only formats and filters (the same rule JobSignal follows).
Stdlib only.

    from interview.careers.classify import Taxonomy
    tax = Taxonomy.load()
    tax.classify("Senior Technical Program Manager, AI Safety")
    # -> {"role": "ai_tpm", "family": "technical_program",
    #     "families": ["technical_program", "ai_product"], "seniority": "senior"}
"""
from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROLES = HERE / "roles.json"

# JobSignal's experience_level vocabulary → ours. Used only when the title
# itself says nothing about level.
EXPERIENCE_MAP = {
    "internship": "entry",
    "entry": "entry",
    "mid": "mid",
    "senior": "senior",
    "director_plus": "director",
}
WORKPLACE = {"remote": "remote", "hybrid": "hybrid", "onsite": "onsite", "on-site": "onsite"}
EMPLOYMENT = {"full_time": "full_time", "part_time": "part_time", "contract": "contract",
              "internship": "internship", "temporary": "contract"}


def _norm(title: str) -> str:
    t = (title or "").lower()
    t = t.replace("–", "-").replace("—", "-").replace("|", ",")
    return re.sub(r"\s+", " ", t).strip()


class Taxonomy:
    def __init__(self, data: dict):
        self.data = data
        self.families = {f["id"]: f for f in data["families"]}
        self.roles = {r["id"]: r for r in data["roles"]}
        self.seniority_ids = [s["id"] for s in data["seniority"]]
        self._role_res = [(r["id"], [re.compile(p, re.I) for p in r["title_patterns"]],
                           [re.compile(p, re.I) for p in r.get("exclude_patterns", [])])
                          for r in data["roles"]]
        self._exclude = [re.compile(p, re.I) for p in data.get("exclude_title_patterns", [])]
        self._sen_res = [(s["level"], re.compile(s["pattern"], re.I)) for s in data["seniority_patterns"]]
        self._tags = [(t["family"], set(t["from"]), re.compile(t["pattern"], re.I))
                      for t in data.get("family_tags", [])]

    @classmethod
    @lru_cache(maxsize=1)
    def load(cls, path: str = str(ROLES)) -> "Taxonomy":
        return cls(json.loads(Path(path).read_text(encoding="utf-8")))

    def role_for(self, title: str) -> str | None:
        t = _norm(title)
        if any(p.search(t) for p in self._exclude):
            return None
        for rid, pats, excl in self._role_res:
            if any(p.search(t) for p in pats) and not any(x.search(t) for x in excl):
                return rid
        return None

    def seniority_for(self, title: str, role: str | None = None, experience: str | None = None) -> str:
        t = _norm(title)
        for level, pat in self._sen_res:
            if pat.search(t):
                return level
        mapped = EXPERIENCE_MAP.get((experience or "").lower())
        if mapped:
            return mapped
        if role and role in self.roles:
            return self.roles[role]["level"]
        return "mid"

    def families_for(self, title: str, role: str) -> list[str]:
        primary = self.roles[role]["family"]
        out = [primary]
        t = _norm(title)
        for fam, src, pat in self._tags:
            if primary in src and fam not in out and pat.search(t):
                out.append(fam)
        return out

    def classify(self, title: str, experience: str | None = None) -> dict | None:
        role = self.role_for(title)
        if role is None:
            return None
        return {
            "role": role,
            "family": self.roles[role]["family"],
            "families": self.families_for(title, role),
            "seniority": self.seniority_for(title, role, experience),
        }


def workplace(value: str | None, location: str | None = None) -> str:
    v = WORKPLACE.get((value or "").lower())
    if v:
        return v
    loc = (location or "").lower()
    if "remote" in loc:
        return "remote"
    if "hybrid" in loc:
        return "hybrid"
    return "unknown"


def employment(value: str | None, title: str = "") -> str:
    v = EMPLOYMENT.get((value or "").lower())
    if v:
        return v
    if re.search(r"\b(intern|internship|werkstudent|gyakornok)\b", title or "", re.I):
        return "internship"
    if re.search(r"\b(contract|contractor|temporary)\b", title or "", re.I):
        return "contract"
    return "unknown"


_BOILER = re.compile(r"\b(equal opportunity|we are an equal|accommodation|privacy notice|benefits include|"
                     r"compensation|salary range|pay range|e-verify|background check)\b", re.I)
_ROLE_CUE = re.compile(r"\b(you will|you['’]ll|in this role|this role|the role|as an? |your responsibilities|"
                       r"what you['’]ll do|about the role|you['’]re joining|you will join)\b", re.I)
_HIRING_CUE = re.compile(r"\b(we['’]re looking for|we are looking for|we are hiring|we['’]re hiring|"
                         r"looking for an? |seeking an? )", re.I)
_COMPANY_CUE = re.compile(r"\b(our mission|mission is|founded in|world['’]s (largest|leading)|fortune 500|"
                          r"we are building an|leading provider|millions of|is the key to|"
                          r"backed by|series [a-e]\b|unicorn)", re.I)
# A summary never names a person: sentences about whom the role reports to are dropped.
_PERSON_CUE = re.compile(r"\b(report(s|ing)? (in)?to|reporting line|hiring manager)\b", re.I)


def _sentences(p: str) -> list[str]:
    return [x.strip() for x in re.split(r"(?<=[.!?])\s+(?=[A-Z“\"‘'])", p) if x.strip()]


def summarise(description: str | None, title: str = "", limit: int = 260) -> str:
    """A short, verbatim excerpt that says what the job is.

    Scores paragraphs: talking about the role scores up, talking about the
    company scores down. Never paraphrases (nothing here is invented) and
    never keeps a sentence that names whom the role reports to.
    """
    if not description:
        return ""
    text = re.sub(r"<[^>]+>", " ", description)
    paras = [re.sub(r"^[•·*\-–]+\s*", "", re.sub(r"\s+", " ", p).strip()) for p in re.split(r"\n\s*\n|\n", text)]
    paras = [p for p in paras if len(p) >= 60 and not _BOILER.search(p)]
    if not paras:
        return ""
    words = [w for w in re.findall(r"[a-z]+", (title or "").lower()) if len(w) > 2][:3]

    def score(i_p):
        i, p = i_p
        low = p.lower()
        s = 0
        if words and sum(w in low for w in words) >= min(2, len(words)):
            s += 3
        if _ROLE_CUE.search(p):
            s += 2
        if _HIRING_CUE.search(p):
            s += 1
        if _COMPANY_CUE.search(p):
            s -= 3
        return (s, -i)

    best = max(enumerate(paras), key=score)
    if score(best)[0] <= 0:
        return ""
    sents = [x for x in _sentences(best[1]) if not _PERSON_CUE.search(x)]
    out = ""
    for x in sents:
        if len(out) + len(x) + 1 > limit:
            break
        out = (out + " " + x).strip()
    if out:
        return out
    if not sents:
        return ""
    cut = sents[0][:limit]
    return cut[: cut.rfind(" ")].rstrip(",;:") + "…"

"""The rules around the classifier (brief §2, §14).

`prefilter` rejects the obvious before any money is spent on a model call:
job postings and recruiting advertisements, and pages that are mostly
contact details. `should_extract` turns the classifier's verdict into the
decision: A and B are extracted; D only when it states specific questions
(brief §14); C, F never. Spam and recruiting ads never, whatever the class.
"""
from __future__ import annotations

import re

RECRUITING = re.compile(
    r"\b(we(?:'| a)re hiring|now hiring|apply now|join our team|open positions?|job opening|"
    r"send (?:your|me your) (?:cv|resume)|dm me (?:for|your) (?:referral|resume|cv)|"
    r"referral available|salary range|years of experience required|#hiring|immediate joiners?)\b",
    re.I)
SALES = re.compile(r"\b(enroll now|use (?:my )?code|discount|limited seats|buy now|book a call|"
                   r"link in (?:bio|comments)|comment ['\"]?\w+['\"]? (?:below )?(?:to|and i'll)|"
                   r"free pdf|download the pdf)\b", re.I)
QUESTIONISH = re.compile(r"\?|\b(asked|question|write a|design a|how would you|explain)\b", re.I)
# Free sources are broad (every Stack Overflow post that says "interview"), so
# a page must be about an interview before a model is paid to read it.
INTERVIEWISH = re.compile(r"\b(interview(?:ed|er|ers|s|ing)?|onsite|on-site|phone screen|technical screen|"
                          r"hiring loop|interview loop|coding round|system design round)\b", re.I)


def prefilter(title: str, text: str) -> str | None:
    blob = f"{title}\n{text}"
    hits = len(RECRUITING.findall(blob))
    if hits >= 2 and not re.search(r"\binterview (?:experience|questions?)\b", blob, re.I):
        return "recruiting advertisement"
    if not QUESTIONISH.search(blob):
        return "no question or interview account in the text"
    if not INTERVIEWISH.search(blob):
        return "not about an interview"
    removed = blob.count("[email removed]") + blob.count("[number removed]")
    if removed >= 3:
        return "mostly contact details"
    return None


def looks_like_sales(text: str) -> bool:
    return len(SALES.findall(text)) >= 2


def should_extract(cls: dict) -> str | None:
    """None to extract; otherwise the reason not to."""
    c = cls.get("class")
    if cls.get("spam"):
        return "spam"
    if cls.get("recruiting_ad"):
        return "recruiting advertisement"
    if c in ("A", "B"):
        return None
    if c == "D":
        return None if cls.get("states_specific_questions") else "promotional, states no specific questions"
    if c == "C":
        return "generic advice"
    return "irrelevant"

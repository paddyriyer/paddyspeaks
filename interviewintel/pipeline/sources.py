"""Source filter (brief §14, §15): what may enter the pipeline, and in what shape.

* URLs are canonicalised (tracking parameters and fragments removed) so the
  same post found by two searches is one source.
* Some domains are never a source: job boards, review sites behind a login,
  and anything we would have to sign in to read.
* Personal data is scrubbed from every piece of text we keep: email
  addresses, phone numbers, @handles and links. Titles of social posts carry
  the author's name, so a social post's title is replaced with a neutral one.
"""
from __future__ import annotations

import hashlib
import re
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

TRACKING = re.compile(r"^(utm_|fbclid|gclid|mc_|ref$|refId|trk|trackingId|lipi|rcm|originalSubdomain|source$)", re.I)

# Never a source of interview knowledge for us. Reasons are documented in
# docs/INTERVIEW-INTEL.md §Sources.
BLOCKED_DOMAINS = {
    "glassdoor.com": "content requires sign-in; terms forbid automated collection",
    "teamblind.com": "content requires sign-in",
    "indeed.com": "job board, not interview reports",
    "ziprecruiter.com": "job board, not interview reports",
    "linkedin.com/jobs": "job listings, not interview reports",
    "linkedin.com/in": "a personal profile, never a source",
    "facebook.com": "requires sign-in",
    "instagram.com": "requires sign-in",
    "x.com": "requires sign-in",
    "twitter.com": "requires sign-in",
}

SOURCE_TYPES = {
    "community": "Submitted to PaddySpeaks by a candidate",
    "linkedin_post": "Public LinkedIn post",
    "forum": "Public forum thread",
    "blog": "Blog or article",
    "qa_site": "Q&A site",
    "video": "Video description",
    "other": "Public web page",
}

_FORUMS = ("reddit.com", "news.ycombinator.com", "leetcode.com/discuss", "stackexchange.com", "discuss.")
_QA = ("stackoverflow.com", "stackexchange.com", "quora.com")
_BLOGS = ("medium.com", "dev.to", "hashnode", "substack.com", "blogspot.", "wordpress.", "github.io", "/blog")


def canonical_url(url: str) -> str:
    try:
        p = urlsplit(url.strip())
    except ValueError:
        return ""
    if p.scheme not in ("http", "https") or not p.netloc:
        return ""
    host = p.netloc.lower()
    if host.startswith("www."):
        host = host[4:]
    if host.endswith(".linkedin.com"):          # in.linkedin.com, uk.linkedin.com …
        host = "linkedin.com"
    query = urlencode([(k, v) for k, v in parse_qsl(p.query) if not TRACKING.match(k)])
    path = p.path.rstrip("/") or "/"
    return urlunsplit(("https", host, path, query, ""))


def blocked_reason(url: str) -> str | None:
    p = urlsplit(url)
    hostpath = (p.netloc + p.path).lower()
    for dom, why in BLOCKED_DOMAINS.items():
        d_host = dom.split("/")[0]
        if p.netloc == d_host or p.netloc.endswith("." + d_host):
            if "/" not in dom or hostpath.startswith(dom):
                return why
    return None


def source_type(url: str) -> str:
    p = urlsplit(url)
    hp = (p.netloc + p.path).lower()
    if hp.startswith("paddyspeaks.com/interview.app/submit"):
        return "community"
    if p.netloc.endswith("linkedin.com") and ("/posts/" in p.path or "/pulse/" in p.path or "/feed/update/" in p.path):
        return "linkedin_post"
    if "youtube.com" in hp or "youtu.be" in hp:
        return "video"
    if any(f in hp for f in _FORUMS):
        return "forum"
    if any(q in hp for q in _QA):
        return "qa_site"
    if any(b in hp for b in _BLOGS):
        return "blog"
    return "other"


# --- personal data ------------------------------------------------------------
EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
PHONE = re.compile(r"(?<!\w)(?:\+?\d[\d\s().-]{7,}\d)(?!\w)")
HANDLE = re.compile(r"(?<![\w.])@[A-Za-z0-9_][A-Za-z0-9_.-]{1,30}")
LINK = re.compile(r"https?://\S+|www\.\S+")


def scrub(text: str) -> str:
    """Remove contact details and links. Years and small numbers survive."""
    if not text:
        return ""
    t = EMAIL.sub("[email removed]", text)
    t = LINK.sub("[link removed]", t)
    t = HANDLE.sub("[handle removed]", t)
    t = PHONE.sub(lambda m: m.group(0) if len(re.sub(r"\D", "", m.group(0))) < 9 else "[number removed]", t)
    return t


def has_personal_data(text: str) -> bool:
    return scrub(text) != (text or "")


def public_title(url: str, title: str) -> str:
    """A title we can show. Social-post titles name their author; we don't."""
    st = source_type(url)
    if st in ("linkedin_post", "community"):
        return SOURCE_TYPES[st]
    t = scrub(re.sub(r"\s+", " ", title or "")).strip()
    # "… | Jane Doe" / "Jane Doe on X: …" — trailing or leading bylines go.
    t = re.sub(r"\s+[|\-–—]\s+[^|\-–—]{2,40}$", "", t) if st in ("forum", "blog") else t
    t = re.sub(r"^[A-Z][\w.'-]+(?: [A-Z][\w.'-]+){0,3} on \w+: ", "", t)
    return t[:140] or SOURCE_TYPES[st]


def fingerprint(text: str) -> str:
    """Near-duplicate key for reposted text: the first 400 normalised characters."""
    norm = re.sub(r"[^a-z0-9]+", " ", (text or "").lower()).strip()[:400]
    return hashlib.sha1(norm.encode()).hexdigest()[:16]


def url_id(url: str) -> str:
    return hashlib.sha1(url.encode()).hexdigest()[:12]
